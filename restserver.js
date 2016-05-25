"use strict";

var net = require('net');
var tls = require('tls');
var url = require("url");
var querystring = require("querystring");
var accesslog = require('accesslog');

var Common = require('./common.js');
var logger = Common.logger;

var Activate = require('./activate.js');
var Validate = require('./validate.js');
var StartSession = require('./StartSession.js');
var AuthenticateUser = require('./authenticateUser.js');
var checkPasscode = require('./checkPasscode.js');
var resetPasscode = require('./resetPasscode.js');
var unlockPassword = require('./unlockPassword.js');
var SendEmailForUnknownJobTitle = require('./sendEmailForUnknownJobTitle.js');
var setPasscode = require('./setPasscode.js');
var captureDeviceDetails = require('./captureDeviceDetails.js');
var MediaStream = require('./mediaStream.js');
var ThreadedLogger = require('./ThreadedLogger.js');
var ActivationLink = require('./activationLink.js');
var Upload = require('./upload.js');
var authFilterExcludes = require('./authFilterExcludes.js');
var authFilterValidator = require('./authFilterValidator.js');

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

    var serverExt = null;

    var listenFunc = function(server, port, host) {
        server.listen(port, host, function() {
            logger.info('%s listening at %s', server.name, server.url);
        });
    };

    for (var i = 0; i < Common.listenAddresses.length; i++) {
        // logger.info("address: "+Common.listenAddresses[i]);
        var urlObj = url.parse(Common.listenAddresses[i]);
        // logger.info("protocol: "+urlObj.protocol+", hostname:
        // "+urlObj.hostname+", port: "+urlObj.port);
        var isSSL = urlObj.protocol === "https:";
        var port = urlObj.port;
        if (!port)
            port = ( isSSL ? 443 : 80);
        var host = urlObj.hostname;
        // if (!host)

        var server_options;
        if(isSSL) {
            server_options = {
                key : Common.fs.readFileSync('../cert/server.key'),
                certificate : Common.fs.readFileSync('../cert/server.cert'),
                ca : Common.fs.readFileSync('../cert/server.ca')
            };
        } else {
            server_options = null;
        }

        var myserver = Common.restify.createServer(server_options);
        buildServerObject(myserver);

        listenFunc(myserver, port, host);
        // if (i==0) serverExt = myserver;

        var wsServer = new WebSocketServer({
            httpServer : myserver,
            autoAcceptConnections : false
        });

        wsServer.on('request', webSocketRequest);

    }

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

function testq(req, res, next) {

}

function getResourceListByDevice(req, res, next) {

    var deviceName = req.params.deviceName;
    var resolution = req.params.resolution;
    var arr = new Array();
    Common.redisClient.ZREVRANGE("d_" + deviceName, '0', '-1', function(err, replies) {

        if (err || replies.length === 0) {
            Common.redisClient.ZREVRANGE("r_" + resolution, '0', '-1', function(err, replies) {
                if (err || replies.length === 0) {
                    res.send(arr);
                    return;
                }
                replies.forEach(function(reply, i) {
                    arr.push(reply);
                    if ((i + 1) === replies.length) {
                        res.send(arr);
                    }
                });
            });
            return;
        }

        replies.forEach(function(reply, i) {

            arr.push(reply);
            if ((i + 1) === replies.length) {
                res.send(arr);
            }
        });
        //
    });
}

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


var validator = new authFilterValidator(['LOGINTOKEN'], authFilterExcludes);

function authValidate(req, res, next){

    validator.validate(req, function(err){
        if(err){
            logger.error("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$authorization validatation failed: " + err + " ::: " + req.path(req.url));
            next();
            return;
        }
        else {
            next();
            return;
        }
    });
}


var cnt = 0;

var accesslogger = accesslog({
    path : './log/access_log.log'
});

var filterModule = require('permission-parser');
var filterOpts = {
    loge: logger.error
};
var filterObj = new filterModule([], filterOpts);
var filterFile = 'parameters-map.json';
Common.fs.watchFile(filterFile, {
    persistent : false,
    interval : 5007
}, function(curr, prev) {
    logger.info(filterFile + ' been modified');
    refresh_filter();
});

