"use strict";

require('date-utils');
var Common = require('./common.js');
var logger = Common.logger;
var Login = require('./login.js');
var async = require('async');
var platformModule = require('./platform.js');
var Platform = platformModule.Platform;
var sessionModule = require('./session.js');
var Session = sessionModule.Session;
var TimeLog = require('./timeLog.js').TimeLog;
var ThreadedLogger = require('./ThreadedLogger.js');
var User = require('./user.js');
var exec = require('child_process').exec;
var Track = require('./track.js');
var mount = require('./mount.js');
var syncFolders = require('./syncFolders.js');
var gatewayModule = require('./Gateway.js');
var deleteAppModule = require('./deleteAppFromProfiles.js');
var addAppModule = require('./addAppsToProfiles.js');
var uninstallFunc = deleteAppModule.uninstallAPKForUserOnPlatforms;
var firewall = require('./firewall.js');
var nfsModule = require('./nfs.js');
var EWSSubscription = require('./EWSSubscription.js');
var MediaStream = require('./mediaStream.js');
var Lock = require('./lock.js');

var default_keys = {
    ecryptfs_password: "nubo",
    ecryptfs_key: "ecryptfs user:mykey 64 6d4edd1d1ed408ce163f1bd8acfc78c3001ae9a3e542e7faf1eafeb9a8eb9cd63df8e5179f4a87819d45510e972623fadb1c41f1fe3a73fc50abe98033c08bee6db6ae60f1b6c53adc30f078d3e86a6d19b1fdd8c000d4c57bbdb351228d934ac5d5272072b91f168e14921a1174416566"
};

var StartSession = {
    func: startSession,
    endSession: endSession
};

module.exports = StartSession;

function sendEmailToAdmin(subj, text, callback) {
  if(!Common.adminEmail) {
        callback(null);
        return;
  }
  var mailOptions = {
      from: "support@nubosoftware.com", // sender address
      fromname: "Nubo Support",
      to: Common.adminEmail, // list of receivers
      toname: Common.adminName,
      subject: subj, // Subject line
      text: text
  };
  mailOptions.html = mailOptions.text.replace(/\n/g, "<br />");
  Common.mailer.send(mailOptions, function(success, message) {
      if (!success) {
        var msg = "sendgrid error: " + message;
        logger.info(msg);
        callback(msg);
      } else {
        callback(null);
        //logger.info("Message sent to "+email);
      }
  }); //Common.mailer.send
}

function startSession(req, res, next) {

    // https://login.nubosoftware.com/startsession?loginToken=[loginToken]?timeZone=[timeZome]
    var logger = new ThreadedLogger();
    res.contentType = 'json';
    var msg = "";
    var status = 100; //unknown
    //logger.info(req.url);

    //read and validate params
    var loginToken = req.params.loginToken;
    var timeZone = req.params.timeZone;
    var remoteAddr = req.connection.remoteAddress;
    var platid = req.params.platid;
    var loginData;

    async.series([
        function(callback) {
            new Login(loginToken, function(err, login) {
                if (err) {
                    res.send({
                        status: 0,
                        message: 'Internal error. Please contact administrator.',
                        loginToken: 'notValid'
                    });
                    logger.error("startSession: " + err);
                    callback(err);
                    return;
                }

                if (login.isValidLogin() == 'false') {
                    var msg = "login isn\'t valid for user " + login.getUserName();
                    res.send({
                        status: 2,
                        message: msg
                    });
                    logger.error("startSession: " + msg);
                    callback(msg);
                    return;
                }

                logger.user(login.getUserName());
                logger.info("Start session", {mtype: "important"});
                loginData = login;
                callback(null);
            });
        },
        function(callback) {
            User.getUserDataCenter(loginData.getUserName(), logger, function(err, dcname, dcurl) {
                if (err) {
                    res.send({
                        status: 0,
                        message: 'Internal error. Please contact administrator.'
                    });
                    logger.error("startSession: " + err);
                    callback(err);
                    return;
                }

                if (dcname && dcname != loginData.getDcname()) {
                    var msg = "user logged in at diffrent data center and need to be redirected";
                    res.send({
                        status: 2,
                        message: msg
                    });
                    logger.error("startSession: " + msg);
                    callback(msg);
                    return;
                }

                callback(null);
            });
        },
        function(callback) {
            startOrJoinSession(req, res, loginData, 1, platid, timeZone, logger, function(err) {
                if (err) {
                    logger.error("startSession: starting user session failed. err: " + err);
                } else {
                    logger.info("startSession: user session started succefully");
                }
                callback(null);
            });
        }
    ], function(err) {
        return;
    });
}

function copyFile(src,dst,callback) {
    var reader = Common.fs.createReadStream(src);
    var writer = Common.fs.createWriteStream(dst);
    var isFinished = false;
    reader.pipe(writer);
    writer.on('finish', function() {
        logger.info("Finished writing to "+dst);
        if (!isFinished)
            callback(null);
        });
    writer.on('error', function(err) {
        logger.info("Error writing to "+dst+": "+err);
        if (!isFinished) {
            isFinished = true;
            callback("Error writing to "+dst);
        }
    });
    reader.on('error', function(err) {
        logger.info("Error reading from "+src+": "+err);
        if (!isFinished) {
            isFinished = true;
            callback("Error reading from "+src);
        }
       });
}

function setPerUserEnvironments(session, login, timeZone, callback){
    var email = session.params.email;
    var localid = session.params.localid;
    var errormsg = "";
   
    var lang = login.loginParams.lang;
    var countrylang = login.loginParams.countrylang;
    var localevar = login.loginParams.localevar;

    var lineLanguage    = 'setprop persist.sys.language.u' + localid +' \"' + lang + '\"';
    var lineCountryLang = 'setprop persist.sys.country.u' + localid +' \"' + countrylang + '\"';
    var lineLocalevar   = 'setprop persist.sys.localevar.u' + localid +' \"' + localevar + '\"';

    var cmd = lineLanguage + ';\\\n' + lineCountryLang + ';\\\n' + lineLocalevar + ';\\\n';
    if (timeZone !== null && timeZone !== "") {
        cmd = cmd + 'setprop persist.sys.timezone.u' + localid + ' \"' + timeZone + '\";\\\n';
    } else {
        session.logger.error("ERROR: missing timeZone param.");
    }
    session.logger.info("cmd:\n"+cmd);
    session.platform.exec(cmd, function(err, code, signal, sshout) {
        if (err) {
            var msg = "Error in adb shell: " + err;
            session.logger.info(msg);
        }
        callback(null);
     }); // ssh.exec    
}

// Retrieve data from search query
/*
function getRowVal(row,name,defval) {
    var res = defval;
    if (row.get(name)) {
        res = row.get(name).value;
    }
    return res;
}*/


function closeSSH(ssh, callback){
    if (ssh!=null) {
        ssh.end();
    }
    callback(null);
}


