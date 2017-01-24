"use strict";

var net = require('net');
var tls = require('tls');
var url = require("url");
var querystring = require("querystring");
var accesslog = require('accesslog');
var async = require("async");
var fs = require("fs");
var restify = require("restify");

var Common = require('./common.js');
var logger = Common.logger;


var SendEmailForUnknownJobTitle = require('./sendEmailForUnknownJobTitle.js');
var ThreadedLogger = require('./ThreadedLogger.js');
var Notifications = require('./Notifications.js');
var SmsNotification = require('./SmsNotification.js');
var internalRequests = require('./internalRequests.js');
var checkStreamFile = require('./checkStreamFile.js');


var port = 8443;
if (process.argv.length >= 3) {
    port = process.argv[2];
}

var mainFunction = function(err, firstTimeLoad) {
    if (err) {
        console.log("Fatal Error: " + err);
        Common.quit();
        return;
    }

    refresh_filter();

    if (!firstTimeLoad)// execute the following code only in the first time
        return;

    var WebSocketServer = require('websocket').server;

    // Handle new WebSocket client
    var new_client = function(client, clientAddr, resourceURL) {
        var logger = new ThreadedLogger();
        var log;
        log = function(msg) {
            logger.info(' ' + clientAddr + ': ' + msg);
        };
        log('WebSocket connection');
        log('Version ' + client.protocolVersion + ', subprotocol: ' + client.protocol);

        var target_port = resourceURL.query.port;
        var target_host = resourceURL.query.gateway;
        var target_isSSL = resourceURL.query.isSSL;

        if (Common.webSocketGatewayHostMap) {
            var newtarget = Common.webSocketGatewayHostMap[target_host];
            if (newtarget && newtarget !== "") {
                logger.info("Map target host " + target_host + " to " + newtarget);
                var urlObj = url.parse(newtarget);
                if (urlObj.protocol === "ssl:") {
                    target_isSSL = "true";
                } else {
                    target_isSSL = "valse";
                }
                target_port = urlObj.port;
                target_host = urlObj.hostname;
            }
        }

        var target;

        if (target_isSSL == "true") {
            logger.info("Try connection with SSL to " + target_host + ":" + target_port);
            target = tls.connect(target_port, target_host, function() {
                log('connected to ssl target');
            });
        } else {
            logger.info("Try connection to " + target_host + ":" + target_port);
            target = net.createConnection(target_port, target_host, function() {
                log('connected to non-ssl target');
            });
        }
        target.on('data', function(data) {
            // log("sending message: " + data);
            try {
                // if (client.protocol === 'base64') {
                // client.send(new Buffer(data).toString('base64'));
                // } else {
                // client.send(data,{binary: true});
                client.sendBytes(data);
                // }
            } catch (e) {
                log("Client closed, cleaning up target");
                target.end();
            }
        });
        target.on('end', function() {
            log('target disconnected');
        });
        target.on('error', function(err) {
            log('target error: ' + err);
        });
        target.on('close', function(err) {
            log('target closed');
            client.close();
        });
        client.on('message', function(msg) {
            // log('got message: ' + msg);
            // if (client.protocol === 'base64') {
            // target.write(new Buffer(msg, 'base64'));
            // } else {
            target.write(msg.binaryData, 'binary');
            // }
        });
        client.on('close', function(code, reason) {
            log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
            target.end();
        });
        client.on('error', function(a) {
            log('WebSocket client error: ' + a);
            target.end();
        });
    };

    var webSocketRequest = function(request) {
        logger.info("websocket request: " + JSON.stringify(request.resourceURL, null, 2));
        if (request.resourceURL.pathname !== "/gatewayProxy") {
            request.reject();
            logger.info("Invalid gatewayProxy connection");
            return;
        }

        var connection = request.accept('binary', request.origin);
        
        if (request.resourceURL.query.playbackMode == "Y") {
            SendPlayback.sendPlayback(connection, request.origin, request.resourceURL);
        } else {
            new_client(connection, request.origin, request.resourceURL);
        }

    };

    var initPortListener = function(listenAddress, callback) {
        async.waterfall(
            [
                function(callback) {
                    var urlObj = url.parse(listenAddress);
                    // logger.info("protocol: "+urlObj.protocol+", hostname:"+urlObj.hostname+", port: "+urlObj.port);
                    var isSSL = urlObj.protocol === "https:";
                    var port = urlObj.port;
                    if(!port)
                        port = ( isSSL ? 443 : 80);
                    var host = urlObj.hostname;
                    callback(null, host, port, isSSL);
                },
                function(host, port, isSSL, callback) {
                    if(isSSL) {
                        readCerts(function(err, opts) {
                            if(err) {
                                callback(err);
                                return;
                            } else {
                                //opts.requestCert = true;
                                callback(null, host, port, opts);
                            }
                        });
                    } else {
                        callback(null, host, port, null);
                    }
                },
                function(host, port, server_options, callback) {
                    var myserver = restify.createServer(server_options);
                    buildServerObject(myserver);
                    myserver.listen(port, host, function() {
                        logger.info('%s listening at %s', myserver.name, myserver.url);
                        callback(null);
                    });
                    var closeListener = function(callback) {
                        myserver.close(callback);
                    };
                    Common.exitJobs.push(closeListener);
                    var wsServer = new WebSocketServer({
                        httpServer : myserver,
                        autoAcceptConnections : false
                    });

                    wsServer.on('request', webSocketRequest);
                }
            ], function(err) {
                if(err) {
                    logger.error("Cannot open listener for " + listenAddress + ", err: " + err);
                }
                if(typeof callback === "function") callback(err);
            }
        );
    };
    var readCerts = function(callback) {
        if(!Common.sslCerts) {
            Common.sslCerts = {
                key: "../cert/server.key",
                certificate: "../cert/server.cert",
                ca: "../cert/root.crt"
            };
        }
        console.log("Common.sslCerts: " + JSON.stringify(Common.sslCerts));
        if(!Common.sslCerts || !Common.sslCerts.ca || !Common.sslCerts.certificate || !Common.sslCerts.key) return callback("bad parameter Common.sslCerts");
        var sslCerts = {};
        async.forEachOf(
            Common.sslCerts,
            function(item, key, callback) {
                fs.readFile(item, function(err, data) {
                    if(err) {
                        logger.error("Cannot read " + item + " file, err: " + err);
                    } else {
                        sslCerts[key] = data;
                    }
                    callback(err);
                });
            },
            function(err) {
                callback(err, sslCerts);
            }
        );
    };

    async.series(
        [
            function(callback) {
                async.each(
                    Common.listenAddresses,
                    initPortListener,
                    function(err) {
                        callback(null);
                    }
                );
            },
            function(callback) {
                if(Common.username) {
                    require('child_process').execFile("/usr/bin/id", [Common.username], function(error, stdout, stderr) {
                        if(error) {
                            logger.error("Cannot get uid/gid of " + Common.username + "\nstderr:\n" + stderr + "\nerr:\n" + error);
                            callback(err);
                        } else {
                            var obj = /uid=(\d+)\(\w+\) gid=(\d+).+/.exec(stdout);
                            if(obj === null) {
                                logger.error("Cannot get uid/gid of " + Common.username + " bad input: " + stdout);
                            } else {
                                logger.info("Run as " + obj[1] + ":" + obj[2]);
                                process.setgid(Number(obj[2]));
                                process.setuid(Number(obj[1]));
                            }
                        }
                    });
                } else {
                    logger.warn("Run as root");
                }
            }
        ], function(err) {
        }
    );
};