var refresh_filter = function() {
    Common.fs.readFile(filterFile, function(err, data) {
        if (err) {
            logger.error('Error: Cannot open ' + filterFile + ' file');
        } else {
            try {
                var msg = data.toString().replace(/[\n|\t]/g, '');
                var obj = JSON.parse(msg);
            } catch (e) {
                logger.error("cannot parse json file " + filterFile + " exception:" + JSON.stringify(e));
                return;
            }
            console.log("obj: " + JSON.stringify(obj));
            filterObj.reload(obj.rules, {permittedMode: obj.permittedMode});
        }
    });
}
refresh_filter();

function buildServerObject(server) {
    server.on('uncaughtException', function(request, response, route, error) {
        logger.error("Exception in http server: " + (error && error.stack || error));
        response.send(error);
        return true;
    });
    server.use(Common.restify.queryParser());
    server.use(filterObj.useHandler);
    server.use(function(req, res, next) {
        req.realIP = req.headers['x-real-ip'] || req.connection.remoteAddress;
        next();

    });
    // server.use(debugFunc);

    server.use(accesslogger);
    server.use(nocache);
    server.use(authValidate);
    // server.use(Common.restify.gzipResponse());
    server.use(Common.restify.CORS({
        origins: Common.allowedOrigns, // defaults to ['*']
    }));
    
    server.get('/authenticateUser', AuthenticateUser.func);
    server.get('/checkPasscode', checkPasscode.func);
    server.get('/setPasscode', setPasscode.func);
    server.get('/resetPasscode', resetPasscode.func);
    server.get('/activate', Activate.func);
    server.get('/validate', Validate.func);
    server.get('/startsession', StartSession.func);
    server.get('/getResourceListByDevice', getResourceListByDevice);
    server.get('/sendEmailForUnknownJobTitle', SendEmailForUnknownJobTitle.func);
    server.get('/captureDeviceDetails', captureDeviceDetails.captureDeviceDetails);
    server.get('/resendUnlockPasswordLink', unlockPassword.resendUnlockPasswordLink);
    server.get('/createStream', MediaStream.createStream);
    server.get('/playPauseStream', MediaStream.playPauseStream);
    server.get('/html/player/common.js', require('./webCommon.js'));
    server.get('/activationLink', ActivationLink.func);
    server.get('/unlockPassword', unlockPassword.unlockPassword);
    server.post('/file/uploadToSession', Upload.uploadToSession);
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

    var resourcesfile = new nodestatic.Server(Common.nfshomefolder, {
        cache : 10
    });

    var isPermittedUrl = function(url) {
        // logger.error("url: "+ url )
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
        var urlObj = url.parse(req.url);
        var pathname = urlObj.pathname;

        //handle apps resoureces
        if (pathname.indexOf("/html/player/extres/") === 0) {
            resourcesfile.serve(req, res, function(err, result) {
                if (err) { 
                    logger.error("Error serving " + req.url + " - " + err.message);
                    res.writeHead(404, {
                        "Content-Type": "text/plain"
                    });
                    res.write("404 Not Found\n");
                    res.end();
                    Common.redisClient.zincrby("missing_res", 1, req.url);
                    return;
                }
                else{
                    userConnectionStatics(req, pathname);
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
                    Common.redisClient.zincrby("missing_res", 1, req.url);
                    return;
                }
                else{
                    userConnectionStatics(req, pathname);
                }
            });
        }
    });
}

function userConnectionStatics(req, pathname) {
    var deviceName = req.params.deviceName;
    var resolution = req.params.resolution;
    if (deviceName != null || resolution != null) {
        if (pathname.indexOf("/html/player/extres/") === 0)
            pathname = pathname.substr(20);
        if (deviceName != null && deviceName.length > 0) {
            Common.redisClient.sadd("devices", deviceName);
            Common.redisClient.zincrby("d_" + deviceName, 1, pathname);
        }
        if (resolution != null && resolution.length > 0) {
            Common.redisClient.sadd("resolutions", resolution);
            Common.redisClient.zincrby("r_" + resolution, 1, pathname);
        }
    }
}

Common.loadCallback = mainFunction;
if (module) {
    module.exports = {mainFunction: mainFunction};
}
