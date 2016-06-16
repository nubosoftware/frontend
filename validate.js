var Common = require('./common.js');
var logger = Common.logger;
var Login = require('./login.js');
var User = require('./user.js');
var Geo = require('./geo.js');
var ThreadedLogger = require('./ThreadedLogger.js');
var async = require('async');
var internalRequests = require('./internalRequests.js');

Validate = {
    func: validate
};

module.exports = Validate;

//user is allowed 3 login attempts. then he will be locked.
var MAX_LOGIN_ATTEMPTS = 3;
//number of tries to validate before sending error to client
var MAX_VALIDATE_RETRIES = 4;
// time to wait before attempt to validate again.
var VALIDATE_ATTEMPT_INTERVAL = 500;

function returnInternalError(err, res) {
    status = 3;
    // internal error
    msg = "Internal error";
    console.error(err.name, err.message);
    logger.info(msg + ": " + err);
    if (res != undefined) {
        res.send({
            status: status,
            message: msg
        });
    }
    return;
}

// https://login.nubosoftware.com/validate?username=[username]&deviceid=[deviceId]&activationKey=[activationKey]
function validate(req, res, next) {
    var logger = new ThreadedLogger();
    //var timelog = logger.timelogger;
    res.contentType = 'json';
    var playerVersion = req.params.playerVersion ? req.params.playerVersion : null;
    var activationKey = req.params.activationKey ? req.params.activationKey : null;
    var deviceId = req.params.deviceid ? req.params.deviceid : null;
    var clientIP = req.connection.remoteAddress;
    var clientUserName = req.params.username ? req.params.username : null;

    if(Common.withService && !clientUserName){
        res.send({
            status: 1,
            message: "Invalid username"
        });
        return;    
    }

    if (!activationKey || activationKey.length < 5) {
        res.send({
            status: 1,
            message: "Invalid activationKey"
        });
        return;
    }

    // var response = {
    //     status: 0,
    //     message: 'Internal error'
    // }
    // res.send(response);
    // return;

    var error = null;
    var response = null;
    var iter = 0;

    async.waterfall([
        function(callback) {
            checkIfNeedRedirection(playerVersion, activationKey, clientIP, logger, function(err, redirectResponse, userData, activationData) {
                if (err || redirectResponse) {
                    error = err;
                    response = redirectResponse;
                    callback('done');
                    return;
                }

                callback(null, userData, activationData);
            });
        },
        function(userData, activationData, callback) {
            async.whilst(
                function() {
                    return (!response && iter <= MAX_VALIDATE_RETRIES);
                },
                function(callback) {
                    validateActivation(activationKey, deviceId, userData, activationData, req.url, clientUserName, logger, function(err, validateResponse) {
                        if (err)
                            error = err;

                        if (validateResponse) {
                            response = validateResponse;
                            callback(null);
                            return;
                        }

                        setTimeout(function() {
                            ++iter;
                            callback(null);
                        }, VALIDATE_ATTEMPT_INTERVAL);
                    });
                }, callback);
        }
    ], function(err) {
        if (error) {
            logger.error("validate: error handling validate request");
        }

        if (!response) {
            logger.error('validate: don\'t have response to send');
            response = {
                status: 0,
                message: 'Internal error. Please contact administrator.'
            }
            res.send(response);
            return;
        }

        if (!error && response)
            logger.info("validate: user successfully validated");

            logger.info("client response: " , JSON.stringify(response, null, 2));
            res.send(response);
            
        return;
    });
}