function returnInternalError(err, res) {
    logger.error(err.name, err.message);
    res.send({
        status : 3,
        message : "Internal error"
    });
}

var nodestatic = require('node-static');
var http = require('http');

function downloadFunc(req, res, next) {

    var dtype = req.params.dtype;
    var destURL = Common.urlToAPK;
    if (dtype === "IOS1")
        destURL = Common.urlToIOS1;
    else if (dtype === "IOS2") {
        var qs = querystring.stringify({
            url : Common.urlToIOS2
        });
        destURL = "itms-services://?action=download-manifest&amp;;;;" + qs;
    }

    res.writeHead(303, {
        Location : destURL
    });
    res.end();
}

function debugFunc(req, res, next) {
    // return false;
    var debugTimeout = req.params.debugTimeout;
    if (debugTimeout === 'Y') {
        logger.info("Debug timeout....");
        return false;
        // stop chain to test timeout. http will never return response....
    }
    var debugErr = req.params.debugErr;
    if (debugErr === 'Y') {
        console.log("Before mytestvar: " + debugErr);
    }
    return next();
}

function tooManyUsers(req, res, next) {

    var stat = Common.fs.statSync("./TooManyUsers.txt");

    res.writeHead(200, {
        'Content-Type' : 'application/json',
        'Content-Length' : stat.size
    });

    var readStream = Common.fs.createReadStream("./TooManyUsers.txt");
    // We replaced all the event handlers with a simple call to
    // readStream.pipe()
    readStream.pipe(res);
}

