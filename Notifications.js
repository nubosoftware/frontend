"use strict";

var Common = require('./common.js');
var logger = Common.logger;

var async = require('async');
// notification/GCM variables
var gcm = require('node-gcm');
var sender = null;
var apn = require('apn');
var util = require('util');
var request = require('./request.js');
var querystring = require('querystring');
var settings = require('./settings.js');
var ThreadedLogger = require('./ThreadedLogger.js');

var Notifications = {
    'notifyClient' : notifyClient,
    'notifyExchangeClient' : notifyExchangeClient,
    'pushNotification' : pushNotification,
    'GCMNotification' : GCMNotification,
    'udpNotification' : udpNotification,
    'sendNotificationByRegId': sendNotificationByRegId,
    'sendNotificationFromRemoteServer': sendNotificationFromRemoteServer
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

function notifyClient(req, res) {
    var logger = new ThreadedLogger();
    var sessionId = req.params.sessionId;
    if (sessionId === undefined) {
        logger.error("notifyClient: Missing sessionId");
    }
    var id = req.params.id;
    if (id === undefined) {
        logger.error("notifyClient: Invalid notification id");
    }
    var tickerText = req.params.tickerText;
    if (tickerText === undefined) {
        logger.error("notifyClient: Invalid notification tickerText");
    }
    var priority = req.params.priority;
    if (priority === undefined) {
        logger.error("notifyClient: Invalid notification priority");
    }
    var contentText = req.params.contentText;
    if (contentText === undefined) {
        contentText = '';
        logger.error("notifyClient: Invalid notification contentText");
    }
    var contentTitle = req.params.contentTitle;
    if (contentTitle === undefined) {
        contentTitle = 'Nubo';
        logger.error("notifyClient: Invalid notification contentTitle");
    }

    console.log("sessionId= " + sessionId);

    //read sessioinId from redis
    Common.redisClient.hget("sess_" + sessionId, "activation", function(err, replies) {
        if (err) {
            logger.error("ERROR:" + err);
            return;
        }
        var status;
        if (replies !== null) {
            //            this.params = replies;
            var activationKey = replies;
            logger.info("activationKey= " + activationKey);
            //sendGCMMessage(activationKey, tickerText, contentTitle, contentText);
            status = 1;
        } else {
            logger.info("replies is null");
            status = 0;
        }
        res.send({
            status : status,
            tickerText : tickerText,
            contentTitle : contentTitle,
            contentText : contentText
        });
    });
}

/*
 activationKey = user activation from db

 EMAIL       -    (activationKey, sender, NU, opt<text>, 0)
 CALENDAR    -    (activationKey, eventName, when, location, 1)
 IM          -    (activationKey, sender, NU, opt<text>, 2)
 else        -    (activationKey, sender, NU, opt<text>, -1)
 */

function sendGCMMessage(activationKey, notifyTitle, notifyTime, notifyLocation, type) {

    Common.db.Activation.findAll({
        attributes : ['pushregid', 'devicetype'],
        where : {
            activationkey : activationKey
        },
    }).complete(function(err, results) {

        if (!!err || !results || results == null) {
            logger.error("sendGCMMessage" + err);
            return;
        } else {
            //get the regId from the cassandra with the deviceId
            var pushRegID = results[0].pushregid != null ? results[0].pushregid : '';
            var deviceType = results[0].devicetype != null ? results[0].devicetype : '';
            //send GCM message (push notification) to the client by the regId
            sendNotificationByRegId(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type);
        }

    });

}
/**
 * sendNotificationFromRemoteServer
 * Service for sending push from remote nubo installations
 * Each server need to authenticate with serverID and serverAuthKey
 */
function sendNotificationFromRemoteServer(req, res) {
    var status = 1;
    var msg = "";
    function readParam(paramName) {
        var value = req.params[paramName];
        if (status == 1 && value === undefined) {
            msg = "Missing parameter: "+paramName;
            logger.error("sendNotificationFromRemoteServer: "+msg);
            status = 0;
        }
        return value;
    }
    if (!Common.RemoteServers) {
        msg = "Missing RemoteServers";
        logger.error("sendNotificationFromRemoteServer: "+msg);
        status = 0;
    }
    var serverID = readParam("serverID");
    var serverAuthKey = readParam("serverAuthKey");
    var confAuthKey = Common.RemoteServers[serverID];
    if (status == 1 && confAuthKey != serverAuthKey ) {
        msg = "Invalid serverAuthKey";
        logger.error("sendNotificationFromRemoteServer: "+msg);
        status = 0;
    }
    var deviceType = readParam("deviceType");
    var pushRegID = readParam("pushRegID");
    var notifyTitle = readParam("notifyTitle");
    var notifyTime = readParam("notifyTime");
    var notifyLocation = readParam("notifyLocation");
    var type = readParam("type");

    if (status == 1) {
        sendNotificationByRegId(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type);
        msg = "Notification queued";
    }

    res.send({
            status : status,
            msg : msg
        });
}

/**
 * sendNotificationToRemoteSever
 * Deliver the push notification to remote server (gateway)
 * Detailed of the gateway are located in Settings.json
 */
function sendNotificationToRemoteSever(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type) {
    var urlstr = Common.NotificationGateway.url+"?"+ querystring.stringify({
        deviceType: deviceType,
        pushRegID: pushRegID,
        notifyTitle: notifyTitle,
        notifyTime: notifyTime.toString(),
        notifyLocation: notifyLocation,
        type: type,
        serverID: Common.NotificationGateway.serverID,
        serverAuthKey: Common.NotificationGateway.authKey
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
                //callback(msg);
                return;
            }

            logger.info('STATUS: ' + response.statusCode);
            logger.info('HEADERS: ' + JSON.stringify(response.headers));
            logger.info("Body: " + body);
    });
}

