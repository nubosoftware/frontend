"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var crypto = require('crypto');
var util = require('util');
var Login = require('./login.js');
var Track = require('./track.js');

var MIN_DIFFERENT_DIGITS = 4;


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

    //read and validate params
    var loginToken = req.params.loginToken;
    var passcode = req.params.passcode;
    if (validatePassword(passcode) == 0) {
        res.send({
            status : Common.STATUS_ERROR,
            message : "Invalid passCode"
        });
        return;
    }
    var oldpasscode = req.params.oldpasscode;

    (function(loginToken, passcode) {
        new Login(loginToken, function(err, login) {
            if (err) {
                logger.error("setPasscode: " + err)
                res.send({
                    status : Common.STATUS_ERROR,
                    message : 'internal error'
                });
                return;
            }

            if(!login){
                logger.error("setPasscode: shouldn't get this error!!!")
                res.send({
                    status : Common.STATUS_EXPIRED_LOGIN_TOKEN,
                    message : "Invalid loginToken",
                    loginToken : 'notValid'
                });
                return;
            }

            logger.info("login.getPasscodeActivationRequired=" + login.getPasscodeActivationRequired());
            if (oldpasscode) {
                if (login.loginParams.passcode !== oldpasscode) {
                    res.send({
                        status : Common.STATUS_ERROR,
                        message : "Pascode change not allowed"
                    });
                    return;
                }
            } else {
                if (login.getPasscodeActivationRequired() != "true") {
                    status = Common.STATUS_ERROR;
                    res.send({
                        status : Common.STATUS_ERROR,
                        message : "Pascode activation not allowed"
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
                    email : login.getEmail()
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
                        logger.error("Internal error while change resetPasscode: " + err);
                        return;
                    }
                });

                login.setPasscodeActivationRequired(false);
                login.setPasscode(passcode);
                login.setValidLogin(true);
                login.save(function(err, login) {
                    console.dir(login.loginParams);
                    res.send({
                        status : Common.STATUS_OK,
                        message : "Passcode updated"
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
                        email : login.getEmail(),
                    },
                    other : {
                        dcName : Common.dcName
                    }
                });

            }).catch(function(err) {
                status = Common.STATUS_ERROR;
                logger.error("setPasscode: " + err);

                res.send({
                    status : Common.STATUS_ERROR,
                    message : "Internal Error"
                });
                return;
            });

        });
    })(loginToken, passcode);

}

var setPasscode = {
    func : setPasscode,
    validatePassword : validatePassword
};
module.exports = setPasscode;
