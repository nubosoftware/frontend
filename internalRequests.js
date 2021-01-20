var http = require('./http.js');
var querystring = require('querystring');
var Common = require('./common.js');
var url = require('url');
var logger = Common.logger;
var _ = require('underscore');
var nodeHttp = require('http');
var nodeHttps = require('https');
var fs = require('fs');
var async = require('async');

function getOptions() {
    var options = {};
    _.extend(options, Common.internalServerCredentials.options);
    options.headers = {};
    options.headers['fe-user'] = Common.backendAuth.user;
    options.headers['fe-pass'] = Common.backendAuth.password;
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
                    callback(null, resObjData.status);
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
    options.method = req.method;
    options.agent = false;
    _.extend(options, getOptions());
    _.extend(options.headers, req.headers);

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
    connector.on('error', function(err) {
        logger.error("upload error: "+err);
        res.writeHead(503, {
            "Content-Type": "text/plain"
        });
        res.end("503 Service Unavailable\n");
        return;
    });
    return;
}


function getStreamsFile(req, res, next) {
    var loginToken = req.params.loginToken;
    var streamName = req.params.streamName;
    var isLive = req.params.isLive;
    req.pause();
    var options = getOptions();
    console.log("SharonLog url = " + req.url)
    options.path = "/readStreamFile" + "?loginToken=" + loginToken + "&streamFileName=" + streamName + "&isLive=" + isLive;
    _.extend(options.headers, req.headers);
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
    connector.on('error', function(err) {
        logger.error("getStreamsFile error: "+err);
        res.writeHead(503, {
            "Content-Type": "text/plain"
        });
        res.end("503 Service Unavailable\n");
        return;
    });
    return;
}

//pipe upload file to backend server
function forwardRequest(req, res, next) {

    //logger.info("forwardRequest. method: "+req.method+", url: "+req.url);
    req.pause();

    var options = url.parse(req.url);
    options.method = req.method;
    options.agent = false;
    _.extend(options, getOptions());
    _.extend(options.headers, req.headers);
    options.headers['x-client-ip'] = req.realIP;

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
    connector.on('error', function(err) {
        logger.error("forwardRequest error: "+err);
        res.writeHead(503, {
            "Content-Type": "text/plain"
        });
        res.end("503 Service Unavailable\n");
        return;
    });
    return;
}

function forwardGetRequest(req, res, next) {
    var options = getOptions();
    options.path = req.url;
    options.headers['x-client-ip'] = req.realIP;
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

function checkServerAndForwardGetRequest(req, res, next) {

    var options = getOptions();
    options.path = '/checkStatus';
    //logger.info("checkServerAndForwardGetRequest. method: "+req.method+", url: "+req.url);
    var response = {
        status: Common.STATUS_DATA_CENTER_UNAVALIBLE,
        msg: "data center isn't avalible"
    };

    http.doGetRequest(options, function(err, resData) {

        if (err) {
            logger.error("checkServerAndForwardGetRequest: " + err);
            res.send(response);
            return;
        }

        var resObjData;
        try {
            resObjData = JSON.parse(resData);
        } catch (e) {
            logger.error("checkServerAndForwardGetRequest: " + e);
            res.send(response);
            return;
        }

        if (resObjData.status === Common.STATUS_DATA_CENTER_UNAVALIBLE) {
            res.send(response);
            return;
        } else if (resObjData.status === Common.STATUS_OK) {
            forwardRequest(req, res, next);
            return;
        } else {
            logger.error("checkServerAndForwardGetRequest: unknown status " + resObjData.status);
            res.send(response);
            return;
        }
    });
}


function addMissingResource(resource) {
    var options = getOptions();
    options.path = "/addMissingResource";
    options.method = "POST";

    var postData = JSON.stringify({
        resource: resource
    });

    var reqHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };

    _.extend(options.headers, reqHeaders);

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

    if (!deviceName && !resolution) {
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

    var headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };
    _.extend(options.headers, headers);

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

function forwardActivationLink(req, res, next) {
    var options = getOptions();
    options.path = req.url;
    options.headers['x-client-ip'] = req.realIP;
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

        let smsActivation = req.params.smsActivation;
        if (smsActivation === true || smsActivation === "true") {
            logger.info("Sending smsActivation response");
            res.send(resObjData);
            return;
        }

        logger.info("forwardActivationLink: status: " + resObjData.status + ", message: " + resObjData.message);

        let deviceType = resObjData.deviceType;
        if (!deviceType || deviceType == "") {
            deviceType = "NA";
        }
        res.writeHead(302, {
            'Location': '/html/player/login.html#activationLink/'+resObjData.status+"/"+deviceType
            //add other headers here...
        });
        res.end();
        /*
        if (resObjData.status == 0) {
            fs.readFile("html/player/activateDevice.html", function(error, page) {
                if (error) {
                    res.write(resData);
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'text/html'
                    });
                    res.write(page);
                }
                res.end();
            });
        } else {
            fs.readFile("html/player/activateErrorDevice.html", function(error, page) {
                if (error) {
                    res.write(resData);
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'text/html'
                    });
                    res.write(page);
                }
                res.end();
            });
        }*/
        return;
    });
}