function sendNotificationByRegId(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type) {
    // Hanan - removing time and location due to security issue raised by Israel that content is displayed on physical client
    notifyLocation = '';
    notifyTime = '';
    
    if (Common.NotificationGateway) {
        sendNotificationToRemoteSever(deviceType, pushRegID, notifyTitle, notifyTime, notifyLocation, type);
        return;
    }
    logger.info("Sending notification to "+pushRegID);
    if (deviceType === "Android") {
        if (!sender) {
            sender = new gcm.Sender( Common.GCMSender);
        }
        var message = new gcm.Message();
        var nOfRetries = 4;
        message.addData('type', type);
        // is this 0 or 1?        
        message.addData('notifyTime', notifyTime.toString());
        message.addData('title', notifyTitle);
        message.addData('notifyLocation', notifyLocation);
        message.collapseKey = 'demo';
        message.delayWhileIdle = false;
        message.timeToLive = 3;
        sender.send(message, [pushRegID], nOfRetries, function(err, result) {
            if (err) {
                logger.error("Cannot send message to GCM err: " +  err + "; res: " + result);
            } else {
                logger.info("Notifications.js::sender.send result: ", result);
                if (result.canonical_ids === 1) {
                    Common.db.Activation.update(
                        {
                            'pushregid': result.results[0].registration_id
                        }, {
                            where: {
                                'pushregid': pushRegID,
                                'devicetype' : "Android"
                            }
                        }
                    ).then(function(res) {
                        logger.info("Notifications.js::sender.send activation updated with new regid: ", result.results[0].registration_id);
                    });
                }
            }
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

        if(!apnConnection || (JSON.stringify(apnConnectionOptions) !== JSON.stringify(options))) {
            apnConnectionOptions = options;
            if(apnConnection) apnConnection.shutdown();
            apnConnection = new apn.Connection(options);
        }
        var myDevice = new apn.Device(pushRegID);
        var note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 360000;
        // Expires 100 hour from now.

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
                alert = notifyTitle;    
            }
        } else {
            alert = "Email from " + notifyTitle;
        }

        note.payload = {
            "aps" : {
                "alert" : alert,
                "sound" : "default"
            },
            "when" : "if calendar - send time in utc",
            "AppId" : type
        };

        apnConnection.pushNotification(note, myDevice);
    }
}

