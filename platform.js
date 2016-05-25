"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var Lock = require('./lock.js');
//var SimpleSSH = require('./simplessh.js');
var SimpleSSH = require('./permanentssh.js');
var async = require('async');
var http = require('./http.js');
var TimeLog = require('./timeLog.js').TimeLog;
var sessionModule = require('./session.js');
var firewall = require('./firewall.js');
var Session = sessionModule.Session;
var Platform, DeleteAll, killPlatform, installAPKOnPlatform, addOnlineRuleToPlatform;
var validtypes = ["aws", "kvm", "kvm2", "static", "vmw", "vmw_static"];

var Platform = function(platid, platType, callback, newplatid) {
    var self = this;
    this.params = {
        platid: platid,
        errorset: 'false'
    };
    this.adbpre = "";
    this.ssh = null;
    this.platType = platType;
    var prefix = (platType ? platType + "_" : "");
    var logger = Common.logger;

    this.appendAttributes = function(newParams) {
        for (var attrname in newParams) {
            this.params[attrname] = newParams[attrname];
        }
    }
    this.save = function(callback) {
        (function(plat) {
            Common.redisClient.hmset('platform_' + plat.params.platid, plat.params, function(err, obj) {
                if (err) {
                    logger.info("Error in save hmset:" + err);
                    if (callback) callback(err, null);
                    return;
                } else {
                    if (callback) callback(err, plat);
                } // else
            }); //hmset 
        })(this); //function (plat)
    }; // save	

    this.lock = function(retries, wait, specialLogger, callback) {
            var plat = this;
            var platid = plat.params.platid;
            var mylogger = (specialLogger ? specialLogger : logger);
            mylogger.info("Try to get lock on platform " + prefix + platid);
            Common.redisClient.SETNX('lock_' + 'platform_' + platid, 1, function(err, reply) {
                if (err) {
                    mylogger.info("Error in the lock on platform " + prefix + platid + " ,err: " + err);
                    callback(err);
                    return;
                }
                if (reply == 1) {
                    mylogger.info("*********Successfull lock on platform " + prefix + platid);
                    callback(null); // sucessfull lock
                    return;
                }
                if (retries <= 0) {
                    mylogger.info("Timeout in lock on platform " + prefix + platid);
                    callback("Error in the lock on platform " + prefix + platid + ", Lock already exists");
                } else {
                    mylogger.info("Wait on lock on platform " + prefix + platid + ", retries: " + retries);
                    setTimeout(function() {
                        plat.lock(retries - 1, wait, specialLogger, callback);
                    }, wait);
                }
            }); // Common.redisClient.SETNX
        } //lockPlatform

    this.releaseLock = function(specialLogger, callback) {
            var mylogger = (specialLogger ? specialLogger : logger);
            var plat = this;
            var platid = plat.params.platid;
            mylogger.info("Try to release lock on platform " + prefix + platid);
            Common.redisClient.DEL('lock_' + 'platform_' + platid, function(err, reply) {
                if (err) {
                    mylogger.info("Error in release lock on platform " + prefix + platid + " ,err: " + err);
                    callback(err);
                    return;
                }
                if (reply == 1) {
                    mylogger.info("*********Lock Released on platform " + prefix + platid);
                } else {
                    mylogger.info("Lock not found on platform " + prefix + platid + ", reply: " + reply);
                }
                callback(null);
            }); // Common.redisClient.SETNX
        } //releaseLock

    this.addToRunningPlatforms = function(callback) {
        var platid = this.params.platid;
        var platform = this;
        Common.redisClient.SREM(prefix + 'platforms_idle', platid, function(err, reply) {
            if (err) {
                logger.info("Error while remove platform from platforms_idle list: " + err);
                callback(err);
                return;
            }
            Common.redisClient.ZADD(prefix + 'platforms', 0, platid, function(err, reply) {
                if (err) {
                    logger.info("Error while add platform to platforms list: " + err);
                    callback(err);
                    return;
                }
                var mailOptions = {
                    from: "support@nubosoftware.com", // sender address
                    fromname: "Nubo Support",
                    to: Common.adminEmail, // list of receivers
                    toname: Common.adminName,
                    subject: (Common.dcName != "" ? Common.dcName + " - " : "") + "Platform added to running platform list", // Subject line
                    text: 'Platform details: ' + JSON.stringify(platform.params, null, 2)
                };
                Common.mailer.send(mailOptions, function(success, message) {}); //Common.mailer.send
                callback(null);
            }); // ZADD
        }); // ZREM
    }; // this.addToRunningPlatforms

    this.addToErrorPlatforms = function(callback, silent) {
        var platid = this.params.platid;
        var platform = this;

        async.waterfall([
            function(callback) {
                Common.redisClient.ZSCORE('platforms', platid, function(err, reply) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    var score = reply ? reply : 0;
                    callback(null, score);
                });
            },
            function(score, callback) {
                Common.redisPool.acquire(function(err, client) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    callback(null, score, client);
                });
            },
            function(score, client, callback) {
                var multi = client.multi();
                multi.srem('platforms_idle', platid);
                multi.zrem('platforms', platid);
                multi.zadd('platforms_errs', score, platid);
                multi.hset('platform_' + platid, 'errorset', 'true');
                multi.exec(function(err, replies) {
                    Common.redisPool.release(client);
                    if (err) {
                        callback(err);
                        return;
                    }

                    Common.redisClient.publish("platformPoolRefresh", "Platform moved to errs");
                    callback(null);
                });
            }
        ], function(err) {
            if (err) {
                logger.error("addToErrorPlatforms: " + err);
            } else {
                logger.info("addToErrorPlatforms: Platform " + platid + " moved to errs list");
            }

            if (!silent) {
                var mailOptions = {
                    from: "support@nubosoftware.com", // sender address
                    fromname: "Nubo Support",
                    to: Common.adminEmail, // list of receivers
                    toname: Common.adminName,
                    subject: (Common.dcName != "" ? Common.dcName + " - " : "") + "Platform removed from running platform list", // Subject line
                    text: 'Platform details: ' + JSON.stringify(platform.params, null, 2)
                };
                Common.mailer.send(mailOptions, function(success, message) {}); //Common.mailer.send
            }

            callback(null);
            return;
        });
    }; // this.addToErrorPlatforms

    this.addToClosePlatforms = function(callback) {

        var platid = this.params.platid;

        Common.redisPool.acquire(function(err, client) {
            if (err) {
                logger.error("addToClosePlatforms: " + err);
                callback(err);
                return;
            }

            var multi = client.multi();
            multi.zrem('platforms', platid);
            multi.zrem('platforms_errs', platid);
            multi.srem('platforms_idle', platid);
            multi.sadd('platforms_close', platid);
            multi.exec(function(err, replies) {
                Common.redisPool.release(client);
                if (err) {
                    logger.error("addToClosePlatforms: " + err);
                    callback(err);
                    return;
                }
                logger.info("addToClosePlatforms: platform " + platid + " moved to close list");
                callback(null);
                return;
            });
        });
    };

    this.initSsh = function(sessLogger, callback) {
        var sshhost = this.params.platform_ip;
        var sshuser = 'root';
        var sshport = this.params.ssh_port;
        this.adbpre = 'ANDROID_ASSETS=/system/app LD_LIBRARY_PATH=/vendor/lib:/system/lib BOOTCLASSPATH=/system/framework/core.jar:/system/framework/conscrypt.jar:/system/framework/okhttp.jar:/system/framework/core-junit.jar:/system/framework/bouncycastle.jar:/system/framework/ext.jar:/system/framework/framework.jar:/system/framework/framework2.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/mms-common.jar:/system/framework/android.policy.jar:/system/framework/services.jar:/system/framework/apache-xml.jar:/system/framework/webviewchromium.jar EXTERNAL_STORAGE=/storage/emulated/legacy sh -c ';
        var platid = this.params.platid
        logger = sessLogger;

        if (Common.useADB) {
            sshhost = this.params.sshhost;
            sshuser = this.params.sshuser;
            this.adbpre = 'adb -s ' + this.params.platformline + ' shell ';
        }

        function sshconnect(platform, retries) {
            //      new SimpleSSH(sshhost, sshuser, function(err, sshobj) {
            SimpleSSH({
                    host: sshhost,
                    port: (sshport ? sshport : 22),
                    username: sshuser
                },
                {
                    logger: sessLogger
                },
                function(err, sshobj) {
                    if (err) {
                        var msg = "Error on open ssh to platform " + platid + ": " + err;
                        sessLogger.info(msg);
                        retries--;
                        if (retries > 0) {
                            sessLogger.info("Will retry ssh connect after 500ms");
                            setTimeout((function() {
                                sshconnect(platform, retries);
                            }), 500); // setTimeout
                        } else {
                            callback(msg);
                        }
                    } else {
                        platform.ssh = sshobj;
                        callback(null, sshobj);
                    }
                }
            );
        }
        sshconnect(this, 10);
    }; // this.initSsh

    this.increaseFails = function(callback) {
        Common.redisClient.ZINCRBY("platforms_fails", 1, this.params.platid, callback);
    }

    this.resetFails = function(callback) {
        Common.redisClient.ZREM("platforms_fails", this.params.platid, callback);
    }

    // increase (decrece) refernce to number of sessions in platform
    this.increaseReference = function(inc, callback) {
        var platid = this.params.platid;

        var platList = (this.params.errorset === 'true') ? 'platforms_errs' : 'platforms';
        Common.redisClient.ZINCRBY(platList, inc, platid, function(err) {
            if (err) {
                var msg = "Error on set updatePlatformReference: " + err;
                callback(msg);
                return;
            }
            callback(null);
        });
    }

    this.execWithTimeout = function(cmd, timeout, callback) {
        logger.warn("!!!!WARNING run on Platform " + platid + " cmd: " + cmd);
        (function(plat) {
            var cmd_full = plat.adbpre + '"' + cmd.replace(/(["'$`\\])/g, "\\$1") + '"';
            if (plat.ssh === null) {
                plat.initSsh(logger, function(err, obj) {
                    if (err) {
                        callback(err, 11, null, ""); //errno 11 - EAGAIN - Try again
                    } else {
                        plat.execWithTimeout(cmd, timeout, callback);
                    }
                });
            } else {
                var cmd_full = plat.adbpre + '"' + cmd.replace(/(["'$`\\])/g, "\\$1") + '"';
                plat.ssh.execWithTimeout(cmd_full, timeout, callback);
            }
        })(this);
    };

    this.exec = function(cmd, callback) {
        this.execWithTimeout(cmd, 60000, callback);
    };

    this.testServiceRun = function(callback) {
        var options = {
            host : self.params.platform_ip,
            port: 3333,
            path : "/",
            method : "GET",
            rejectUnauthorized : false,
        };
        http.doGetRequest(options, function(err, resData) {
            if(err) {
                callback(err);
            } else {
                if(resData === "OK") {
                    logger.debug("service on linux running");
                    callback(null);
                } else {
                    callback("invalid response");
                }
            }
        });
    };

    this.waitServiceRun = function(timeout, callback) {
        var timeoutFlag = false;
        logger.debug("Waiting upto " + timeout + " seconds for service on linux...");
        var timeoutObj = setTimeout((function() {
            timeoutFlag = true;
        }), timeout * 1000); // setTimeout
        var connectionFlag = false;
        async.whilst(
            function() { return !(timeoutFlag || connectionFlag); },
            function(callback) {
                self.testServiceRun(function(err) {
                    if(err) {
                        setTimeout(callback, 1000);
                    } else {
                        clearTimeout(timeoutObj);
                        connectionFlag = true;
                        callback(null);
                    }
                });
            },
            function(err) {
                if(connectionFlag) {
                    callback(null);
                } else {
                    callback("timeout");
                }
            }
        );
    }

    this.startPlatform = function(descPlatform, callback) {
        var postData = JSON.stringify(descPlatform);
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/startPlatform",
            method: "POST",
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': postData.length
            },
        };

        http.doPostRequest(options, postData, function(err, resData) {
            if (err) {
                callback(err);
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null, resObj);
                else
                    callback("Request return error " + resData);
            }
        });
    };

    this.testStartPlatform = function(callback) {
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/startPlatform",
            method: "GET",
            rejectUnauthorized: false,
        };

        http.doGetRequest(options, function(err, resData) {
            if (err) {
                logger.error('problem with request: ' + err);
                callback(err);
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null, resObj);
                else
                    callback("Request return error", resObj);
            }
        });
    };

    this.attachUser = function(session, timeZone, callback) {
        var logger = session.logger;
        var nfs = session.nfs || {
            params: {
                nfs_ip: "192.168.122.1",
                nfs_path: Common.nfshomefolder
            }
        };

        var postData = JSON.stringify({
            login: session.login.loginParams,
            session: session.params,
            nfs: nfs.params,
            timeZone: timeZone
        });
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/attachUser",
            method: "POST",
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': postData.length
            },
        };

        http.doPostRequest(options, postData, function(err, resData) {
            if (err) {
                logger.error('problem with request: ' + err);
                callback(err, {
                    addToErrorsPlatforms: true
                });
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null, resObj.localid);
                else
                    callback("Request return error " + resData);
            }
        });
    };

    this.detachUser = function(session, callback) {
        var UNum = session.params.localid;
        var logger = session.logger;

        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/detachUser?unum=" + UNum,
            method: "GET",
            rejectUnauthorized: false,
        };

        http.doGetRequest(options, function(err, resData) {
            if (err) {
                logger.error('problem with request: ' + err);
                callback(err, {
                    addToErrorsPlatforms: true
                });
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null);
                else
                    callback("Request return error " + resData);
            }
        });
    };

    this.installApk = function(obj, callback) {
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/installApk?apk=" + encodeURIComponent(obj.path),
            method: "GET",
            rejectUnauthorized: false,
        };

        http.doGetRequest(options, function(err, resData) {
            if (err) {
                logger.error('problem with request: ' + err);
                callback(err, {
                    addToErrorsPlatforms: true
                });
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null);
                else
                    callback("Request return error " + resData);
            }
        });
    };

    this.attachApps = function(tasks, callback) {
        var postData = JSON.stringify({
            tasks: tasks
        });
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/attachApps",
            method: "POST",
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': postData.length
            },
        };

        http.doPostRequest(options, postData, function(err, resData) {
            if (err) {
                logger.error('problem with request: ' + err);
                callback(err, {
                    addToErrorsPlatforms: true
                });
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null, resObj);
                else
                    callback("Request return error " + resData);
            }
        });
    };

    this.getPackagesList = function(filter, callback) {
        var path = "/getPackagesList";
        if (typeof filter === 'function') callback = filter;
        else path += "?filter=" + encodeURIComponent(filter);
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: path,
            method: "GET",
            rejectUnauthorized: false,
        };

        http.doGetRequest(options, function(err, resData) {
            if (err) {
                logger.error('problem with request: ' + err);
                callback(err, {
                    addToErrorsPlatforms: true
                });
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null, resObj.data);
                else
                    callback("Request return error " + resData);
            }
        });
    };

    this.checkStatus = function(userName, deviceID, callback){
        var params = "?username=" + userName + "&deviceid=" + deviceID + "&platformip=" + this.params.platform_ip;
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/checkPlatformStatus" + params,
            method: "GET",
            rejectUnauthorized: false,
        };

        http.doGetRequest(options, function(err, resData) {
            if (err) {
                logger.error('checkStatus: problem with request: ' + err);
                callback(err);
                return;
            }

            var resObj = JSON.parse(resData);
            if (resObj.status === 1)
                callback(null);
            else{
                var errMsg = 'checkStatus: ' + resObj.error;
                logger.error(errMsg);
                callback(errMsg);
            }
        });
        return;
    }

    this.refreshMedia = function(unum, paths, callback) {
        var postObj = {
            unum: unum,
            paths: paths
        };
        var postData = JSON.stringify(postObj);
        var options = {
            host: this.params.platform_ip,
            port: 3333,
            path: "/refreshMedia",
            method: "POST",
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': postData.length
            },
        };

        http.doPostRequest(options, postData, function(err, resData) {
            if (err) {
                logger.error('problem with request: ' + err);
                callback(err, {
                    addToErrorsPlatforms: true
                });
            } else {
                var resObj = JSON.parse(resData);
                if (resObj.status === 1)
                    callback(null, resObj);
                else
                    callback("Request return error " + resData);
            }
        });
    };

    this.applyFirewall = function(tasks, callback) {
        if (Common.platformType === "kvm") {
            callback(null);
        } else {
            var postData = JSON.stringify({
                tasks: tasks
            });
            var options = {
                host: this.params.platform_ip,
                port: 3333,
                path: "/applyFirewall",
                method: "POST",
                rejectUnauthorized: false,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': postData.length
                },
            };

            http.doPostRequest(options, postData, function(err, resData) {
                var resObj;
                if (err) {
                    logger.error('problem with request: ' + err);
                    callback(err);
                } else {
                    try {
                        resObj = JSON.parse(resData);
                    } catch (e) {
                        logger.error("bad response on applyFirewall: " + resData);
                        resObj = {};
                    }
                    if (resObj.status === 1) {
                        callback(null, resObj);
                    } else {
                        callback("Request return error: " + resData, resObj);
                    }
                }
            });
        }
    };

    if (platid == null) { // generate new platform
        (function(plat) {

            function getPlatID(callback) {
                if (newplatid) {
                    callback(null, newplatid);
                    return;
                } else {
                    Common.redisClient.INCR(prefix + 'platformseq', function(err, reply) {
                        if (err) {
                            logger.info("err:" + err);
                            if (callback) callback(err, 0);
                            return;
                        }
                        callback(null, reply);
                        return;
                    }); // INCR
                }
            }
            getPlatID(function(err, reply) {
                if (err) {
                    if (callback) callback(err, plat);
                    return;
                }
                console.log('platid=' + reply);
                //Common.redisClient.ZADD('platforms',0,reply,function(err,reply){
                //});
                plat.params.platid = reply;
                plat.save(callback);
            });


        })(this); //function (plat)


    } else { // load an existing platform
        (function(plat) {
            var reply = Common.redisClient.hgetall('platform_' + plat.params.platid, function(err, obj) {
                //console.dir(obj);
                if (err) {
                    logger.info("err:" + err);
                    callback(err, plat);
                    return;
                }
                if (obj != null) {
                    plat.params = obj;
                    callback(err, plat);
                    return;
                } else {
                    logger.info("Cannot find platform " + plat.params.platid);
                    callback("Cannot find platform " + plat.params.platid, null);
                    return;
                }
            }); //hgetall
        })(this); // function (sess)
    } // else // load an existing session
};

