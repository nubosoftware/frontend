"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var User = require('./user.js');
var Notifications = require('./Notifications.js');
var Track = require('./track.js');
var ThreadedLogger = require('./ThreadedLogger.js');
var internalRequests = require('./internalRequests.js');
var reg;
var status;
var msg;

var ActivationLink = {
    func : activationLink
};
module.exports = ActivationLink;

function returnInternalError(err, res) {
    status = 3;
    // internal error
    msg = "Internal error";
    console.error(err.name, err.message);
    if (res != undefined) {
        res.send({
            status : status,
            message : msg
        });
    }
    return;
}

function is_mobile(req) {
    var ua = req.header('user-agent');
    logger.info("user-agent=" + ua);
    if (/Android/.test(ua))
        return true;
    else
        return false;
};

function activationLink(req, res, next) {
    var status = 100;
    var msg = "";
    var logger = new ThreadedLogger();
    var emailToken = req.params.token;
    if (emailToken == undefined || emailToken.length < 15) {
        status = 1;
        // invalid parameter
        msg = "Invalid token";
    }

    var cloneActivation = req.params.cloneActivation;

    if (status == 1) {
        res.send({
            status : status,
            message : msg
        });
        return;
    }

    var datetest = new Date();

    Common.db.Activation.findAll({
        attributes : ['deviceid', 'activationkey', 'status', 'pushregid', 'email', 'firstname', 'lastname', 'jobtitle', 'devicetype'],
        where : ['expirationdate >= ? AND emailtoken = ? ', new Date(), emailToken],
    }).complete(function(err, results) {

        if (!!err) {
            returnInternalError(err);
            return;
        }

        if (!results || results == "") {
            status = 1;
            // invalid parameter
            msg = "Token not found!";
            res.send({
                status : status,
                message : msg
            });
            return;
        }

        results.forEach(function(row) {
            if (row.status == 0) {
                var oldActivationKey = row.activationkey != null ? row.activationkey : '';
                var deviceid = row.deviceid != null ? row.deviceid : '';
                var email = row.email != null ? row.email : '';
                var pushRegID = row.pushregid != null ? row.pushregid : '';
                var firstName = row.firstname != null ? row.firstname : '';
                var lastName = row.lastname != null ? row.lastname : '';
                var jobTitle = row.jobtitle != null ? row.jobtitle : '';
                var deviceType = row.devicetype != null ? row.devicetype : '';
                logger.user(email);

                var clientIP = req.connection.remoteAddress;

                var appid = deviceid + "_" + oldActivationKey;
                Track.trackAPI({
                    customAppID : appid,
                    customSessID : appid,
                    type : 'Activation validated',
                    appType : 'Nubo',
                    ip : clientIP,
                    userParams : {
                        email : email,
                        firstName : firstName,
                        lastName : lastName,
                        title : jobTitle
                    },
                    other : {
                        dcName : Common.dcName,
                        deviceType : deviceType,
                        deviceid : deviceid
                    }
                });

                //1. create user in db (if necessary)
                internalRequests.createOrReturnUserAndDomain(email, logger, function(err, obj) {
                    if (err) {
                        returnInternalError(err);
                        return;
                    }
                    var email = obj.email;
                    var domain = obj.domain;
                    var authType = obj.authType;
                    var orgName = obj.orgName;
                    var serverURL = obj.exchange_conf.serverURL;
                    var passcode = obj.passcode;
                    var orgEmail = obj.orgEmail;
                    var orgUser = obj.exchange_conf.orgUser;
                    var orgPassword = obj.exchange_conf.orgPassword;

                    // update the user details from latest activation record
                    if (firstName != null && firstName.length > 0)
                        User.setUserDetails(email, firstName, lastName, jobTitle, function(err) {
                        });

                    //2. update Activation in db
                    Common.db.Activation.update({
                        status : 1
                    }, {
                        where : {
                            activationkey : oldActivationKey
                        }
                    }).then(function() {
                        status = 0;

                        // mark old activation from the same device as invalid
                        // cloneActivation if exist, has different deviceid (HTML5 client) so we can run it here, asynchronously with cloneActivation update

                        Common.db.Activation.findAll({
                            attributes : ['deviceid', 'activationkey', 'status', 'pushregid', 'email', 'firstname', 'lastname', 'jobtitle', 'devicetype'],
                            where : {
                                deviceid : deviceid
                            },
                        }).complete(function(err, results) {

                            if (!!err) {
                                logger.info("ERROR: Cannot get Activations of deviceid: " + deviceid);
                            }

                            results.forEach(function(row) {
                                var otherActivationKey = row.activationkey != null ? row.activationkey : '';
                                if (otherActivationKey != oldActivationKey) {

                                    Common.db.Activation.update({
                                        status : 2
                                    }, {
                                        where : {
                                            activationkey : otherActivationKey
                                        }
                                    }).then(function() {

                                    }).catch(function(err) {

                                    });
                                }
                            });
                        });

                        //3. send approval to the user

                        //res.statusCode = 302;
                        //res.setHeader("Location", "/html/welcome/w.html");
                        //res.end();

                        //4. create user in storage (if necessary)

                        if (cloneActivation != undefined && cloneActivation.length > 5) {

                            Common.db.Activation.findAll({
                                attributes : ['deviceid', 'activationkey', 'status', 'pushregid', 'email', 'firstname', 'lastname', 'jobtitle', 'devicetype'],
                                where : {
                                    activationkey : cloneActivation
                                },
                            }).complete(function(err, results) {

                                if (!!err) {
                                    logger.info("Error while setting clone activation: " + err);
                                    var msg = "Device activated !";
                                    res.send({
                                        status : status,
                                        message : msg,
                                        "deviceType" : deviceType
                                    });
                                    return;
                                }

                                if (!results || results == "") {
                                    logger.info("Error while setting clone activation. cloneActivation not found:" + cloneActivation);
                                    var msg = "Device activated !";
                                    res.send({
                                        status : status,
                                        message : msg,
                                        "deviceType" : deviceType
                                    });
                                    return;
                                }

                                var row = results[0];
                                if (row.status == 0 && (row.email != null ? row.email : '') == email) {
                                    Common.db.Activation.update({
                                        status : 1
                                    }, {
                                        where : {
                                            activationkey : cloneActivation
                                        }
                                    }).then(function() {
                                        var msg = "Device activated ! Clone activation activated also!";
                                        res.send({
                                            status : status,
                                            message : msg,
                                            "deviceType" : deviceType,
                                            "cloneActivation" : cloneActivation
                                        });
                                        return;
                                    }).catch(function(err) {
                                        logger.info("Error while setting clone activation. update failed:" + err);
                                        var msg = "Device activated !";
                                        res.send({
                                            status : status,
                                            message : msg,
                                            "deviceType" : deviceType
                                        });
                                        return;
                                    });

                                } else {
                                    logger.info("Error while setting clone activation. cloneActivation is not valid:" + cloneActivation);
                                    var msg = "Device activated !";
                                    res.send({
                                        status : status,
                                        message : msg,
                                        "deviceType" : deviceType
                                    });
                                    return;
                                }
                            });

                        } else {
                            var msg = "Device activated !";
                            res.send({
                                status : status,
                                message : msg,
                                "deviceType" : deviceType,
                                email : email
                            });
                        }

                        // create the user folder so we can write settings on it
                        internalRequests.createUserFolders(email, deviceid, false, new Date().getTime(), process.hrtime()[1], function(err) {

                        }, false);
                        // Send push notification to this device
                        Notifications.sendNotificationByRegId(deviceType, pushRegID, 'your device has been activated!' , " ", 'Nubo', "-2");                        
                        return;
                    }).catch(function(err) {
                        returnInternalError(err);
                        return;
                    });

                });
                // createOrReturnUserAndDomain

            } else {
                status = 1;
                // invalid parameter
                msg = "Token is not valid any more. Please try again.";
                var deviceType = row.devicetype;
                res.send({
                    status : status,
                    message : msg,
                    "deviceType" : deviceType
                });
                //res.statusCode = 302;
                //res.setHeader("Location", "/html/welcome/e.html");
                //res.end();
                return;
            }
        });
    });

}

/*
var feedbackOptions = {
    "batchFeedback" : true,
    "interval" : 30
};

var feedback = new apn.Feedback(feedbackOptions);
feedback.on("feedback", function(devices) {
    devices.forEach(function(item) {
        logger.info("Feedback from APN: " + JSON.stringify(item));
    });
});
*/