function notifyExchangeClient(req, res) {

    var status = 0;
    var emailStatus = 1;
    var calendarStatus = 1;
    var OrgUserAccountFromDB = null;
    var appType = -1;

    var notifyTitle = req.params.notifyTitle;
    if (notifyTitle === undefined) {
        logger.error("ERROR - notifyExchangeClient: Invalid notification notifyTitle");
        emailStatus = 0;
        calendarStatus = 0;
    }
    var notifyTime = req.params.notifyTime;
    if (notifyTime === undefined) {
        logger.error("ERROR - notifyExchangeClient: Invalid notification notifyTime");
        calendarStatus = 0;
    }
    var notifyLocation = req.params.notifyLocation;
    if (notifyLocation === undefined) {
        logger.error("ERROR - notifyExchangeClient - Invalid notification notifyLocation");
        calendarStatus = 0;
    }
    var notifyAccount = req.params.notifyAccount;
    if (notifyAccount === undefined) {
        logger.error("ERROR - notifyExchangeClient - Invalid notification notifyLocation");
        calendarStatus = 0;
    }

    var pkgName = req.params.pkgName;
    if (pkgName != "com.android.email" && pkgName != "com.android.calendar") {
        calendarStatus = 0;
        emailStatus = 0;
        status = 1;
        logger.error("ERROR - notifyExchangeClient: Invalid notification pkgName");
    }

    if (pkgName.toString() == "com.android.calendar" && calendarStatus == 0) {
        res.send({
            status : 0,
            message : "invalid calendar params"
        });
        return;
    }

    if (pkgName.toString() == "com.android.email" && emailStatus == 0) {
        res.send({
            status : 0,
            message : "invalid email params"
        });
        return;
    }

    if (status == 1) {
        res.send({
            status : 0,
            message : "invalid email params"
        });
        return;
    }

    logger.info("  notifyTitle= " + notifyTitle + "  notifyTime= " + notifyTime + "  notifyLocation= " + notifyLocation + "  notifyAccount= " + notifyAccount + "  pkgName= " + pkgName);

    async.series([
    function(callback) {
        if (pkgName.toString() == "com.android.email") {
            appType = 0;
        }
        if (pkgName.toString() == "com.android.calendar") {
            appType = 1;
        }

        Common.db.User.findAll({
            attributes : ['email'],
            where : {
                orgemail : notifyAccount.toString()
            },
        }).complete(function(err, results) {

            if (!!err) {
                logger.error("Error while reading useremail " + err);
                callback("Error while reading useremail " + err);
                return;
            }

            if (!results || results == "") {
                logger.error("Error - there is no account " + notifyAccount.toString());
                callback("Error - there is no account " + notifyAccount.toString());
                return;
            }

            OrgUserAccountFromDB = results[0].email != null ? results[0].email : '';
            callback(null);
        });

    },

    function(callback) {

        Common.db.Activation.findAll({
            attributes : ['activationkey', 'onlinestatus', 'status'],
            where : {
                email : OrgUserAccountFromDB.toString(),
                status: 1
            },
        }).complete(function(err, results) {

            if (!!err) {
                logger.error("Error while getting activationkey, onlinestatus, status FROM activations " + err);
                callback("Error while getting activationkey, onlinestatus, status FROM activations " + err);
                return;
            }

            if (!results || results == "") {
                logger.error("Error while getting activationkey, onlinestatus, status FROM activations - there is no email " + OrgUserAccountFromDB);
                callback("Error while getting activationkey, onlinestatus, status FROM activations - there is no email " + OrgUserAccountFromDB);
                return;
            }

            for (var i = 0; i < results.length; i++) {
                var onlinestatus = results[i].onlinestatus != null ? results[i].onlinestatus : 0;
                if (onlinestatus == "1") {
                    callback("user is connected to Nubo");
                    return;
                }//if (onlinestatus == "1"){
            }// for

            for (var i = 0; i < results.length; i++) {
                var activationkey = results[i].activationkey != null ? results[i].activationkey : '';
                var activationStatus = results[i].status != null ? results[i].status : '';
                if (activationStatus == "1") {
                    sendGCMMessage(activationkey, notifyTitle, notifyTime, notifyLocation, appType.toString());
                }//if (activationStatus == "1"){
            }// for
            callback(null);
        });

    }], function(err, results) {
        res.send({
            status : (err) ? 0 : 1,
            notifyAccount : notifyAccount,
            pkgName : pkgName
        });
        if (err) {
            logger.error("Error during send notification to client: " + err);
        } else {
            logger.info("notification sent to client");
        }
    });
    //async.series
}

