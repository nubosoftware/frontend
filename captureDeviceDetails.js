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

    var session = req.params.session;
    var actionType = req.params.actionType;
    var ip = req.connection.remoteAddress;
    var port = Common.withServiceUDPStaticPort ? Common.withServiceUDPStaticPort : req.connection.remotePort;

    // get activation key
    if (!session || session.length < 5) {
        status = 1;
        msg = "Invalid parameter";
    }
    
    if (status == 1) {
        res.send({
            status : status,
            msg : msg
        });
        return;
    }

    // get user details based on session
    Common.db.User.findAll({
        attributes: ['clientip', 'clientport'],
        where: {
            username: session,
            isactive: 1
        },
    }).then(function(results) {
        // no user found, return an error
        if (!results || results == "") {
            logger.error('User not found to capture device details ' + session);
            status = 1;
            msg = 'Invalid parameters';
            res.send({
                status : status,
                message : msg
            });
        } else {
            ip = userResults[0].clientip;
            port = userResults[0].clientport;
            
            if (actionType == "get") {
                status = 0;
                msg = 'OK';
                res.send({
                    status : status,
                    message : msg,
                    ip : ip,
                    port : port
                });
            } else {
                // save IP and Port on DB
                updateIPandPort(session, ip, port, function(err) {
                    if (err) {
                        logger.error(err);
                        status = 1;
                        msg = 'Internal error';
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
        logger.error('Problem selecting user, error:' + err);
        status = 1;
        msg = 'Internal error';
        res.send({
            status : status,
            message : msg
        });
    });
}

function updateIPandPort(username, ip, port, callback) {
    // update existing entry
    Common.db.User.update({
        clientip: ip,
        clientport: port
    }, {
        where: {
        	username: username
        }
    }).then(function(results) {
        if (Common.DEBUG)
            logger.info("Update ip (" + ip + ") and port (" + port + ") for " + username);
        callback(null);
        return;
    }).catch(function(err) {
        callback("can't update ip and port for " + username + ", error is:" + err);
        return;
    });
}



captureDeviceDetails = {
    captureDeviceDetails : captureDeviceDetails
};

module.exports = captureDeviceDetails;