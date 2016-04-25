"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var crypto = require('crypto');
var util = require('util');
var Login = require('./login.js');
var isFirstTime = "";

function returnInternalError(err, res) {
    status = 0;
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

function resetPasscode(req, res, next) {
    // https://oritest.nubosoftware.com/resetPasscode?loginToken=[loginToken]
    res.contentType = 'json';
    var msg = "";
    var status = 100;
    //unknown
    var statusEmail = 100;
    isFirstTime = "";
    logger.info("resetPasscode: " + req.url);
    //read and validate params
    var loginToken = req.params.loginToken;
    if (loginToken == undefined || loginToken.length < 5) {
        status = 0;
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
                status = 0;
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

                        // setup e-mail data with unicode symbols
                        var resetURL = Common.serverurl + "html/player/login.html#resetPasscodeLink/" + encodeURIComponent(emailToken) + "/" + encodeURIComponent(email);
                        var mailOptions = {
                            from : "support@nubosoftware.com", // sender address
                            fromname : "Nubo Support",
                            to : email,
                            toname : firstName + " " + lastName,
                            subject : "Reset Passcode",
                            // Subject line
                            //text: "Dear " + firstName + " " + lastName + ", \nPlease click the following link to reset your passcode, and then continue working from your mobile device:\n\n" + Common.serverurl + "activationLink?token=" + emailToken + "\n\n- The Nubo Team",
                            text : "Dear " + firstName + " " + lastName + ", \nPlease click the following link to reset your passcode, and then continue working" + deviceText + "\n\n" + resetURL + "\n\n- The Nubo Team",
                            // plaintext body
                            //html: "<p>Dear " + firstName + " " + lastName + ",</p><p> \nPlease click the following link to reset your passcode, and then continue working from your mobile device:</p>\n\n" + "<p><a href=\"" + resetURL + "\">" + firstName + " " + lastName + " – Reset Passcode</a></p>  \n\n<p>- The Nubo Team</p>"
                            html : "<p>Dear " + firstName + " " + lastName + ",</p><p> \nPlease click the following link to reset your passcode, and then continue working" + deviceText + "</p>\n\n" + "<p><a href=\"" + resetURL + "\">" + firstName + " " + lastName + " – Reset Passcode</a></p>  \n\n<p>- The Nubo Team</p>"

                        };

                        logger.info("Before send message");
                        logger.info("reset: " + resetURL);
                        // send mail with defined transport object
                        Common.mailer.send(mailOptions, function(success, message) {
                            if (!success) {
                                logger.info("sendgrid error: " + message);
                            } else {

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
    })(loginToken);

    /*status = 1;
     msg = "Ok";
     res.send({status: status , message: msg});  */

}

var resetPasscode = {
    func : resetPasscode
};
module.exports = resetPasscode;