/*
 The 'pushNotification' function shall receive email, notification params
 and notify the client
 req {[email], titleText, ticketText, messageText ,appName}
 res {status, msg}
 APP       <NUM>
 EMAIL     <0>     -    ( [ TOemail ] , 	sender,      "",     opt<text>, 0)
 CALENDAR  <1>     -    ( [ TOemail ] , 	eventName,  when,    location, 1)
 IM        <2>     -    ( [ TOemail ] , 	sender,      "",     opt<text>, 2)
 else      <-1>    -    ( [ TOemail ] , 	title,       "",     opt<text>, -1)

 https://login.nubosoftware.com//Notifications/pushNotification?email=[]&email=[]&titleText=[]&notifyTime=[]&notifyLocation=[]&appName=[]
 */


function pushNotification(req, res) {
    var logger = new ThreadedLogger();
    var status = -1;
    var msg = "";

    var email = req.params.email;
    if (email === undefined) {
        logger.error("ERROR - pushNotification: Invalid email");
        status = 0;
        msg = msg + " - ERROR - pushNotification: Invalid email";
    }
    logger.user(email);

    var titleText = req.params.titleText;
    if (titleText === undefined) {
        logger.error("ERROR - pushNotification: Invalid titleText");
        status = 0;
        msg = msg + " - ERROR - pushNotification: Invalid titleText";
    }

    var notifyTime = req.params.notifyTime;
    if (notifyTime === undefined) {
        logger.error("ERROR - pushNotification: Invalid notifyTime");
        status = 0;
        msg = msg + " - ERROR - pushNotification: Invalid notifyTime";
    }

    var notifyLocation = req.params.notifyLocation;
    if (notifyLocation === undefined) {
        logger.error("ERROR - pushNotification: Invalid notifyLocation");
        status = 0;
        msg = msg + " - ERROR - pushNotification: Invalid notifyLocation";
    }

    var appName = req.params.appName;
    if (!appName || appName === undefined || !(appName === NEW_ACTIVATION_TYPE || appName === NUBO_DEFAULT_APP || appName === NUBO_EMAIL_APP || appName === NUBO_CALENDAR_APP || appName === NUBO_MESSENGER_APP)) {
        logger.error("ERROR - pushNotification: Invalid appName");
        status = 0;
        msg = msg + " - ERROR - pushNotification: Invalid appName";
    }

    if (status == 0) {
        res.send({
            status : status,
            message : msg
        });
        return;

    } else {
        if (!util.isArray(email)) {
            email = [email];
        }

        var failedEmailNotification = [];

        //TODO change the name to something more appropriate!!!
        if (Common.withService) {
            var func = udpNotification;
	        logger.info("sending UDP notification...");
        } else {
            var func = GCMNotification;
            logger.info("sending GCM notification...");
        }


        async.eachSeries(email, function(emailItem, callback) {
            if (appName == "0" || appName == "1" || appName == "2") {
                settings.getNotificationsStatusForAllAppsInternal(emailItem, function(errorMessage, appsNotifResponse) {
                    if (errorMessage) {
                        logger.error('pushNotification::getNotificationsStatusForAllAppsInternaludp failed!!!');
                        callback(null);
                    } else {
                        var data = JSON.parse(appsNotifResponse.toString());
                        if (data == null || data.appsNotifStatus == null || data.appsNotifStatus == "") {
                            func(emailItem, titleText, notifyTime, notifyLocation, appName, function(err) {
                                if (err) {
                                    logger.error('ERROR::pushNotification: ' + err);
                                    failedEmailNotification.push(emailItem);
                                }
                                callback(null);
                            });
                        } else {
                            isUserNotificationEnabled(data.appsNotifStatus, appName, function(retVal) {
                                if (retVal) {
                                    func(emailItem, titleText, notifyTime, notifyLocation, appName, function(err) {
                                        if (err) {
                                            logger.error('ERROR::pushNotification:: ' + err);
                                            failedEmailNotification.push(emailItem);
                                        }
                                        callback(null);
                                    });
                                } else {
                                    callback(null);
                                }
                            });
                        }
                    }
                });
            } else {
                func(emailItem, titleText, notifyTime, notifyLocation, appName, function(err) {
                    if (err) {
                        logger.error('ERROR::pushNotification:: ' + err);
                        failedEmailNotification.push(emailItem);
                    }
                    callback(null);
                });
            }

        }, function(err) {
            if (err) {
                logger.error('pushNotification::Sending notication failed!!!');
            } else {
                res.send({
                    status : failedEmailNotification.length == 0 ? '1' : '0',
                    message : failedEmailNotification.length == 0 ? ["Notification::message was successfully delivered..."] : failedEmailNotification,
                });

            }
        });

    }
}

