"use strict";

/*
 * In this class install multiple apps to multi profiles and devices.
 */

var Common = require('./common.js');
var logger = Common.logger;
var sessionModule = require('./session.js');
var Session = sessionModule.Session;
var setting = require('./settings.js');
var util = require('util');
var async = require('async');
var User = require('./user.js');
var exec = require('child_process').exec;
var mount = require('./mount.js');
var eventLog = require('./eventLog.js');
var firewall = require('./firewall.js');
var _ = require('underscore');

// Lock constants
var LOCK_TIMEOUT = 7000;
// 7 seconds timeout for lock
var LOCK_RETRY = 10;
// Try 10 times
var TIME_BETWEEN_RETRIES = 1000;
// 1 second

// Install status in device_apps
var TO_BE_INSTALLED = 0;
var TO_BE_UNINSTALLED = -1;
var REMOVE_FROM_TABLE = 2;

var IS_PRIVATE_APP_FALSE = 0;
var IS_PRIVATE_APP_TRUE = 1;

// Event log Const
var EV_CONST = eventLog.EV_CONST;
var EV_ADD_APP_TO_PROFILE = EV_CONST.EV_ADD_APP_TO_PROFILE;
var EV_REMOVE_APP_FROM_PROFILE = EV_CONST.EV_REMOVE_APP_FROM_PROFILE;
var WARN = EV_CONST.WARN;

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

function getPlatformApksPath() {
    var pathToAPKs = '/data/tmp';
    return pathToAPKs;
}

function loadAdminParamsFromSession(req, res, callback) {
    setting.loadAdminParamsFromSession(req, res, callback);
}

function createSSHSessions(sshSessions, platforms, callback) {
    var i = 0;
    async.eachSeries(platforms, function(platform, callback) {
        platform.initSsh(logger, function(err) {
            sshSessions[i] = platform.ssh;
            i++;
            // Always increment even if session wasn't created since
            // this array has its indices synced to platforms
            callback(null);
        });
    }, function(err) {
        if (err) {
            logger.info(err);
        }
        callback(null);
        // Exit function without error
    });
}

function closeSSHSessions(sshSessions, callback) {
    var i = 0;
    async.eachSeries(sshSessions, function(sshSession, callback) {
        if (sshSession != null) {
            sshSession.end();
        }
        callback(null);
    }, function(err) {
        callback(null);
        // Exit function without error
    });
}

function unlock_DevicePackage(lock, lockTimeout, wait, retries, callback) {
    Common.redisClient.get(lock, function(err, currentLockTimeout) {
        if (err) {
            logger.info("Error in the removing lock " + lock + " ,err: " + err);
        }
        // Timeout hasn't changed
        if (lockTimeout == currentLockTimeout) {
            Common.redisClient.del(lock, function(err, reply) {
                if (err) {
                    logger.info("Error in the removing lock " + lock + " ,err: " + err);
                }
                if (reply == 1) {
                    callback(null);
                    // sucessfull unlock
                    return;
                } else {
                    // err also arrives here
                    if (retries <= 0) {
                        callback("Error while unlocking " + lock);
                    } else {
                        setTimeout(function() {
                            unlock_DevicePackage(lock, lockTimeout, wait, retries - 1, callback);
                        }, wait);
                    }
                }
            });
            // Common.redisClient.DEL
        } else {
            // Someone else has already aquired the lock
            callback(null);
        }
    });
}

function unlock_DevicePackages_On_device_apps(locks, lockTimeouts, wait, retries, callback) {
    var i = 0;
    async.eachSeries(locks, function(lock, cb) {
        unlock_DevicePackage(lock, lockTimeouts[i], wait, retries, function(err) {
            i++;

            if (err) {
                logger.error("unlock_DevicePackages_On_device_apps: " + err);
                cb(null);
                return;
            }

            cb(null);
            return;
        });
    }, function(err) {
        callback(err);
        return;
    });
}