function forwardResetPasscodeLink(req, res, next) {
    var options = getOptions();
    options.path = '/activationLink?token=' + req.params.token + '&email=' + req.params.email;
    options.headers['x-client-ip'] = req.realIP;
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

        logger.info("forwardResetPasscodeLink: status: " + resObjData.status + ", message: " + resObjData.message);
        let deviceType = resObjData.deviceType;
        if (!deviceType || deviceType == "") {
            deviceType = "NA";
        }
        res.writeHead(302, {
            'Location': '/html/player/login.html#resetPasscodeLink/'+resObjData.status+"/"+deviceType
            //add other headers here...
        });
        res.end();

        /*if (resObjData.status == 0) {
            fs.readFile("html/player/resetPasscode.html", function(error, page) {
                if (error) {
                    res.write(resData);
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'text/html'
                    });
                    res.write(page);
                }
                res.end();
            });
        } else {
            fs.readFile("html/player/resetPasscodeError.html", function(error, page) {
                if (error) {
                    res.write(resData);
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'text/html'
                    });
                    res.write(page);
                }
                res.end();
            });
        }*/
        return;
    });
}

function registerFrontEnd(hostname, callback) {
    var options = getOptions();
    options.path = '/frontEndService/registerFrontEnd?hostname=' + hostname;
    http.doGetRequest(options, function(err, resData) {
        if (err) {
            return callback(err);
        }
        let resObjData = {};

        try {
            resObjData = JSON.parse(resData);
            //console.log(resObjData)
        } catch (e) {
            console.log("ERROR!!");
            callback(e);
            return;
        }
        if (resObjData.status == Common.STATUS_OK) {
            callback(null, resObjData.index);
        } else if (resObjData.status == Common.STATUS_ERROR) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }
    });
}

function refreshFrontEndTTL(index, callback) {
    var options = getOptions();
    options.path = '/frontEndService/refreshFrontEndTTL?index=' + index;

    http.doGetRequest(options, function(err, resData) {
        if (err) {
            return callback(err);
        }

        try {
            resObjData = JSON.parse(resData);
            if (resObjData.status == Common.STATUS_OK) {
                callback(null);
            } else if (resObjData.status == Common.STATUS_ERROR) {
                callback(resObjData.message);
            } else {
                callback("unknown status code");
            }
            return;
        } catch (e) {
            callback(e);
            return;
        }
    });
}

function unregisterFrontEnd(index, callback) {
    var options = getOptions();
    options.path = '/frontEndService/unregisterFrontEnd?index=' + index;

    http.doGetRequest(options, function(err, resData) {
        if (err) {
            return callback(err);
        }

        try {
            resObjData = JSON.parse(resData);
            if (resObjData.status === Common.STATUS_OK) {
                callback(null);
            } else if (resObjData.status === Common.STATUS_ERROR) {
                callback(resObjData.message);
            } else {
                callback("unknown status code");
            }
            return;
        } catch (e) {
            callback(e);
            return;
        }
    });
}

module.exports = {
    forwardGetRequest: forwardRequest,
    forwardCheckStreamFile: forwardCheckStreamFile,
    getStreamsFile: getStreamsFile,
    addMissingResource: addMissingResource,
    updateUserConnectionStatics: updateUserConnectionStatics,
    upload: upload,
    forwardActivationLink: forwardActivationLink,
    forwardResetPasscodeLink: forwardResetPasscodeLink,
    checkServerAndForwardGetRequest: checkServerAndForwardGetRequest,
    registerFrontEnd: registerFrontEnd,
    refreshFrontEndTTL: refreshFrontEndTTL,
    unregisterFrontEnd: unregisterFrontEnd,
    forwardPostRequest: forwardRequest


}