var DeleteAll = function(platType) {
    var prefix = (platType ? platType + "_" : "");
    Common.redisClient.ZRANGE(prefix + 'platforms', 0, -1, function(err, replies) {
        console.log(replies.length + " replies:");
        replies.forEach(function(reply, i) {
            console.log("    " + i + ": " + reply);
            new Platform(reply, platType, function(err, obj) {
                if (err) {
                    console.log("Error: " + err);
                    return;
                }
                console.log('Platform: ' + JSON.stringify(obj.params, null, 2));
                deletePlatform(reply, function(err, obj) {
                    if (err) {
                        console.log("Error: " + err);
                        return;
                    }
                });
            });
        });
    });
};

/**
 *  getAvailablePlatform
 *	Found the least loaded platform to start a new session in
 * @returns {}
 */
var getAvailablePlatform = function(platType, dedicatedPlatID, logger, callback) {
    var prefix = (platType ? platType + "_" : "");
    var lock = null;
    var platid = null;

    if (!dedicatedPlatID) {
        async.waterfall([
            function(callback) {
                Common.redisClient.ZCARD(prefix + 'platforms', callback);
            },
            function(nPlatfrorms, callback) {
                // Connect to platforms with less users.
                // Choose platform from half of exist platforms with less users, but no more that 10 possible platforms
                var front = Math.min(Common.platformParams.choosePool, Math.ceil(nPlatfrorms / 2));
                var method;
                if (Common.platformParams.cleanPlatformsMode) {
                    Common.redisClient.ZREVRANGEBYSCORE(
                        prefix + 'platforms', '(' + Common.platformParams.usersPerPlatform, '-inf',
                        "LIMIT", 0, front,
                        function(err, replies) {
                            callback(err, replies)
                        }
                    );
                } else {
                    Common.redisClient.ZRANGEBYSCORE(
                        prefix + 'platforms', '-inf', '(' + Common.platformParams.usersPerPlatform,
                        "LIMIT", 0, front,
                        function(err, replies) {
                            callback(err, replies)
                        }
                    );
                }
            },
            function(platIds, callback) {
                if (!platIds.length) {
                    callback("Empty pool");
                    return;
                }
                if (platType === "ex") {
                    var platId = platIds[Math.floor(Math.random() * platIds.length)];
                    callback(null, platId);
                } else {
                    // Pass platform one-by-one and try lock some
                    async.detectSeries(platIds, function(platId, callback) {
                        lock = new Lock({
                            key: 'lock_platform_' + platId,
                            logger: logger,
                            numberOfRetries: 0,
                            waitInterval: 0,
                            lockTimeout: 1000 * 60 * 5 // 5 minutes
                        });

                        lock.acquire(function(err, replay) {
                            if (err || !replay) {
                                callback(false);
                                return;
                            }
                            platid = platId;
                            callback(true);
                        });
                    }, function(found) {
                        if (found)
                            callback(null, platid);
                        else
                            callback("cannot lock any platform");
                    });
                }
            },
            function(platId, callback) {
                new Platform(platId, platType, function(err, obj) {
                    if (err) {
                        callback("Platform load error", null);
                        return;
                    }
                    callback(null, obj);
                });
            },
            function(platobj, callback) {
                platobj.increaseReference(1, function(err) {
                    callback(err, platobj);
                });
            }
        ], function(err, platobj) {
            if (err) {
                logger.error("getAvailablePlatform: " + err);
                if (lock && lock.isAquired()) {
                    lock.release(function(lockErr, replay) {
                        callback(err);
                        return;
                    });
                }
                callback(err);
            } else {
                callback(null, platobj, lock);
            }
        });
    } else {
        async.waterfall([
            function(callback) {
                lock = new Lock({
                    key: 'lock_platform_' + dedicatedPlatID,
                    logger: logger,
                    numberOfRetries: 30,
                    waitInterval: 500,
                    lockTimeout: 1000 * 60 * 5 // 5 minutes
                });

                lock.acquire(function(err, replay) {
                    if (err) {
                        callback(err);
                    } else if (!replay) {
                        callback('couldn\'t lock dedicated platform ID');
                    } else {
                        callback(null, dedicatedPlatID);
                    }
                });
            },
            function(platId, callback) {
                new Platform(platId, platType, function(err, obj) {
                    if (err) {
                        callback("Platform load error", null);
                        return;
                    }    
                    callback(null, obj);
                });
            },
            function(platform, callback) {
                platobj.increaseReference(1, function(err) {
                    callback(err, platobj);
                });
            }
        ], function(err) {
            if (err) {
                logger.error("getAvailablePlatform: " + err);
                if (lock && lock.isAquired()) {
                    lock.release(function(lockErr, replay) {
                        callback(err);
                        return;
                    });
                }
                callback(err);
            } else {
                callback(null, platobj, lock);
            }
        });
    }
}