// Make sure that no other request is making changes in device_apps this
// specific package+device
function lock_DevicePackage(lock, wait, callback) {
    var lockTimeout = new Date().getTime() + LOCK_TIMEOUT + 1;
    Common.redisClient.SETNX(lock, lockTimeout, function(err, reply) {
        if (err) {
            logger.info("Error in the lock " + lock + " ,err: " + err);
            callback(err);
            return;
        }
        if (reply == 1) {
            logger.info("Successful lock on " + lock);
            callback(null, lockTimeout);
            // sucessfull lock
            return;
        }
        logger.info("Unable to lock on " + lock);
        // Verify that the lock has not expired
        Common.redisClient.get(lock, function(err, currentLockTimeout) {
            var timeStamp = new Date().getTime();
            if (currentLockTimeout != null) {
                if (timeStamp > currentLockTimeout) {
                    var lockTimeout = new Date().getTime() + LOCK_TIMEOUT + 1;
                    Common.redisClient.GETSET(lock, lockTimeout, function(err, prevTimeStamp) {
                        // Has some else acquired the lock between GET and
                        // GETSET
                        if (prevTimeStamp != currentLockTimeout) {
                            // Start over
                            lock_DevicePackage(lock, wait, callback);
                            return;
                        }

                        // Ok, we have the lock
                        logger.info("GETSET to lock on " + lock);
                        callback(null, lockTimeout);
                        return;
                    });
                } else {
                    // Lock is held but not expired
                    logger.info("setTimeout to lock " + lock);
                    setTimeout(function() {
                        lock_DevicePackage(lock, wait, callback);
                    }, wait);
                }
            } else {// currentLockTimeout = null
                // Lock was released, just try again
                logger.info("currentLockTimeout = null to lock " + lock);
                lock_DevicePackage(lock, wait, callback);
                return;
            }
        });
    });
    // Common.redisClient.SETNX
}

// Lock package+deviceId in device_apps
function lock_DevicePackages_On_device_apps(locks, wait, callback) {
    var locksLocked = [];
    var locksTimeouts = [];
    async.eachSeries(locks, function(lock, callback) {
        lock_DevicePackage(lock, wait, function(err, lockTimeout) {
            if (err) {
                callback(err);
                return;
            } else {
                locksLocked.push(lock);
                locksTimeouts.push(lockTimeout);
            }
            callback(null);
        });
    }, function(err) {
        callback(null, locksLocked, locksTimeouts);
    });
}

// Lock the package for user in user_apps
function lockPackage(lock, wait, retries, callback) {
    Common.redisClient.SETNX(lock, 1, function(err, reply) {
        if (err) {
            logger.info("Error in the lock " + lock + " ,err: " + err);
            callback(err);
            return;
        }
        if (reply == 1) {
            callback(null);
            // sucessfull lock
            return;
        }

        if (retries <= 0) {
            logger.info("Timeout in lock " + lock);
            callback("Error in the lock " + lock + ", Lock already exists");
        } else {
            logger.info("Wait on lock " + lock + " retries: " + retries);
            setTimeout(function() {
                lockPackage(lock, wait, retries - 1, callback);
            }, wait);
        }
    });
    // Common.redisClient.SETNX
}

function lockPackages_user_apps(email, packageNames, wait, retries, callback) {
    var lockedPackages = [];
    var errPackages = [];
    async.eachSeries(packageNames, function(packageName, callback) {
        var lock = 'lock_package_' + packageName + '_' + email;
        lockPackage(lock, wait, retries, function(err) {
            if (err) {
                errPackages.push(packageName);
            } else {
                lockedPackages.push(packageName);
            }
            callback(err);
        });
    }, function(err) {
        callback(err, lockedPackages, errPackages);
    });
}

function unlockPackage(email, packageName, wait, retries, callback) {
    var lock = 'lock_package_' + packageName + '_' + email;

    Common.redisClient.DEL(lock, function(err, reply) {
        if (err) {
            logger.info("Error in the removing lock " + lock + " ,err: " + err);
        }
        if (reply == 1) {
            callback(null);
            // sucessfull unlock
            return;
        } else {
            // err also arrives here
            if (retries <= 0) {
                logger.info("Timeout in unlock " + lock);
                callback("Error while unlocking " + lock);
            } else {
                logger.info("Wait on unlock " + lock + " retries: " + retries);
                setTimeout(function() {
                    unlockPackage(email, packageName, wait, retries - 1, callback);
                }, wait);
            }
        }
    });
    // Common.redisClient.DEL
}

function unlockPackages_user_apps(email, packageNames, wait, retries, callback) {
    async.eachSeries(packageNames, function(packageName, cb) {
        unlockPackage(email, packageName, wait, retries, function(err) {
            cb(null);
        });
    }, function(err) {
        callback(null);
    });
}

// Remove package from device_apps since it was properly installed
function removeInstalledFlag(email, packageName, deviceid, callback) {

    var deviceId = Common.getWithServiceDeviceID(deviceid);

    Common.db.DeviceApps.destroy({
        where : {
            email : email,
            packagename : packageName,
            deviceid : deviceId
        }
    }).then(function() {

        callback(null);

    }).catch(function(err) {
        var msg = "Internal error: " + err;
        logger.info(msg);
        callback(err);
    });

}

