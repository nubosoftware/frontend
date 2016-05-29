"use strict";


var Common = require('./common.js');
var logger = Common.logger;
var http = require('./http.js');
var url = require("url");

var StartSession = {
    func: startSession
};

module.exports = StartSession;

function startSession(req, res, next) {

    // https://login.nubosoftware.com/startsession?loginToken=[loginToken]?timeZone=[timeZome]
    res.contentType = 'json';
    var errRes = {
        status: 0,
        message: 'Internal error. Please contact administrator.',
    };
    var urlObj = url.parse(Common.internalurl);

    var options = {
        host: urlObj.hostname,
        port: urlObj.port,
        path: req.url
    };

    //forward request to backend server
    http.doGetRequest(options, function(err, resData) {
        if (err) {
            res.send(errRes);
            logger.error("startSession: " + err);
            return;
        }

        var resObj;
        try {
            resObj = JSON.parse(resData);
        } catch (e) {
            res.send(errRes);
            logger.error("startSession: " + e);
            return;
        }

        res.send(resObj);
        return;
    });
}

