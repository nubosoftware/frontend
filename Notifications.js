"use strict";

var Common = require('./common.js');
var logger = Common.logger;

var async = require('async');
// notification/GCM variables
var gcm = require('node-gcm');
var senderFCM = null;
var senderGCM = null;
var apn = require('apn');
var request = require('./request.js');
var querystring = require('querystring');
var ThreadedLogger = require('./ThreadedLogger.js');
var Entities = require('html-entities').XmlEntities;
var dgram = require('dgram');

var Notifications = {
    sendNotificationFromRemoteServer: sendNotificationFromRemoteServer
};

module.exports = Notifications;

var apnConnection = null;
var apnConnectionOptions = {};

var NEW_ACTIVATION_TYPE = '-2';
var NUBO_DEFAULT_APP = '-1';
var NUBO_EMAIL_APP = '0';
var NUBO_CALENDAR_APP = '1';
var NUBO_MESSENGER_APP = '2';
var NOT_SENDING_NOTIFICATION = "not sending Notification"
var SENDING_NOTIFICATION = "sending Notification"

/**
 * sendNotificationFromRemoteServer
 * Service for sending push from remote nubo installations
 * Each server need to authenticate with serverID and serverAuthKey
 */
function sendNotificationFromRemoteServer(req, res) {

    var response = {
        status: 1,
        msg: ""
    };

    function readParam(paramName) {
        var value = req.params[paramName];
        if (response.status == 1 && value === undefined) {
            response.msg = "Missing parameter: " + paramName;
            logger.error("sendNotificationFromRemoteServer: " + response.msg);
            response.status = 0;
        }
        return value;
    }
    if (!Common.RemoteServers) {
        response.msg = "Missing RemoteServers";
        response.status = 0;
        logger.error("sendNotificationFromRemoteServer: " + response.msg);
    }

    var serverID = readParam("serverID");
    var serverAuthKey = readParam("serverAuthKey");
    var confAuthKey = Common.RemoteServers[serverID];
    if (response.status == 1 && confAuthKey != serverAuthKey) {
        response.msg = "Invalid serverAuthKey";
        response.status = 0;
        logger.error("sendNotificationFromRemoteServer: " + response.msg);
    }

    var deviceType = readParam("deviceType");
    var pushRegID = readParam("pushRegID");
    var notifyTitle = readParam("notifyTitle");
    var notifyTime = readParam("notifyTime");
    var notifyLocation = readParam("notifyLocation");
    var type = readParam("type");
    var enableSound = req.params["enableSound"]; //readParam("enableSound");
    var enableVibrate = req.params["enableVibrate"]; //readParam("enableVibrate");
    var showFullNotif = req.params["showFullNotif"]; //readParam("showFullNotif");
    var packageID = req.params["packageID"];

    if (response.status !== 1) {
        res.send(response);
        return;
    }

    if (notifyLocation != null && notifyLocation.indexOf("#!#offline") != -1) {
        notifyLocation = notifyLocation.replace("#!#offline", '');
    }

    if (Common.withService) {
        var ip = req.params.ip;
        var port = req.params.port;
        var userName = req.params.userName;

        if (!ip || !port || !userName) {
            logger.error('sendNotificationFromRemoteServer: missing parameter to send UDP notification');
            response.status = 0;
            response.msg = "missing parameter";
            res.send(response);
            return;
        }

        udpNotification(pushRegID, notifyTitle, notifyTime, notifyLocation, type, ip, port, userName, function(err) {
            if (err) {
                logger.error('sendNotificationFromRemoteServer: ' + err);
                response.status = 0;
                response.msg = 'Failed sending notification';
                res.send(response);
                return;
            }

            response.msg = "Notification queued";
            res.send(response);
        });

    } else {
        sendNotificationByRegId(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type, enableSound, enableVibrate, showFullNotif, packageID, function(err, pushregid) {
            if (err) {
                logger.error("sendNotificationFromRemoteServer: " + err);
                response.status = 0;
                response.msg = 'Failed sending notification';
                res.send(response);
                return;
            }

            if (pushregid) {
                response.pushregid = pushregid;
            }

            response.msg = "Notification queued";
            res.send(response);
        });
    }
}

/**
 * sendNotificationToRemoteSever
 * Deliver the push notification to remote server (gateway)
 * Detailed of the gateway are located in Settings.json
 */
function sendNotificationToRemoteSever(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type, enableSound, enableVibrate, showFullNotif, packageID, callback) {
    var urlstr = Common.NotificationGateway.url + "?" + querystring.stringify({
        deviceType: deviceType,
        pushRegID: pushRegID,
        notifyTitle: notifyTitle,
        notifyTime: notifyTime.toString(),
        notifyLocation: notifyLocation,
        enableVibrate: enableVibrate,
        type: type,
        enableSound: enableSound,
        showFullNotif: showFullNotif,
        packageID: (packageID === undefined ? "" : packageID),
        serverID: Common.NotificationGateway.serverID,
        serverAuthKey: Common.NotificationGateway.authKey
    });

    request({
        'method': 'GET',
        url: urlstr,
        'strictSSL': true,
        timeout: 5000
    }, function(error, response, body) {
        if (error) {
            logger.error('sendNotificationToRemoteSever: ' + error);
            var msg = "Connection error";
            callback(msg);
            return;
        }

        try {
            var resObj = JSON.parse(body);
        } catch (err) {
            logger.error('sendNotificationToRemoteSever: ' + err);
            callback("failed parse server response");
            return;
        }

        if (resObj.status === 1) {
            callback(null, resObj.pushregid);
            return;
        }

        logger.error('sendNotificationToRemoteSever: got error from remote server: ' + JSON.stringify(resObj));
        callback('error form remote server');
    });
}

