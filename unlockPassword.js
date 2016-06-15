var Common = require('./common.js');
var checkPasscode = require('./checkPasscode.js');
var logger = Common.logger;

function resendUnlockPasswordLink(req, res, next) {
    var activationKey = req.params.activationKey;
    if (!activationKey || activationKey == "") {
        status = 0;
        msg = "Invalid email";
        res.send({
            status : status,
            message : msg
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
            res.send({
                status : status,
                message : msg
            });
            logger.info(err);
            return;
        }

        if (!results || results == "") {
            status = 0;
            msg = "Cannot find userto send unlock password email";
            res.send({
                status : status,
                message : msg
            });
            logger.info(msg);
            return;
        }

        var email = results[0].email != null ? results[0].email : '';
        var activation_status = results[0].status != null ? results[0].status : '';
        if (activation_status != 1 && activation_status != 4) {
            status = 0;
            msg = "Inappropriate activation status: " + activation_status;
            res.send({
                status : status,
                message : msg
            });
            logger.info(msg);
            return;
        } else {
            logger.info("unlock passcode email is sent to :" + email);
            checkPasscode.findUserNameSendEmail(email);
            status = 1;
            msg = "resent unlock email to : " + email;
            res.send({
                status : status,
                message : msg
            });
            logger.info(msg);
            return;
        }
    });

}

function unlockPassword(req, res, next) {

    var status = 1;
    var email = req.params.email;
    if (!email || email == "") {
        status = 0;
        msg = "Invalid email";
    }

    var loginemailtoken = req.params.loginemailtoken;
    if (!loginemailtoken || loginemailtoken == "") {
        status = 0;
        msg = "Invalid loginemailtoken";
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
            status = 0;
            msg = "Internal Error: " + err;
            logger.info("findUserNameSendEmail:" + msg);
            res.send({
                status : status,
                message : msg
            });
            return;
        }

        if (!results || results == "") {
            status = 0;
            msg = "Cannot find user " + email;
            logger.info("findUserNameSendEmail:" + msg);
            res.send({
                status : status,
                message : msg
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
                status = 1;
                msg = "password of user " + email + " is successfully unlocked";
                res.send({
                    status : status,
                    message : msg
                });
                logger.info(msg);
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
            status = 0;
            msg = "Invalid access";
            res.send({
                status : status,
                message : msg
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