var killPlatform = function(platid, platType, callback) {
    var platform = null;
    var timeLog = new TimeLog();
    var errorToMail = "";

    async.series([
        // load platform
        function(callback) {
            new Platform(platid, platType, function(err, obj) {
                if (err || !obj) {
                    var msg = "killPlatform: Platform " + platid + " does not exist. err: " + err;
                    errorToMail = msg + "\n";
                    logger.error(msg);
                    callback(null);
                    return;
                }

                platform = obj;
                callback(null);
            });
        },
        // move all sessions of this platform to suspend
        function(callback) {
            var sessionsExist = true;
            async.whilst(
                function() {
                    return (sessionsExist);
                },
                function(callback) {
                    Common.redisClient.SMEMBERS('platsesslist_' + platid, function(err, sessions) {
                        if (err) {
                            var msg = "killPlatform: couldn't get session list of platform " + platid + " err: " + err;
                            errorToMail += msg + "\n";
                            logger.error(msg);
                            callback(err);
                            return;
                        }
                        if (!sessions || sessions.length == 0) {
                            sessionsExist = false;
                            callback(null);
                            return;
                        }

                        async.eachSeries(sessions, function(sessionID, cb) {
                            new Session(sessionID, function(err, session) {
                                if (err) {
                                    logger.error("killPlatform: " + err);
                                    cb(err);
                                    return;
                                }
                                if (session.params.forceExit == 1 || session.params.deleteFlag == 1 || session.params.deleteError == 1) {
                                    cb(null);
                                    return;
                                }

                                session.forceExit(function(err) {
                                    if (err) {
                                        logger.error("killPlatform: " + err);
                                        cb(err);
                                        return;
                                    }

                                    cb(null);
                                });
                            });
                        }, function(err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            setTimeout(function() {
                                //waiting for all sessions to exit gracefully
                                callback(null);
                            }, 10000);
                        });
                    });
                }, callback);
        },
        // kill emulator process
        function(callback) {
            if (validtypes.indexOf(Common.platformType) === -1) {
                var msg = "killPlatform: wrong platform type";
                errorToMail += msg + "\n";
                logger.error(msg);
                callback(null);
                return;
            }

            if (platform != null) {
                require('./platform_' + Common.platformType + '.js').stop_platform(
                    platform, platType,
                    function(err, obj) {
                        if (err) {
                            var msg = "killPlatform: couldn't stop platform " + platid + " err: " + err;
                            errorToMail += msg + "\n";
                            logger.error(msg);
                            callback(null);

                        } else {
                            platform = obj;
                            callback(null);
                        }
                    }
                );
            } else {
                callback(null);
            }
        },
        // delete platform
        function(callback) {
            deletePlatform(platid, function(err) {
                if (err) {
                    var msg = "killPlatform: error deleting platform " + platid;
                    errorToMail += msg + "\n";
                    callback(null);
                    return;
                }
                callback(null);
            });
        }
    ], function(err, results) {
        timeLog.logTime("killPlatform");
        if (errorToMail) {
            logger.error("killPlatform: error removing platform " + platid);
        } else {
            logger.info("killPlatform: platform " + platid + " removed successfully");
        }

        if (platform != null) {
            var mailOptions = {
                from: "support@nubosoftware.com", // sender address
                fromname: "Nubo Support",
                to: Common.adminEmail, // list of receivers
                toname: Common.adminName,
                subject: (errorToMail == null ? "Platform " + platid + " deleted successfully" : "Platform " + platid + " deleted unsuccessfully"), // Subject line
                text: (errorToMail ? 'Platform delete error: ' + errorToMail : '') + '\nPlatform details: ' + JSON.stringify(platform.params, null, 2)
            }

            //mailOptions.html = mailOptions.text.replace(/\n/g, "<br />");

            Common.mailer.send(mailOptions, function(success, message) {}); //Common.mailer.send
        }
        if (callback)
            callback(errorToMail);
    });
}

