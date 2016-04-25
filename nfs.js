"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var util = require('util');
var async = require('async');
var User = require('./user.js');
//var SimpleSSH = require('./simplessh.js');
var SimpleSSH = require('./permanentssh.js');
var assert = require('assert');
var spawn = require('child_process').spawn;


//nfs objects in redis:
//sorted set nfs_servers, score is count of sessions use each nfs server
//hashes nfs_server_<index> describe nfs server
//  nfs_ip - ip of nfs to usage on platforms
//  ssh_ip - ip of machine with mounted nfs and can run unison (management) for synchronization
//  ssh_user - linux login allow connection with ssh and can run 'sudo unison'
//  key_path - path to ssh key on current unison machine
function syncFolders(nfs, dst, path, callback) {
    var nfs_target;
    var ssh;
    async.series([
        function(callback) {
            Common.redisClient.HGETALL('nfs_server_' + dst, function(err, result) {
                //nfs.logger.info("HGETALL nfs_server_" + dst + " res: " + result + " err: " + err);
                if (!err) nfs_target = result;
                callback(err);
            });
        },
        function(callback) {
            SimpleSSH({
                    host: nfs_target.ssh_ip,
                    username: nfs_target.ssh_user
                }, {
                    logger: nfs.logger
                },
                function(err, sshobj) {
                    if (err) {
                        nfs.logger.error("nfs.js::syncFolders Cannot get ssh connection")
                    } else {
                        ssh = sshobj;
                    }
                    callback(err);
                }
            );
        },
        // create folder if not exist
        function(callback) {
            var cmd = "sudo mkdir -p " + nfs_target.nfs_path + "/" + path;
            ssh.exec(cmd, function(err, code, signal, sshout) {
                if (err || (code != 0)) {
                    nfs.logger.error("cmd: " + cmd +
                        "\n   err: " + err +
                        "\n   code: " + code +
                        "\n   out: " + sshout);
                }

                callback((err || (code != 0)) ? "cannot create folder" : null);
            });
        },
        //unison
        function(callback) {
            var stderr = null;
            var stdout = null;
            var redisClient = null;
            var localPath = nfs.params.nfs_path + "/" + path;
            var remotePath = "ssh://" + nfs_target.ssh_user + "@" + nfs_target.ssh_ip + "/" + nfs_target.nfs_path + "/" + path;
            var unisonParams = [localPath, remotePath, '-retry', '5', '-silent', '-times', '-force', 'newer', '-batch', '-numericids', '-perms', '-1',
                '-owner', '-group', '-servercmd', 'sudo /usr/bin/unison', '-sshargs', "-i " + nfs.params.key_path
            ];

            var unisonProc = spawn("unison", unisonParams);
            redisClient = setSyncAbort(path, unisonProc, nfs.logger);

            unisonProc.stdout.on('data', function(data) {
                stdout = data.toString().replace(/(\r\n|\n|\r)/gm,"").trim();
            });

            unisonProc.stderr.on('data', function(data) {
                stderr = data.toString().replace(/(\r\n|\n|\r)/gm,"").trim();
            });

            unisonProc.on('error', function(err) {
                nfs.logger.error("syncFolders: lunching unison failed");
                nfs.logger.error("syncFolders: unison params: " + unisonParams.join(' '));
                nfs.logger.error("syncFolders: " + err);
            });

            unisonProc.on('close', function(code) {
                if (redisClient) {
                    redisClient.unsubscribe();
                    redisClient.quit();
                }

                var stdoutMsg = stdout ? "stdout: " + stdout : "";
                var stderrMsg = stderr ? "stderr: " + stderr : "";
                // unison exit codes
                //  0: successful synchronization; everything is up-to-date now.
                //  1: some files were skipped, but all file transfers were successful.
                //  2: non-fatal failures occurred during file transfer.
                //  3: a fatal error occurred, or the execution was interrupted.
                if (code === 0) {
                    callback(null);
                } else if(code === 3 && stdout == 'Terminated!'){
                    nfs.logger.info("syncFolders: syncing aborted");
                    callback("syncing aborted");       
                }
                else{
                    nfs.logger.error("syncFolders: unison exited with code " + code + ". " + stderrMsg + stdoutMsg);
                    callback("sync terminated with code: " + code);                    
                }
            });
        }
    ], function(err) {
        if (err) {
            callback(err);
            return;
        }

        nfs.logger.info("syncFolders: sync done for: " + path);
        callback(null);
    });
}

function setSyncAbort(path, spawnProcess, logger){

    var redisClient = Common.redis.createClient(Common.redisport, Common.redishost);
    var channel = "sync_" + path;
    redisClient.subscribe(channel);
                
    redisClient.on("message", function(channel, message) {
        logger.info("setSyncAbort: aborting sync for: " + path);
        spawnProcess.kill('SIGINT');
        redisClient.unsubscribe();
    });

    return redisClient;
}

