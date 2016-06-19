var Common = require('./common.js');
var checkPasscode = require('./checkPasscode.js');
var logger = Common.logger;

function resendUnlockPasswordLink(req, res, next) {
    var status = 1;
    var msg = "";
    var retErrorMsg = "Invalid resendUnlockPasswordLink access";
    var activationKey = req.params.activationKey;
    if (!activationKey || activationKey == "") {
        logger.info("resendUnlockPasswordLink. Invalid activationKey.");
        status = 0;
        msg = "Invalid email";
        res.send({
            status : status,
            message : retErrorMsg
        });
        return;
    }
    logger.info(activationKey);

    Common.db.Activation.findAll({
        attributes : ['email', 'status'],
        where : {
            activationkey : activationKey
        },
    }).complete(function(err, results) {

        if (!!err) {
            status = 0;
            msg = "Internal Error: " + err;
            logger.info(msg);
            res.send({
                status : status,
                message : msg
            });
            return;
        }

        if (!results || results == "") {
            logger.info("resendUnlockPasswordLink. Cannot find user to send unlock password email.");
            status = 0;
            res.send({
                status : status,
                message : retErrorMsg
            });
            return;
        }

        var email = results[0].email != null ? results[0].email : '';
        var activation_status = results[0].status != null ? results[0].status : '';
        if (activation_status != 1 && activation_status != 4) {
            logger.info("Inappropriate activation status: " + activation_status);
            status = 0;
            res.send({
                status : status,
                message : retErrorMsg
            });
            return;
        } else {
            logger.info("unlock passcode email is sent to :" + email);
            checkPasscode.findUserNameSendEmail(email);
            status = 1;
            res.send({
                status : status,
                message : "resent unlock email"
            });
            logger.info(msg);
            return;
        }
    });

}

function unlockPassword(req, res, next) {

    var status = 1;
    var msg = "";
    var retErrorMsg = "Invalid unlockPassword access";
    var email = req.params.email;
    if (!email || email == "") {
        logger.info("unlockPassword. Invalid email: " + email);
        status = 0;
        msg = retErrorMsg;
    }

    if (status == 1) {
        var loginemailtoken = req.params.loginemailtoken;
        if (!loginemailtoken || loginemailtoken == "") {
            logger.info("unlockPassword. Invalid loginemailtoken. email: " + email);
            status = 0;
            msg = retErrorMsg;
        }
    }

    if (status == 0) {
        res.send({
            status : status,
            message : msg
        });
        return;
    }

    Common.db.User.findAll({
        attributes : ['loginemailtoken'],
        where : {
            email : email
        },
    }).complete(function(err, results) {

        if (!!err) {
            msg = "Internal Error: " + err;
            logger.info("findUserNameSendEmail:" + msg);
            status = 0;
            res.send({
                status : status,
                message : msg
            });
            return;
        }

        if (!results || results == "") {
            logger.info("unlockPassword. Cannot find user: " + email);
            status = 0;
            res.send({
                status : status,
                message : retErrorMsg
            });
            return;
        }

        var loginEmailToken = results[0].loginemailtoken != null ? results[0].loginemailtoken : '';
        if (loginEmailToken == loginemailtoken) {
            // update login attempts to 0

            Common.db.User.update({
                loginattempts : '0'
            }, {
                where : {
                    email : email
                }
            }).then(function() {
                logger.info("password of user " + email + " is successfully unlocked");
                status = 1;
                res.send({
                    status : status,
                    message : "password is successfully unlocked"
                });
                return;
            }).catch(function(err) {
                status = 0;
                msg = "Internal Error: " + err;
                res.send({
                    status : status,
                    message : msg
                });
                return;
            });

        } else {
            logger.info("unlockPassword. invalid loginEmailToken. email: "+email);
            status = 0;
            msg = "Invalid access";
            res.send({
                status : status,
                message : retErrorMsg
            });
            return;
        }
    });

}

var unlockPassword = {
    unlockPassword : unlockPassword,
    resendUnlockPasswordLink : resendUnlockPasswordLink
};
module.exports = unlockPassword;