var registerAvailPlatform = function(hostline, top, platType, callback) {


    var lock = new Lock({
        key: "lock_find_avalible_platform_id",
        logger: logger,
        numberOfRetries: 20,
        waitInterval: 500,
        lockTimeout: 1000 * 60 // one minute max lock
    });

    lock.cs(
        //critical section function
        function(callback) {
            var avaliblePlatID = Common.startPlatformNum;
            var maxIterations = 10000; //arbitry max check to avoid infinite loop
            var foundAvaliblePlatID = false;

            async.whilst(
                //loop until avalible platform ID found or until reached MAX.
                function() {
                    var notFound = (!foundAvaliblePlatID && avaliblePlatID < maxIterations);
                    return (notFound === true);
                },
                //check in all platforms lists (working, idle and errs) if avaliblePlatID used
                function(callback) {
                    Common.redisPool.acquire(function(err, client) {
                        var multi = client.multi();
                        multi.zscore('platforms', avaliblePlatID);
                        multi.zscore('platforms_errs', avaliblePlatID);
                        multi.SISMEMBER('platforms_idle', avaliblePlatID);
                        multi.SISMEMBER('platforms_close', avaliblePlatID);
                        multi.exec(function(err, replies) {
                            Common.redisPool.release(client);
                            if (err) {
                                var errMsg = "cannot get data from redis err: " + err;
                                callback(errMsg);
                                return;
                            }
                            if (replies[0] == null && replies[1] == null && replies[2] == 0 && replies[3] == 0)
                                foundAvaliblePlatID = true;
                            else
                                ++avaliblePlatID;

                            callback(null);
                            return;
                        });
                    });
                },
                //finish on error or if avalible platform ID found 
                function(err) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    if (foundAvaliblePlatID) {
                        Common.redisClient.sadd('platforms_idle', avaliblePlatID, function(err, reply) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            logger.info("registerAvailPlatform: found avalible ID for platform --> ", avaliblePlatID);
                            callback(null, avaliblePlatID);
                        });
                    } else {
                        var errMsg = "reached maximum of platforms and didn't found avalible platform";
                        callback(errMsg);
                    }
                }
            );
        },
        //callback when critical section finished
        function(err, platID) {
            if (err) {
                var errMsg = "registerAvailPlatform: " + (err ? err : '');
                logger.error(errMsg);
                callback(err);
                return;
            }

            //if found register platfrom with foundAvaliblePlatID
            var port = Common.platfromPortStart + (platID * 2);
            var ip = Common.platformIPPrefix + (10 + platID);
            var tun = 'tun' + (platID + 1);
            logger.info("registerAvailPlatform: Starting platform: " + platID + ", port: " + port + ", ip: " + ip + ", tun: " + tun);
            registerPlatform(platID, hostline, platType, callback);
        }
    );
}

