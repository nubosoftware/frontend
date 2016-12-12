"use strict";

var winston = require('winston');
var crypto = require('crypto');
var poolModule = require('generic-pool');
var dataEncryptor = require('./dataEncryptor.js');
var url = require('url');
var async = require('async');
var _ = require('underscore');

var Common = {
    STATUS_OK : 1,
    STATUS_ERROR : 0,
    STATUS_EXPIRED_LOGIN_TOKEN : 2,
    STATUS_INVALID_PLAYER_VERSION : 3,
    STATUS_PASSWORD_LOCK : 4,
    STATUS_CHANGE_URL : 301,
    STATUS_DISABLE_USER_DEVICE : 5,
    STATUS_DISABLE_USER : 6,
    STATUS_EXPIRED_PASSCODE : 7,
    STATUS_INVALID_RESOURCE : 10,
    minUXIPVersion : 1,
    util : require('util'),
    fs : require('fs'),
    path : require('path'),
    db : '',
    allowedOrigns : [],
    //SendGrid: require('sendgrid').SendGrid,
    serverurl : "https://lab.nubosoftware.com/",
    publicurl : "https://lab.nubosoftware.com/",
    internalurl : "https://lab.nubosoftware.com/",
    restify : require('restify'),
    crypto : require('crypto'),
    nodemailer : require("nodemailer"),
    redis : require("redis"),
    redisConf: {
        host: "127.0.0.1",
        port: 6379,
        db: 0
    },
    internalServerCredentials: {
        key: "",
        cert: ""
    },
    platfromPortStart : 5560,
    platformIPPrefix : "192.168.122.",
    platformMacPrefix : "52:54:00:12:00:",
    nfshomefolder : '/srv/nfs4/homes/',
    urlToAPK : "https://nubo01.nubosoftware.com/html/android/Nuboil.apk",
    urlToIOS1 : "https://nubo01.nubosoftware.com/html/ios/enterprises/SysAid/SysAid_Apps.mobileprovision",
    urlToIOS2 : "https://nubo01.nubosoftware.com/html/ios/enterprises/SysAid/GWILNuboClient.plist",
    iosPushUseSandbox : true,
    iosPushCertFile : "cert.pem",
    iosPushKeyFile : "key.pem",
    dcName : "",
    dcURL : "",
    minPlayerVersion : "0.0",
    encAlgorithm : 'aes-128-ecb',
    encKey : '', // this should be the same key as in JDCBAuthProvider.AES_KEY in openfire
    geoipLicense : '',
    listenAddresses : ["https://", "http://"],
    activationTimeoutPeriod : 48,
    nuboMask : '24',
    logLevel: "info",
    //TODO change the name to something more appropriate!!!
    withService : false,
    withServiceDeviceID : "virtualDevice",
    withServiceWebDeviceID : "virtualDeviceWeb",
    withServiceNuboAdmin : "Nubo Administrator",
	withServiceIMAdmin : { 
		IMAdmin1 : 1,
		IMAdmin2 : 2
	},
    EWSDomain : "",
    EWSServerURL : false,
    photoCompression : 70,
    activateBySMS : false,
    smsHandler : false,
    registerOrgPassword: "",
    encryptedParameters: {
        "mailOptions": {
            "auth": {
                "pass": 1
            }
        },
        "NotificationGateway": {
            "authKey": 1
        },
        "redisConf" : {
            "password" : 1
        },
        "registerOrgPassword": 1,
        "RemoteServers" : "*"
    },
    encryptConf: false,
    exitJobs: [],
    authValidatorPermittedMode: false,
    allowOnlyImportedADusers : false,
    disableIPBlockMechanism : false
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

function load_settings(callback) {
    var decryptedSettings;
    var encryptedSettings;
    var settings;

    async.series([
        //read file
        function(callback) {
            Common.fs.readFile('Settings.json', function(err, data) {
                if (err) {
                    callback(err);
                    return;
                }

                var rawSettings = data.toString().replace(/[\n|\t]/g, '');
                // logger.debug("load_settings: " + rawSettings);
                try {
                    settings = JSON.parse(rawSettings);

                } catch (err) {
                    callback(err + ", while parsing Settings.json");
                    return;
                }

                Common.encKey = settings.encKey;

                callback(null);
            });
        },
        // decrypt fields
        function(callback) {
            try {
                decryptedSettings = dataEncryptor.parseParameters('dec', settings, Common.encryptedParameters, Common.dec);
            } catch (err) {
                callback("decrypting " + err);
                return;
            }
            callback(null);
        },
        // encrypt fields in case some value changed
        function(callback) {
            var newSettingsToFile = null;
            if (settings.encryptConf) {
                try {
                    encryptedSettings = dataEncryptor.parseParameters('enc', settings, Common.encryptedParameters, Common.enc);
                    if (!(_.isEqual(encryptedSettings, settings))) {
                        newSettingsToFile = JSON.stringify(encryptedSettings, null, 4);
                    }
                } catch (err) {
                    callback("encrypting " + err);
                    return;
                }

                if(newSettingsToFile){
                    Common.fs.writeFile('Settings.json', newSettingsToFile, callback);
                }
                else{
                    callback(null);
                }
            } else {
                callback(null);
            }
        },
    ], function(err) {
        if (err) {
            logger.error("load_settings: " + err);
            callback(err);
            return;
        }

        callback(null, decryptedSettings);
    });
}

function parse_configs() {
    logger.info('Load settings from file');

    load_settings(function(err, settings) {
        if (err) {
            logger.error('cannot load settings from file');
            return;
        }

        if(settings.logLevel && (settings.logLevel !== Common.logLevel)) logger.level = settings.logLevel;

        // load all attributes of settings in to Common
        for (var attrname in settings) {
            Common[attrname] = settings[attrname];
        }

        Common.serverurl = Common.publicurl;
        Common.dcURL = Common.serverurl;

        var internalUrlObj = url.parse(Common.internalurl);
        Common.internalServerCredentials.options = {};
        Common.internalServerCredentials.options.host = internalUrlObj.hostname;
        Common.internalServerCredentials.options.port = Number(internalUrlObj.port);
        var isSSL = internalUrlObj.protocol === "https:";
        if(isSSL){
            Common.internalServerCredentials.options.key = Common.fs.readFileSync(Common.internalServerCredentials.key);
            Common.internalServerCredentials.options.certificate = Common.fs.readFileSync(Common.internalServerCredentials.cert);
            Common.internalServerCredentials.options.rejectUnauthorized = false;

        }

        if(Common.platformpath) Common.imagesPath = Common.platformpath + "/out/target/product/x86_platform";


        if (firstTimeLoad) {
            //connect to redis
            Common.redisPool = poolModule.Pool({
                name : 'redis',
                create : function(callback) {
                    var c = Common.redis.createClient(Common.redisConf);
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
    });

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