// Called on user login .Reads operation necessary for each package (install,
// uninstall, etc.) and launches them
function startSessionInstallations(session, time, hrTime, uninstallFunc, callback) {
    var email = session.params.email;
    var localid = session.params.localid;
    var platform = session.platform;
    var deviceId = session.params.deviceid;

    var maindomain;
    User.getUserDomain(email, function (orgDomainFromDB ) {
        if (orgDomainFromDB)
            maindomain = orgDomainFromDB;
        else
            maindomain = email.substr(email.indexOf('@') + 1);
        // Go over all new packages

        Common.db.DeviceApps.findAll({
            attributes : ['packagename'],
            where : {
                email : email,
                deviceid : deviceId
            },
        }).complete(function(err, results) {

            if (!!err) {
                logger.info(err);
                callback(null);
                return;

            }

            if (!results || results == "") {
                logger.info('No change in packages for user.');
                callback(null);
                return;

            }

            var packageNames = [];
            for (var i = 0; i < results.length; ++i) {
                packageNames.push(results[i].packagename != null ? results[i].packagename : '');
            }

            var platforms = [platform];
            var userIdInPlatforms = [localid];
            var deviceIds = [deviceId];
            // Locks
            var locksLocked = [];
            var locksTimeouts = [];
            // Packages
            var packagesToInstall = [];
            var packagesToUninstall = [];
            var packagesToRemove = [];

            async.series([
            // Lock device_apps for packages
            function(callback) {
                lockDeviceApps(deviceIds, packageNames, function(err, locks, timeouts) {
                    locksLocked = locks;
                    locksTimeouts = timeouts;
                    callback(err);
                });
            },
            // Read installed again for packages
            function(callback) {
                Common.db.DeviceApps.findAll({
                    attributes : ['packagename', 'installed', 'time', 'hrtime'],
                    where : {
                        email : email,
                        deviceid : deviceId
                    },
                }).complete(function(err, results) {

                    if (!!err) {
                        logger.info(err);
                        callback(null);
                        return;

                    }

                    if (!results || results == "") {
                        logger.info('No change in packages for user.');
                        callback(null);
                        return;

                    }

                    for (var i = 0; i < results.length; ++i) {

                        var packageName = results[i].packagename != null ? results[i].packagename : '';
                        var timeInTable = results[i].time != null ? results[i].time : '';
                        var hrtimeInTable = results[i].hrtime != null ? results[i].hrtime : '';

                        var shouldUpdate = shouldUpdateTable(time, hrTime, timeInTable, hrtimeInTable);
                        if ((shouldUpdate == null) && (packageNames.indexOf(packageName) != -1)) {
                            // Package is locked
                            var installed = results[i].installed != null ? results[i].installed : '';
                            if (installed == TO_BE_INSTALLED) {
                                packagesToInstall.push(packageName);
                            } else if (installed == TO_BE_UNINSTALLED) {
                                packagesToUninstall.push(packageName);
                            } else if (installed == REMOVE_FROM_TABLE) {
                                packagesToRemove.push(packageName);
                            }
                        }

                    }
                    callback(null);
                });

            },
            // Remove unnecessary lines in table
            function(callback) {
                async.eachSeries(packagesToRemove, function(packageToRemove, callback) {
                    removeInstalledFlag(email, packageToRemove, deviceId, function(err) {
                    callback(null);
                        return;
                    });
                }, function(err) {
                    callback(null);
                });
            },
            // Install the ones needed
            function(callback) {
               async.eachSeries(packagesToInstall, function(packageToInstall, callback) {
                    installAPKForUsersOnPlatforms(platforms, packageToInstall, userIdInPlatforms, email, maindomain, function(err1) {
                        if (err1) {
                            logger.info(err1);
                            callback(null);
                            return;
                        }
                        // Set flag to remove line from table
                        insertToDeviceApps(email, deviceId, packageToInstall, maindomain, REMOVE_FROM_TABLE, time, hrTime, function(err) {
                            callback(null);
                        });
                    });
                    // installAPKForUsersOnPlatforms
                }, function(err) {
                    callback(null);
                });
            },
            // Uninstall
            function(callback) {
                async.eachSeries(packagesToUninstall, function(packageToUninstall, callback) {
                    uninstallFunc(platforms, packageToUninstall, userIdInPlatforms, email, maindomain, function(err1) {
                        if (err1) {
                            logger.info(err1);
                            callback(null);
                            return;
                        }
                        // Set flag to remove line from table
                        insertToDeviceApps(email, deviceId, packageToUninstall, maindomain, REMOVE_FROM_TABLE, time, hrTime, function(err) {
                            callback(null);
                        });
                    });
                    // uninstallFunc
                }, function(err) {
                    callback(null);
                });
            }], function(err) {
                if (err) {
                    logger.info("ERROR: startSessionInstallations: " + err);
                }
                // Unlock
                unlock_DevicePackages_On_device_apps(locksLocked, locksTimeouts, TIME_BETWEEN_RETRIES, LOCK_RETRY, function(err1) {
                    callback(err || err1);
                    return;
                });
            });

        });
    });
}