function sendNotificationByRegId(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type, enableSound, enableVibrate, showFullNotif, packageID, callback) {
    // Hanan - removing time and location due to security issue raised by Israel that content is displayed on physical client
    if (showFullNotif != 1) {
        notifyLocation = '';
        notifyTime = '';
    }

    if (!pushRegID || pushRegID == '' || pushRegID == '(null)') {
        logger.info('Aborting push notification to ' + deviceType + ', push reg id is null');
        return;
    }

    if (Common.NotificationGateway) {
        sendNotificationToRemoteSever(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type, enableSound, enableVibrate, showFullNotif, packageID, callback);
        return;
    }

    var entities = new Entities();
    notifyTitle = entities.decode(entities.decode(notifyTitle));

    logger.info("Sending notification to " + pushRegID);
    if (deviceType === "Android") {
        var sender;
        if (pushRegID && pushRegID.length > 150) {
            // use FCM key
            if (!senderFCM) {
                senderFCM = new gcm.Sender(Common.FCMSender);
            }
            sender = senderFCM;
            if (pushRegID.startsWith("base64")) {
                pushRegID = new Buffer(pushRegID.substring(6), 'base64').toString();
                logger.info("Found base64 encoded FCM token. Translte to: " + pushRegID);
            }
        } else {
            // use GCM key
            if (!senderGCM) {
                senderGCM = new gcm.Sender(Common.GCMSender);
            }
            sender = senderGCM;
        }
        var message = new gcm.Message();
        var nOfRetries = 4;
        message.addData('type', type);
        // is this 0 or 1?        
        message.addData('notifyTime', notifyTime.toString());
        message.addData('title', notifyTitle);
        message.addData('notifyLocation', notifyLocation);
        message.addData('enableSound', enableSound);
        message.addData('enableVibrate', enableVibrate);
        message.addData('nuboPackageID', packageID);
        message.collapseKey = 'demo';
        message.delayWhileIdle = false;
        message.timeToLive = 3;
        sender.send(message, [pushRegID], nOfRetries, function(err, result) {
            if (err) {
                logger.error("Cannot send message to GCM err: " + err + "; res: " + result);
                callback(err);
                return;
            }

            logger.info("Notifications.js::sender.send result: ", result);
            if (result.canonical_ids === 1) {
                logger.info("Notifications.js::sender.send activation updated with new regid: ", result.results[0].registration_id);
                callback(null, result.results[0].registration_id);
                return;
            }

            callback(null);
        });
        //@TODO - fix the iPhone notification params
    } else if (deviceType === "iPhone" || deviceType === "iPad") {

        var options = {};
        // apn options
        options.cert = Common.iosPushCertFile;
        options.key = Common.iosPushKeyFile;
        if (Common.iosPushUseSandbox) {
            options.gateway = "gateway.sandbox.push.apple.com";
            // sandbox
        } else {
            options.gateway = "gateway.push.apple.com";
            // production
        }

        if (!apnConnection || (JSON.stringify(apnConnectionOptions) !== JSON.stringify(options))) {
            apnConnectionOptions = options;
            if (apnConnection) apnConnection.shutdown();
            apnConnection = new apn.Connection(options);
        }
        var myDevice = new apn.Device(pushRegID);
        var note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 360000;
        // Expires 100 hour from now.

        if (notifyLocation.length > 0) {
            notifyLocation = '\n' + notifyLocation;
        }

        var alert = "";
        if (type != 0) {
            // calendar
            if (type == 1) {
                alert = notifyTitle;
                if (notifyLocation != null && notifyLocation.length > 0) {
                    alert += ' at ' + notifyLocation;
                }
                alert += '\n' + notifyTime;
            } else {
                alert = notifyTitle + notifyLocation;
            }
        } else {
            alert = "Email from " + notifyTitle + notifyLocation;
        }

        if (enableSound == 1) {
            note.payload = {
                "aps": {
                    "alert": alert,
                    "sound": "default"
                },
                "when": "if calendar - send time in utc",
                "AppId": type,
                "packageID": (packageID === undefined ? "" : packageID)
            };
        } else {
            note.payload = {
                "aps": {
                    "alert": alert
                },
                "when": "if calendar - send time in utc",
                "AppId": type,
                "packageID": (packageID === undefined ? "" : packageID)
            };
        }

        apnConnection.pushNotification(note, myDevice);
        callback(null);
    }
}

/*
 Sends a UDP datagram to the client at the specified (DataBase) remote endpoint.
 */
function udpNotification(email, titleText, notifyTime, notifyLocation, appName, ip, port, userName, callback) {

    //TODO add notifyTime & notifyLocation
    var message = new Buffer(userName + ':' + appName);
    //var message = new Buffer(appName);

    var client = dgram.createSocket('udp4');
    logger.info("Sending UDP notification to: Email = " + email + ", IP = " + ip + ", PORT = " + port);
    client.send(message, 0, message.length, port, ip, function(err, bytes) {
        if (err) {
            callback("udpNotification:: Failed to send dgram msg");
            return;
        } else {
            client.close();
            callback(null);
            return;
        }
    });

}