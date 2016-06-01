var http = require('./http.js');
var querystring = require('querystring');
var Common = require('./common.js');
var url = require('url');
var logger = Common.logger;

function getOptions() {
    var urlObj = url.parse(Common.internalurl);

    var options = {
        host: urlObj.hostname,
        port: urlObj.port,
    };

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
            callback(err);
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
            callback(err);
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
            callback(err);
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
            callback(err);
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
            callback(err);
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
            callback(err);
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


module.exports = {
    createOrReturnUserAndDomain: createOrReturnUserAndDomain,
    createDomainForUser: createDomainForUser,
    updateUserAccount: updateUserAccount,
    validateAuthentication: validateAuthentication,
    createUserFolders: createUserFolders,
    saveSettingsUpdateFile: saveSettingsUpdateFile
}