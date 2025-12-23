"use strict";

const Common = require('./common.js');
const logger = Common.logger;
const crypto = require('crypto');

var async = require('async');
// notification/GCM variables
var gcm = require('node-gcm');
var senderFCM = null;
var senderGCM = null;
var apn = require('@hyperlink/node-apn');
var request = require('./request.js');
var querystring = require('querystring');
var ThreadedLogger = require('./ThreadedLogger.js');
var Entities = require('html-entities').XmlEntities;
var dgram = require('dgram');
const NCMSender = require('./ncmSender');
const FirebaseCloudMessageAPI = require('./FirebaseCloudMessageAPI');

var ncmSender = null;
var firebaseCloudMessageAPI = null;

var Notifications = {
    sendNotificationFromRemoteServer: sendNotificationFromRemoteServer
};

module.exports = Notifications;

var apnProviderProd = null;
var apnProviderSand = null;
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
function sendNotificationFromRemoteServer(req, res, next) {

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
    function readBoolParam(paramName, defValue) {
        var value = req.params[paramName];
        if (value === 1 || value === "1" || value === "true" || value === "True") {
            return 1;
        } else if (value === 0 || value === "0" || value === "false" || value === "False") {
            return 0;
        } else {
            return defValue;
        }
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
    var enableSound =  readBoolParam("enableSound",1); //req.params["enableSound"]; //readParam("enableSound");
    var enableVibrate = readBoolParam("enableVibrate",1); //readParam("enableVibrate");
    var showFullNotif = readBoolParam("showFullNotif",1); //readParam("showFullNotif");
    var packageID = req.params["packageID"];


    if (response.status !== 1) {
        res.send(response);
        return;
    }
    logger.info(`sendNotificationFromRemoteServer. serverID: ${serverID}, packageID: ${packageID}, type: ${type}, notifyTitle: ${notifyTitle}`);

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


function getAPNOptions(production) {
    var options = {};
    // apn options
    if (Common.apnOptions) {
        options = Common.apnOptions;
    } else {
        options.cert = Common.iosPushCertFile;
        options.key = Common.iosPushKeyFile;
    }
    options.production = production;
    return options;
}

function sendNotificationByRegId(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type, enableSound, enableVibrate, showFullNotif, packageID, callback) {
    // Hanan - removing time and location due to security issue raised by Israel that content is displayed on physical client
    if (showFullNotif != 1) {
        notifyLocation = '';
        notifyTime = '';
    }

    // Extract base packageID for grouping (without contentId or API hash)
    // This ensures notifications are grouped correctly on both iOS and Android
    let groupID = packageID;
    if (packageID) {
        const parts = packageID.split(',');
        groupID = parts[0];  // Get base packageID without contentId or API hash
    }

    if (!pushRegID || pushRegID == '' || pushRegID == '(null)') {
        // logger.info('Aborting push notification to ' + deviceType + ', push reg id is null');
        callback(null);
        return;
    }

    if (Common.NotificationGateway) {
        if (Common.NotificationGateway.deviceType && deviceType != Common.NotificationGateway.deviceType) {
            logger.info('Device type does not match NotificationGateway.deviceType. Sending directly to ' + deviceType);
        } else {
            sendNotificationToRemoteSever(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type, enableSound, enableVibrate, showFullNotif, packageID, callback);
            return;
        }
    }

    var entities = new Entities();
    notifyTitle = entities.decode(entities.decode(notifyTitle));

    if (pushRegID === 'null' || pushRegID === 'NA') {
        // logger.info('Aborting push notification to ' + deviceType + ', push reg id is null');
        callback(null);
        return;
    }
    logger.info("Sending notification to " + pushRegID);
    if (deviceType === "Android") {
        var sender;
        if (pushRegID && pushRegID.startsWith("ncm:")) {
            pushRegID = pushRegID.substring(4);
            if (!ncmSender) {
                ncmSender = new NCMSender(Common.NCMSenderID,Common.NCMServerURL);
            }
            sender = ncmSender;
        } else if (Common.FCMServiceAccountFile) {
            if (!firebaseCloudMessageAPI) {
                firebaseCloudMessageAPI = new FirebaseCloudMessageAPI();
            }
            if (pushRegID.startsWith("base64")) {
                pushRegID = new Buffer(pushRegID.substring(6), 'base64').toString();
                // logger.info("Found base64 encoded FCM token. Translte to: " + pushRegID);
            }

            firebaseCloudMessageAPI.sendMessage({
                android: {
                    priority: 'high',
                    data: {
                      contentAvailable: 'true',
                    }
                },
                // notification: {
                //     title: notifyTitle,
                //     body: notifyLocation
                // },
                data: {
                    type: type,
                    notifyTime: notifyTime.toString(),
                    title: notifyTitle,
                    notifyLocation: notifyLocation,
                    enableSound: enableSound.toString(),
                    enableVibrate: enableVibrate.toString(),
                    nuboPackageID: packageID,
                    nuboGroupID: groupID  // Consistent group identifier for notification grouping
                },
                token: pushRegID
            })
            .then(response => {
                logger.info("Notifications.js::sender.send result for pushRegID "+pushRegID+": "+JSON.stringify(response,null,2));
                callback(null);
            })
            .catch(error => {
                logger.info(`Error sending message to FCM pushRegID ${pushRegID}: ${error}`);
                callback(error);
            });

            return;

        } else if (pushRegID && pushRegID.length > 150) {
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
        let priority = 'high';
        if (type == 7) {
            priority = 'normal';
        }
        var message = new gcm.Message({
            priority: priority,
            contentAvailable: true,
            delayWhileIdle: false,
        });
        var nOfRetries = 4;
        message.addData('type', type);
        // is this 0 or 1?
        message.addData('notifyTime', notifyTime.toString());
        message.addData('title', notifyTitle);
        message.addData('notifyLocation', notifyLocation);
        message.addData('enableSound', enableSound);
        message.addData('enableVibrate', enableVibrate);
        message.addData('nuboPackageID', packageID);
        message.addData('nuboGroupID', groupID);  // Consistent group identifier for notification grouping

        logger.info("FCM message: "+JSON.stringify(message,null,2)+", pushRegID: "+pushRegID);
        sender.send(message, [pushRegID], nOfRetries, function(err, result) {
            if (err) {
                logger.error("Cannot send message to GCM err: " + err + "; res: " + result);
                callback(err);
                return;
            }

            logger.info("Notifications.js::sender.send result for pushRegID "+pushRegID+": "+JSON.stringify(result,null,2));
            if (result.canonical_ids === 1) {
                logger.info("Notifications.js::sender.send activation updated with new regid: ", result.results[0].registration_id);
                callback(null, result.results[0].registration_id);
                return;
            }

            callback(null);
        });
        //@TODO - fix the iPhone notification params
    } else if (deviceType === "iPhone" || deviceType === "iPad") {
        var apnProvider;

        var regidArr = pushRegID.split(":");
        var token,buildType,bundleID;
        if (regidArr && regidArr.length == 3) {
            buildType = regidArr[0];
            bundleID = regidArr[1];
            token = regidArr[2];
        } else {
            buildType = "R";
            bundleID = "com.nubo.NuboClientIOS";
            token = pushRegID;
        }

        if (buildType != "D") { // release - use production server
            apnProvider = new apn.Provider(getAPNOptions(true));
        } else { // debug - use sandbox
            apnProvider = new apn.Provider(getAPNOptions(false));
        }
        //var myDevice = new apn.Device(pushRegID);
        var note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 360000;
        // Expires 100 hour from now.



        var alert = "";
        if (type != 0 && type != 6 && type != 7 && type != 5) {
            // calendar
            if (type == 1) {
                alert = notifyTitle;
                if (notifyLocation != null && notifyLocation.length > 0) {
                    alert += ' at ' + notifyLocation;
                }
                alert += '\n' + notifyTime;
            } else {
                if (notifyLocation.length > 0) {
                    notifyLocation = '\n' + notifyLocation;
                }
                alert = notifyTitle + notifyLocation;
            }
        } else {
            alert = "Email from " + notifyTitle + notifyLocation;
        }



        //note.topic = "com.nubo.NuboClientIOS";
        note.topic = bundleID;
        // Generate a unique notification ID for each notification to prevent replacement
        const notificationId = crypto.randomBytes(16).toString("hex");
        note.payload = {
            "AppId": type,
            "packageID": (packageID === undefined ? "" : packageID),
            "notifyTitle": notifyTitle,
            "notifyLocation": notifyLocation,
            "enableSound": enableSound,
            "enableVibrate": enableVibrate,
            "mutable-content": 1,
            "notificationId": notificationId  // Unique ID for each notification to prevent replacement
        };


        if (type != 6 && type != 7 && type != 5) {
            note.alert = alert;
            if (enableSound == 1) {
                note.sound = "default";
            }
            // Removed collapseId - it was causing notifications to replace each other instead of stacking
            // collapseId makes iOS replace existing notifications with the same ID
            // Set threadId for notification grouping (using groupID which is base packageID without contentId/hash)
            note.threadId = (groupID === undefined || groupID == "" ? String(type) : groupID);
            note.contentAvailable = true;
            note.priority = 10;
            note.mutableContent = true;
            logger.info("(type != 6 && type != 7 && type != 5)");
        } else if (type == 6) {
            // For add notification (type 6), create a structured notification
            note.alert = {
                title: notifyTitle,
                body: notifyLocation
            };
            if (enableSound == 1) {
                note.sound = "default";
            }
            let hash;
            let packageIDPart;
            if (packageID) {
                const parts = packageID.split(',');
                if (parts.length > 1) {
                    packageIDPart = parts[0];
                    hash = parts[1];
                }
            }
            if (!packageIDPart) {
                packageIDPart = packageID;
            }
            if (!hash) {
                hash = "NA";
            }
            
            note.payload = {
                ...note.payload,  // Keep existing payload data
                hash: hash,
                packageID: packageIDPart,
                AppId: "8", // change type to 8 so it will not add additional notification
            };
            logger.info("APN (type 6) note payload: "+JSON.stringify(note.payload,null,2));
            // Use groupID (base packageID) for threadId to group notifications by app
            // Each notification has unique notificationId in payload to prevent replacement
            note.threadId = (groupID === undefined || groupID == "" ? String(type) : groupID);
            note.category = "NuboNotification";
            note.contentAvailable = true;
            note.priority = 10;
            note.mutableContent = true;
        } else {
            // Handle other silent notification types (7,5)
            if (enableSound == 1) {
                note.sound = "default";
            }
            // Set threadId for notification grouping (using groupID which is base packageID without contentId/hash)
            note.threadId = (groupID === undefined || groupID == "" ? String(type) : groupID);
            note.contentAvailable = true;
            note.priority = 10;
            note.mutableContent = true;
            note.badge = 0;
            if (type == 7 && notifyLocation === "sessionClosedByUser") {
                // we will send two notification, the first with alert and the standard notification with contentAvailable
                const alertNote = new apn.Notification();
                const sessionClosedByUser = Common.sessionClosedByUser;
                alertNote.alert = {
                    title: sessionClosedByUser ? sessionClosedByUser.title : "Session closed by user",
                    body: sessionClosedByUser ? sessionClosedByUser.body : "The session is closed, since you have opened it in another device."
                };
                alertNote.topic = bundleID;
                alertNote.priority = 10;
                alertNote.contentAvailable = false;
                alertNote.category = "NuboNotification";
                apnProvider.send(alertNote, token).then( (result) => {
                    logger.info("APN (alertNote)result for pushRegID "+pushRegID+": "+JSON.stringify(result,null,2));
                });

                // change the original notifyLocation so it will not diaply alert twice
                note.payload.notifyLocation = "sessionClosedByUserSilent";
            }
        }
	    note.category = "NuboNotification";
        logger.info("APN note: "+JSON.stringify(note,null,2)+", pushRegID: "+pushRegID);
        apnProvider.send(note, token).then( (result) => {
            logger.info("APN result for pushRegID "+pushRegID+": "+JSON.stringify(result,null,2));
            apnProvider.shutdown();
            callback(null);
        })
        .catch((err) => {
            // Handle any error that occurred in any of the previous
            // promises in the chain.
            logger.info("APN errpr",err);
        });;
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