// Check whether the user has apps that need to be uninstalled and uninstall them
function uninstallUserApps(session, login, callback) {
        var email = session.params.email;
        var localid = session.params.localid;
        var platform = session.platform;
        var deviceID = session.params.deviceid;
        var domain = login.loginParams.mainDomain;
        var status;
        var msg;
        // Go over all new packages
        Common.db.DeviceApps.findAll({
            attributes : ['packagename'],
            where : {
                email : email,
                deviceid : deviceID,
                installed : -1
            },
        }).complete(function(err, results) {

            if (!!err) {
                status = 3;
                // internal error
                msg = "Internal error: " + err;
                logger.info(msg);
                callback(null);
                return;
            }

            if (!results || results == "") {
                status = 2;
                // invalid parameter
                msg = "No need to uninstall packages for user.";
                logger.info(msg);
                callback(null);
                return;
            }

            var packageName;
            async.eachSeries(results, function(row, callback) {
                packageName = row.packagename != null ? row.packagename : '';
                logger.info('Uninstalling package ' + packageName + ' for user ' + localid);
                var platforms = [platform];
                var userIdInPlatforms = [localid];
                var deviceIds = [deviceID];
                deleteAppModule.uninstallAppForUserOnPlatforms(email, platforms, deviceIds, packageName, userIdInPlatforms, domain, callback);
            }, function(err) {
                if (err) {
                    logger.info(err);
                }
                callback(err);
            });
        });
}

/* disableBrowserApp
 * Disables com.android.browser package for browser clients
 * @param session    session Object
 * @param callback
*/
function disableBrowserApp(session, callback) {
    var localid = session.params.localid;
    var platform = session.platform;
    var cmd = 'pm disable --user ' + localid + ' com.android.browser';
    platform.exec(cmd,function(err,code, signal,sshout) {
        callback(err);
    }); // ssh.exec
}

// This function should been called after session and platform locked
// session can been null, platform can been null
function endSessionLocked(session, platform, callback) {
    if (session) {
        var sessLogger = session.logger;
        var UNum = (platform && session.params.localid) ? session.params.localid : 0;
        async.series([
            // mark delete flag
            function(callback) {
                if (UNum != 0) {
                    async.series([
                        function(callback) {
                            session.params.deleteFlag = 1;
                            var now = new Date();
                            session.params.endTime = now.toFormat("YYYY-MM-DD HH24:MI:SS");
                            var endTS = now.getTime();
                            var msec = endTS - session.params.startTS;
                            var hh = Math.floor(msec / 1000 / 60 / 60);
                            msec -= hh * 1000 * 60 * 60;
                            var mm = Math.floor(msec / 1000 / 60);
                            msec -= mm * 1000 * 60;
                            var ss = Math.floor(msec / 1000);
                            msec -= ss * 1000;
                            session.params.totalSessionTime = (hh > 0 ? hh + ' hours, ' : '') + (mm ? mm + ' minutes, ' : '') + (ss ? ss + ' seconds' : '');
                            session.save(callback);
                        },
                        // if ssh is not initializated, move platform to platforms_errs
                        function(callback) {
                            if (platform.ssh) {
                                callback(null);
                            } else {
                                callback("ssh is not initializated");
                            }
                        },
                        function(callback) {
                            detachUserFromPlatform(session, callback);
                        },
                        //remove user rules from iptables
                        function(callback) {
                            firewall.removeRulesFromTable(session.params.localid, session.params.platid, function(err, ruleCmd) {
                                if (err) {
                                    callback(err);
                                } else if (ruleCmd) {
                                    //sessLogger.info("cmd: " + ruleCmd);
                                    platform.exec(ruleCmd, function(err, code, signal, sshout) {
                                        if (err) {
                                            var msg = "Error in adb shell ruleCmd: " + err;
                                            callback(msg);
                                            return;
                                        }
                                        sessLogger.logTime("rules has been removed from table");
                                        callback(null);
                                    });
                                } else {
                                    callback(null);
                                }
                            });
                        },
                        // delete platfrom reference
                        function(callback) {
                            session.deletePlatformReference(function(err) {
                                if (err) {
                                    callback("failed deleteing session platform reference");
                                    return;
                                }
                                callback(null);
                            });
                        },
                        // decrese platform sessions
                        function(callback) {
                            platform.increaseReference(-1, callback);
                        },
                        //workaround for onlinestatus bug
                        function(callback) {
                            Common.db.Activation.update({
                                onlinestatus: 0
                            }, {
                                where: {
                                    activationkey: session.params.activation
                                }
                            }).then(function() {
                                callback(null);
                            }).catch(function(err) {
                                var msg = "error while update onlinestatus:: " + err;
                                callback(msg);
                                return;
                            });
                        }
                    ], function(err, results) {
                        callback(err);
                    });
                } else {
                    callback("no UNum");
                }
            }
        ], function(err, results) {
            // no matter if error happened remove session from db
            if (err) {
                sessLogger.error("endSessionLocked: " + err);
            }
            session.del(function(serr) {
                /*if (err) {
                 platform.addToErrorPlatforms(function(err) {
                 if (err) {
                 sessLogger.info("ERROR: Cannot move platform to platforms_errs, err: " + err);
                 }
                 });
                 }*/
                if (serr) {
                    sessLogger.logTime("Error during remove session from db, err: " + err);
                    callback("Error during remove session from db, err: " + serr);
                } else {
                    sessLogger.logTime("removed session from db.");
                    callback(err);
                }
            });
        });
    } else {
        if (platform) {
            /*platform.addToErrorPlatforms(function(err) {
             if (err) {
             logger.info("ERROR: Cannot move platform to platforms_errs, err: " + err);
             }
             });*/
        }
        logger.info("Session is not defined");
        callback("Session is not defined");
    }
}

var detachUserFromPlatform = function(session, callback) {
    if(Common.platformType === "kvm") {
        detachUserFromPlatformByManagement(session, callback);
    } else {
        session.platform.detachUser(session, callback);
    }
};

