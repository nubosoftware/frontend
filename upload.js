"use strict";

var Common = require('./common.js');
var http = require('http');
var https = require('https')
var logger = Common.logger;
var url = require('url');
var _ = require('underscore');

var Upload = {
    'upload': upload
};
module.exports = Upload;

//pipe upload file to backend server
function upload(req, res, next) {

    logger.info("upload: uploading file");
    req.pause();

    var options = url.parse(req.url);
    options.headers = req.headers;
    options.method = req.method;
    options.agent = false;
    _.extend(options, Common.internalServerCredentials.options);

    var request;
    if (options.key) request = https.request;
    else request = http.request;
    // TODO move pipe request to http module
    var connector = request(options, function(serverResponse) {
        serverResponse.pause();
        res.writeHeader(serverResponse.statusCode, serverResponse.headers);
        serverResponse.pipe(res);
        serverResponse.resume();
    });
    req.pipe(connector);
    req.resume();
    return;
}