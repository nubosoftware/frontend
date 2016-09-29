"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var crypto = require('crypto');
var util = require('util');
var Login = require('./login.js');
var Track = require('./track.js');
var async = require('async');
var ThreadedLogger = require('./ThreadedLogger.js');
var smsNotification = require('./SmsNotification.js');

var isFirstTime = "";

var MIN_DIFFERENT_DIGITS = 4;
// user is allowed 3 login attempts. then he will be locked.
var MAX_LOGIN_ATTEMPTS = 3;

function returnInternalError(err, res) {
    status = Common.STATUS_ERROR;
    // internal error
    msg = "Internal error";
    console.error(err.name, err.message);
    if (res != undefined) {
        res.send({
            status : status,
            message : msg,
            isFirstTime : isFirstTime
        });
    }
    return;
}

function checkPasscode(req, res, next) {
    // https://oritest.nubosoftware.com/checkPasscode?loginToken=[]&passcode=[]
    var logger = new ThreadedLogger();
    res.contentType = 'json';
    var msg = "";
    var status = 100;
    // unknown
    var statusEmail = 100;
    isFirstTime = "";

    // read and validate params
    logger.info("check passcode...");

    var loginToken = req.params.loginToken;
    if (loginToken == undefined || loginToken.length < 5) {
        status = Common.STATUS_EXPIRED_LOGIN_TOKEN;
        // invalid parameter
        msg = "Invalid loginToken";
    }

    var passcode = req.params.passcode;

    if (passcode == undefined) {
        status = Common.STATUS_INVALID_PASSCODE;
        // invalid parameter
        msg = "Invalid passCode";
        res.send({
            status : status,
            message : msg
        });
        return;
    }

    (function(loginToken, passcode) {
        new Login(loginToken, function(err, login) {
            if (err) {
                status = Common.STATUS_EXPIRED_LOGIN_TOKEN;
                // invalid parameter
                msg = "Invalid loginToken, err:" + err;
                res.send({
                    status : status,
                    message : msg,
                    loginToken : 'notValid'
                });
                return;
            }
            logger.user(login.getEmail());

            function loginUser(login, passcode, res) {
                login.setPasscode(passcode);
                login.setValidLogin(true);
                login.loginParams.passcode = passcode;
                login.save(function(err, login) {
                    var status = Common.STATUS_OK;
                    var msg = "Passcode is valid. User loggedin";
                    var l = login.loginParams;
                    var passcodeexpirationdate;
                    if (l.passcodeexpirationdays > 0) {
                        var passcodeupdate = new Date(l.passcodeupdate);
                        var now = new Date();
                        passcodeexpirationdate = new Date(passcodeupdate.getTime() + l.passcodeexpirationdays*24*60*60*1000);
                        if (now > passcodeexpirationdate) {
                            status = Common.STATUS_EXPIRED_PASSCODE;
                            msg = "Passcode is valid, but expired";
                        } else {
                            status = Common.STATUS_OK;
                            msg = "Passcode is valid. User loggedin";
                        }
                    } else  {
                        status = Common.STATUS_OK;
                        msg = "Passcode is valid. User loggedin";
                    }

                    console.dir(login.loginParams);
                    res.send({
                        status : status,
                        message : msg
                    });
                    sendTrack();
                });
            }

            function sendTrack() {
                if (login.getActivationKey() == "8042c13987c6633d8e682bb53a022e015d9dc4ce71e6371e4edc5e02b90fb26bf765652a40dc6f8f0f1c6d47ca35426d")
                    return;
                var appid = login.getDeviceID() + "_" + login.getActivationKey();
                Track.trackAPI({
                    customAppID : appid,
                    customSessID : appid,
                    type : 'Passcode check',
                    appType : 'Nubo',
                    ip : req.connection.remoteAddress,
                    userParams : {
                        email : login.getEmail(),
                    },
                    other : {
                        dcName : Common.dcName,
                        msg : msg,
                        status : status,
                        validLogin : login.isValidLogin()
                    }
                });
            }

            if (login.getPasscodeActivationRequired() != "false" || login.getAuthenticationRequired() != "false") {
                status = Common.STATUS_ERROR;
                // invalid parameter
                msg = "Pascode enter not allowed";
                res.send({
                    status : status,
                    message : msg
                });
                sendTrack();
                return;
            }

            Common.db.User.findAll({
                attributes : ['isactive', 'passcode', 'loginattempts'],
                where : {
                    orgdomain : login.getMainDomain(),
                    email : login.getEmail()
                },
            }).complete(function(err, results) {
                if (!!err) {
                    status = Common.STATUS_ERROR;
                    msg = "Internal Error: " + err;
                    res.send({
                        status : status,
                        message : msg
                    });
                    sendTrack();
                    return;
                }

                if (!results || results == "") {
                    status = Common.STATUS_ERROR;
                    msg = "Cannot find user or user is inactive " + login.getEmail();
                    res.send({
                        status : status,
                        message : msg
                    });
                    sendTrack();
                    return;
                }

                var dbPasscode = Common.dec(results[0].passcode);
                // when user is first created, he gets loginattempts = 0.
                // there is no possibility that user has loginattempts = null.
                // this can only be due to reasons such as alter table from old db
                var loginattempts = results[0].loginattempts != null ? results[0].loginattempts : 0;
                var isUserActive = results[0].isactive != null ? results[0].isactive : 0;

                Common.db.UserDevices.findAll({
                    attributes: ['active'],
                    where: {
                        email: login.getEmail(),
                        imei: login.getDeviceID(),
                        maindomain : login.getMainDomain()
                    },
                }).complete(function(err, results) {
                    var retErrorMsg = "Checkpasscode failure";
                    if (!!err) {
                        status = Common.STATUS_ERROR;
                        msg = "Internal Error: " + err;
                        logger.info(msg);
                        res.send({
                            status : status,
                            message : retErrorMsg
                        });
                        sendTrack();
                        return;
                    }

                   if (!results || results == "") {
                       status = Common.STATUS_ERROR;
                       msg = "Cannot find device " + login.getDeviceID();
                       logger.info(msg);
                       res.send({
                           status : status,
                           message : retErrorMsg
                       });
                       sendTrack();
                       return;
                   }

                   var isDeviceActive = results[0].active != null ? results[0].active : 0;

                   if (isUserActive == 0 || isDeviceActive == 0) {
                       // get admin data
                       Common.db.User.findAll({
                           attributes: ['email', 'firstname', 'lastname'],
                           where: {
                               orgdomain : login.getMainDomain(),
                               isadmin : '1'
                           },
                       }).complete(function(err, results) {
                           var adminName = "";
                           var adminEmail = "";
                           if (!!err) {
                                status = Common.STATUS_ERROR;
                                msg = "Internal Error: " + err;
                                logger.info(msg);
                           } else {
                               if (results && results.length > 0) {
                                   var row = results[0];
                                   adminName = row.firstname + " " + row.lastname;
                                   adminEmail = row.email;
                               } 
                           }

	                       if (isUserActive == 0) {
	                           status = Common.STATUS_DISABLE_USER;
	                           msg = "User is inactive " + login.getUserName();
	                           logger.info(msg);
	                      } else {
	                           //inactive device
	                           status = Common.STATUS_DISABLE_USER_DEVICE;
	                           msg = "Device is inactive " + login.getDeviceID();
	                           logger.info(msg);
	                      }

	                      // remove login token from redis
                          Common.redisClient.DEL('login_' + loginToken, function(err) {
                              if (!!err) {
                                  logger.info("Failed to delete logintoken");
                              }
                           });

	                      res.send({
	                          status : status,
	                          message : retErrorMsg,
	                          adminName : adminName,
	                          adminEmail : adminEmail,
	                          orgName : login.getMainDomain()
	                      });
	                      sendTrack();
	                      return;
                      });
                   } else {
                       if (loginattempts == null) {
                           // default loginattemps is 0
                           loginattempts = 0;
                       }
                       if (dbPasscode != passcode) {

                           // incorrect login. check for attempt no:
                           // logger.info("get loginattempts from db %s", login.getUserName());

                           Common.db.User.update({
                               loginattempts : (loginattempts + 1)
                           }, {
                               where : {
                                   email : login.getEmail()
                               }
                           }).then(function() {

                           }).catch(function(err) {
                               status = Common.STATUS_ERROR;
                               msg = "Internal Error: " + err;
                               res.send({
                                   status : status,
                                   message : msg
                               });
                               return;
                           });

                           // if before the update loginattempts was already 2 (MAX_LOGIN_ATTEMPTS -1), then lock him
                           logger.info("checking login attempts for user");
                           if (loginattempts + 1 >= MAX_LOGIN_ATTEMPTS) {
                               logger.info("login attempts failed");

                               //user has had mistaken twice and this is the third time
                               status = Common.STATUS_PASSWORD_LOCK;
                               // passcode lock
                               msg = "You have incorrectly typed your passcode 3 times. An email was sent to you. Open your email to open your passcode.";
                               logger.info(msg);

                               findUserNameSendEmail(login.getEmail());

                               // remove login token from redis
                               Common.redisClient.DEL('login_' + loginToken, function(err) {
                                   if (!!err) {
                                       logger.info("Failed to delete logintoken");
                                   }

                                   res.send({
                                       status : status,
                                       message : msg
                                   });
                                   sendTrack();
                               });
                               return;
                           } else {
                               status = Common.STATUS_INVALID_PASSCODE;
                               msg = "Invalid passcode";
                               res.send({
                                   status : status,
                                   message : msg
                               });
                               sendTrack();
                               return;
                           }

                       } else {
                           if (loginattempts > 0) {

                               Common.db.User.update({
                                   loginattempts : '0'
                               }, {
                                   where : {
                                       email : login.getEmail()
                                   }
                               }).then(function() {
                                   loginUser(login, passcode, res);
                               }).catch(function(err) {
                                   status = Common.STATUS_ERROR;
                                   msg = "Internal Error: " + err;
                                   res.send({
                                       status : status,
                                       message : msg
                                   });
                                   return;
                               });

                           } else {
                               loginUser(login, passcode, res);
                           }
                       }
                   }
                });
            });
        });

    })(loginToken, passcode);
    // end async

    /*
     * status = 1; msg = "Ok"; res.send({status: status , message: msg});
     */

}