function nocache(req, res, next) {
   if (!req.headers['range']) {
       res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
       res.header('Expires', '-1');
       res.header('Pragma', 'no-cache');
   }
   next();
}

function yescache(req, res, next) {
  res.removeHeader('Cache-Control');
  res.removeHeader('Expires');
  res.removeHeader('Pragma');
  next();
}

function captureDeviceNetworkDetails(req,res,next) {
    // skip irrelevant requets to reduce calls to DB
    if ((req.url.indexOf("/html/player/") >= 0) || req.url.indexOf("getResource") >= 0 || req.url.indexOf("checkStreamsFile") >= 0)  {
        next();
    } else {
        internalRequests.updateNetworkDeviceDetails(req, function(err, resObj) {
	    if (err) {
	        logger.error("captureDeviceNetworkDetails: " + err);
	    }

        if(resObj.status === 1){
            logger.error("captureDeviceNetworkDetails: " + resObj.message);
        }
	    next();
	    return;
        });
    }
}


var cnt = 0;

var accesslogger = accesslog({
    path : './log/access_log.log'
});

var filterModule = require('permission-parser');

var filterOpts = {
    loge: logger.error,
    mode: filterModule.mode.URL
};

var filterObj = new filterModule.filter([], filterOpts);
var filterFile = "./parameters-map.js";
Common.fs.watchFile(filterFile, {
    persistent : false,
    interval : 5007
}, function(curr, prev) {
    logger.info(filterFile + ' been modified');
    refresh_filter();
});

var refresh_filter = function() {
    try {
        delete require.cache[require.resolve(filterFile)];
    } catch(e) {}

    var obj;
    try {
        obj = require(filterFile);
    } catch(e) {
        logger.error('Error: Cannot load ' + filterFile + ' file, err: ' + e);
        return;
    }

    filterObj.reload(obj.rules, {permittedMode: obj.permittedMode});
};

//wrapper for old client
function filterObjUseHandlerWrapper(req, res, next){
        var urlObj = url.parse(req.url);
        var pathname = urlObj.pathname;

        if ((pathname.indexOf("/html/player/extres/") === 0) || (pathname.indexOf("//html/player/extres/") === 0))  {
            next();
        }
        else{
            filterObj.useHandler(req,res,next);
        }
}

