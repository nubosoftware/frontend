"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var net = require('net');
var tls = require('tls');
var querystring = require("querystring");
var accesslog = require('accesslog');
var url = require("url");
var createTrialProd = require('./createTrialProd.js');

var mainFunction = function(err, firstTimeLoad) {
    if (err) {
        console.log("Fatal Error: " + err);
        Common.quit();
        return;
    }
    if (!firstTimeLoad)// execute the following code only in the first time
        return;

    var urlObj = url.parse("https://:6666");
    var isSSL = urlObj.protocol === "https:";
    var port = urlObj.port;
    if (!port)
        port = ( isSSL ? 443 : 80);
    var host = urlObj.hostname;
    var server_options;
    if(isSSL) {
        server_options = {
            requestCert: true,
            rejectUnauthorized: true,
            key : Common.fs.readFileSync('../cert/server.key'),
            certificate : Common.fs.readFileSync('../cert/server.cert'),
            ca : Common.fs.readFileSync('./trialroot.crt')
        };
    } else {
        server_options = null;
    }

    var server = Common.restify.createServer(server_options);
    buildServerObject(server);
    server.listen(port, host, function() {
        logger.info('%s listening at %s', server.name, server.url);
    });

    process.on('SIGINT', function() {
        logger.info("restserver caught interrupt signal");
        Common.quit();
    });
};


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

var cnt = 0;

var accesslogger = accesslog({
    path : './log/access_log.log'
});

function buildServerObject(server) {
    server.on('uncaughtException', function(request, response, route, error) {
        logger.error("Exception in http server: " + (error && error.stack || error));
        response.send(error);
        return true;
    });
    // server.use(debugFunc);
    server.use(Common.restify.queryParser());
    server.use(accesslogger);
    server.get('/createTrialProd', createTrialProd.createTrialProd);

    server.get("/", function(req, res, next) {
        logger.info("Access to " + req.url );
        res.writeHead(200,  {"Content-Type" : "text/plain"});
        res.write("OK\n");
        res.end();
    });
}

Common.loadCallback = mainFunction;
if (module) {
    module.exports = {mainFunction: mainFunction};
}
