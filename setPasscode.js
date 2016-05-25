"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var crypto = require('crypto');
var util = require('util');
var Login = require('./login.js');
var isFirstTime = "";
var Track = require('./track.js');

var MIN_DIFFERENT_DIGITS = 4;

function returnInternalError(err, res) {
    status = 3;
    // internal error
    msg = "Internal error";
    console.error(err.name, err.message);
    logger.info("error_1");
    if (res != undefined) {
        res.send({
            status : status,
            message : msg,
            isFirstTime : isFirstTime
        });
    }
    return;
}

function validatePassword(password) {
    // check valid password length
    if (password == null || password.length < 6) {
        logger.info("setPasscode::password is shorter 6 digits");
        return 0;
    }

    // check for valid different numbers in password
    var counter = 0;
    var minimumChars = [];
    var passwordChars = password.split('');
    var minimumCharsContains = false;
    var hasRequestedDifferentDigits = false;
    for (var i = 0; i < passwordChars.length; i++) {
        for (var j = 0; j < counter; j++) {
            if (minimumChars[j] == passwordChars[i]) {
                minimumCharsContains = true;
                break;
            }
        }
        if (!minimumCharsContains) {
            // update different chars we have so far
            minimumChars[counter] = passwordChars[i];
            counter++;
        }
        // password is valid if there are at least 4 different chars
        if (counter >= MIN_DIFFERENT_DIGITS) {
            hasRequestedDifferentDigits = true;
            break;
        }
        minimumCharsContains = false;
    }
    if (!hasRequestedDifferentDigits) {
        logger.info("setPasscode::password must be at least " + MIN_DIFFERENT_DIGITS + " different digits");
        return 0;
    }

    // check if password is consecutive numbers
    var isConsecutive = true;
    for (var i = 0; i < passwordChars.length - 1; i++) {
        if (parseInt(passwordChars[i]) + 1 != parseInt(passwordChars[i + 1])) {
            isConsecutive = false;
            break;
        }
    }
    if (isConsecutive) {
        logger.info("setPasscode::password can't be consecutive numbers ");
        return 0;
    }

    // passed all validations
    return 1;

}

function setPasscode(req, res, next) {
    // https://oritest.nubosoftware.com/setPasscode?loginToken=[]&passcode=[]&oldpasscode=[]
    res.contentType = 'json';
    var msg = "";
    var status = 100;
    //unknown
    var statusEmail = 100;
    isFirstTime = "";
    logger.info(req.url);
    //read and validate params

    var loginToken = req.params.loginToken;
    if (loginToken == undefined || loginToken.length < 5) {
        status = 2;
        // invalid parameter
        msg = "Invalid loginToken";
        res.send({
            status : status,
            message : msg
        });
        return;
    }

    var passcode = req.params.passcode;
    if (passcode == undefined || validatePassword(passcode) == 0) {

        status = 0;
        // invalid parameter
        msg = "Invalid passCode";
        res.send({
            status : status,
            message : msg
        });
        return;
    }
    var oldpasscode = req.params.oldpasscode;

    (function(loginToken, passcode) {
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
            logger.info("login.getPasscodeActivationRequired=" + login.getPasscodeActivationRequired());
            if (oldpasscode) {
                if (login.loginParams.passcode !== oldpasscode) {
                    status = 0;
                    // invalid parameter
                    msg = "Pascode change not allowed";
                    res.send({
                        status : status,
                        message : msg
                    });
                    return;
                }
            } else {
                if (login.getPasscodeActivationRequired() != "true") {
                    status = 0;
                    // invalid parameter
                    msg = "Pascode activation not allowed";
                    res.send({
                        status : status,
                        message : msg
                    });
                    return;
                }
            }

            Common.db.User.update({
                passcodeupdate: new Date(),
                passcode : Common.enc(passcode),
                passcodetypechange : 0
            }, {
                where : {
                    email : login.getUserName()
                }
            }).then(function() {

                Common.db.Activation.update({
                    resetpasscode : 0
                }, {
                    where : {
                        activationkey : login.getActivationKey()
                    }
                }).then(function() {

                }).catch(function(err) {
                    if (err) {
                        logger.info("Internal error while change resetPasscode: " + err);
                        return;
                    }
                });

                login.setPasscodeActivationRequired(false);
                login.setPasscode(passcode);
                login.setValidLogin(true);
                login.save(function(err, login) {
                    status = 1;
                    var msg = "Passcode updated";
                    console.dir(login.loginParams);
                    res.send({
                        status : status,
                        message : msg
                    });
                });

                var appid = login.getDeviceID() + "_" + login.getActivationKey();
                Track.trackAPI({
                    customAppID : appid,
                    customSessID : appid,
                    type : 'Passcode set',
                    appType : 'Nubo',
                    ip : req.connection.remoteAddress,
                    userParams : {
                        email : login.getUserName(),
                    },
                    other : {
                        dcName : Common.dcName
                    }
                });

            }).catch(function(err) {
                status = 0;
                msg = "Internal Error: " + err;
                logger.info(msg);
                res.send({
                    status : status,
                    message : msg
                });
                return;
            });

        });
    })(loginToken, passcode);

    /*status = 1;
     msg = "Ok";
     res.send({status: status , message: msg});  */
}

var setPasscode = {
    func : setPasscode,
    validatePassword : validatePassword
};
module.exports = setPasscode;