var detachUserFromPlatformByManagement = function(session, callback) {
    var UNum = session.params.localid;
    var sessLogger = session.logger;
    var platform = session.platform;
    async.series([
            // Logout. pm remove-user close all user's applications
            function(callback) {
                var cmd = 'pm remove-user ' + session.params.localid;
                //console.log("cmd: " + cmd);
                sessLogger.info(cmd);
                platform.exec(cmd, function(err, code, signal, sshout) {
                    sessLogger.logTime("pm remove-user");
                    callback(null); // Try to continue even if pm failed
                }); // platform.exec
            }, // function(callback)
            // force close all user's applications if it still exist
            function(callback) {
                var cmd = "kill `ps | grep ^u" + UNum + "_ | awk '{print $2}'`";
                sessLogger.info("cmd: " + cmd);
                platform.exec(cmd, function(err, code, signal, sshout) {
                    if (err) {
                        var msg = "Error in adb shell: " + err;
                        callback(msg);
                        return;
                    }
                    sessLogger.logTime("kill all processes, " + sshout);
                    callback(null);
                }); // platform.exec
            }, // function(callback)
            // unmount folders
            function(callback) {
                mount.fullUmount(session, null, function(err) {
                    if (err) {
                        sessLogger.info("ERROR: cannot umount user's directories, err:" + err);
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
            }, // function(callback)
            // rm files of logouted user (after umount of all user's data)
            function(callback) {
                var cmd = "rm -rf /data/system/users/" + UNum +
                    " ; rm /data/system/users/" + UNum + ".xml" +
                    " ; rm -rf /data/user/" + UNum +
                    " ; rm -rf /data/media/" + UNum +
                    " ; rm -rf /data/misc/keystore/user_" + UNum + "/*";
                sessLogger.info("cmd: " + cmd);
                platform.exec(cmd, function(err, code, signal, sshout) {
                    if (err) {
                        var msg = "Error in adb shell: " + err;
                        callback(msg);
                        return;
                    }
                    sessLogger.logTime("rm folder");
                    callback(null);
                }); // platform.exec
            }, // function(callback)
            function(callback) {
                MediaStream.removeUserStreams(session.params.sessid, function(err) {
                    callback(null);
                });
            } // function(callback)
        ], function(err) {
            callback(err);
        }
    );
};

var detachUserFromPlatformByPlatform = function(session, callback) {
    var UNum = session.params.localid;
    var logger = session.logger;

    var options = {
        host : "127.0.0.1",
        port: 3333,
        path : "/detachUser?unum=" + UNum,
        method : "GET",
        rejectUnauthorized : false,
    };
    var callbackDone = false;
    var resData = "";
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            resData = resData + chunk;
        });
        res.on('end', function() {
            logger.info('sendRequestCreateUserOnPlatform *********** res: ' + resData);
            var resObj = JSON.parse(resData);
            if(!callbackDone) {
                callbackDone = true;
                if(resObj.status === 1)
                    callback(null);
                else
                    callback("Request return error");
            }
        });
    });

    // set timeout on the connection
    //req.on('socket', function(socket) {
    //    socket.setTimeout(60000);
    //    socket.on('timeout', function() {
    //        console.log('Timeout while request create user');
    //    });
    //});

    req.on('error', function(e) {
        logger.error('problem with request: ' + e.message);
        if(!callbackDone) {
            callbackDone = true;
            callback("Error while request create user", {addToErrorsPlatforms: true});
        }
    });

    // write data to request body
    req.end();
};

//TODO: Too many sync implementations
function syncFiles(session, syncStorage, callback) {
    var sessLogger = session.logger;
    if(!session) {
        callback(null);
        return;
    }

    async.series([
            // sync back NFS in case on no error
            // old code not used
            function(callback) {
                syncFolders.syncBackToStorage(session, function(err){
                    callback(null, err);
                });
            },
            //sync data folder
            function(callback) {
                if (session.nfs && (session.params.email !== "demo@nubosoftware.com")) {
                    var pathToSync = User.getUserDeviceDataFolder(session.params.email, session.params.deviceid);
                    session.nfs.syncAll(pathToSync, function(err) {
                        callback(err);
                    });
                } else {
                    callback(null);
                }
            },
            //sync storage folder
            function(callback) {
                if (syncStorage && session.nfs && (session.params.email !== "demo@nubosoftware.com")) {
                    var pathToSync = User.getUserStorageFolder(session.params.email);
                    session.nfs.syncAll(pathToSync, function(err) {
                        callback(err);
                    });
                } else {
                    callback(null);
                }
            },
            // sync storage to other region
            // old code not used
            function(callback){
                User.syncUserFolders(session.params.email,session.params.deviceid);
                callback(null);
            }
        ], function(err, results) {
            if(err)
                sessLogger.error("syncFiles: Sync files failed");

            callback(err);
        }
    );
}

function updateUserInDbOnLogout(session, callback) {
    async.waterfall([
            function(callback) {
                User.getUserDataSize(session.params.email, callback);
            },
            function(size, callback) {
                var delta = {
                    storageLast: size
                };
                Common.db.User.update(
                    delta,
                    {
                        where : {
                            email : session.params.email
                        }
                    }
                ).then(function() {
                    callback(null);
                }).catch(function(err) {
                    var msg = "Error while setUserDetails: " + err;
                    session.logger.error("StartSession.js updateUserInDbOnLogout: ", msg);
                    callback(msg);
                    // return error
                    return;
                });
            }
        ], function(err, results) {
            if(callback) callback(err);
        }
    );
}