function findUserNameSendEmail(userEmail) {

    var status;
    var msg;

    Common.db.User.findAll({
        attributes : ['firstname', 'lastname','mobilephone','orgdomain'],
        where : {
            email : userEmail,
        },
    }).complete(function(err, results) {

        if (!!err) {
            status = Common.STATUS_ERROR;
            msg = "Internal Error: " + err;
            logger.info("findUserNameSendEmail:" + msg);
            return;
        }

        if (!results || results == "") {
            status = Common.STATUS_ERROR;
            msg = "Cannot find user " + userEmail;
            logger.info("findUserNameSendEmail:" + msg);
            return;
        }

        var firstname = results[0].firstname != null ? results[0].firstname : '';
        var lastname = results[0].lastname != null ? results[0].lastname : '';
        var mobilePhone = results[0].mobilephone != null ? results[0].mobilephone : '';
        var mainDomain = results[0].orgdomain != null ? results[0].orgdomain : '';

        Common.crypto.randomBytes(48, function(ex, buf) {
            Common.crypto.randomBytes(48, function(ex, buf) {
                var loginEmailToken = buf.toString('hex');
                //update loginemailtoken and send unlock email to user

                Common.db.User.update({
                    loginemailtoken : loginEmailToken
                }, {
                    where : {
                        email : userEmail
                    }
                }).then(function() {
                    sendNotification(userEmail, firstname, lastname, loginEmailToken,mobilePhone,mainDomain);
                }).catch(function(err) {
                    status = Common.STATUS_ERROR;
                    msg = "Internal Error: " + err;
                    logger.info("findUserNameSendEmail:update loginemailtoken" + msg);
                    return;
                });

            });
        });
    });
}