// Installs

function installAPKForUsersOnPlatforms(platforms, packageName, userIdInPlatforms, email, domain, callback) {
    var i = 0;
    // Do install in parallel
    async.each(platforms, function(platform, callback) {
        firewall.addRuleForRunningUserFromInstallAPK(packageName, domain, firewall.Firewall.add, userIdInPlatforms[i], platform.params.platid, email, function(err) {
//TODO:Open comments after fix of multiregion installation
//            if (err) {
//                callback(err);
//            } else {
                var cmd = 'pm install --user ' + userIdInPlatforms[i] + ' ' + packageName;
                i++;
                platform.exec(cmd, function(err, code, signal, sshout) {
                    callback(err);
                });
//            }
        });
    }, function(err) {
        callback(err);
    });
}


/**
 *
 * @param packageNames
 * @param email
 * @param isNeedToInstall
 *                true to install the app, false to uninstall
 * @param domain
 * @param isPrivateApp
 *                indicate if the app is install only to the user and not by
 *                group install. IS_PRIVATE_APP_TRUE(1) = true,
 *                IS_PRIVATE_APP_FALSE(0) = false
 * @param callback
 */
// TODO - remove arg isNeedToInstall.
// TODO - seperate this function to two functions: 1. install app, 2.uninstall
// app

function updateUserAppsTableForUser(packageNames, email, isNeedToInstall, domain, isPrivateApp, callback) {

    if (email == null || email == "") {
        callback('email = ' + email);
        return;
    }
    if (packageNames.length === 0) {
        callback(null);
    }
    async.waterfall(
        [
            function(callback) {
                Common.db.UserApps.findAll({
                    attributes : ['private', 'packagename'],
                    where : {
                        email : email,
                        maindomain : domain,
                        packagename : packageNames
                    },
                }).complete(function(err, results) {
                    if (!!err) {
                        logger.error(new Error().stack);
                        callback(err);
                    } else {
                        callback(null, results);
                    }
                });
            },
            function(results, callback) {
                async.eachSeries(
                    results,
                    function(result, callback) {
                        console.log("result: " + JSON.stringify(result));
                        processPackage(result, callback);
                    },
                    function(err) {
                        callback(err);
                    }
                );
            },
        ], function(err) {
            callback(err);
        }
    );

    var processPackage = function(result, callback) {
        if (result.private === IS_PRIVATE_APP_TRUE) {
            // the app is profile (private) app, and the command is for
            // groups - do nothing.
            if (isPrivateApp == IS_PRIVATE_APP_FALSE) {
                callback(null);
                return;
            }
        }

        if (isNeedToInstall) {
            addAppToUserInDB(email, result.packagename, domain, isPrivateApp, function(err) {
                if (err) {
                    logger.info("ERROR: Internal error: " + err);
                }
                callback(err);
            });
        } else {
            // Before uninstall from private user, we need to check if the
            // app is installed on another group that the user belongs to
            // AND its IS_PRIVATE_APP_TRUE.
            isAppInstalledToGroup(result.packagename, domain, function(isBelongsToInstalledGroup, err) {
                if (isBelongsToInstalledGroup && isPrivateApp == IS_PRIVATE_APP_TRUE) {
                    // change the user_app to private.
                    changeAppPrivacyToUser(email, result.packagename, domain, IS_PRIVATE_APP_FALSE, function(err) {
                        if (err) {
                            logger.error("ERROR: Internal error: " + err);
                        }
                        callback(err);
                    });
                } else {
                    removeAppFromUserInDB(email, result.packagename, domain, isPrivateApp, function(err) {
                        if (err) {
                            logger.error("ERROR: Internal error: " + err);
                        }
                        callback(err);
                    });
                }
            });
        }
    };
}

function isAppInstalledToGroup(packageName, domain, callback) {

    Common.db.GroupApps.findAll({
        attributes : ['groupname'],
        where : {
            packagename : packageName,
            maindomain : domain
        },
    }).complete(function(err, results) {

        if (!!err) {
            logger.error('Internal error: ' + err);
            callback(false, err);
            return;
        }
        var isBelongsToInstalledGroup = true;

        if (!results || results == "") {
            isBelongsToInstalledGroup = false;
        }
        callback(isBelongsToInstalledGroup, null);
    });

}

