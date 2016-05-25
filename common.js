"use strict";

var winston = require('winston');
var memwatch = require('memwatch');
var crypto = require('crypto');
var poolModule = require('generic-pool');
var dataEncryptor = require('./dataEncryptor.js');

var Common = {
    minUXIPVersion : 1,
    util : require('util'),
    fs : require('fs'),
    path : require('path'),
    db : '',
    allowedOrigns : [],
    //SendGrid: require('sendgrid').SendGrid,
    geoip : require('geoipcity'),
    serverurl : "https://lab.nubosoftware.com/",
    publicurl : "https://lab.nubosoftware.com/",
    internalurl : "https://lab.nubosoftware.com/",
    restify : require('restify'),
    crypto : require('crypto'),
    sequelizeModule : require('sequelize'),
    sequelizeLogs : false,
    dbHost : 'localhost',
    dbName : 'nubo',
    dbUser : 'root',
    dbPassword : 'password',
    dbPort : '3306',
    dbMaxConnections : 10,
    dbMaxIdleTime : 30,
    nodemailer : require("nodemailer"),
    redis : require("redis"),
    redishost : "127.0.0.1",
    redisport : 6379,
    redisdb : 0,
    redispassword : null,
    platfromPortStart : 5560,
    platformIPPrefix : "192.168.122.",
    platformMacPrefix : "52:54:00:12:00:",
    cassandraHost : 'localhost:9160',
    nfsserver : 'alex@172.16.0.109',
    nfshomefolder : '/srv/nfs4/homes/',
    nfslocalcachefolder : '/home/nubodev/Android/nubo-production/nubomanagement/homesbak/homes/',
    nfsId: 1,
    settingsfolder : 'com.nubo.nubosettings/startup/',
    browserfolder : 'com.android.browser/',
    useSSLGateway : false,
    internal_network : 'none',
    gwplatformport : 8890,
    gwcontrolport : 8891,
    hostline : 'user@host',
    imagesPath: "/opt/Android-KitKat",
    exchange_platformpath : "/home/sharon/storage/Android/ExchangePlatformKK/nuboplatform", //sharon
    platforversion : '0.4.dev',
    sessionTimeout : 600, // 10 minutes session timeout
    sshPrivateKey : '/home/nubodev/.ssh/id_rsa',
    platformType : 'emulator',
    startPlatformNum : 2,
    nographics : false,
    useADB : true,
    urlToAPK : "https://nubo01.nubosoftware.com/html/android/Nuboil.apk",
    urlToIOS1 : "https://nubo01.nubosoftware.com/html/ios/enterprises/SysAid/SysAid_Apps.mobileprovision",
    urlToIOS2 : "https://nubo01.nubosoftware.com/html/ios/enterprises/SysAid/GWILNuboClient.plist",
    iosPushUseSandbox : true,
    iosPushCertFile : "cert.pem",
    iosPushKeyFile : "key.pem",
    demoActivationKey : "AAABBCCDD",
    dcName : "",
    dcURL : "",
    minPlayerVersion : "0.0",
    encAlgorithm : 'aes-128-ecb',
    encKey : 'NufgmTd@#hAfgf&&', // this should be the same key as in JDCBAuthProvider.AES_KEY in openfire
    geoipLicense : '',
    externalMountsSrc : '',
    netDnsSearch : 'nubosoftware.com',
    listenAddresses : ["https://", "https://:8443", "http://"],
    activationTimeoutPeriod : 48,
    nuboMask : '24',
    platformParams : {
        concurrency: 2,
        concurrencyDelay: 10000,
        platformPoolSize: 0,
        explatformPoolSize: 0,
        upperCapacityLevel: 0.5,
        bottomCapacityLevel: 0,
        maxCapacity: 60,
        usersPerPlatform: 20,
        choosePool: 10,
        maxFailed: 0,
        maxFails: 5,
        fixedPool: true,
        cleanPlatformsMode: false
    },
    logLevel: "info",
    defaultApps: [
        "com.android.browser",
        "com.android.calculator2",
        "com.android.calendar",
        "com.android.contacts",
        "com.android.email",
        "com.android.gallery",
        "com.mobisystems.editor.office_with_reg",
        "com.mobisystems.mobiscanner",
        "com.nubo.messenger",
        "com.nubo.nubosettings"
    ],
    hideControlPanel : false,
    //TODO change the name to something more appropriate!!!
    withService : false,
    withServiceDeviceID : "virtualDevice",
    withServiceWebDeviceID : "virtualDeviceWeb",
    withServiceNuboAdmin : "Nubo Administrator",
	withServiceIMAdmin : { 
		IMAdmin1 : 1,
		IMAdmin2 : 2
	},
	controlPanelApp : "com.nubo.controlpanel",
    EWSKeepAliveInterval : 5,
    EWSCalendarSyncRefreshIntervalInMinutes : 10,
    EWSCalendarSyncReadAheadEventsInMinutes : 120,
    EWSCalendarSocketTimeoutInMillis : 5000,
    EWSCalendarNotificationRefreshIntervalInMillis : 30000,
    EWSDomain : "",
    EWSRunCalendarSyncOnThisDataCenter : false,
    mappingAttributesLDAP : ["memberOf", "mail", "manager", "ipPhone", "sn", "givenName", "distinguishedName", "objectCategory", "mobile"],
    mappingAttributesNubo : ["memberOf", "email", "manager", "officephone", "lastname", "firstname", "distinguishedName", "objectCategory", "mobilephone"],
    isHandlingMediaStreams : false,
    photoCompression : 70,
    ffmpegCgroupDir : "/sys/fs/cgroup/cpu/ffmpeg/tasks",
    activateBySMS : false,
    smsHandler : false,
    encryptedParameters: {
        "dbPassword": 1,
        "mailOptions": {
            "auth": {
                "pass": 1
            }
        },
        "NotificationGateway": {
            "authKey": 1
        },
        "redispassword": 1
    }
};

