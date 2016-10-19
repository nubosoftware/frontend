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

    internalRequests.forwardGetRequest(req.url, function(err, resObj){
        res.send(resObj);
    });
}