function changeAppPrivacyToUser(email, packageName, domain, isPrivateApp, callback) {
    ///////////ERROR: HANDLE CASE OF INSERT

    Common.db.UserApps.findAll({
        attributes : ['email', 'packagename', 'maindomain'],
        where : {
            email : email,
            packagename : packageName,
            maindomain : domain
        },
    }).complete(function(err, results) {

        if (!!err) {
            callback(err);
            return;
        }

        if (!results || results == "") {

            Common.db.UserApps.create({
                email : email,
                packagename : packageName,
                maindomain : domain,
                private : isPrivateApp
            }).then(function() {
                callback(null);
            }).catch(function(err) {
                callback(err);
            });

        } else {

            Common.db.UserApps.update({
                private : isPrivateApp
            }, {
                where : {
                    email : email,
                    packagename : packageName,
                    maindomain : domain
                }
            }).then(function() {
                callback(null);
            }).catch(function(err) {
                callback(err);
            });
        }

    });

}

function addAppToUserInDB(email, packageName, domain, isPrivateApp, callback) {

    // select UserApp
    Common.db.UserApps.findAll({
        attributes : ['email', 'packagename', 'maindomain'],
        where : {
            email : email,
            packagename : packageName,
            maindomain : domain
        },
    }).complete(function(err, results) {

        if (!!err) {
            callback(err);
            return;
        }

        if (!results || results == "") {
            // insert new userApp

            Common.db.UserApps.create({
                email : email,
                packagename : packageName,
                maindomain : domain,
                private : isPrivateApp

            }).then(function(results) {
                callback(null);
            }).catch(function(err) {
                callback(err);
            });

        } else {
            // update existing userApp
            Common.db.UserApps.update({
                email : email,
                packagename : packageName,
                maindomain : domain,
                private : isPrivateApp
            }, {
                where : {
                    email : email,
                    packagename : packageName,
                    maindomain : domain
                }
            }).then(function() {
                callback(null);
            }).catch(function(err) {
                callback(err);
            });
        }

    });

}

function removeAppFromUserInDB(email, packageName, domain, isPrivateApp, callback) {

    Common.db.UserApps.destroy({
        where : {
            email : email,
            maindomain : domain,
            packagename : packageName
        }
    }).then(function() {

        callback(null);
    }).catch(function(err) {
        callback(err);
    });

}

function insertToDeviceApps(email, deviceid, packageName, maindomain, installed, time, hrTime, callback) {
    var deviceId = Common.getWithServiceDeviceID(deviceid);

    Common.db.DeviceApps.upsert({
        email : email,
        deviceid : deviceId,
        packagename : packageName,
        maindomain : maindomain,
        installed : installed,
        time : time,
        hrtime : hrTime
    }).then(function() {
        callback(null);
    }).catch(function(err) {
        callback(err);
    });
}

function getAllUserDevices(email, callback) {
    // Loop over all user's devices
    var deviceMap = {};

    Common.db.Activation.findAll({
        attributes : ['deviceid'],
        where : {
            email : email,
            status : '1'
        },
    }).complete(function(err, results) {

        if (!!err) {
            logger.error("Error while getting deviceid " + err);
            callback("Error while getting deviceid " + err);
            return;
        }
        var deviceIds = [];
        for (var i = 0; i < results.length; ++i) {
            var deviceId = results[i].deviceid;
            if (!deviceMap[deviceId]) {
                deviceMap[deviceId] = deviceId;
                deviceIds.push(deviceId);
            }
        }
        callback(null, deviceIds);

    });

}

function updateDevicePackage(email, deviceId, packageName, domain, time, hrTime, installed, callback) {
    async.waterfall(
        [
            // Get
            function(callback) {
                // Ok, locked
                Common.db.DeviceApps.findAll({
                    attributes : ['time', 'hrtime'],
                    where : {
                        email : email,
                        deviceid : deviceId,
                        packagename : packageName,
                        maindomain : domain
                    },
                }).complete(function(err, results) {
                    if (!!err) {
                        logger.info(err);
                        callback(err);
                    } else {
                        callback(null, results);
                    }
                });
            },
            // Put
            function(results, callback) {
                if (!results) {
                    logger.error("addAppsToProfiles.js::updateDevicePackage missed app " + packageName + "in device_apps table for " + email + " # " + deviceId);
                    callback(null);
                    return;
                }
                var timeInTable = results[0].time;
                var hrtimeInTable = results[0].hrtime;
                var result = shouldUpdateTable(time, hrTime, timeInTable, hrtimeInTable);
                if (result === null) {
                    insertToDeviceApps(email, deviceId, packageName, domain, installed, time, hrTime, callback);
                } else {
                    callback(null);
                }
            }
        ], function(err) {
            if (err) {
                logger.error("ERROR: " + err);
            }
            callback(err);
        }
    );
}