function checkIfNeedRedirection(playerVersion, activationKey, clientIP, logger, callback) {

    var finish = 'finish';
    var response = null;
    var error = null;
    var userData = null;
    var activationData = null;


    async.series([
        //check client version
        function(callback) {
            if (playerVersion && playerVersion.length > 1) {
                var playerVer = parseVersion(playerVersion);
                var twoNumbersVersionStr = playerVer.major + "." + playerVer.minor;
                if (Common.versionRedirectionMap) {
                    var redirect = Common.versionRedirectionMap[twoNumbersVersionStr];
                    if (redirect && redirect != Common.serverurl) {
                        // need to redirect user no another server based on geographic location
                        var msg = "Redirecting user from " + twoNumbersVersionStr + " to " + redirect;
                        logger.info("checkIfNeedRedirection: player version not supported, " + msg);
                        response = {
                            status: 301,
                            message: msg,
                            mgmtURL: redirect
                        }
                        callback(finish);
                        return;
                    }
                }

                var minVer = parseVersion(Common.minPlayerVersion);
                if (playerVer.major < minVer.major || (playerVer.major == minVer.major && playerVer.minor < minVer.minor)) {
                    response = {
                        status: 3,
                        message: "Invalid player version"
                    }
                    callback(finish);
                    return;
                }
            }
            callback(null);
        },
        //check geo location
        function(callback) {
            if (Common.isGeoIP == true && Common.countryRedirectionMap) {
                Geo.lookup(clientIP, function(err, data) {
                    if (err) {
                        var errMsg = "Redirection failed";
                        logger.error("checkIfNeedRedirection: " + errMsg + ", " + err);
                        response = {
                            status: 0,
                            message: errMsg
                        }
                        error = err;
                        callback(finish);
                        return;
                    }

                    redirect = Common.countryRedirectionMap[data.countryCode];
                    if (redirect && redirect != Common.serverurl) {
                        // need to redirect user no another server based on geographic location
                        var msg = "Redirecting user from " + data.countryCode + " to " + redirect;
                        logger.info("checkIfNeedRedirection: geo redirection, " + msg);
                        response = {
                            status: 301,
                            message: msg,
                            mgmtURL: redirect
                        }
                        callback(finish);
                        return;
                    }
                    callback(null);
                });
            } else {
                callback(null);
            }
        },
        //get activation data to get the user name
        function(callback) {
            if (!Common.dcName || !Common.dcURL) {
                callback(finish);
                return;
            }

            getActivationData(activationKey, logger, function(err, activation) {
                if (err) {
                    var msg = 'failed getting activation data';
                    response = {
                        status: 0,
                        message: msg
                    }
                    error = msg;
                    callback(finish);
                    return;
                }
                activationData = activation;
                callback(null);
            });
        },
        // check if user connected already to some data center
        function(callback) {
            if (!Common.dcName || !Common.dcURL) {
                callback(finish);
                return;
            }

            internalRequests.createOrReturnUserAndDomain(activationData.email, logger, function(err, user, userObj, orgObj) {
                if (err) {
                    response = {
                        status: 0,
                        message: 'Internal error'
                    }
                    logger.error("checkIfNeedRedirection: couldn't get user, " + err);
                    error = err;
                    callback(finish);
                    return;
                }

                if (user.dcname && Common.dcName != user.dcname) {
                    var msg = "Redirecting user from " + Common.dcName + " to " + user.dcname;
                    logger.info("checkIfNeedRedirection: user connected already, " + msg);
                    response = {
                        status: 301,
                        message: msg,
                        mgmtURL: user.dcurl
                    }
                }
                userData = user;
                userData.org = orgObj;
                userData.user = userObj;
                callback(finish);

            });
        }
    ], function(finish) {
        callback(error, response, userData, activationData);
    });
}

function getActivationData(activationKey, logger, callback) {

    Common.db.Activation.findAll({
        attributes: ['activationkey', 'status', 'email', 'deviceid', 'firstlogin', 'resetpasscode', 'firstname', 'lastname', 'jobtitle', 'devicetype'],
        where: {
            activationkey: activationKey
        },
    }).complete(function(err, results) {

        if (!!err) {
            logger.error("getActivationInfo: " + err);
            var errMsg = "Internal database error";
            callback(errMsg);
            return;
        }

        if (!results || results == "") {
            var errMsg = "activationKey not found!";
            logger.error("getActivationInfo: " + errMsg);
            callback(errMsg);
            return;
        }

        if (results.length != 1) {
            var errMsg = "Internal database error";
            logger.error("getActivationInfo: more then one activation key, key: " + activationKey);
            callback(errMsg);
            return;
        }

        callback(null, results[0]);
    });
}