function endSession(sessionID, callback) {
    var session = null;
    var platform = null;
    var ssh = null;
    var nfs = null;
    var deviceid = null;
    var email = null;
    var sessid = null;
    var addToErrorsPlatforms = false;
    var lastConnectedDevice = false;
    var realDeviceID;

    var sessLogger = new ThreadedLogger();
    var timeLog = sessLogger.timelogger;

    if (sessionID == null || sessionID.length < 1) {
        callback("Invalid session id");
        return;
    }

    async.series([
        // load session
        function(callback) {
            new Session(sessionID, function(err, obj) {
                if (err || !obj) {
                    var msg = "session does not exist. err:" + err;
                    callback(msg);
                    return;
                }
                //logger.info('Session found: '+JSON.stringify(obj,null,2));
                var tempSession = obj;
                deviceid = tempSession.params.deviceid;
                email = tempSession.params.email;
                sessid = tempSession.params.sessid;
                sessLogger.user(email);
                if (sessid != sessionID) {
                    var msg = "loaded invalid session id: " + sessid;
                    callback(msg);
                    return;
                }
                callback(null);
            });
        },
        function(callback) {

            var sessLock = new Lock({
                key: "lock_" + email + "_" + deviceid,
                logger: sessLogger,
                numberOfRetries: 1,
                waitInterval: 500,
                lockTimeout: 1000 * 60 * 30
            });

            sessLock.cs(
                function(callback) {
                    async.series([
                        // validate folders for user
                        function(callback) {
                            validateUserFolders(email, deviceid, function(err) {
                                if (err) {
                                    sessLogger.warn("endSession: error in pre validateUserFolders err: " + err);
                                }
                                callback(null);
                            });
                        },
                        // re-load session after lock has been created
                        function(callback) {
                            new Session(sessionID, function(err, obj) {
                                if (err || !obj) {
                                    var msg = "session does not exist. err: " + err;
                                    callback(msg);
                                    return;
                                }
                                session = obj;
                                session.logger = sessLogger;
                                callback(null);
                            });
                        },
                        function(callback) {
                            nfsModule({
                                    UserName: session.params.email,
                                    logger: sessLogger,
                                },
                                function(err, nfsobj) {
                                    if (err) {
                                        sessLogger.warn("endSession: cannot create nfs obect err: " + err);
                                        callback(null); // TODO: return err
                                    } else {
                                        nfs = nfsobj;
                                        session.nfs = nfsobj;
                                        callback(null);
                                    }
                                }
                            );
                        },
                        // load platform
                        function(callback) {
                            new Platform(session.params.platid, null, function(err, obj) {
                                if (err || !obj) {
                                    var msg = "endSession: platform does not exist. err:" + err;
                                    callback(msg);
                                    return;
                                }
                                platform = obj;
                                session.setPlatform(platform);

                                callback(null);
                            });
                        },
                        // open ssh connection
                        function(callback) {
                            platform.initSsh(sessLogger, function(err, sshobj) {
                                if (err) {
                                    addToErrorsPlatforms = true;
                                    callback("error in initSsh err: " + err);
                                    return;
                                }

                                if (sshobj) {
                                    ssh = sshobj;
                                    callback(null);
                                } else {
                                    callback("initSsh return null object");
                                }
                            });
                        },
                        function(callback) {
                            sessLogger.logTime("Closing session on platform");
                            var platLock = new Lock({
                                key: "lock_platform_" + platform.params.platid,
                                logger: sessLogger,
                                numberOfRetries: 30,
                                waitInterval: 500,
                                lockTimeout: 1000 * 60 * 10 // 10 minutes max lock
                            });

                            platLock.cs(
                                function(callback) {
                                    endSessionLocked(session, platform, function(err) {
                                        if (err) {
                                            callback("error in endSessionLocked err: " + err);
                                            return;
                                        }
                                        callback(null);
                                    });
                                }, callback);
                        },
                        //decrease gateway's session score
                        function(callback) {
                            gatewayModule.updateGWSessionScore(session.params.gatewayIndex, -1, session.params.sessid, sessLogger, function(err) {
                                if (err) {
                                    callback("failed decresing gateway reference");
                                    return;
                                }
                                callback(null);
                            });
                        },
                        //get real device ID (to support when withService set)
                        function(callback) {
                            Common.redisClient.hget("login_" + session.params.loginToken, "deviceID", function(err, replay) {
                                if(err){
                                    callback(err);
                                    return;
                                }

                                realDeviceID = replay;
                                callback(null);
                            });
                        },
                        // remove platform/gateway assosiation to user device
                        function(callback) {
                            User.updateUserConnectedDevice(email, realDeviceID, null, null, sessLogger, function(err) {
                                if (err) {
                                    callback("failed removing platform/gateway assosiation of user device")
                                    return;
                                }
                                callback(null);
                            });
                        },
                        // remove data center details in case it is last connected device
                        function(callback) {
                            if (!Common.dcName && !Common.dcURL) {
                                callback(null);
                                return;
                            }
                            User.getUserConnectedDevices(email, sessLogger, function(err, devices){
                                if(err){
                                    callback("failed getting all online devices");
                                    return;
                                }

                                // if this is the last device connected
                                if(devices.length == 0){
                                    lastConnectedDevice = true;
                                }

                                callback(null);
                            });
                        },
                        // sync user data
                        function(callback) {
                            syncFiles(session, lastConnectedDevice, function(err) {
                                if (err) {
                                    callback("failed syncing user data");
                                    return;
                                }
                                callback(null);
                            });
                        },
                        function(callback){
                            if (!Common.dcName && !Common.dcURL) {
                                callback(null);
                                return;
                            }

                            if(!lastConnectedDevice){
                                callback(null);
                                return;
                            }

                            User.updateUserDataCenter(email, null, null, sessLogger, function(err) {
                                if (err) {
                                    callback("failed removeing user logged in data center");
                                    return;
                                }
                                callback(null);
                            });                         
                        }
                    ], callback); //async.series
                },
                callback
            ); // sessLock.cs
        },
        function(callback) {
            validateUserFolders(email, deviceid, function(err) {
                if (err) {
                    sessLogger.warn("endSession: error in post validateUserFolders err: " + err);
                }
                callback(null);
            });
        },
        function(callback) {
            Common.redisClient.publish("platformPoolRefresh", "User disconnected");
            updateUserInDbOnLogout(session);
            callback(null);
        }
    ], function(err) {
        if (err) {
            var errMsg = "endSession: " + err;
            sessLogger.error(errMsg);
        } else {
            sessLogger.logTime("Session closed");
        }

        if (addToErrorsPlatforms) {
            platform.addToErrorPlatforms(function(err) {
                if (err) 
                    sessLogger.error("endSession: error in addToErrorPlatforms: " + err);
            });
        }

        closeSSH(ssh, function() {});

        if (session != null) {
            var appid = session.params.deviceid + "_" + session.params.activation;
            Track.trackAPI({
                customAppID: appid,
                customSessID: appid,
                type: 'End Session',
                appType: 'Nubo',
                userParams: {
                    email: session.params.email
                },
                other: {
                    dcName: Common.dcName,
                    session: session.params,
                    log: Common.specialBuffers[sessLogger.logid]
                }
            });

            if (errMsg) {
                var subj = (Common.dcName != "" ? Common.dcName + " - " : "") + "Session deleted unsuccessfully";
                var text = 'Session delete error: ' + errMsg +  '\nSession details: ' + JSON.stringify(session.params, null, 2);
                sendEmailToAdmin(subj, text, function(err) {
                    Common.specialBuffers[sessLogger.logid] = null;
                });
            } else {
                Common.specialBuffers[sessLogger.logid] = null;
            }
        } else {
            Common.specialBuffers[sessLogger.logid] = null;
        }

        callback(errMsg);
    });
}

function validateUserFolders(UserName, deviceID, keys, callback) {
  if (typeof(keys) === 'function') {
    callback = keys;
    keys = undefined;
  }
  User.validateUserFolders(UserName, deviceID, keys, callback);
}

function validateUserFoldersExist(session, keys, time, hrTime, callback) {
    var login = session.login;
    var UserName = login.getUserName();
    var deviceID = login.getDeviceID();
    var demo = login.loginParams.demoActivation && login.loginParams.demoActivation!="false"
    var key = demo ? null : keys
    if (demo) {
        User.createUserFolders(UserName,deviceID,true, time, hrTime,
            function(err) {
                validateUserFolders(UserName, deviceID, key, callback);
            }, demo
        );
    } else {
        validateUserFolders(UserName, deviceID, key, function(err) {
            if (err || demo) {
                User.createUserFolders(UserName,deviceID,true, time, hrTime,
                    function(err) {
                        validateUserFolders(UserName, deviceID, key, callback);
                    }, demo
                );
            } else
               callback(null);
        });
    }

}

var attachUser = function(session, timeZone, callback) {
    if(Common.platformType === "kvm") {
        attachUserByManagement(session, timeZone, callback);
    } else {
        session.platform.attachUser(session, timeZone, callback);
    }
};