function lockDeviceApps(deviceIds, packageNames, callback) {
    // Generate array of locks
    var locks = [];
    for (var i = 0; i < deviceIds.length; ++i) {
        var deviceId = deviceIds[i];
        for (var j = 0; j < packageNames.length; ++j) {
            var lock = 'lock_' + deviceId + '_' + packageNames[j];
            locks.push(lock);
            logger.info("will lock on " + lock);
        }
    }

    var locksLocked = [];
    var locksTimeouts = [];
    lock_DevicePackages_On_device_apps(locks, TIME_BETWEEN_RETRIES, function(err, locksArr, locksTOArr) {
        if (err) {
            callback('Error accessing redis');
            return;
        }
        locksLocked = locksArr;
        locksTimeouts = locksTOArr;
        callback(null, locksLocked, locksTimeouts);
    });
}

// Update device_apps with new packages for all user devices
function updateDeviceAppsTableForUser(deviceIds, packageNames, email, domain, installed, time, hrTime, callback) {
    // Go over all packages and deviceIds and update device_apps
    async.each(packageNames, function(packageName, callback1) {
        async.each(deviceIds, function(deviceId, callback2) {
            updateDevicePackage(email, deviceId, packageName, domain, time, hrTime, installed, function(err) {
                callback2(err);
            });
        }, function(err) {
            callback1(err);
        });
    }, function(err) {
        callback(err);
    });
}

// Returns an error message if the table is more updated
function shouldUpdateTable(curTime, curTimeHr, timeInTable, hrtimeInTable) {
    if (timeInTable > curTime) {
        return 'Found newer timestamp in device_apps1 timeInTable=' + timeInTable + ' curTimeHr=' + curTime;
    }
    if ((timeInTable == curTime) && (hrtimeInTable > curTimeHr)) {
        return 'Found newer timestamp in device_apps2 timeInTable=' + timeInTable + ' curTimeHr=' + curTime + ' hrtimeInTable=' + hrtimeInTable + ' curTimeHr=' + curTimeHr;
    }

    return null;
}

function createLogEvents(email, domain, packageNames, isNeedToInstall, callback) {
    // TODO: In some cases the mgmt does the installing by itself. Need to
    // decide which calling user to put here
    var callerEmail = email;
    var eventtype = EV_REMOVE_APP_FROM_PROFILE;
    if (isNeedToInstall) {
        eventtype = EV_ADD_APP_TO_PROFILE;
    }

    async.eachSeries(packageNames, function(packageName, cb) {
        var extra_info = 'app:' + packageName + ' email:' + email;
        // Create event in Eventlog
        eventLog.createEvent(eventtype, callerEmail, domain, extra_info, WARN, function(err) {
            if (err) logger.error(err);
            cb(null);
        });
    }, function(err) {
        callback(null);
    });
}

