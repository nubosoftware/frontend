"use strict"

const Common = require("./common.js");
const internalRequests = require("./internalRequests.js");
const logger = Common.logger;
var url = require('url');
var _ = require('underscore');
var nodeHttp = require('http');
var nodeHttps = require('https');

function jsonPrint(obj) {
    return JSON.stringify(obj, null, 2);
}

function getOptions() {
    var options = {
        host: "172.16.80.120",
        port: "8080",
        headers: {}
    };
    //_.extend(options, Common.internalServerCredentials.options);
    /*(options.headers = {};
    options.headers['fe-user'] = Common.backendAuth.user;
    options.headers['fe-pass'] = Common.backendAuth.password;*/
    return options;
}

function tunnel(req, res) {
    try {
        //logger.info(`guacTunnel. params: ${jsonPrint(req.params)}, body: ${jsonPrint(req.body)}, headers: ${jsonPrint(req.headers)}`);
        req.pause();

        var options = url.parse(req.url);
        options.method = req.method;
        options.agent = false;
        _.extend(options, getOptions());
        _.extend(options.headers, req.headers);
        options.headers['x-client-ip'] = req.realIP;
        options.path = options.path.replace("/html/guac/tunnel", "/guacamole-example-1.3.0/tunnel")
        //logger.info(`guacTunnel. options: ${jsonPrint(options)}}`);
        var request;
        if (options.key) request = nodeHttps.request;
        else request = nodeHttp.request;
        // TODO move pipe request to http module
        var connector = request(options, function (serverResponse) {

            serverResponse.pause();
            res.writeHeader(serverResponse.statusCode, serverResponse.headers);
            serverResponse.pipe(res);
            serverResponse.resume();
        });
        req.pipe(connector);
        req.resume();
        connector.on('error', function (err) {
            logger.error("forwardRequest error: " + err);
            res.writeHead(503, {
                "Content-Type": "text/plain"
            });
            res.end("503 Service Unavailable\n");
            return;
        });
    } catch (err) {
        logger.info(`guacTunnel Error: ${err}`);
        res.send({
            status: 1,
            message: "Internal error"
        });
    }
}
module.exports = {
    tunnel
}