function sendNotification(email, first, last, loginEmailToken,mobilePhone,mainDomain) {

    Common.db.Orgs.findAll({
        attributes : ['notifieradmin','deviceapprovaltype'],
        where : {
            maindomain : mainDomain
        },
    }).complete(function(err, results) {

        if (!!err) { // error on fetching org
            logger.error('Error on get orgs details for ' + mainDomain +', error: ' + err);
        } else if (!results || results == "") { // no org in DB
            logger.error('Cannot find org + ' + mainDomain);
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
                emailSubject = 'Unlock Nubo Passcode';
                toName = first + " " + last;
            } else if (deviceapprovaltype == 1) { // manually only by admin
                toEmail = notifieradmin;
                emailSubject = 'Unlock Nubo Passcode for ' + first + ' ' + last;
                toName = notifieradmin;
            } else if (deviceapprovaltype == 2) { // both for admin and user
                toEmail = [notifieradmin,email];
                emailSubject = 'Unlock Nubo Passcode for ' + first + ' ' + last;
                toName = '';
            }
            
            // build reset password URL 
            var unlockPasswordURL = Common.serverurl + "html/player/login.html#unlockPassword/" + encodeURIComponent(loginEmailToken) + "/" + encodeURIComponent(email);
            logger.info("Unlock Link: " + unlockPasswordURL);
            
            if (toEmail != null && toEmail.length > 0) {
                // setup e-mail data with unicode symbols
                var mailOptions = {
                    from : senderEmail,
                    // sender address
                    fromname : senderName,
                    to : toEmail,
                    // list of receivers
                    toname : toName,
                    subject : emailSubject,
                    // Subject line
                    text : "Dear " + first + " " + last + ", \n Unlock your passcode, and then go to your Nubo app from your mobile device." + "\n\n- The Nubo Team",
                    // plaintext body
                    html : "<p>Dear " + first + " " + last + ",</p><p> \n Click the following link to unlock your passcode, and then go to your Nubo app from your mobile device:</p>\n\n" + "<p><a href=\"" + unlockPasswordURL + "\">" + "Unlock Passcode</a></p>  \n\n<p>- The Nubo Team</p>" // html body
                };
                logger.info("sent " + email + " unlockpassword email");
                Common.mailer.send(mailOptions, function(success, message) {
                    if (!success) {
                        logger.info("sendgrid error: " + message);
                        return;
                    }
                });
            }

            // send SMS
            if (Common.activateBySMS && (deviceapprovaltype == 0 || deviceapprovaltype == 2)) {
                smsNotification.sendSmsNotificationInternal(mobilePhone,'Click to unlock your Nubo account ' + unlockPasswordURL, function(message, status) {
                    logger.info(message);
                });
            }
        }
    });
}

var checkPasscode = {
    func : checkPasscode,
    findUserNameSendEmail : findUserNameSendEmail
};

module.exports = checkPasscode;