function addRemoveAPKsForRunningUser(time, hrTime, email, packageNames, domain, isPrivateApp, isNeedToInstall, func, callback) {
    // platforms, sshSessions deviceIds and userIdInPlatforms should always have.
    // the same length
    var platforms = [];
    var sshSessions = [];
    var uniquePlatforms = [];
    var userIdInPlatforms = [];
    var deviceIds = [];
    var locksLocked = [];
    var locksTimeouts = [];

    var installed;
    if (isNeedToInstall) {
        installed = TO_BE_INSTALLED;
        func = installAPKForUsersOnPlatforms;
    } else {
        installed = TO_BE_UNINSTALLED;
    }

    async.series([
    // Lock packages for user in user_apps
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: lockPackages_user_apps");
        lockPackages_user_apps(email, packageNames, TIME_BETWEEN_RETRIES, LOCK_RETRY, function(err, l, e) {
            packageNames = l;
            callback(err);
        });
    },
    // Update user_apps table with new app
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: updateUserAppsTableForUser");
        updateUserAppsTableForUser(packageNames, email, isNeedToInstall, domain, isPrivateApp, function(err) {
            callback(err);
        });
    },
    // Create events in Eventlog
    function(callback) {
        createLogEvents(email, domain, packageNames, isNeedToInstall, callback);
    },
    // Get all user devices
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: getAllUserDevices");
        getAllUserDevices(email, function(err, devices) {
            deviceIds = devices;
            callback(err);
        });
    },
    // Lock device_apps for packages
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: lockDeviceApps");
        lockDeviceApps(deviceIds, packageNames, function(err, locks, timeouts) {
            locksLocked = locks;
            locksTimeouts = timeouts;
            callback(err);
        });
    },
    // Update device_apps table with new app
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: updateDeviceAppsTableForUser");
        updateDeviceAppsTableForUser(deviceIds, packageNames, email, domain, installed, time, hrTime, function(err) {
            callback(err);
        });
    },
    // Get all user platforms
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: getUserPlatforms");
        sessionModule.getUserPlatforms(email, function(err, p, u, userIds, devices) {
            platforms = p;
            uniquePlatforms = u;
            userIdInPlatforms = userIds;
            // deviceIds = devices;
            callback(null);
        });
    },
    // Open SSH Connections to all user's platforms
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: createSSHSessions");
        createSSHSessions(sshSessions, platforms, function() {
            callback(null);
        });
    },
    // Install/Uninstall APK for user on all platforms
    function(callback) {
        // Go over all packages
        logger.info("addRemoveAPKsForRunningUser: Install/Uninstall APK for user on all platforms");
        if(Common.platformType === "kvm") {
            async.eachSeries(
                packageNames,
                function(packageName, cb) {
                    func(platforms, packageName, userIdInPlatforms, email, domain, function(err) {
                        cb(null);
                    });
                },
                function(err) {
                    callback(null);
                }
            );
        } else {
            async.eachSeries(
                uniquePlatforms,
                function(curPlatform, callback) {
                    var tasks = [];
                    platforms.forEach(function(platform, platIndex) {
                        packageNames.forEach(function(packageName) {
                            if(curPlatform.params.platid === platform.params.platid) {
                                tasks.push({
                                    packageName: packageName,
                                    unum: userIdInPlatforms[platIndex],
                                    task: isNeedToInstall ? 1 : 0
                                });
                            }
                        });
                    });
                    curPlatform.attachApps(tasks, function(err) {
                        callback(null);
                    });
                },
                function(err) {
                    callback(null);
                }
            );
        }
    },
    // Close SSH sessions
    function(callback) {
        logger.info("addRemoveAPKsForRunningUser: closeSSHSessions");
        closeSSHSessions(sshSessions, function() {
            callback(null);
        });
    }], function(err) {
        if (err) {
            logger.info("ERROR: " + err);
        }
        logger.info("addRemoveAPKsForRunningUser: unlockPackages_user_apps");
        unlockPackages_user_apps(email, packageNames, TIME_BETWEEN_RETRIES, LOCK_RETRY, function(err1) {
            unlock_DevicePackages_On_device_apps(locksLocked, locksTimeouts, TIME_BETWEEN_RETRIES, LOCK_RETRY, function(err2) {
                if (err || err1 || err2) {
                    callback(err + err1 + err2);
                    return;
                }
                callback(null);
            });
        });
    });
}

function installAPKsForRunningUsers(time, hrTime, emails, packageNames, domain, isPrivateApp, callback) {
    async.eachSeries(emails, function(email, cb) {
        addRemoveAPKsForRunningUser(time, hrTime, email, packageNames, domain, isPrivateApp, true, installAPKForUsersOnPlatforms, function(err) {
            if (err) {
                logger.info('installAPKsForRunningUsers: ' + err);
            }
            cb(null);
            // Continue doing this for the rest of the users
        });
    }, function(err) {
        callback(err);
    });
}

function existAPKs(packageNames, callback) {
    async.eachSeries(packageNames, function(packageName, cb) {
        var installationUpdatesFile = getLocalApksPath() + packageName + '.apk';
        Common.fs.exists(installationUpdatesFile, function(exists) {
            if (!exists) {
                cb('Cannot find file ' + installationUpdatesFile);
                return;
            }
            cb(null);
        });
    }, function(err) {
        callback(err);
    });
}

var checkUsersInTable = function(emails, callback) {
    if(emails) {
        Common.db.User.findAll({
            attributes : ['email'],
            where : {
                username : emails
            },
        }).complete(function(err, results) {
            var missedEmails = [];
            if (!!err) {
                callback(err);
                return;
            }

            if (results.length === emails.length) {
                callback(null);
            } else {
                var resEmails = _.map(results, function(item) {return item.email;});
                missedEmails = _.difference(emails, resEmails);
                callback('User ' + JSON.stringify(missedEmails) + ' not found', missedEmails);
            }
        });
    } else {
        callback(null);
    }
};