var registerPlatformNum = function(_opts, callback) {

    var opts = {};
    var maxFailed = isNaN(Common.platformParams.maxFailed) ? 10 : Common.platformParams.maxFailed;
    opts.min = _opts.min || Common.startPlatformNum;
    opts.max = _opts.max || (Common.startPlatformNum + Common.platformParams.maxCapacity/Common.platformParams.usersPerPlatform - 1 + maxFailed); //allow upto 10 in bad states
    opts.hostline = (_opts.hostline === undefined) ? Common.hostline : _opts.hostline;
    opts.platType = _opts.platType || "";
    var logger = _opts.logger || Common.logger;

    var lock = new Lock({
        key: "lock_find_avalible_platform_id",
        logger: logger,
        numberOfRetries: 20,
        waitInterval: 500,
        lockTimeout: 1000 * 60 // one minute max lock
    });

    lock.cs(
        //critical section function
        function(callback) {
            var curPlatID = opts.min;
            var maxPlatID = opts.max;
            var foundAvaliblePlatID = false;

            async.whilst(
                //loop until avalible platform ID found or until reached MAX.
                function() {
                    var notFound = (!foundAvaliblePlatID && curPlatID <= maxPlatID);
                    return notFound;
                },
                //check in all platforms lists (working, idle and errs) if avaliblePlatID used
                function(callback) {
                    Common.redisPool.acquire(function(err, client) {
                        var multi = client.multi();
                        multi.zscore('platforms', curPlatID);
                        multi.zscore('platforms_errs', curPlatID);
                        multi.SISMEMBER('platforms_idle', curPlatID);
                        multi.SISMEMBER('platforms_close', curPlatID);
                        multi.zscore('platforms_fails', curPlatID);
                        multi.exec(function(err, replies) {
                            Common.redisPool.release(client);
                            if (err) {
                                var errMsg = "cannot get data from redis err: " + err;
                                callback(errMsg);
                                return;
                            }
                            if (replies[0] === null && replies[1] === null && replies[2] === 0 && replies[3] === 0 && (replies[4] < Common.platformParams.maxFails))
                                foundAvaliblePlatID = true;
                            else
                                curPlatID++;

                            callback(null);
                            return;
                        });
                    });
                },
                //finish on error or if avalible platform ID found
                function(err) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    if (foundAvaliblePlatID) {
                        Common.redisClient.sadd('platforms_idle', curPlatID, function(err, reply) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            logger.info("registerPlatformNum: found avalible ID for platform --> ", curPlatID);
                            callback(null, curPlatID);
                        });
                    } else {
                        var errMsg = "Cannot allocate platform index in range [" + opts.min + ", " + opts.max + "]";
                        callback(errMsg);
                    }
                }
            );
        },
        //callback when critical section finished
        function(err, platID) {
            if (err) {
                var errMsg = "registerPlatformNum: " + (err ? err : '');
                logger.error(errMsg);
                callback(err);
            } else {
                registerPlatform(platID, opts.hostline, opts.platType, callback);
            }
        }
    );
}