var attachUserByManagement = function(session, timeZone, callback) {
    var login = session.login;
    var UserName = login.loginParams.userName;
    var deviceID = login.loginParams.deviceID;
    var platform = session.platform;
    var addToErrorsPlatforms = false;
    var pmUserCreated = false;
    var platformErrorFlag = false;
    var logger = session.logger;
    var timeLog = logger.timelogger;
    var localid = 0;

    /*
     * create android user, chech his number, empty directories
     * Arguments:
     *  callback(err, localid)
     *  err - error message, if exist
     *  localid - number of created user
     */
    function createUserAndroid(callback) {
        var localid;
        async.series([
                // create user
                function(callback) {
                    var cmd = 'pm create-user '+ UserName + deviceID;
                    //console.log("cmd: "+cmd);
                    platform.exec(cmd,function(err,code, signal,sshout){
                        if (err) {
                            addToErrorsPlatforms = true;
                            var msg = "Error in adb shell: "+err;
                            platformErrorFlag = true;
                            callback(msg);
                            return;
                        }
                        var re = new RegExp('Success: created user id ([0-9]+)');
                        var m = re.exec(sshout);
                        if (m) {
                            localid = m[1];
                            session.params.localid = localid;
                            pmUserCreated = true;
                            timeLog.logTime("pm create-user");
                            callback(null);
                        } else {
                            addToErrorsPlatforms = true;
                            callback("Error with PM - cannot get localid");
                        }
                    }); // ssh.exec
                }, //function(callback)
                // Remove directory that was created by Android for new user and mount our directory instead
                function(callback) {
                    var cmd = 'rm -rf /data/user/' + localid +
                            ' ; sync' +' ; mkdir /data/user/' + localid +
                            ' ; mkdir /data/system/users/' + localid +
                            ' ; sync' + ' ; chown system:system /data/user/';
                    //console.log("cmd: "+cmd);
                    platform.exec(cmd,function(err,code, signal,sshout) {
                        if (err) {
                            var msg = "Error in adb shell: "+err;
                            callback(msg);
                            return;
                        }
                        timeLog.logTime("rm, mkdir etc..");
                        callback(null);
                    }); // ssh.exec
                }, //function(callback)
            ], function (err) {
                if (err) {
                    logger.error("Error: cannot initializate android user err:" +err);
                }

                callback(err, localid);
            }
        );
    }

    var refreshPackages = function(session, callback) {
        var localid = session.params.localid;
        var platform = session.platform;
        var deviceType = session.login.loginParams.deviceType;
        var cmd = 'pm refresh ' + localid;
        if (deviceType === 'Web') {
            cmd = cmd + "; pm disable --user " + localid + " com.android.browser";
        }
        session.logger.info('cmd: ' + cmd);
        platform.exec(cmd,function(err,code, signal,sshout) {
            callback(err);
        }); // ssh.exec
    };

    /**
     * Run am create-user on the platform
     */
    var amCreateUser = function(platform, session, callback) {
        var cmd = 'am create-user ' + localid;
        platform.exec(cmd, function(err, code, signal, sshout) {
            if (err) {
                var msg = "Error in adb shell: " + err;
                platformErrorFlag = true;
                callback(msg);
                return;
            }
            callback(null);
        });
        // ssh.exec
    };

    /**
     * Delete previous users certificates from platform
     */
    function deleteUserCerts(platform, callback) {
        var cmd = 'rm /data/misc/keystore/user_' + localid + '/*';
        logger.info(' Deleting using cmd='+cmd);
        platform.exec(cmd, function(err, code, signal, sshout) {
            if (err) {
                var msg = "Error in adb shell: " + err;
                platformErrorFlag = true;
                callback(msg);
                return;
            }
            callback(null);
        });
        // ssh.exec
    }

    /*
     * Start code
     */
    async.series([
            // create user
            function(callback) {
                createUserAndroid(function(err, res) {
                    if(!err) localid = res;
                    callback(err);
                });
            },
            function(callback) {
                deleteUserCerts(platform, function(err){
                    timeLog.logTime("deleteUserCerts");
                    callback(err);
                });
            },
            // mount all nfs folders
            function(callback) {
                mount.fullMount(session, null, function(err) {
                    if (err) session.logger.error("Cannot mount user's directories");
                    timeLog.logTime("fullMount");
                    callback(err);
                });
            },
            function(callback) {
                refreshPackages(session, function(err){
                    timeLog.logTime("refreshPackages");
                    callback(err);
                });
            },
            function(callback){
                setPerUserEnvironments(session, login, timeZone, callback);
            },
            function(callback) {
                amCreateUser(platform, session, function(err){
                    timeLog.logTime("amCreateUser");
                    callback(err);
                });
            },
        ], function(err1) {
            if(err1) {
                var flags = {
                    addToErrorsPlatforms: addToErrorsPlatforms,
                    platformErrorFlag: platformErrorFlag
                };
                if(pmUserCreated) {
                    endSessionLocked(session, platform, function(err2) {
                        if(err2) logger.error("Error happened while handling error, err: " + err2);
                        callback(err1, flags);
                    });
                } else {
                    callback(err1, flags);
                }
            } else {
                callback(null, localid);
            }
        }
    );
};

/*
Common.nfsserver = "nubodev@172.16.2.108";
Common.default_gateway = "194.90.222.178:7890";
startOrJoinSession(null,null,'israel@nubosoftware.com','353918056784503',1);
*/

function startOrJoinSession(req, res, login, retryCnt, dedicatedPlatID, timeZone, sessLogger, callback) {

    var UserName = login.getUserName();
    var deviceID = Common.getWithServiceDeviceID(login.getDeviceID());
    var domain = login.getMainDomain();
    var timeLog = sessLogger.timelogger;
    var oldSession = false;
    var clientIP = req.connection.remoteAddress;
    var isLocalIP = clientIP.indexOf(Common.internal_network) == 0 ? true : false;

    var userDeviceLock = new Lock({
        key: 'lock_' + UserName + '_' + deviceID,
        logger: sessLogger,
        numberOfRetries: 20,
        waitInterval: 500,
        lockTimeout: 1000 * 60 * 5 // 5 minutes
    });


    var geoipInfo = null;

    var session = null;
    // Need to create a timestamp
    var time = new Date().getTime();
    var hrTime = process.hrtime()[1];

    nfsModule({
            UserName: UserName,
            logger: sessLogger,
            nfs_idx: Common.nfsId
        },
        function(err, nfs) {
            if (err) {
                logger.warn("startOrJoinSession: cannot create nfs obect err: " + err);
            } else {
                // cancel sync incase we syncing
                nfs.SendSyncAbort(User.getUserStorageFolder(login.getUserName()));
                nfs.SendSyncAbort(User.getUserDeviceDataFolder(login.getUserName(), login.getDeviceID()));
            }

            userDeviceLock.cs(
                function(callback) {
                    buildUserSession(UserName, deviceID, login, dedicatedPlatID, timeZone, time, hrTime, sessLogger, callback);
                },
                function(err, session, isOldSession) {
                    if (err) {
                        response2Client(null, err, res, isLocalIP, sessLogger);
                        sessLogger.error("startOrJoinSession: couldn\'t create user session");
                        callback(err);
                    } else {
                        //success
                        response2Client(session, null, res, isLocalIP, sessLogger);
                        oldSession = isOldSession;
                        postStartSessionProcedure(session, time, hrTime);
                        callback(null);
                    }

                    if (!oldSession) {
                        report(session, err, login, oldSession, sessLogger, clientIP, function() {});
                    } else {
                        sessLogger.info("startOrJoinSession: join running session: " + session.params.sessid);
                        Common.specialBuffers[sessLogger.logid] = null;
                    }
                });
        }
    );

    return;
}