try {
    Common.fs.mkdirSync("./log");
} catch(err) {}

var loggerName = Common.path.basename(process.argv[1], '.js') + ".log";
var exceptionLoggerName = Common.path.basename(process.argv[1], '.js') + "_exceptions.log";
console.log("log file: " + loggerName);

Common.logger = new (winston.Logger)({
    transports : [new (winston.transports.Console)({
        json : false,
        timestamp: true,
        colorize: true
    }), new winston.transports.File({
        filename : __dirname + '/log/' + loggerName,
        handleExceptions : true,
        json : false
    })],
    exceptionHandlers : [new (winston.transports.Console)({
        json : false,
        timestamp : true
    }), new winston.transports.File({
        filename : __dirname + '/log/' + exceptionLoggerName,
        json : false
    })],
    exitOnError : false
});

var logger = Common.logger;
try {
    require('winston-syslog').Syslog;
    logger.add(winston.transports.Syslog, {
        app_name : "nubomanagement-public",
        handleExceptions : true,
        json : true
    });
} catch(e) {
    logger.warn("syslog module is not installed");
}

Common.specialBuffers = {};

logger.on('logging', function(transport, level, msg, meta) {
    if (meta != null && meta.specialBuffer != null && transport.name == "console") {
        if (Common.specialBuffers[meta.specialBuffer] == null)
            Common.specialBuffers[meta.specialBuffer] = "";
        Common.specialBuffers[meta.specialBuffer] += '\n' + new Date() + " [" + level + "] " + msg;
        //console.log("logging. level:"+level+", msg:"+msg+", meta:"+JSON.stringify(meta,null,2)+", transport: "+JSON.stringify(transport,null,2));
    }
});

Common.sshPool = {};

var hd = null;

var firstTimeLoad = true;

function to_array(args) {
    var len = args.length, arr = new Array(len), i;

    for ( i = 0; i < len; i += 1) {
        arr[i] = args[i];
    }

    return arr;
}

