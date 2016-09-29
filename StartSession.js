"use strict";


var Common = require('./common.js');
var logger = Common.logger;
var http = require('./http.js');
var url = require("url");
var internalRequests = require('./internalRequests.js');

var StartSession = {
    func: startSession
};

module.exports = StartSession;

function startSession(req, res, next) {
    // https://login.nubosoftware.com/startsession?loginToken=[loginToken]?timeZone=[timeZome]
    res.contentType = 'json';
    var errRes = {
        status: Common.STATUS_ERROR,
        message: 'Internal error. Please contact administrator.',
    };

    internalRequests.forwardGetRequest(req.url, function(err, resObj){
        if (err) {
            res.send(errRes);
            logger.error("startSession: " + err);
            return;
        }

        res.send(resObj);
    });
}