function cleanUserSessionBuild(buildStatus, UserName, deviceID, session, callback) {
    var logger = session.logger;

    async.series([
        function(callback) {
            if (buildStatus.userConnectedDeviceUpdated)
                User.updateUserConnectedDevice(UserName, deviceID, null, null, logger, function(err) {
                    if (err)
                        logger.error("cleanUserSessionBuild: failed deleteing platform and gw of user");
                    callback(null);
                });
            else
                callback(null);
        },
        function(callback) {
            if (buildStatus.userDataCenterUpdated)
                User.getUserConnectedDevices(UserName, logger, function(err, userDevices) {
                    if (err) {
                        logger.error("cleanUserSessionBuild: failed getting user devices");
                        callback(null);
                        return;
                    }

                    //empty list - only one device tried to connect
                    if (userDevices.length == 0) {
                        User.updateUserConnectedDevice(UserName, deviceID, null, null, logger, function(err) {
                            if (err) {
                                logger.error("cleanUserSessionBuild: failed deleteing user data center");
                            }
                            callback(null);
                        });
                    }
                    else
                        callback(null);
                });
            else
                callback(null);
        },
        function(callback) {
            if (buildStatus.sessionPlatformReferenceIncresed)
                session.deletePlatformReference(function(err) {
                    if (err)
                        logger.error("cleanUserSessionBuild: failed deleteing session platform reference");
                    callback(null);
                });
            else
                callback(null);
        },
        function(callback) {
            if (buildStatus.platformReferenceIncresed)
                session.platform.increaseReference(-1, function(err) {
                    if (err)
                        logger.error("cleanUserSessionBuild: failed decresing platform reference");
                    callback(null);
                });
            else
                callback(null);
        },
        function(callback) {
            if (buildStatus.userAttached)
                session.platform.detachUser(session, function(err) {
                    if (err) {
                        logger.error("cleanUserSessionBuild: failed detaching user from platform");
                        buildStatus.addToErrorsPlatforms = true;
                    }
                    callback(null);
                });
            else
                callback(null);
        },
        function(callback) {
            if (buildStatus.addToErrorsPlatforms)
                session.platform.addToErrorPlatforms(function(err) {
                    if (err)
                        logger.error("cleanUserSessionBuild: failed adding platform " + session.params.platid + " to platform error list");
                    callback(null);
                });
            else
                callback(null);
        },
        function(callback) {
            if (buildStatus.platformLock)
                buildStatus.platformLock.release(function(err) {
                    if (err)
                        logger.error("cleanUserSessionBuild: failed releasing lock");
                    callback(null);
                });
            else
                callback(null);
        },
        function(callback) {
            if (buildStatus.gatewayReferenceIncresed)
                gatewayModule.updateGWSessionScore(session.params.gatewayIndex, -1, session.params.sessid, logger, function(err) {
                    if (err)
                        logger.error("cleanUserSessionBuild: failed decresing gateway reference");
                    callback(null);
                });
            else
                callback(null);
        },
        // delete session
        function(callback){
            session.del(function(err){
                if(err)
                    logger.error("cleanUserSessionBuild: failed deleting session");
                callback(null);
            });
        }
    ], function(err){
        callback(null);
        return;
    });
}

