"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var crypto = require('crypto');
var util = require('util');
var User = require('./user.js');
var Login = require('./login.js');
var http = require('http');
var url = require('url');
var ThreadedLogger = require('./ThreadedLogger.js');
var internalRequests = require('./internalRequests.js');

var isFirstTime = "";

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

function updateFirstLogin(activationKey, firstLogin) {
    logger.info("updateFirstLogin, firstLogin:" + firstLogin + ", activationKey:" + activationKey);

    Common.db.Activation.update({
        firstlogin : firstLogin
    }, {
        where : {
            activationkey : activationKey
        }
    }).then(function() {

    }).catch(function(err) {
        logger.info("Error in updateFirstLogin " + err);
        return;
    });

}

function AuthenticateUser(req, res, next) {
    // https://oritest.nubosoftware.com/authenticateUser?loginToken=[]&user=[]&password=[]
    res.contentType = 'json';
    var msg = "";
    var status = 100;
    //unknown
    isFirstTime = "";
    var logger = new ThreadedLogger();
    logger.info("authenticateUser");
    //read and validate params

    var loginToken = req.params.loginToken;
    if (loginToken == undefined || loginToken.length < 5) {
        status = 0;
        // invalid parameter
        msg = "Invalid loginToken";
    }

    var user = req.params.user;
    if (user == undefined || user.length < 1) {
        status = 0;
        // invalid parameter
        msg = "Invalid user";
    }
    logger.user(user);
    logger.info("authenticateUser", {mtype: "important"});

    var userDomain = Common.EWSDomain || '';
    var domIndex = user.indexOf('\\');
    if (domIndex > 0) {
        userDomain = user.substring(0, domIndex);
        user = user.substring(domIndex + 1);
    }

    var password = req.params.password;
    if (password == undefined || password.length < 5) {
        status = 0;
        // invalid parameter
        msg = "Invalid password";
    }

    if (status == 0) {
        logger.info("AuthenticateUser error: " + msg);
        res.send({
            status : status,
            message : msg
        });
        return;
    }

    (function(loginToken, user, password) {
        new Login(loginToken, function(err, login) {
            if (err) {
                status = 0;
                // invalid parameter
                msg = "Invalid loginToken, err:" + err;
                logger.info("AuthenticateUser error: " + msg);
                res.send({
                    status : status,
                    message : msg,
                    loginToken : 'notValid'
                });
                return;
            }
            if (login.getAuthenticationRequired() != "true") {
                status = 0;
                // invalid parameter
                msg = "Authentication not allowed";
                logger.info("AuthenticateUser error: " + msg);
                res.send({
                    status : status,
                    message : msg
                });
                return;
            }
            internalRequests.createOrReturnUserAndDomain(login.getEmail(), logger, function(err, obj) {
                if (err) {
                    status = 0;
                    msg = "Internal Error: " + err;
                    logger.info("AuthenticateUser error: " + msg);
                    res.send({
                        status : status,
                        message : msg
                    });
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
                var secureSSL = obj.secureSSL;
                var signature = obj.signature;

                internalRequests.validateAuthentication(login.getMainDomain(), email, authType, serverURL, userDomain, user, password, secureSSL, signature, function(err) {
                    if (err) {
                        res.send({
                            status : '0',
                            message : 'Internal error. Please contact administrator.'
                        });
                        logger.error("AuthenticateUser: " + err);
                        return;
                    }
                    login.setAuthenticationRequired(false);
                   
                    // if (paramters have been changed update also all other devices)
                    var updateOtherDevices = (orgUser != user || orgPassword != password);
                    logger.info('Update account info for user!');
                    orgUser = user;
                    orgPassword = password;

                    internalRequests.updateUserAccount(login.getUserName(), email, authType, serverURL, userDomain, orgUser, orgPassword, secureSSL, signature, login.getDeviceID(), updateOtherDevices, true, function(err) {
                        if (err) {
                            res.send({
                                status: '0',
                                message: 'Internal error. Please contact administrator.'
                            });
                            logger.error("AuthenticateUser: " + err);
                            return;
                        }

                        login.save(function(err, login) {
                            if (err) {
                                res.send({
                                    status: '0',
                                    message: 'Internal error. Please contact administrator.'
                                });
                                logger.error("AuthenticateUser: " + err);
                                return;
                            }

                            res.send({
                                status: 1,
                                message: "User authenticated"
                            });
                            updateFirstLogin(login.getActivationKey(), 0);
                        });
                    });
                });
                //validateAuthentication

            });
            // internalRequests.createOrReturnUserAndDomain
        });
        //Login
    })(loginToken, user, password);
}

var AuthenticateUser = {
    func : AuthenticateUser
};
module.exports = AuthenticateUser;