function isUserNotificationEnabled(data, appName, callback) {


    async.eachSeries(data, function(item, callback) {
        if ( (item.appName == "Email" && appName == "0") || (item.appName == "Calendar" && appName == "1") || (item.appName == "Messaging" && appName == "2")) {
            if (item.sendNotif == 1) {
                callback(SENDING_NOTIFICATION);
            } else {
                callback(NOT_SENDING_NOTIFICATION);
            }
        } else {
            callback(null);
        }


    }, function(retVal) {
        if (retVal == SENDING_NOTIFICATION) {
            callback(true);
        } else if (retVal == NOT_SENDING_NOTIFICATION) {
            callback(false);
        } else {
            callback(false);
        }
    });
}

/*
 Sends a UDP datagram to the client at the specified (DataBase) remote endpoint.
 */
function udpNotification(email, titleText, notifyTime, notifyLocation, appName, callback) {

    Common.db.User.findAll({
        attributes : ['clientport', 'clientip','username'],
        where : {
            username : email,
        },
    }).complete(function(err, results) {
        if (!!err || results == '' || results == null) {
            callback("udpNotification:: Failed accessing DB");
            return;
        } else {
            //appName = result[0].appname;
            var mPort = results[0].clientport;
            var mIP = results[0].clientip;
            if(!mIP) {
                callback("missed ip");
                return;
            }
            mIP = mIP.replace(/\/|:/g, "");
            var dgram = require('dgram');
            var mUserName = results[0].username;

            //TODO add notifyTime & notifyLocation
            var message = new Buffer(mUserName + ':' + appName);
            //var message = new Buffer(appName);

            var client = dgram.createSocket('udp4');
            logger.info("Sending UDP notification to: Email = " + email + ", IP = " + mIP + ", PORT = " + mPort);
            client.send(message, 0, message.length, mPort, mIP, function(err, bytes) {
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
    });
}

/*
 Sends a GCM notification to the client
 */
function GCMNotification(email, titleText, notifyTime, notifyLocation, appName, callback) {

    Common.db.Activation.findAll({
        attributes : ['activationkey', 'onlinestatus', 'status'],
        where : {
            email : email,
        },
    }).complete(function(err, results) {
        if (!!err || results == '' || results == null) {
            callback("GCMNotification:: Failed accessing DB");
            return;
        } else {
            results.forEach(function(row) {
                var activationkey = row.activationkey != null ? row.activationkey : '';
                var activationStatus = row.status != null ? row.status : '';
                if (activationStatus == "1") {
                    sendGCMMessage(activationkey, titleText, notifyTime, notifyLocation, appName.toString());
                }
            });
            callback(null);
        }
    });
}

