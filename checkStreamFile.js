"use strict";

var Common = require('./common.js');
var internalRequests = require('./internalRequests.js');

var logger = Common.logger;
var seccessCode = 1;
var errorCode = 0;

function checkStreamFile(req, res, next) {
    // https://<MGMTIP>/checkStreamFile?loginToken=[]&streamName=[]
    res.contentType = 'json';
    var loginToken = req.params.loginToken;

    var streamName = req.params.streamName;
    internalRequests.forwardCheckStreamFile(loginToken, streamName, function(err, statusCode) {
        if (err) {
            res.send({
                status : errorCode,
                message : "error occurred during request"
            });
        } else {
            res.send({
                status : statusCode,
                message : ""
            });
        }
    });
}

var CheckStreamFile = {
    func : checkStreamFile
};
module.exports = CheckStreamFile;