function getUserDeviceData(email, deviceID, logger, maindomain, callback) {
   var blockedDevices = [];
   Common.db.BlockedDevices.findAll({
         attributes: [ 'devicename'],
         where: {
             maindomain : maindomain,
         },
    }).complete(function(err, results) {
        if (!!err) {
            errormsg = 'Error on get Blocked Devices: ' + err;
            console.log(errormsg);
            return;
        } else if (results) {
            results.forEach(function(row) {
                blockedDevices.push(row.devicename);
            });
        }
    });

    Common.db.UserDevices.findAll({
        attributes: ['email', 'imei', 'active', 'devicename'],
        where: {
            email: email,
            imei: deviceID
        },
    }).complete(function(err, results) {
        if (!!err) {
            logger.error('getUserDeviceData: ' + err);
            var errMsg = "Internal database error";
            callback(errMsg);
            return;

        }

        if (!results || results == "") {
            var errMsg = "Device does not exist";
            logger.error('getUserDeviceData: ' + errMsg);
            callback(errMsg);
            return;
        }

        if (results.length != 1) {
            var errMsg = "Internal database error";
            logger.error("getUserDeviceData: more then one device, deviceID: " + deviceID);
            callback(errMsg);
            return;
        }

        var isDeviceBlocked = false;
        for (var i=0; i < blockedDevices.length; i++) {
            // console.log("****getUserDeviceData. devicename: " + results[0].devicename + ", blockedDevices[i]: " + blockedDevices[i]);
            if (results[0].devicename && blockedDevices[i]) {
                if (results[0].devicename.toLowerCase().indexOf(blockedDevices[i].toLowerCase()) > -1) {
                    isDeviceBlocked = true;
                    break;
                }
            }
        };

        callback(null, results[0], isDeviceBlocked);
    });
}