function buildServerObject(server) {
    server.on('uncaughtException', function(request, response, route, error) {
        logger.error("Exception in http server: " + (error && error.stack || error));
        response.send(error);
        return true;
    });
    server.use(Common.restify.queryParser());
    server.use(filterObjUseHandlerWrapper);
    server.use(function(req, res, next) {

        req.realIP = (Common.proxyClientIpHeader && req.headers[Common.proxyClientIpHeader]) || req.connection.remoteAddress;
        next();

    });
    // server.use(debugFunc);

    server.use(accesslogger);
    server.use(nocache);
    if (Common.withService) {
	   server.use(captureDeviceNetworkDetails);
    } 
    // server.use(Common.restify.gzipResponse());
    server.use(Common.restify.CORS({
        origins: Common.allowedOrigns, // defaults to ['*']
    }));
    
// --------------------------------------------------------------------------------------------

    // depreacted
    if (!Common.withService) {
        server.get('/sendEmailForUnknownJobTitle', SendEmailForUnknownJobTitle.func);
    }
//--------------------------------------------------------------------------------------------

	server.get('/authenticateUser', internalRequests.forwardGetRequest);
    server.get('/checkPasscode', internalRequests.forwardGetRequest);
    server.get('/setPasscode', internalRequests.forwardGetRequest);
    server.get('/resetPasscode', internalRequests.forwardGetRequest);
    server.get('/activate', internalRequests.forwardGetRequest);
    server.get('/validate', internalRequests.forwardGetRequest);
    server.get('/captureDeviceDetails', internalRequests.captureDeviceDetails);
    server.get('/resendUnlockPasswordLink', internalRequests.forwardGetRequest);
    server.get('/activationLink', internalRequests.forwardGetRequest);
    server.get('/unlockPassword', internalRequests.forwardGetRequest);
    server.get('/startsession', internalRequests.forwardGetRequest);
    server.get('/getResource', internalRequests.forwardGetRequest);

    server.get('/getResourceListByDevice', internalRequests.forwardGetRequest);
    server.get('/html/player/common.js', require('./webCommon.js'));
    server.get('/download', downloadFunc);
    server.post('/file/uploadToSession', internalRequests.upload);
    server.post('/file/uploadToLoginToken', internalRequests.upload);
    server.post('/file/uploadDummyFile', internalRequests.upload);

    if (Common.isHandlingMediaStreams) {
        server.get('/getStreamsFile' , internalRequests.getStreamsFile);
        server.get('/checkStreamsFile' , checkStreamFile.func);
    }
    // if Exchange is external to organization (like office 365) the notification will come from it
    if (Common.EWSServerURL) {
        server.post('/EWSListener', internalRequests.upload);
    }
    server.get('/SmsNotification/sendSmsNotificationFromRemoteServer', SmsNotification.sendSmsNotificationFromRemoteServer);
    server.get('/Notifications/sendNotificationFromRemoteServer', Notifications.sendNotificationFromRemoteServer);
    
    server.opts('/.*/', optionsHandler);
    
    function optionsHandler(req, res) {
        if (!isPermittedUrl(req.url)) {
            logger.info("Access to " + req.url + " does not permitted");
            res.writeHead(404, {
                "Content-Type": "text/plain"
            });
            res.write("404 Not Found\n");
            res.end();
            return;
        }
        var allowHeaders = ['accept', 'cache-control', 'content-type', 'x-file-name', 'x-requested-with'];

        res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
        res.header('Access-Control-Allow-Methods', 'POST');
        return res.send(204);
    }

    var webclientfile = new nodestatic.Server('./', {
        cache : 10
    });

    var resourcesfile;
    if (!Common.withService) {
        resourcesfile = new nodestatic.Server(Common.nfshomefolder, {
            cache: 10
        });
    }
    var isPermittedUrl = function(url) {
        var match;
        match = url.match('^.*/html/(.*)');
        if (match !== null){
            return true;
        }

        match = url.match('^.*/favicon.ico');
        if (match !== null){
            return true;
        }

        match = url.match('^.*/streams/(.*)');
        if (match !== null){
            return true;
        }

        match = url.match('^.*/file/(.*)');
        if (match !== null){
            return true;
        }

        return false;
    };
    server.use(yescache);
    server.get(/^\/.*/, function(req, res, next) {
        if(!isPermittedUrl(req.url)) {
            logger.info("Access to " + req.url + " does not permitted");
            res.writeHead(404,  {"Content-Type" : "text/plain"});
            res.write("404 Not Found\n");
            res.end();
            return;
        }

        var urlObj = url.parse(req.url);
        var pathname = urlObj.pathname;

        //handle apps resoureces
        if (!Common.withService &&  (pathname.indexOf("/html/player/extres/") === 0 || pathname.indexOf("//html/player/extres/") === 0)) {
            resourcesfile.serve(req, res, function(err, result) {
                if (err) { 
                    logger.error("Error serving " + req.url + " - " + err.message);
                    res.writeHead(404, {
                        "Content-Type": "text/plain"
                    });
                    res.write("404 Not Found\n");
                    res.end();
                    internalRequests.addMissingResource(req.url);
                    return;
                }
                else{

                    internalRequests.updateUserConnectionStatics(req.params.deviceName, req.params.resolution, pathname);
                }
            });
        //handle web client resources
        } else {
            webclientfile.serve(req, res, function(err, result) {
                if (err) { // There was an error serving the file
                    logger.error("Error serving " + req.url + " - " + err.message);
                    res.writeHead(404, {
                        "Content-Type": "text/plain"
                    });
                    res.write("404 Not Found\n");
                    res.end();
                    internalRequests.addMissingResource(req.url);
                    return;
                }
                else{
                    if (!Common.withService) {
                        internalRequests.updateUserConnectionStatics(req.params.deviceName, req.params.resolution, pathname);
                    }

                }
            });
        }
    });
}

Common.loadCallback = mainFunction;
if (module) {
    module.exports = {mainFunction: mainFunction};
}