function buildUserSession(UserName, deviceID, login, dedicatedPlatID, timeZone, time, hrTime, logger, callback) {

    var buildStatus = {
        platformReferenceIncresed : false,
        platformLock : null,
        addToErrorsPlatforms : false,
        userAttached : false,
        sessionPlatformReferenceIncresed : false,
        gatewayReferenceIncresed : false,
        userDataCenterUpdated : false,
        userConnectedDeviceUpdated : false
    };

    var keys = null;


    sessionModule.getSessionOfUserDevice(UserName, deviceID, function(err, sessobj) {
        if (err) {
            callback(err);
            return;
        }

        if (sessobj == null) {
            new Session(null, {
                UserName: UserName
            }, function(err, obj) {
                if (err) {
                    callback("error creating session");
                    return;
                }

                var session = obj;
                session.logger = logger;
                session.login = login;
                session.params.email = UserName;
                session.params.deviceid = deviceID;


                async.series([
                    //validate user folders
                    function(callback) {
                        validateUserFoldersExist(session, keys, time, hrTime, callback);
                    },
                    // nfs
                    function(callback) {
                        nfsModule({
                                UserName: UserName,
                                logger: logger,
                                nfs_idx: Common.nfsId
                            },
                            function(err, nfs) {
                                if (err) {
                                    logger.warn("buildUserSession: cannot create nfs obect err: " + err);
                                    callback(null); // TODO: return err
                                } else {
                                    session.params.nfs_ip = nfs.nfs_ip;
                                    session.params.nfs_idx = nfs.nfs_idx;
                                    session.nfs = nfs;
                                    callback(null);
                                }
                            }
                        );
                    },
                    //get platform
                    function(callback) {
                        platformModule.getAvailablePlatform(null, dedicatedPlatID, logger, function(err, obj, lock) {
                            if (err) {
                                callback("couldn't get platform");
                                return;
                            }

                            buildStatus.platformLock = lock;
                            buildStatus.platformReferenceIncresed = true;

                            session.platform = obj;
                            session.params.platid = obj.params.platid;
                            session.params.hostline = obj.params.hostline;
                            session.params.platformline = obj.params.platformline;
                            session.params.platform_ip = obj.params.platform_ip;

                            callback(null);
                        });
                    },
                    //check platform
                    function(callback) {
                        platformModule.checkPlatformStatus(UserName, deviceID, session.platform, logger, function(err){
                            if(err){
                                buildStatus.addToErrorsPlatforms = true;
                                callback("platform failed, err: " + err);
                                return;
                            }

                            callback(null);
                        });
                    },   
                    //attach gateway to session
                    function(callback) {
                        //create dummy gateway obj
                        var gwObj = {
                            index: -1
                        };
                        new gatewayModule.Gateway(gwObj, {
                            logger: logger
                        }, function(err, gateway) {
                            if (err || !gateway) {
                                callback("failed to associate gateway to session");
                            } else {
                                session.params.gatewayIndex = gateway.params.index;
                                session.params.gatewayInternal = gateway.params.internal_ip;
                                session.params.gatewayExternal = gateway.params.external_ip;
                                session.params.isSSL = gateway.params.ssl;
                                session.params.isGWDisabled = gateway.params.isGWDisabled;
                                session.params.gatewayPlayerPort = gateway.params.player_port;
                                session.params.gatewayAppsPort = gateway.params.apps_port;
                                session.params.gatewayControllerPort = gateway.params.controller_port;
                                callback(null);
                            }
                        });
                    },
                    // create session files
                    function(callback) {
                        createSessionFiles(session, function(err) {
                            callback(err);
                        });
                    },
                    //attach user to platform
                    function(callback) {
                        attachUser(session, timeZone, function(err, res) {
                            if (err) {
                                buildStatus.addToErrorsPlatforms = true;
                                callback("attach user to platform failed");
                                return;
                            }

                            session.params.localid = res;
                            buildStatus.userAttached = true;
                            callback(null);
                        });
                    },
                    // update Platform Reference
                    function(callback) {
                        session.updatePlatformReference(function(err) {
                            if (err) {
                                callback("failed updaing session\'s platform reference");
                                return;
                            }
                            buildStatus.sessionPlatformReferenceIncresed = true;
                            callback(null);
                        });
                    },
                    // unlock platform after pm
                    function(callback) {
                        buildStatus.platformLock.release(function(err, replay) {
                            if (err){
                                callback("cannot remove lock on platform");
                                return;
                            }

                            buildStatus.platformLock = null;
                            callback(null);
                        });
                    },
                    // create session in redis
                    function(callback) {
                        session.params.activation = login.getActivationKey();
                        session.params.deleteFlag = 0;
                        session.params.loginToken = login.loginParams.loginToken;
                        var now = new Date();
                        session.params.startTime = now.toFormat("YYYY-MM-DD HH24:MI:SS");
                        session.params.startTS = now.getTime();
                        session.params.encrypted = login.loginParams.encrypted;
                        session.params.forceExit = 0;
                        session.setUserAndDevice(UserName, deviceID, function(err) {
                            if (err) {
                                callback("creating session failed");
                                return;
                            }
                            session.suspend(1, function(err) {
                                if (err) {
                                    callback("susspending session failed");
                                    return;
                                }
                                callback(null);
                            });
                        });
                    },
                    // update gateway Reference
                    function(callback) {
                        gatewayModule.updateGWSessionScore(session.params.gatewayIndex, 1, session.params.sessid, session.logger, function(err) {
                            if (err) {
                                callback("failed increasing gateway reference");
                                return;
                            }
                            buildStatus.gatewayReferenceIncresed = true;
                            callback(null);
                        });
                    },
                    // update user DB with data center details
                    function(callback) {
                        if (!Common.dcName && !Common.dcURL) {
                            callback(null);
                            return;
                        }

                        var dcname = login.getDcname() != '' ? login.getDcname() : null;
                        var dcurl = login.getDcurl() != '' ? login.getDcurl() : null;

                        if (dcname && dcurl) {
                            buildStatus.userDataCenterUpdated = true;
                            User.updateUserDataCenter(UserName, dcname, dcurl, logger, callback);
                        } else {
                            callback(null);
                        }
                    },
                    //update user-device connected platform and gw
                    function(callback) {
                        //login.getDeviceID(): because withService changes the device ID we need the real device ID to set platform and GW on DB
                        User.updateUserConnectedDevice(UserName, login.getDeviceID(), session.params.platid, session.params.gatewayIndex, logger, function(err) {
                            if (err) {
                                callback("failed updating connected platform and gateway of the session")
                                return;
                            }

                            buildStatus.userConnectedDeviceUpdated = true;
                            callback(null);
                        });
                    },
                    // validate folders of the user
                    function(callback) {
                        validateUserFolders(UserName, deviceID, function(err) {
                            if (err) {
                                callback("failed validating user folders " + err);
                                return;
                            }
                            callback(null);
                        });
                    }
                ], function(err) {
                    if (err) {
                        logger.error("buildUserSession: " + err);
                        cleanUserSessionBuild(buildStatus, UserName, deviceID, session, function(){
                            callback(err);
                        });
                    }
                    else
                        callback(null, session, false);
                });
            });

        } else {
            if (sessobj.params.deleteFlag == 1 || sessobj.params.deleteError == 1) {
                callback("session in delete state");
                return;
            }

            if (sessobj.params.forceExit == 1) {
                callback("session forced to exit");
                return;
            }

            var session = sessobj;
            session.logger = logger;

            // validate folders of the user
            validateUserFolders(UserName, deviceID, function(err) {
                if (err) {
                    var errMsg = "buildUserSession: failed validating user folders"
                    logger.error(errMsg);
                    callback(errMsg);
                    return;
                }
                callback(null, session, true);
            });
        }
    });
}

/*
 * Create startup.json, Session.xml, sessionid
 */