//python register_platform.py --host='nubodev@172.16.2.108' --gateway='172.16.2.108' -p 5560 -t tun2 --ip='192.168.122.12' --top=/home/nubodev/Android/nubo-production/nuboplatform
var registerPlatform = function(platid, hostline, platType, callback) {
    var prefix = (platType ? platType + "_" : "");
    var platfromCreated = false;
    var platform = null;
    var timeLog = new TimeLog();
    var re = new RegExp('(.*)@(.*)');
    var m = re.exec(hostline);
    var sshhost = null;
    var sshuser = null;
    if (m != null && m.length >= 3) {
        sshhost = m[2];
        sshuser = m[1];
    }

    var localServerURL = Common.localserverurl;
    if (localServerURL == null)
        localServerURL = Common.serverurl;
    var instanceID = "";

    async.series([
            // step 4 create platform
            function(callback) {
                new Platform(null, platType, function(err, plat) {
                    if (err) {
                        callback("Unable to create platform in DB: " + err);
                        return;
                    }
                    console.log('Platform: ' + JSON.stringify(plat.params, null, 2));
                    platform = plat;
                    timeLog.logTime("new Platform");
                    callback(null);
                }, platid); // new Platform	  
            },
            function(callback) {
                createApksPath(callback);
            },
            // step start platform
            function(callback) {
                if (Common.platformType.indexOf('kvm') === 0) {
                    platform.appendAttributes({
                        'sshhost': sshhost,
                        'sshuser': sshuser
                    });
                }

                if (validtypes.indexOf(Common.platformType) === -1) {
                    callback("Wrong platform type");
                } else {
                    require('./platform_' + Common.platformType + '.js').start_platform(
                        platform, platType,
                        function(err, obj) {
                            if (err) {
                                platform.increaseFails(function() {});
                                callback(err);
                            } else {
                                platform = obj;
                                callback(null);
                            }
                        }
                    );
                }
            },
            // step upload platform params to db
            function(callback) {
                platform.save(function(err) {
                    callback(err);
                });
            },
            function(callback) {
                if (Common.platformType === "kvm") {
                    postBootProcedure(platform, logger, callback);
                } else {
                    callback(null);
                }
            }
        ],
        function(err, results) {
            logger.info("Finished all. results.length: " + results.length + ", err: " + err);
            timeLog.logTime("finish start platform");
            if (platform.ssh != null)
                platform.ssh.end();

            if (err && platform != null) {
                // remove platform from running platforms
                platform.addToErrorPlatforms(function(err1) {
                    if (err1) {
                        logger.error("registerPlatform: error while removing platform from platforms_errs list: " + err1);
                    }
                    Common.redisClient.SREM(prefix + 'platforms_idle', platid, function(err2, reply) {
                        if (err2) {
                            logger.error("registerPlatform: error while removing platform from platforms_idle list: " + err2);
                        }
                        callback(err)
                    });
                });
            } else {
                platform.resetFails(function() {});
                callback(null);
            }
        }); //async.series([

}
var postBootProcedure = function(platform, logger, callback) {
    async.series([
        // check ssh connection to new plaform
        function(callback) {
            platform.initSsh(logger, function(err) {
                if (err) {
                    logger.info("Cannot connect to created platform, err:" + err);
                }
                callback(err);
            });
        },
        // Mount /data/tmp
        function(callback) {
            // We're not unmounting this directory in any case!!
            mountTmpDir(platform, function(err) {
                callback(err);
            });
        },
        function(callback) {
            var cmd = "enable_houdini;pm refresh 0";
            logger.info("cmd: " + cmd);
            platform.exec(cmd, function(err, code, signal, sshout) {
                callback(null);
            });
        },
        function(callback) {
            if (Common.withService) {
                var cmd = "setprop ro.kernel.withService withService";
                platform.exec(cmd, function(err, code, signal, sshout) {
                    callback(null);
                });
            } else {
                callback(null);
            }
        },
        function(callback) {
            if (Common.hideControlPanel) {
                var cmd = "setprop ro.kernel.hideControlPanel hideControlPanel";
                platform.exec(cmd, function(err, code, signal, sshout) {
                    callback(null);
                });
            } else {
                callback(null);
            }
        }
    ], callback);
};

