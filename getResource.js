"use strict";


var Common = require('./common.js');
var logger = Common.logger;
var http = require('./http.js');
var url = require("url");

module.exports = {
    getResource: getResource
};

function getResource(req, res, next) {
    // https://server_url/getResource?packageName=[]&fileName=[]
    // http://localhost/getResource?fileName=drawable-hdpi/ic_launcher.png&packageName=com.nubo.nubocamera

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
            logger.error("getResource: " + err);
            return;
        }

        var resObj;
        try {
            resObj = JSON.parse(resData);
        } catch (e) {
            res.send(errRes);
            logger.error("getResource: " + e);
            return;
        }

        res.send(resObj);
        return;
    });
}