function createSessionFiles(session, callback) {


    var login = session.login;
    var logger = session.logger;
    var platform = session.platform;
    var UserName = login.getUserName();
    var deviceID = Common.getWithServiceDeviceID(login.getDeviceID());
    var domain = login.getMainDomain();

    var localid = session.params.localid;

    async.series([
        // Handle browser autologin config if one exists
        function(callback) {
            User.handleAutoLoginForUser(domain, UserName, deviceID, callback);
        },
        // Handle certificate if one exists
        function(callback) {
            User.handleCertificatesForUser(domain, UserName, deviceID, callback);
        },
        function(callback) {
            //configure demo email
            if (login.loginParams.demoActivation && login.loginParams.demoActivation != "false") {
                var setAccountValues = {
                    'accountType': "1",
                    'email': "demo" + localid + "@nubo.co",
                    'orgEmail': "demo" + localid + "@nubo.co",
                    'username': "demo",
                    'password': "Password1",
                    'serverName': "ex-test.nubo.co",
                    'domain': "",
                    'serverPort': '443',
                    'secureSSL': "0",
                    'signature': "- Sent from my Nubo work environment"
                };
                var settings = {};
                settings['setAccount'] = setAccountValues;
                logger.info("Save settings to device: " + deviceID);
                logger.info("Save Settings ", settings);
                User.saveSettingsUpdateFile(settings, UserName, deviceID, function(err) {
                    if (err) {
                        logger.error("Error saveSettingsUpdateFile : " + err);
                        return;
                    }
                    logger.info("Updated settings for " + UserName + ", " + deviceID);
                });
                callback(null);
            } else {
                callback(null);
            }
        },
        function(callback) {
            //create imServerParams file
            User.saveIMSettingsFile(UserName, login.getImUserName(), deviceID, localid, function(err) {
                if (err) {
                    logger.error("createSessionFiles: " + err);
                }
                callback(null);
            });
        },
        function(callback) {
            //create Session.xml                     
            var rootFolder = Common.nfshomefolder;
            var xml_file = rootFolder + User.getUserDeviceDataFolder(UserName, deviceID) + "Session.xml";
            var xml_file_content = "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\r\n" + "<session>\r\n" + "\t<gateway_url>" + session.params.gatewayInternal + "</gateway_url>\r\n" + "\t<gateway_controller_port>" + session.params.gatewayControllerPort + "</gateway_controller_port>\r\n" + "\t<gateway_apps_port>" + session.params.gatewayAppsPort + "</gateway_apps_port>\r\n" + "\t<platformID>" + platform.params.platid + "</platformID>\r\n" + "\t<management_url>" + Common.serverurl + "</management_url>\r\n" + "\t<username>" + login.getUserName() + "</username>\r\n" + "</session>\r\n"
            Common.fs.writeFile(xml_file, xml_file_content, function(err) {
                if (err) {
                    var msg = "Failed to create Session.xml file. error: " + err;
                    logger.error(msg);
                    callback(msg);
                } else {
                    Common.fs.chmod(xml_file, '600', function(err) {
                        var msg = null;
                        if (err) {
                            msg = "Failed to chmod Session.xml file. error: " + err;
                        }
                        Common.fs.chown(xml_file, 1000, 1000, function(err) {
                            if (err) {
                                msg = msg + "Failed to chown Session.xml file. error: " + err;
                            }
                            callback(msg);
                        });
                    });
                }
            });
        },
        // put session id to text file (platform login process)
        //meir
        function(callback) {
            var rootFolder = Common.nfshomefolder;
            var sess_file = rootFolder + User.getUserDeviceDataFolder(UserName, deviceID) + "sessionid";
            //logger.info("rootFolder: "+rootFolder+", sess_file: "+sess_file);
            var sess_file_content = session.params.sessid;
            Common.fs.writeFile(sess_file, sess_file_content, function(err) {
                if (err) {
                    var msg = "Failed to create sessionid file. error: " + err;
                    logger.error(msg);
                    callback(msg);
                } else {
                    Common.fs.chmod(sess_file, '644', function(err) {
                        var msg = null;
                        if (err) {
                            msg = "Failed to chmod sessionid file. error: " + err;
                        }
                        Common.fs.chown(sess_file, 1000, 1000, function(err) {
                            if (err) {
                                msg = msg + "Failed to chown sessionid file. error: " + err;
                            }
                            callback(msg);
                        });
                    });
                }
            });

        },
        function(callback) {
            // Call subscription to EWS if needed
            EWSSubscription.subscribeProfileToEWS(login.getUserName(), login.getMainDomain(), false, function(err) {
                if (err && err != 'OK') {
                    // log the error but don't fail the process
                    logger.error("Problem setting EWS subscription: " + err);
                    callback(null);
                } else {
                    callback(null);
                }
            });
        }
    ], function(err) {
        //logger.info("Session.xml and sessionid created succesfully");
        if (err) {
            logger.error("Error: Cannot create session description files");
        }
        callback(err);
    });
}

// send email, tracker
function report(session, createErr, login, oldSession, logger, clientIP, callback) {


    var UserName = login.getUserName();
    var deviceID = Common.getWithServiceDeviceID(login.getDeviceID());
    var geoipInfo = null;

    async.series([
        function(callback) {
            if (!createErr && !oldSession && Common.isGeoIP == true) {
                Common.geoip.lookup(clientIP, function(err, data) {
                    if (!err) {
                        logger.info("Country: " + data.countryCode);
                        geoipInfo = data;
                    } else {
                        logger.info("GeoIP Error: " + err);
                    }
                    callback(null);
                }); // Common.geoip.lookup
            } else // if (!oldSession
                callback(null);
        },
        function(callback) {
            var appid = deviceID + "_" + login.getActivationKey();
            Track.trackAPI({
                customAppID: appid,
                customSessID: appid,
                type: 'Start Session',
                appType: 'Nubo',
                ip: clientIP,
                userParams: {
                    email: UserName
                },
                geo: geoipInfo,
                other: {
                    dcName: Common.dcName,
                    deviceType: login.loginParams.deviceType,
                    session: session ? session.params : "",
                    loginParams: login.loginParams,
                    log: Common.specialBuffers[logger.logid]
                }
            });
            var subj = (Common.dcName != "" ? Common.dcName + " - " : "") +
                (createErr == null ? "Session created successfully" : "Session create Error") +
                (geoipInfo ? ' [' + geoipInfo.countryCode + ']' : '');
            var text = (createErr ? 'Session create error: ' + createErr : '') +
                '\nDevice Type: ' + login.loginParams.deviceType +
                (geoipInfo ? '\nGeoIP Info: ' + JSON.stringify(geoipInfo, null, 2) : '') +
                '\nSession details: ' + (session ? JSON.stringify(session.params, null, 2) : "");
            sendEmailToAdmin(subj, text, function(err) {
                Common.specialBuffers[logger.logid] = null;
                callback(null);
            });
        }
    ], function(err) {
        callback(null);
    });
}

/*
 * Response to clent, close http request
 * Arguments:
 *  session - session object
 *  err - boolean, if error has been heppened
 */
function response2Client(session, err, res, isLocalIP, logger) {
    var resobj;
    if (err) {
        resobj = {
            status: 0,
            message: "Error during session creation: " + err
        };
    } else {
        resobj = {
            status: 1,
            gateway: isLocalIP ? session.params.gatewayInternal : session.params.gatewayExternal,
            port: session.params.gatewayPlayerPort,
            isSSL: session.params.isSSL,
            sessionid: session.params.sessid
        };
    }
    logger.info("response to client: " + JSON.stringify(resobj,null,2));
    res.send(resobj);
    return true;
}

function postStartSessionProcedure(session, time, hrTime) {

    async.series([
        // Install/Uninstall new apps to user if needed
        function(callback) {
            // Install/Uninstall new apps to user if needed
            addAppModule.startSessionInstallations(session, time, hrTime, uninstallFunc, function(err) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null);
            });
        },
        //insert user rules into iptables 
        function(callback) {
            callback(null);
            return;

            Common.redisClient.publish("platformPoolRefresh", "User connected");
            firewall.generateUserRules(session.params.email, session.params.localid, session.params.platid, firewall.Firewall.add, function(err, ruleCmd) {
                if (err) {
                    callback(err);
                    return;
                }

                if (ruleCmd) {
                    session.platform.exec(ruleCmd, function(err, code, signal, sshout) {
                        if (err) {
                            callback("error in adb shell: " + err);
                            return;
                        }

                        callback(null);
                    });
                } else {
                    callback(null);
                }
            });
        }
    ], function(err, results) {
        if (err) {
            session.logger.error("postStartSessionProcedure: " + err);
        }
        return;
    });
}

