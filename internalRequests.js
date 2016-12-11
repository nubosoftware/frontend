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

function createOrReturnUserAndDomain(email, logger, callback) {
    var options = getOptions();
    options.path = "/createOrReturnUserAndDomain" + "?email=" + email;

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

        if (resObjData.status === 1) {
            callback(null, resObjData.resObj, resObjData.userObj, resObjData.orgObj);
        } else if (resObjData.status === 0) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }

        return;
    });
}

function createDomainForUser(domain, logger, callback) {
    var options = getOptions();
    options.path = "/createDomainForUser" + "?domain=" + domain;

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

        if (resObjData.status === 1) {
            callback(null, resObjData.resObj);
        } else if (resObjData.status === 0) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }

        return;
    });
}

function updateUserAccount(registrationEmail, orgEmail, authType, serverURL, domain,
    orgUser, orgPassword, secureSSL, signature, fromDevice, updateOtherDevices, updateMainDevice, callback) {

    var options = getOptions();
    options.path = "/updateUserAccount";
    options.method = "POST";
    var postData = JSON.stringify({
        registrationEmail: registrationEmail,
        orgEmail: orgEmail,
        authType: authType,
        serverURL: serverURL,
        domain: domain,
        orgUser: orgUser,
        orgPassword: orgPassword,
        secureSSL: secureSSL,
        signature: signature,
        fromDevice: fromDevice,
        updateOtherDevices: updateOtherDevices,
        updateMainDevice: updateMainDevice
    });
    options.headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };


    http.doPostRequest(options, postData, function(err, resData) {
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

        if (resObjData.status === 1) {
            callback(null);
        } else if (resObjData.status === 0) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }

        return;
    });

}

function validateAuthentication(mainDomain, email, authType, serverURL, domain, orgUser, orgPassword, secureSSL, signature, callback) {
    var options = getOptions();
    options.path = "/validateAuthentication";
    options.method = "POST";
    var postData = JSON.stringify({
        mainDomain: mainDomain,
        email: email,
        authType: authType,
        serverURL: serverURL,
        domain: domain,
        orgUser: orgUser,
        orgPassword: orgPassword,
        secureSSL: secureSSL,
        signature: signature
    });
    options.headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };

    http.doPostRequest(options, postData, function(err, resData) {
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

        if (resObjData.status === 1) {
            callback(null);
        } else if (resObjData.status === 0) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }

        return;
    });
}

function createUserFolders(email, deviceid, overwrite, time, hrTime, callback, demoUser) {
    var options = getOptions();
    options.path = "/createUserFolders";
    options.method = "POST";

    var postData = JSON.stringify({
        email: email,
        deviceid: deviceid,
        overwrite: overwrite,
        time: time,
        hrTime: hrTime,
        demoUser: demoUser
    });

    options.headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };

    http.doPostRequest(options, postData, function(err, resData) {
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

        if (resObjData.status === 1) {
            callback(null);
        } else if (resObjData.status === 0) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }

        return;
    });
}

function saveSettingsUpdateFile(settings, userName, deviceID, callback) {
    var options = getOptions();
    options.path = "/saveSettingsUpdateFile";
    options.method = "POST";

    var postData = JSON.stringify({
        settings: settings,
        userName: userName,
        deviceID: deviceID
    });

    options.headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': postData.length
    };

    http.doPostRequest(options, postData, function(err, resData) {
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

        if (resObjData.status === 1) {
            callback(null);
        } else if (resObjData.status === 0) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }

        return;
    });
}

function forwardGetRequest(url, callback) {
    var options = getOptions();
    options.path = url;

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

function setAdminInDB(email, orgdomain, callback) {
    console.log('internalREquests: email: ' + email);
    var options = getOptions();
    options.path = "/setAdminInDB" + "?email=" + email + "&orgdomain=" + orgdomain;
    console.log('internalREquests: options: ' + options);

    http.doGetRequest(options, function(err, resData) {
        if (err) {
            console.log('internalRequests err: ' + err);
            callback(err);
            return;
        }

        var resObjData;
        console.log('resObjData: ' + resData);
        try {
            resObjData = JSON.parse(resData);
            console.log('resObjData: ' + resObjData);
        } catch (e) {
            callback(e);
            return;
        }

        if (resObjData.status === 1) {
            callback(null, resObjData.resObj, resObjData.userObj, resObjData.orgObj);
        } else if (resObjData.status === 0) {
            callback(resObjData.message);
        } else {
            callback("unknown status code");
        }

        return;
    });
}

function forwardGetRequestt(req, res, next) {
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

module.exports = {
    createOrReturnUserAndDomain: createOrReturnUserAndDomain,
    createDomainForUser: createDomainForUser,
    updateUserAccount: updateUserAccount,
    validateAuthentication: validateAuthentication,
    createUserFolders: createUserFolders,
    saveSettingsUpdateFile: saveSettingsUpdateFile,
    forwardGetRequest: forwardGetRequest,
    forwardGetRequestt: forwardGetRequestt,
    forwardCheckStreamFile: forwardCheckStreamFile,
    getStreamsFile : getStreamsFile,
    setAdminInDB : setAdminInDB,
    upload: upload
}
