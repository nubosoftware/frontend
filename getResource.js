"use strict";


var Common = require('./common.js');
var logger = Common.logger;
var http = require('./http.js');
var url = require("url");
var internalRequests = require('./internalRequests.js');

module.exports = {
    getResource: getResource
};

function getResource(req, res, next) {
    // https://server_url/getResource?packageName=[]&fileName=[]
    // http://localhost/getResource?fileName=drawable-hdpi/ic_launcher.png&packageName=com.nubo.nubocamera

    res.contentType = 'json';
    var errRes = {
        status: Common.STATUS_ERROR,
        message: 'Internal error. Please contact administrator.',
    };

    internalRequests.forwardGetRequest(req.url, function(err, resObj) {
        if (err) {
            res.send(errRes);
            logger.error("getResource: " + err);
            return;
        }

        res.send(resObj);
    });


}