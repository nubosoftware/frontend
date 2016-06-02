"use strict";

var Common = require('./common.js');
var http = require('http');
var logger = Common.logger;
var url = require('url');

var Upload = {
    'uploadToSession': uploadToSession
};
module.exports = Upload;

//pipe upload file to backend server
function uploadToSession(req, res, next) {
    logger.info("uploadToSession: uploading file from " + req.params.session);
    req.pause();
    var internalurl = url.parse(Common.internalurl);
    var options = url.parse(req.url);
    options.headers = req.headers;
    options.method = req.method;
    options.agent = false;
    options.host = internalurl.hostname;
    options.port = Number(internalurl.port);

    var connector = http.request(options, function(serverResponse) {
        serverResponse.pause();
        res.writeHeader(serverResponse.statusCode, serverResponse.headers);
        serverResponse.pipe(res);
        serverResponse.resume();
    });
    req.pipe(connector);
    req.resume();
    return;
}