var retryInstallOnPlatform = function(platform, apkName, platid, retries, wait, callback) {
    var cmd = 'pm install --user 0 -r ' + apkName;
    platform.exec(cmd, function(err, code, signal, sshout) {
        // Handle case where this specific apk cannot be installed on platforms
        var re = new RegExp('.*Failure \\[(.*)\\]');
        var installErr = re.exec(sshout);
        if (installErr != null && installErr.length == 2) {
            callback('Problem: ' + installErr[1]); // Return the error from platform
            return;
        }
        if (!err) {
            logger.info('Successfully installed ' + apkName + ' on platform' + platid);
            callback(null);
            return;
        }
        if (retries <= 0) {
            logger.info('Timeout during install on platform ' + platid);
            callback('Error during install on platform ' + platid);
        } else {
            logger.info('Installing on platform ' + platid + ', retries: ' + retries);
            setTimeout(function() {
                retryInstallOnPlatform(retries - 1, apkName, platid, wait, logger, callback);
            }, wait);
        }
    });
}


function getPlatformApksPath() {
    var pathToAPKs = '/data/tmp';
    return pathToAPKs;
}


function getPathToNfs() {
    var re = new RegExp('(.*)@(.*)');
    var m = re.exec(Common.nfsserver);
    var nfs = null;
    if (m != null && m.length >= 3) {
        nfs = m[2];
    }
    var nfspath = nfs + ":" + Common.nfshomefolder;
    return nfspath;
}


function getLocalApksPath() {
    var pathToAPKs = Common.nfshomefolder + '/apks/';
    return pathToAPKs;
}

// Make sure apks path exists
function createApksPath(callback) {
    var pathToAPKs = getLocalApksPath();
    Common.fs.mkdir(pathToAPKs, '0755', function(err) {
        if (err) {
            if (err.code == 'EEXIST') {
                callback(null);
            } else
                callback(err);
        } else
            callback(null);
    });
}

function mountTmpDir(platform, callback) {
    var tmpDir = getPlatformApksPath();
    var nfsoptions = "nolock,hard,intr,vers=3,nosharecache,noatime,async,unum=0"; //user 0
    var mask = [false];
    var pathToNfs = getPathToNfs() + '/apks/';
    var src = [pathToNfs];
    var dst = [tmpDir];

    require('./mount.js').mountnfs(src, dst, mask, null, null, platform, nfsoptions, function(err) {
        if (err) {
            logger.info(err);
        }
        callback(err);
    });
}

