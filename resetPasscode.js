"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var crypto = require('crypto');
var util = require('util');
var Login = require('./login.js');
var smsNotification = require('./SmsNotification.js');
var User = require('./user.js');

var isFirstTime = "";

function returnInternalError(err, res) {
    var statusInternal = 0;
    // internal error
    var msgInternal = "Internal error";
    console.error(err.name, err.message);
    if (res != undefined) {
        res.send({
            status : statusInternal,
            message : msgInternal,
            isFirstTime : isFirstTime
        });
    }
    return;
}

function resetPasscode(req, res, next) {
    // https://oritest.nubosoftware.com/resetPasscode?loginToken=[loginToken]
    res.contentType = 'json';
    var msg = "";
    var status = 100;
    //unknown
    var statusEmail = 100;
    isFirstTime = "";

    //read and validate params
    var loginToken = req.params.loginToken;
    if (loginToken == undefined || loginToken.length < 5) {
        status = 2;
        // invalid parameter
        msg = "Invalid loginToken";
    }

    if (status == 0) {
        res.send({
            status : status,
            message : msg
        });
        return;
    }
    
    (function(loginToken) {
        new Login(loginToken, function(err, login) {
            if (err) {
                status = 2;
                // invalid parameter
                msg = "Invalid loginToken, err:" + err;
                res.send({
                    status : status,
                    message : msg,
                    loginToken : 'notValid'
                });
                return;
            }
            if (login.getPasscodeActivationRequired() != "false" || login.getAuthenticationRequired() != "false") {
                status = 0;
                // invalid parameter
                msg = "Pascode reset not allowed";
                res.send({
                    status : status,
                    message : msg
                });
                return;
            }
            Common.db.Activation.findAll({
                attributes : ['status', 'email', 'firstname', 'lastname', 'emailtoken', 'devicetype'],
                where : {
                    activationkey : login.getActivationKey()
                },
            }).complete(function(err, results) {

                if (!!err) {
                    returnInternalError(err);
                    return;
                }

                if (!results || results == "") {
                    returnInternalError("activationKey not found!");
                    return;
                }

                var email = results[0].email != null ? results[0].email : '';
                var firstName = results[0].firstname != null ? results[0].firstname : '';
                var lastName = results[0].lastname != null ? results[0].lastname : '';
                var emailToken = results[0].emailtoken != null ? results[0].emailtoken : '';
                var devicetype = results[0].devicetype != null ? results[0].devicetype : '';
                var emailDomain = '';

                User.getUserDomain(email, function (orgDomainFromDB ) {
                    if (orgDomainFromDB)
                        emailDomain = orgDomainFromDB;
                    else
                        emailDomain = email.substr(email.indexOf('@') + 1);
                    
                    
                    var deviceText = "";
                    if (devicetype == "Web") {
                        deviceText = ".";
                    } else {
                        deviceText = " from your mobile device:";
                    }
                    logger.info("resetPasscode. deviceType: " + devicetype);

                    (function(email, firstName, lastName, emailToken) {
                        var expirationDate = new Date();
                        expirationDate.setHours(expirationDate.getHours() + Common.activationTimeoutPeriod);
                        Common.db.Activation.update({
                            status : 0,
                            resetpasscode : 1,
                            expirationdate : expirationDate
                        }, {
                            where : {
                                activationkey : login.getActivationKey()
                            }
                        }).then(function() {
                            status = 1;
                            var msg = "Reset passcode sent";
                            res.send({
                                status : status,
                                message : msg
                            });

                            Common.db.Orgs.findAll({
                                attributes : ['notifieradmin','deviceapprovaltype'],
                                where : {
                                    maindomain : emailDomain
                                },
                            }).complete(function(err, results) {

                                if (!!err) { // error on fetching org
                                    logger.error('Error on get orgs details for ' + emailDomain +', error: ' + err);
                                } else if (!results || results == "") { // no org in DB
                                    logger.error('Cannot find org + ' + emailDomain);
                                } else { // get org details and act accordingly
                                    var row = results[0];
                                    var notifieradmin = row.notifieradmin != null ? row.notifieradmin : '';
                                    var deviceapprovaltype = row.deviceapprovaltype != null ? row.deviceapprovaltype : 0;
                                    
                                    var senderEmail = "support@nubosoftware.com";
                                    var senderName = "Nubo Support";
                                    
                                    // define to recepient and subject based on device approval type
                                    var toEmail = '';
                                    var emailSubject = '';
                                    var toName = '';
                                    if (deviceapprovaltype == 0) { // default behavior, user approve himself
                                        toEmail = email;
                                        emailSubject = 'Reset Passcode';
                                        toName = firstName + " " + lastName;
                                    } else if (deviceapprovaltype == 1) { // manually only by admin
                                        toEmail = notifieradmin;
                                        emailSubject = 'Reset Passcode for ' + firstName + ' ' + lastName;
                                        toName = notifieradmin;
                                    } else if (deviceapprovaltype == 2) { // both for admin and user
                                        toEmail = [notifieradmin,email];
                                        emailSubject = 'Reset Passcode for ' + firstName + ' ' + lastName;
                                        toName = '';
                                    }
                                    
                                    // build reset password URL 
                                    var resetURL = Common.serverurl + "html/player/login.html#resetPasscodeLink/" + encodeURIComponent(emailToken) + "/" + encodeURIComponent(email);
                                    logger.info("Reset password Link: " + resetURL);
                                    
                                    if (toEmail != null && toEmail.length > 0) {
                                        logger.info("Reset Link: " + resetURL);
                                        var mailOptions = {
                                            from : senderEmail, // sender address
                                            fromname : senderName,
                                            to : toEmail,
                                            toname : toName,
                                            subject : emailSubject,
                                            // Subject line
                                            //text: "Dear " + firstName + " " + lastName + ", \nPlease click the following link to reset your passcode, and then continue working from your mobile device:\n\n" + Common.serverurl + "activationLink?token=" + emailToken + "\n\n- The Nubo Team",
                                            text : "Dear " + firstName + " " + lastName + ", \nPlease click the following link to reset your passcode, and then continue working" + deviceText + "\n\n" + resetURL + "\n\n- The Nubo Team",
                                            // plaintext body
                                            //html: "<p>Dear " + firstName + " " + lastName + ",</p><p> \nPlease click the following link to reset your passcode, and then continue working from your mobile device:</p>\n\n" + "<p><a href=\"" + resetURL + "\">" + firstName + " " + lastName + " – Reset Passcode</a></p>  \n\n<p>- The Nubo Team</p>"
                                            html : "<p>Dear " + firstName + " " + lastName + ",</p><p> \nPlease click the following link to reset your passcode, and then continue working" + deviceText + "</p>\n\n" + "<p><a href=\"" + resetURL + "\">" + firstName + " " + lastName + " – Reset Passcode</a></p>  \n\n<p>- The Nubo Team</p>"

                                        };

                                        // send mail with defined transport object
                                        logger.info("sent " + email + " reset password email");
                                        Common.mailer.send(mailOptions, function(success, message) {
                                            if (!success) {
                                                logger.info("sendgrid error: " + message);
                                            } else {

                                            }
                                        });
                                    }

                                    // send SMS
                                    if (Common.activateBySMS && (deviceapprovaltype == 0 || deviceapprovaltype == 2)) {
                                        Common.db.User.findAll({
                                            attributes : ['mobilephone'],
                                            where : {
                                                email : email,
                                            },
                                        }).complete(function(err, results) {
                                            if (!!err) {
                                                status = 0;
                                                msg = "Internal Error: " + err;
                                                logger.info("reset passcode find user by email error: " + msg);
                                            } else if (!results || results == "") {
                                                status = 0;
                                                msg = "Cannot find user " + login.getUserName();
                                                logger.info("reset passcode find user by email error, " + msg);
                                            } else {
                                                var mobilePhone = results[0].mobilephone != null ? results[0].mobilephone : '';

                                                // some validation on mobile phone even they are coming from the data base
                                                if (mobilePhone != null && mobilePhone.length > 0 && mobilePhone.length < 20) {
                                                    smsNotification.sendSmsNotificationInternal(mobilePhone,'Click your Nubo reset password link ' + resetURL, function(message, status) {
                                                        logger.info(message);
                                                    });
                                                }
                                            }
                                        });
                                    }
                                }
                            });       
                    }).catch(function(err) {
                        status = 0;
                        msg = "Internal Error: " + err;
                        res.send({
                            status : status,
                            message : msg
                        });
                        return;
                    });

                })(email, firstName, lastName, emailToken);
            });

        });
        // Login
    });
    })(loginToken);
}

var resetPasscode = {
    func : resetPasscode
};
module.exports = resetPasscode;