function validateActivation(activationKey, deviceID, userdata, activationdata, url, clientUserName, logger, callback) {

    var finish = 'finish';
    var response = null;
    var error = null;

    if (activationKey.indexOf('NuboTester') == 0) {
        // this is nubo test we need to pre register him !
        logger.info("NuboTester...");

        Common.db.Activation.findAll({
            attributes: ['activationkey', 'status', 'email', 'deviceid', 'firstlogin', 'resetpasscode', 'firstname', 'lastname', 'jobtitle'],
            where: {
                activationkey: activationKey
            },
        }).complete(function(err, results) {

            if (!!err) {
                returnInternalError(err);
                return;
            }

            if (results.length >= 1 && results[0].length > 2) {
                logger.info("NuboTester already found!");
                //checkRedirection();
                // activation found, process normally
                return;
            }

            // set creation date of the activation link
            var currentDate = new Date();

            // build expiration date 48 hours from creation date (make iT settings later on)
            Clogger.info('Activation Timeout:' + Common.activationTimeoutPeriod);
            var expirationDate = new Date();
            expirationDate.setHours(expirationDate.getHours() + Common.activationTimeoutPeriod);

            // create activation and user before process
            var email = activationKey + '@sysaidhr.com';

            Common.db.Activation.create({
                activationkey: activationKey,
                deviceid: activationKey,
                status: 1,
                email: email,
                firstname: 'Nubo',
                lastname: 'Tester',
                jobtitle: 'Tester',
                emailtoken: 'emailToken',
                pushregid: 'regid',
                firstlogin: 1,
                resetpasscode: 0,
                devicetype: 'Android',
                createdate: currentDate,
                expirationdate: expirationDate
            }).then(function(results) {

                logger.info("Added activation " + activationKey);

                internalRequests.createOrReturnUserAndDomain(email, logger, function(err, obj) {
                    if (err) {
                        returnInternalError(err);
                        return;
                    }

                    // update the user details
                    User.setUserDetails(obj.email, 'Nubo', 'Tester', 'Tester', function(err) {
                        //checkRedirection();
                    });
                });

            }).catch(function(err) {
                returnInternalError(err, res);
                return;
            });

        });

    } else {

        var activationData = activationdata;
        var userData = userdata;
        var userDeviceData = null;

        var adminName = "";
        var adminEmail = "";

        async.series([
            //get activation data
            function(callback) {
                if (activationData) {
                    callback(null);
                } else {
                    getActivationData(activationKey, logger, function(err, activation) {
                        if (err) {
                            response = {
                                status: 0,
                                message: err
                            }
                            error = err;
                            logger.error('validateActivation: ' + err);
                            callback(finish);
                            return;
                        }

                        logger.user(activation.email);
                        activationData = activation;
                        callback(null);
                    });
                }
            },
            //check activation data
            function(callback) {
                switch (activationData.status) {
                    case 0:
                        var msg = "Activation pending. Please try again later.";
                        response = {
                            status: 0,
                            message: msg
                        }
                        callback(finish);
                        return;
                    case 1:
                        callback(null);
                        return;
                    case 2:
                        response = {
                            status: 2,
                            message: "Activation expired. Please register again."
                        }
                        callback(finish);
                        return;
                    default:
                        var msg = "Internal error. Please contact administrator.";
                        response = {
                            status: 0,
                            message: msg
                        }
                        logger.error('validateActivation: ' + msg);
                        callback(finish);
                        return;
                }
            },
            // check userName and deviceID 
            function(callback) {
                if (deviceID !== activationData.deviceid) {
                    response = {
                        status: 0,
                        message: "Internal error. Please contact administrator."
                    }
                    error = "device ID recived from client doesnt indentical to the one in activation table";
                    logger.error('validateActivation: ' + error + " URL: " + url);
                    callback(finish);
                } else
                    callback(null);
            },
            //get user data 
            function(callback) {
                if (userData) {
                    callback(null);
                } else {
                    internalRequests.createOrReturnUserAndDomain(activationData.email, logger, function(err, resObj, userObj, orgObj) {
                        if (err) {
                            response = {
                                status: 0,
                                message: "Internal error. Please contact administrator."
                            }
                            error = err;
                            logger.error('validateActivation: ' + err);
                            callback(finish);
                            return;
                        }
                        userData = resObj;
                        userData.org = orgObj;
                        userData.user = userObj;
                        callback(null);
                    });
                }
            },
            // get admin data
            function(callback) {
                Common.db.User.findAll({
                     attributes: ['email', 'firstname', 'lastname'],
                     where: {
                         orgdomain : userData.domain,
                         isadmin : '1'
                     },
                }).complete(function(err, results) {
                    if (err) {
                        errormsg = 'Error on get Admin' + err;
                        console.log(errormsg);
                        callback(errormsg);
                        return;
                    }

                    if (results.length < 1) {
                        callback(null);
                        return;
                    }

                    var row = results[0];
                    adminName = row.firstname + " " + row.lastname;
                    adminEmail = row.email;
                    callback(null);
                });
            },
            //check user data
            function(callback) {
                //validate username on motorola project
                if (Common.withService) {
                    if (userData.username != clientUserName) {
                        response = {
                            status: 0,
                            message: "Could not find username: " + clientUserName
                        }
                        callback(finish);
                        return;
                    }
                }

                if (userData.user.isactive == 0) {
                    response = {
                        status: 6,
                        message: "user not active!. Please contact administrator.",
                        orgName: userData.orgName,
                        adminEmail: adminEmail,
                        adminName: adminName
                    }
                    callback(finish);
                    return;
                }

                // when user is first created, he gets loginattempts = 0.
                // there is no possibility that user has loginattempts = null.
                // this can only be due to reasons such as alter table from old db
                var loginattempts = userData.loginattempts ? userData.loginattempts : 0;
                if (loginattempts >= MAX_LOGIN_ATTEMPTS) {
                    response = {
                        status: 4,
                        message: "User passcode has been locked. Unlock email was sent. Please contact administrator."
                    }
                    callback(finish);
                    return;
                }

                callback(null);
            },
            //get and check user device data
            function(callback) {
                var email = activationData.email;
                var deviceid = activationData.deviceid;
                var maindomain = userData.domain;
                getUserDeviceData(email, deviceid, logger, maindomain, function(err, userDevice, isDeviceBlocked) {
                    if (err) {
                        response = {
                            status: 0,
                            message: err
                        }
                        error = err;
                        logger.error('validateActivation: ' + err);
                        callback(finish);
                        return;
                    }

                    if (isDeviceBlocked) {
                        response = {
                            status: 5,
                            message: "device " + deviceid + " blocked!. Please contact administrator.",
                            orgName: userData.orgName,
                            adminEmail: adminEmail,
                            adminName: adminName
                        }
                        callback(finish);
                        return;
                    }

                    if (userDevice.active == 0) {
                        response = {
                            status: 5,
                            message: "device " + deviceid + " not active!. Please contact administrator.",
                            orgName: userData.orgName,
                            adminEmail: adminEmail,
                            adminName: adminName
                        }
                        callback(finish);
                        return;
                    }

                    userDeviceData = userDevice;
                    callback(null);
                });
            },
            //create login token
            function(callback) {
                new Login(null, function(err, login) {
                    if (err) {
                        response = {
                            status: 0,
                            message: "Internal error. Please contact administrator."
                        }
                        error = err;
                        logger.error('validateActivation: ' + err);
                        callback(finish);
                        return;
                    }

                    if (Common.withService) {
                        login.setAuthenticationRequired(false);
                        login.setPasscodeActivationRequired(false);
                        login.setValidLogin(true);
                    } else {
                        var firstLogin = activationData.firstlogin ? activationData.firstlogin : 0;
                        var authType = userData.authType;

                        if (authType != '0' && firstLogin == '1') {
                            login.setAuthenticationRequired(true);
                        } else {
                            login.setAuthenticationRequired(false);
                        }

                        var passcode = userData.passcode;
                        var resetPasscode = activationData.resetpasscode != null ? activationData.resetpasscode : 0;
                        login.setPasscodeActivationRequired(passcode == null || passcode == '' || resetPasscode == 1);
                    }

                    login.setDeviceName(userDeviceData.devicename);
                    login.setDeviceID(userDeviceData.imei);
                    login.setUserName(userData.email);
                    login.setImUserName(userData.username);
                    login.setActivationKey(activationKey);
                    login.setIsAdmin(userData.isAdmin);
                    login.setMainDomain(userData.domain);
                    login.setDeviceType(activationData.devicetype ? activationData.devicetype : '');
                    login.setLang(userData.lang);
                    login.setCountryLang(userData.countrylang);
                    login.setLocalevar(userData.localevar);
                    login.setEncrypted(userData.encrypted);
                    login.setDcname(userData.dcname ? userData.dcname : Common.dcName);
                    login.setDcurl(userData.dcurl ? userData.dcurl : Common.dcURL);
                    login.loginParams.passcodeexpirationdays = userData.passcodeexpirationdays;
                    login.loginParams.passcodeupdate = userData.passcodeupdate;

                    login.save(function(err, login) {
                        if (err) {
                            response = {
                                status: 0,
                                message: "Internal error. Please contact administrator."
                            }
                            error = err;
                            logger.error('validateActivation: ' + err);
                            callback(finish);
                            return;
                        }
     
                        response = {
                            status: 1,
                            message: "Device activated !",
                            authenticationRequired: login.getAuthenticationRequired(),
                            passcodeActivationRequired: login.getPasscodeActivationRequired(),
                            'orgName': userData.orgName,
                            'authType': authType,
                            'firstName': (activationData.firstname ? activationData.firstname : ''),
                            'lastName': (activationData.lastname ? activationData.lastname : ''),
                            'jobTitle': (activationData.jobtitle ? activationData.jobtitle : ''),
                            'sendTrackData': Common.sendTrackData,
                            'trackDataUrl': Common.trackURL,
                            'platformVersionCode': Common.platformVersionCode,
                            'photoCompression': Common.photoCompression,
                            'clientProperties' : Common.clientProperties,
                            passcodeminchars: userData.org.passcodeminchars,
                            passcodetype: userData.org.passcodetype,
                            passcodetypechange: userData.user.passcodetypechange,
                            loginToken: login.getLoginToken()
                        }

                        callback(finish);
                    });
                });
            }
        ], function(finish) {
            callback(error, response);
        });
    }
}

function parseVersion(verStr) {
    var ver = {
        major: 0,
        minor: 0
    };
    var arr = verStr.split(".");
    if (arr.length >= 2) {
        ver.major = arr[0];
        ver.minor = arr[1];
    }
    return ver;
}