var nfs = function (obj, callback) {
    this.params = {};
    var self = this;
//    this.UserName = obj.UserName;

    this.SendSyncAbort = function(path) {
        self.logger.info("SendSyncAbort: " + path);
        var channel = "sync_" + path;
        Common.redisClient.publish(channel, "sync aborted");

        return;
    }

    this.syncFolder = function(path, callback) {
        logger.info("syncFolder: syncing " + path);
        (function (nfsobj) {
            var all_nfs_servers;
            var other_nfs_servers;
            async.series([
                    function(callback) {
                        Common.redisClient.ZRANGE('nfs_servers', 0, -1, function(err, result) {
                            if (err) {
								callback(err);
								return;
                            }

                            all_nfs_servers = result;
                            callback(null);
                        });
                    },
                    function(callback) {
                        async.filter(
                            all_nfs_servers,
                            function(item, callback) {
                                callback(item != nfsobj.nfs_idx);
                            },
                            function(results){
                                other_nfs_servers = results;
                                callback(null);
                            });
                    },
                    function(callback) {
                        async.each(
                            other_nfs_servers,
                            function(item, callback) {
                                //logger.info("syncAll: ", item);
                                syncFolders(nfsobj, item, path, callback);
                            },
                            function(err) {
                                callback(err);
                            }
                        );
                    }
                ], function (err) {
                    if(err){
                        nfsobj.logger.error("syncFolder: " + err);
                        callback(err);
                        return;        
                    }

                    callback(null);
                }
            );
        }) (this); //function (obj)
    };

    this.syncAll = function(pathToSync, callback) {    
           this.syncFolder(pathToSync, callback);
    };

    this.sync = function(session, callback) {
        (function (nfsobj) {
            var re = new RegExp('(.*)@(.*)');
            var m = re.exec(Common.nfsserver);
            if (m[2] == session.params.nfs_ip) {
                callback(null);
            } else {
                syncFolders(nfsobj, m[2], User.getUserHomeFolder(session.params.email), callback);
            }
        })(this);
    }

    this.end = function() {}

    if (obj) {
        (function (nfsobj) {
            nfsobj.logger = obj.logger || Common.logger;
            var logger = nfsobj.logger;
            function initssh(idx, callback) {
                var nfs;
                var ssh;
                async.series([
                        function(callback) {
                            Common.redisClient.HGETALL('nfs_server_'+idx, function(err, result) {
                                if (!err) nfsobj.params = result;
                                if (!result) err = "nfs server does not exist in redis";
                                callback(err);
                            });
                        },
                        function(callback) {
                            var opts = {
                                host: nfsobj.params.ssh_ip,
                                username: nfsobj.params.ssh_user
                            };
                            SimpleSSH(opts, {logger: logger}, function(err, obj) {
                                if (!err) {
                                    nfsobj.ssh = obj;
                                    nfsobj.nfs_ip = nfsobj.params.ssh_ip
                                }
                                callback(err);
                            });
                        }
                    ], function(err) {
                        if (err) logger.info("fail to get nfs, err: " + err);
                        //else logger.info("nfs object initializated");
                        callback (err);
                    }
                );
            }

            var UserName = obj.UserName;
            var session_id;
            var nfs_idx;
            async.series([
                    function(callback) {
                        if(!UserName) return callback(null);
                        Common.redisClient.SRANDMEMBER("usersess_" + UserName, function(err, result) {
                            if (err) {
                                var msg = "Cannot get SRANDMEMBER usersess_" + UserName;
                                logger.info(msg);
                            }
                            //logger.info("SRANDMEMBER usersess_" + UserName + " return err: " + err + "; res: " + result);
                            session_id = result;
                            callback(null);
                        });
                    },
                    // If exist session of same user, use in same nfs to keep same sdcard storage, esle take nfs with least connections
                    function(callback) {
                        if (session_id) {
                            Common.redisClient.HGET("sess_" + session_id, "nfs_idx", function (err, result) {
                                if (err) {
                                    var msg = "Cannot get HGET sess_" + session_id + " nfs_idx";
                                    logger.info(msg);
                                }
                                //logger.info("HGET sess_" + UserName + " return err: " + err + "; res: " + result);
                                nfs_idx = result;
                                callback(err);
                            });
                        } else if (typeof obj.nfs_idx === 'number') {
                            nfs_idx = obj.nfs_idx;
                            callback(null);
                        } else {
                            Common.redisClient.ZRANGE('nfs_servers',0,0,function(err,replies) {
                                var msg = null;
                                if (err || replies.length<1) {
                                    msg = err || "No nfs servers in redis";
                                    logger.error(msg);
                                }
                                logger.info("NFS: "+ replies[0]);
                                nfs_idx = replies[0];
                                callback(msg);
                            });
                        }
                    },
                ], function(err) {
                    if (err) {
                        logger.info("Cannot create nfs object, err:" + err);
                        callback(err);
                    }
                    else initssh(nfs_idx, function(err) {
                        nfsobj.nfs_idx = nfs_idx;
                        callback(err, nfsobj);
                    });
                }
            );
        }) (this);
    } else {
        var msg = "Could not create nfs. null obj";
        logger.error(msg);
        callback(msg, null);
    }
};

module.exports = function(obj, callback) {
    new nfs(obj, callback);
};

