"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var ThreadedLogger = require('./ThreadedLogger.js');
var async = require('async');

function captureDeviceDetails(req, res, next) {
    // https://login.nubosoftware.com/captureDeviceDetails?activationKey
    var logger = new ThreadedLogger();
    
    res.contentType = 'json';
    var msg = "";
    var status = 0;

    var activationKey = req.params.activationKey;
    var actionType = req.params.actionType;
    var ip = req.connection.remoteAddress;
    var port = req.connection.remotePort;

    // get activation key
    if (!activationKey || activationKey.length < 5) {
        status = 1;
        msg = "Invalid activationKey";
    }
 
    if (Common.DEBUG) 
    logger.info("activationKey inside captureDeviceDetails: " + activationKey);

    if (status == 1) {
        res.send({
            status : status,
            msg : msg
        });
        return;
    }

    // get email based on activation key
    Common.db.Activation.findAll({
        attributes: ['email'],
        where: {
            activationkey: activationKey,
            status: 1
        },
    }).then(function(results) {
        // no email found, return an error
        if (!results || results == "") {
            logger.error('Activation key not found ' + activationKey);
            status = 1;
            msg = 'Activation key not found';
            res.send({
                status : status,
                message : msg
            });
        } else {
            var userEmail = results[0].email;
            
            if (actionType == "get") {
                // get from DB
                Common.db.User.findAll({
                    attributes: ['email', 'clientip', 'clientport' ],
                    where: {
                        email: userEmail
                    },
                }).then(function(userResults) {
                    // no email found, return an error
                    if (!userResults || userResults == "") {
                        logger.error('Details for user not found ' + userEmail);
                        status = 1;
                        msg = 'Details for user not found';
                        res.send({
                            status : status,
                            message : msg
                        });
                    } else {
                        ip = userResults[0].clientip;
                        port = userResults[0].clientport;
                        status = 0;
                        msg = 'OK';
                        res.send({
                            status : status,
                            message : msg,
                            ip : ip,
                            port : port
                        });
                    }
                }).catch(function(err) {
                    logger.error(err);
                    status = 1;
                    msg = 'Problem selecting client ip and port for user ' + userEmail;
                    res.send({
                        status : status,
                        message : msg
                    });
                });
            } else {
                // save IP and Port on DB
                updateIPandPort(userEmail, ip, port, function(err) {
                    if (err) {
                        logger.error(err);
                        status = 1;
                        msg = 'Problem capturing IP and Port';
                        res.send({
                            status : status,
                            message : msg
                        });
                    } else {
                        status = 0;
                        msg = 'OK';
                        res.send({
                            status : status,
                            message : msg,
                            ip : ip,
                            port : port
                        });
                    }
                });
            }
        }
    }).catch(function(err) {
        logger.error(err);
        status = 1;
        msg = 'Problem selecting email for activation key';
        res.send({
            status : status,
            message : msg
        });
    });
}

function updateIPandPort(email, ip, port, callback) {
    // update existing entry
    Common.db.User.update({
        clientip: ip,
        clientport: port
    }, {
        where: {
            email: email
        }
    }).then(function(results) {
        if (Common.DEBUG)
            logger.info("Update ip (" + ip + ") and port (" + port + ") for " + email);
        callback(null);
        return;
    }).catch(function(err) {
        callback("can't update ip and port for " + email + ", error is:" + err);
        return;
    });
}



captureDeviceDetails = {
    captureDeviceDetails : captureDeviceDetails
};

module.exports = captureDeviceDetails;