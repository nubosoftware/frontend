var http = require('./http.js');
var querystring = require('querystring');
var Common = require('./common.js');
var url = require('url');
var logger = Common.logger;
var _ = require('underscore');
var nodeHttp = require('http');
var nodeHttps = require('https');


function getOptions() {
    var options = {};
    _.extend(options, Common.internalServerCredentials.options);
    return options;
}

function forwardCheckStreamFile(loginToken, streamFileName, callback) {

    var resObjData;
    var options = getOptions();
    options.path = "/checkStreamFile" + "?loginToken=" + loginToken + "&streamFileName=" + streamFileName;

    http.doGetRequest(options, function(err, resData) {
        if (err) {
            callback(err);
            return;
        } else {
            try {
                resObjData = JSON.parse(resData);
                if (resObjData.status === 1) {
                    callback(null,resObjData.status);
                } else if (resObjData.status === 0) {
                    callback(resObjData.message);
                } else {
                    callback("unknown status code");
                }
                return;
            } catch (e) {
                callback(e);
                return;
            }
        }
    });
}



//pipe upload file to backend server
function upload(req, res, next) {

    logger.info("upload: uploading file");
    req.pause();

    var options = url.parse(req.url);
    options.headers = req.headers;
    options.method = req.method;
    options.agent = false;
    _.extend(options, getOptions());

    var request;
    if (options.key) request = nodeHttps.request;
    else request = nodeHttp.request;
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


function getStreamsFile(req, res, next) {
    var loginToken = req.params.loginToken;
    var streamName = req.params.streamName;
    var isLive = req.params.isLive;
    req.pause();
    var options = getOptions();
    console.log("SharonLog url = " + req.url)
    options.path = "/readStreamFile" + "?loginToken=" + loginToken + "&streamFileName=" + streamName + "&isLive="+isLive;
    options.headers = req.headers;
    options.method = req.method;
    options.agent = false;
    var request;
    if (options.key) request = nodeHttps.request;
    else request = nodeHttp.request;
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

function forwardGetRequest(req, res, next) {
    var options = getOptions();
    options.path = req.url;
    res.contentType = 'json';

    http.doGetRequest(options, function(err, resData) {
        if (err) {
            res.send({
                status: Common.STATUS_ERROR,
                message: "Internal error"
            });
            return;
        }

        var resObjData;
        try {
            resObjData = JSON.parse(resData);
        } catch (e) {
            res.send({
                status: Common.STATUS_ERROR,
                message: "Internal error"
            });
            return;
        }

        res.send(resObjData);

        return;
    });

}

function checkLoginToken(loginToken, callback) {
    var options = getOptions();
    options.path = options.path = "/checkLoginToken" + "?loginToken=" + loginToken;

    http.doGetRequest(options, function(err, resData) {
        if (err) {
            callback(err);
            return;
        }

        var resObjData;
        try {
            resObjData = JSON.parse(resData);

        } catch (e) {
            callback(e);
            return;
        }

        callback(null, resObjData);

        return;
    });
}

function addMissingResource(resource) {
    var options = getOptions();
    options.path = "/addMissingResource";
    options.method = "POST";

    var postData = JSON.stringify({
        resource: resource
    });

    options.headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };

    http.doPostRequest(options, postData, function(err, resData) {
        if (err) {
            logger.error("addMissingResource: " + err);
            return;
        }

        var resObjData;
        try {
            resObjData = JSON.parse(resData);
            console.log(resObjData)
        } catch (e) {
            logger.error("addMissingResource: " + e);
            return;
        }

        if (resObjData.status === Common.STATUS_OK) {
            return;
        }

        if (resObjData.status === Common.STATUS_ERROR) {
            logger.error("addMissingResource: " + resObjData.message);
        } else {
            logger.error("addMissingResource: unknown status code");
        }

        return;
    });
}

function updateUserConnectionStatics(deviceName, resolution, pathname) {

    if(!deviceName && !resolution){
        return;
    }

    var options = getOptions();
    options.path = "/updateUserConnectionStatics";
    options.method = "POST";

    var postData = JSON.stringify({
        deviceName: deviceName,
        resolution: resolution,
        pathname: pathname
    });

    options.headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };

    http.doPostRequest(options, postData, function(err, resData) {
        if (err) {
            logger.error("updateUserConnectionStatics: " + err);
            return;
        }

        var resObjData;
        try {
            resObjData = JSON.parse(resData);
            console.log(resObjData)
        } catch (e) {
            logger.error("updateUserConnectionStatics: " + e);
            return;
        }

        if (resObjData.status === Common.STATUS_OK) {
            return;
        }

        if (resObjData.status === Common.STATUS_ERROR) {
            logger.error("updateUserConnectionStatics: " + resObjData.message);
        } else {
            logger.error("updateUserConnectionStatics: unknown status code");
        }

        return;
    });
}

function captureDeviceDetails(req, res, next) {
    res.contentType = 'json';
    var msg = 'OK';
    var status = 0;

    updateNetworkDeviceDetails(req, function(err, resObj) {
        if (err) {
            msg = 'Internal Error';
            status = 1;
        }

        res.send(resObj);
    });
}

function updateNetworkDeviceDetails(req, callback) {
    var options = getOptions();
    options.path = "/captureDeviceDetails?" + querystring.stringify({
        activationKey: req.params.activationKey,
        sessionid: req.params.sessionid,
        remoteAddress: req.connection.remoteAddress,
        remotePort: req.connection.remotePort
    });

    http.doGetRequest(options, function(err, resData) {
        if (err) {
            logger.error("updateNetworkDeviceDetails: " + err);
            callback(err);
            return;
        }

        var resObjData;
        try {
            resObjData = JSON.parse(resData);
        } catch (e) {
            logger.error("updateNetworkDeviceDetails: " + e);
            callback(e);
            return;
        }

        callback(null, resObjData);
        return;
    });
}


module.exports = {
    forwardGetRequest: forwardGetRequest,
    forwardCheckStreamFile: forwardCheckStreamFile,
    getStreamsFile : getStreamsFile,
    checkLoginToken: checkLoginToken,
    addMissingResource: addMissingResource,
    updateUserConnectionStatics: updateUserConnectionStatics,
    upload: upload,
    updateNetworkDeviceDetails: updateNetworkDeviceDetails,
    captureDeviceDetails : captureDeviceDetails
}