var installAPKOnPlatform = function(platid, platType, apkName, callback) {
    var ssh = null;
    var platform = null;
    var timeLog = new TimeLog();

    async.series([
        // load platform
        function(callback) {
            new Platform(platid, platType, function(err, obj) {
                if (err || !obj) {
                    var msg = "Platform does not exist. err:" + err;
                    logger.info(msg);
                    callback(msg);
                    return;
                }
                logger.info('Platform found: ' + JSON.stringify(obj.params, null, 2));
                platform = obj;
                callback(null);
            });
        },

        // Install apk
        function(callback) {
            if (Common.platformType === "kvm") {
                platform.initSsh(logger, function(err) {
                    var retries = 4;
                    var wait = 2000;
                    if (err) callback(err);
                    else retryInstallOnPlatform(platform, apkName, platid, retries, wait, callback);
                });
            } else {
                platform.installApk({
                    path: apkName,
                    logger: logger
                }, callback);
            }
        },
        //update new package name in redis
        function(callback) {
            if (Common.platformType === "kvm") {
                var cmd = "cat /data/system/packages.list | grep " + apkName.slice(10, -4);
                logger.info("cmd: " + cmd);
                platform.exec(cmd, function(err, code, signal, sshout) {
                    if (err) {
                        var msg = "ERROR:update new package name in redis: cannot connect to plat " + err;
                        callback(msg);
                        return;
                    } else {
                        var packagesObjArray = [];
                        var lines = sshout.split("\n");
                        lines.forEach(function(line) {
                            if (line !== "") {
                                var fields = line.split(" ");
                                var packagesObj = {
                                    packageName: fields[0],
                                    offset: fields[1]
                                };
                                packagesObjArray.push(packagesObj);
                            }
                        });
                        firewall.saveAppsUID(packagesObjArray, platid, function(err) {
                            if (err) {
                                var msg = "ERROR:saveAppsUID: cannot connect save package name " + err;
                                callback(msg);
                                return;
                            } else {
                                callback(null);
                            }

                        });
                    }

                });
            } else {
                platform.getPackagesList(apkName.slice(10, -4), function(err, packagesObjArray) {
                    firewall.saveAppsUID(packagesObjArray, platid, function(err) {
                        if (err) {
                            var msg = "ERROR:saveAppsUID: cannot connect save package name " + err;
                            callback(msg);
                        } else {
                            callback(null);
                        }
                    });
                });
            }
        }

    ], function(err, results) {
        if (err) {
            logger.info('Error during platform install : ' + err);
        } else {
            logger.info('Installed apk on platforms successfully');
        }
        if ((platform != null) && (platform.ssh != null)) {
            platform.ssh.end();
        }

        if (callback) {
            callback(err);
        }
    });

}

//update platform with a new rule for online users
var addOnlineRuleToPlatform = function(platid, platType, rule, callback) {
    var ssh = null;
    var platform = null;

    async.series([
        // load platform
        function(callback) {
            new Platform(platid, platType, function(err, obj) {
                if (err || !obj) {
                    var msg = "Platform does not exist. err:" + err;
                    logger.info(msg);
                    callback(msg);
                    return;
                }
                logger.info('Platform found: ' + JSON.stringify(obj.params, null, 2));
                platform = obj;
                callback(null);
            });
        },

        function(callback) {
            var retries = 4;
            var wait = 2000;
            platform.initSsh(logger, function(err) {
                callback(err);
            });
        },

        function(callback) {
            var cmd = rule;
            logger.info("cmd: " + cmd);
            platform.exec(cmd, function(err, code, signal, sshout) {
                if (err) {
                    var msg = "ERROR:: cannot connect to plat " + err;
                    callback(msg);
                    return;
                } else {
                    callback(null);
                }

            });
        }
    ], function(err, results) {
        if (err) {
            logger.info('Error during update online rule : ' + err);
        } else {
            logger.info("Successfully updated online rule");
        }
        if (platform.ssh != null) {
            platform.ssh.end();
        }

        if (callback)
            callback(err);
    });

}

var deletePlatform = function(platid, callback) {
    Common.redisPool.acquire(function(err, client) {
        if (err) {
            logger.error("deletePlatform: error in redisPool.acquire (platform " + platid + ") err: " + err);
            callback(err);
            return;
        }

        var multi = client.multi();
        multi.del('platform_' + platid + '_packagesUID');
        multi.del('platform_' + platid);
        multi.zrem('platforms', platid);
        multi.zrem('platforms_errs', platid);
        multi.srem('platforms_idle', platid);
        multi.srem('platforms_close', platid);
        multi.exec(function(err, replies) {
            Common.redisPool.release(client);
            if (err) {
                logger.error("deletePlatform: error while deleting platform " + platid + ". err: " + err);
                callback(err);
                return;
            }

            callback(null);
            return;
        });
    });
}

function checkPlatformStatus(userName, deviceID, platform, logger, callback) {

    if (Common.platformType != 'kvm') { // do not do that command if its not kvm
        platform.checkStatus(userName, deviceID, callback);
    } else {

        async.series([
            //check platform responsiveness
            function(callback) {
                var cmd = "pm list users";
                platform.exec(cmd, function(err, code, signal, sshout) {
                    if (err) {
                        var msg = "Error in adb shell: " + err;
                        callback(msg);
                        return;
                    }
                    callback(null);
                }); // ssh.exec
            }, //function(callback)
            // Check userlist.xml file exists
            function(callback) {
                var cmd = "netcfg";
                platform.exec(cmd, function(err, code, signal, sshout) {
                    if (err) {
                        var msg = "Error in adb shell: " + err;
                        callback(msg);
                        return;
                    }
                    var n = sshout.search("eth0[\t ]*UP[\t ]*" + platform.params.platform_ip + "/");
                    if (n >= 0) {
                        callback(null);
                    } else {
                        callback("dead platform");
                    }
                }); // ssh.exec
            }, //function(callback)
            // Check if such user already exist and !!!do nothing!!!
            function(callback) {
                // skip this check
                callback(null);
                return;

                var cmd = 'grep "<name>' + UserName + deviceID + '</name>" /data/system/users/[0-9]*.xml';
                platform.exec(cmd, function(err, code, signal, sshout) {
                    if (err) {
                        var msg = "Error in adb shell: " + err;
                        callback(msg);
                        return;
                    }
                    var n = sshout.indexOf(UserName);
                    if (n >= 0) {
                        var msg = "Error Duplicate user id";
                        callback(msg);
                        return;
                    }
                    callback(null);
                }); // ssh.exec
            }
        ], function(err) {
            if (err) {
                logger.error("checkPlatformStatus: " + err);
                callback(err);
                return;
            }

            callback(null);
        });
    }
}

module.exports = {
    Platform: Platform,
    DeleteAll: DeleteAll,
    getAvailablePlatform: getAvailablePlatform,
    registerPlatform: registerPlatform,
    killPlatform: killPlatform,
    installAPKOnPlatform: installAPKOnPlatform,
    registerAvailPlatform: registerAvailPlatform,
    registerPlatformNum: registerPlatformNum,
    addOnlineRuleToPlatform: addOnlineRuleToPlatform,
    checkPlatformStatus: checkPlatformStatus
};