function parse_configs() {
    logger.info('Load settings from file');

    dataEncryptor.readFile('Settings.json', Common.encryptedParameters, Common.enc, Common.dec, function(err, settings) {
        if (err) {
            logger.error('cannot load settings from file');
            return;
        }

        if(settings.logLevel && (settings.logLevel !== Common.logLevel)) logger.level = settings.logLevel;

        if(settings.EWSDomainPrefix) {
            //TODO: remove this block in Aug 2016 as depricated
            logger.warn("use EWSDomain insead of EWSDomainPrefix");
            Common.EWSDomain = settings.EWSDomainPrefix.slice(0,-1);
            delete settings.EWSDomainPrefix;
        }
        // load all attributes of settings in to Common
        for (var attrname in settings) {
            Common[attrname] = settings[attrname];
        }

        Common.serverurl = Common.publicurl;
        Common.dcURL = Common.serverurl;

        if(Common.platformpath) Common.imagesPath = Common.platformpath + "/out/target/product/x86_platform";


        if (firstTimeLoad) {
            // connect to sequelize-mysql database
            require('./DBModel.js').initSequelize(Common.dbName, Common.dbUser, Common.dbPassword, Common.dbHost, Common.dbPort, function(obj) {
                Common.db = obj;
            });

            //connect to redis
            Common.redisPool = poolModule.Pool({
                name : 'redis',
                create : function(callback) {
                    var c = Common.redis.createClient(Common.redisport, Common.redishost, { password : Common.redispassword });
                    if (Common.redisdb > 0) {
                        c.select(Common.redisdb, function(err) {
                        });
                    }

                    c.on("error", function(err) {
                        logger.error("Error in redis " + err);
                    });

                    callback(null, c);
                },
                destroy : function(client) {
                    client.quit();
                },
                max : 10,
                min : 2,
                idleTimeoutMillis : 30000,
                log : false
            });

            var RedisClient = function() {

            };
            var commands = require("redis/node_modules/redis-commands/commands.json");

            Object.keys(commands).forEach(function(fullCommand) {
                var command = fullCommand.split(' ')[0];

                RedisClient.prototype[command] = function(args, callback) {

                    var arr = null;
                    var cb = null;

                    if (Array.isArray(args) && typeof callback === "function") {
                        arr = args;
                        cb = callback;
                    } else {
                        arr = to_array(arguments);
                        if (arr.length > 0 && typeof arr[arr.length - 1] === "function") {
                            cb = arr.pop();
                        }
                    }
                    Common.redisPool.acquire(function(err, client) {
                        if (err) {
                            logger.error("Redis connection pool error: " + err);
                            callback(err);
                            return;
                        }

                        /*logger.info("Calling command "+command+" with params: "+JSON.stringify(arr,null,2)+
                         ", pool usage: "+(Common.redisPool.getPoolSize()-Common.redisPool.availableObjectsCount())+" / "+
                         Common.redisPool.getPoolSize());        */

                        arr.push(function(err, reply) {
                            if (err) {
                                logger.error("Redis command error: " + err);
                            }
                            Common.redisPool.release(client);
                            if (cb)
                                cb(err, reply);
                        });
                        client[command].apply(client, arr);

                    });
                    return true;
                };
                RedisClient.prototype[command.toUpperCase()] = RedisClient.prototype[command];
            });

            Common.redisClient = new RedisClient();

        }

        if (Common.loadCallback)
            Common.loadCallback(null, firstTimeLoad);

        firstTimeLoad = false;

        if (Common.isGeoIP == true) {
            Common.geoip.settings.license = Common.geoipLicense;
        }

        if (!Common.mailOptions) {
            logger.info("nodemailer has not been configured");
        }
        Common.mailer = Common.nodemailer.createTransport("SMTP", Common.mailOptions);

        logger.info("Common.mailOptions: " + JSON.stringify(Common.mailOptions, null, 2));

        Common.mailer.send = function(mailOptions, callback) {
            if (!Common.mailOptions) {
                callback(false, "nodemailer has not been configured");
                return;
            }
            if (mailOptions.fromname)
                mailOptions.from = mailOptions.fromname + "<" + mailOptions.from + ">";
            if (mailOptions.toname)
                mailOptions.to = mailOptions.toname + "<" + mailOptions.to + ">";
            Common.mailer.sendMail(mailOptions, function(error, response) {
                if (error) {
                    logger.info("Common.mailer.send: " + error);
                    callback(false, error);
                    return;
                }
                callback(true, "");
                return;
            });
        };
    }, logger);

}

Common.enc = function(plainText) {
    if (!plainText || plainText.length <= 2)
        return plainText;
    var cipher = crypto.createCipher(Common.encAlgorithm, Common.encKey);
    var encrypted = "enc:" + cipher.update(plainText, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;

};

Common.dec = function(encText) {
    if (!encText || encText.length <= 4)
        return encText;
    if (encText.indexOf("enc:") != 0)
        return encText;
    var encOnlyText = encText.substr(4);
    var decipher = crypto.createDecipher(Common.encAlgorithm, Common.encKey);
    var decrypted = decipher.update(encOnlyText, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
};

parse_configs();

Common.fs.watchFile('Settings.json', {
    persistent : false,
    interval : 5007
}, function(curr, prev) {
    logger.info('Settings.json. the current mtime is: ' + curr.mtime);
    logger.info('Settings.json. the previous mtime was: ' + prev.mtime);
    parse_configs();
});

//Common.mailer =  new Common.SendGrid("nubo", "Nubo2022");
//Common.mailer =  require('sendgrid')("nubo", "Nubo2022");

Common.quit = function() {
    //Common.redisClient.quit();
    Common.redisPool.drain(function() {
        Common.redisPool.destroyAllNow();
    });
    try {
        logger.clear();
    } catch(err) {}
    process.exit(0);
};

Common.row2obj = function(row) {
    var res = {};
    row.forEach(function(name, value, timestamp, ttl) {
        Object.defineProperty(res, name, {
            value : value,
            enumerable : true,
            writable : true
        });
    });
    return res;
};

Common.getWithServiceDeviceID = function(deviceid) {

    if (Common.withService) {
        if (deviceid.indexOf("web") > -1) {
            deviceid = Common.withServiceWebDeviceID;
        } else {
            deviceid = Common.withServiceDeviceID;
        }
    }

    return deviceid;
};

module.exports = Common;

