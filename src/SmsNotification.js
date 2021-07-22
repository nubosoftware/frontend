"use strict";

var Common = require('./common.js');
var util = require('util');
var request = require('request');
var querystring = require('querystring');
var async = require('async');
var logger = Common.logger;

var SmsNotification = {
    'sendSmsNotification' : sendSmsNotification,
    'sendSmsNotificationFromRemoteServer' : sendSmsNotificationFromRemoteServer,
    'sendSmsNotificationInternal' : sendSmsNotificationInternal
};

module.exports = SmsNotification;

function sendSmsNotification(req, res) {
    var status = 1;
    var msg = "OK";
    function readParam(paramName) {
        var value = req.params[paramName];
        if (status == 1 && value === undefined) {
            msg = "Missing parameter: "+paramName;
            logger.error("sendNotificationFromRemoteServer: "+msg);
            status = 0;
        }
        return value;
    }

    var toPhone = readParam("toPhone");
    var body = readParam("body");
    logger.info("sendSmsNotification status = " + status);

    sendSmsNotificationInternal(toPhone,body,function(returnMessage,status)  {
        res.send({
            status : status,
            msg : returnMessage
        });
        return;
    });
}

function sendSmsNotificationInternal(toPhone, body, callback) {
    var status = 1;
    var msg = '';

    if (Common.NotificationGateway != null && Common.NotificationGateway.smsUrl != null
            && Common.NotificationGateway.smsUrl.length > 0) {
        // send SMS to remote server
        sendSmsNotificationToRemoteSever(toPhone, body, function(returnMessage) {
            callback(returnMessage,status);
            return;
        });
    } else {
        // small validation before we have Alex mechanism in place
        if (toPhone == null || toPhone.length <=0 || toPhone.length > 20 || body == null || body.length <= 0 || body.length > 250) {
            status = 0;
        }

        // if everything is OK
        if (status == 1) {
            // send the SMS
            sendSms(toPhone, body);
            msg = "Notification queued";

            // send the response
            callback(msg,status);
            return;
        } else {
            callback("Wrong notification params, missing body or number", status);
            return;
        }
    }
}

/**
 * sendNotificationFromRemoteServer Service for sending push from remote nubo
 * installations Each server need to authenticate with serverID and
 * serverAuthKey
 */
function sendSmsNotificationFromRemoteServer(req, res) {
    var status = 1;
    var msg = "OK";
    function readParam(paramName) {
        var value = req.params[paramName];
        if (status == 1 && value === undefined) {
            msg = "Missing parameter: "+paramName;
            logger.error("sendNotificationFromRemoteServer: "+msg);
            status = 0;
        }
        return value;
    }

    var toPhone = readParam("toPhone");
    var body = readParam("body");
    var serverID = readParam("serverID");
    var serverAuthKey = readParam("serverAuthKey");

    if (!Common.RemoteServers) {
        msg = "Missing RemoteServers";
        logger.error("sendSmsNotificationFromRemoteServer: " + msg);
        status = 0;
    }

    var confAuthKey = Common.RemoteServers[serverID];
    if (status == 1 && confAuthKey != serverAuthKey) {
        msg = "Invalid serverAuthKey";
        logger.error("sendNotificationFromRemoteServer: " + msg);
        status = 0;
    }

    async.series(
        [
            function(callback) {
                if(status == 1) {
                    sendSmsNotificationInternal(toPhone, body, function(err) {
                        if(err) {
                            status = 0;
                            msg = err;
                        } else {
                            msg = "Sms queued";
                        }
                        callback(null);
                    });
                } else {
                    callback(null);
                }
            }
        ], function(err) {
            res.send({
                status : status,
                msg : msg
            });
        }
    );
}

function sendSms(toPhone, body) {
    if (Common.smsHandler) {
        try {
            let scriptFile;
            if (Common.smsHandler.startsWith('/')) {
                scriptFile = Common.smsHandler;
            } else {
                scriptFile = Common.path.join(Common.rootDir,Common.smsHandler);
            }
            logger.info(`smsHandler: ${scriptFile}`);
            require(scriptFile)(toPhone, body);
        } catch (e) {
            console.log("e: ", e);
            logger.error("Cannot send sms, exception: " + JSON.stringify(e));
        }
    } else if(Common.smsOptions) {
        // Twilio logic to send SMS
        var accountSid = Common.smsOptions.accountSid;
        var authToken = Common.smsOptions.authToken;
        var fromPhone = Common.smsOptions.fromPhone;
        var client = require('twilio')(accountSid, authToken);
        client.messages.create({
            body : body,
            to : toPhone,
            from : fromPhone
        }, function(err, message) {
            if (err) {
                logger.error("Error while sending message " + err);
            } else {
                logger.info("SMS Message queued, message id " + message.sid);
            }

        });
    } else {
        logger.error("SMS notification has not been configured\nMissed Common.smsOptions");
    }
}

/**
 * sendNotificationToRemoteSever Deliver the push notification to remote server
 * (gateway) Detailed of the gateway are located in Settings.json
 */
function sendSmsNotificationToRemoteSever(toPhone, body, callback) {
    var urlstr = Common.NotificationGateway.smsUrl + "?" + querystring.stringify({
        toPhone : toPhone,
        body : body,
        serverID : Common.NotificationGateway.serverID,
        serverAuthKey : Common.NotificationGateway.authKey
    });

    request({
        'method' : 'GET',
        url : urlstr,
        'strictSSL' : true,
        timeout : 5000
    }, function(error, response, body) {
        if (error) {
            logger.info('error: ' + error);
            var msg = "Connection error";
            callback(msg);
            return;
        } else {
            callback(body);
        }
    });
}
