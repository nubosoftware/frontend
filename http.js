"use strict";

var http = require('http');

module.exports = {
    doPostRequest: doPostRequest,
    doGetRequest: doGetRequest
};

function doPostRequest(options, postData, callback) {
    var callbackDone = false;
    var resData = "";
    var req = http.request(
        options,
        function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                resData = resData + chunk;
            });
            res.on('end', function() {
                if(!callbackDone) {
                    callbackDone = true;
                    callback(null, resData);
                }
            });
        }
    );

    req.on('error', function(e) {
        if(!callbackDone) {
            callbackDone = true;
            callback("Error while request", e);
        }
    });

    req.write(postData);
    req.end();
}

function doGetRequest(options, callback) {
    var callbackDone = false;
    var resData = "";
    var req = http.request(
        options,
        function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                resData = resData + chunk;
            });
            res.on('end', function() {
                if(!callbackDone) {
                    callbackDone = true;
                    callback(null, resData);
                }
            });
        }
    );

    req.on('error', function(e) {
        if(!callbackDone) {
            callbackDone = true;
            callback("Error while request", e);
        }
    });

    req.end();
}