function checkAppsInTable(packageNames, domain, callback) {
    logger.info('checkUsersInTable: packageNames= ' + packageNames);
    if(packageNames) {
        Common.db.Apps.findAll({
            attributes : ['packagename'],
            where : {
                packagename : packageNames,
                maindomain: domain
            },
        }).complete(function(err, results) {
            var missedPackageNames = [];
            if (!!err) {
                logger.info('Internal error: ' + err);
                callback(err);
                return;
            }

            if (results.length === packageNames.length) {
                callback(null);
            } else {
                var resPackageNames = _.map(results, function(item) {return item.packagename;});
                missedPackageNames = _.difference(packageNames, resPackageNames);
                callback('App ' + JSON.stringify(missedPackageNames) + ' not found', missedPackageNames);
            }
        });
    } else {
        callback(null);
    }
}

function addAppsToProfiles(req, res, next) {

    // https://login.nubosoftware.com/addAppsToProfiles?secret=[]&session=[]&email=[]&packageName=[]

    res.contentType = 'json';
    var status = 1;
    var msg = "";
    logger.info(req.url);

    var emails = req.params.email;
    if (!emails || emails == "") {
        status = 0;
        msg = "Invalid email";
    }

    var packageNames = req.params.packageName;
    if (!packageNames || packageNames == "") {
        status = 0;
        msg = "Invalid packageName";
    }

    // If there was an error then send response
    if (status != 1) {
        res.send({
            status : status,
            message : msg
        });
        return;
    }

    // Only sysAdmin can do this operation
    loadAdminParamsFromSession(req, res, function(err, login) {

        var domain = login.loginParams.mainDomain;
        if (!setting.getDebugMode()) {
            if (err) {
                res.send({
                    status : 0,
                    message : err
                });
                return;
            }
        } else {
            domain = "nubosoftware.com";
        }

        addAppsToProfilesInternal(domain, emails, packageNames, IS_PRIVATE_APP_TRUE, function(err) {

            var status = 1;
            var msg = "Inserted app to profile Successfully";
            if (err) {
                status = 0;
                msg = err;
            }
            res.send({
                status : status,
                message : msg
            });
        });
    });
}

function addAppsToProfilesInternal(domain, emails, packageNames, isPrivateApp, callback) {

    if (!util.isArray(packageNames)) {
        packageNames = [packageNames];
    }

    if (!util.isArray(emails)) {
        emails = [emails];
    }

    if (isPrivateApp == null || isPrivateApp == '') {
        isPrivateApp = IS_PRIVATE_APP_FALSE;
    }
    logger.info("addAppsToProfilesInternal");
    // domain is not really needed since a specific email can't be assigned to
    // different domains
    // Verify that the users are in the users table
    checkUsersInTable(emails, function(err) {
        if (err) {
            callback(err);
            return;
        }
        logger.info("addAppsToProfilesInternal: checkUsersInTable");
        // Verify that the apps are in the apps table (currently there is NO
        // removal from this table)
        checkAppsInTable(packageNames, domain, function(err) {
            if (err) {
                callback(err);
                return;
            }
            logger.info("addAppsToProfilesInternal: checkAppsInTable");
            // Need to create a timestamp
            var time = new Date().getTime();
            var hrTime = process.hrtime()[1];
            // Install APKs for users
            installAPKsForRunningUsers(time, hrTime, emails, packageNames, domain, isPrivateApp, callback);
        });
    });
}

var AddAppsToProfiles = {
    func : addAppsToProfiles,
    lockPackages_user_apps : lockPackages_user_apps,
    unlockPackages_user_apps : unlockPackages_user_apps,
    addRemoveAPKsForRunningUser : addRemoveAPKsForRunningUser,
    startSessionInstallations : startSessionInstallations,
    insertToDeviceApps : insertToDeviceApps,
    installAPKsForRunningUsers : installAPKsForRunningUsers,
    TO_BE_INSTALLED : TO_BE_INSTALLED,
    IS_PRIVATE_APP_FALSE : IS_PRIVATE_APP_FALSE,
    IS_PRIVATE_APP_TRUE : IS_PRIVATE_APP_TRUE,
    loadAdminParamsFromSession : loadAdminParamsFromSession,
    checkAppsInTable : checkAppsInTable,
    addAppsToProfilesInternal : addAppsToProfilesInternal,
    createSSHSessions : createSSHSessions,
    closeSSHSessions : closeSSHSessions
};

module.exports = AddAppsToProfiles;
