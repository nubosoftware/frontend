var async = require('async');
var Common = require('./common.js');
var internalRequests = require('./internalRequests.js');

var filters = {
    'LOGINTOKEN': 0,
    'SESSID': 1
};

function loginTokenFIlter(req, excludeList, callback) {
    var reqPath = req.path(req.url);
    var loginToken = req.params.loginToken;
    var loginTokenExclude = excludeList['LOGINTOKEN'];

    if (loginTokenExclude && loginTokenExclude[reqPath]) {
        callback(null, Common.STATUS_OK);
        return;
    }

    if (!loginToken) {
        callback("missing loginToken");
        return;
    }

    internalRequests.checkLoginToken(loginToken, function(err, response) {
        if (err) {
            callback(err);
            return;
        }

        if (response.status === Common.STATUS_EXPIRED_LOGIN_TOKEN) {
            callback(null, Common.STATUS_EXPIRED_LOGIN_TOKEN, 'login token expired');
            return;
        }

        if (response.status === Common.STATUS_OK) {
            callback(null, Common.STATUS_OK);
            return;
        }

        callback("unknown status");
    });
}

function sessionIdFilter(req, excludeList, callback) {
    var reqPath = req.path(req.url);
    var sessionId = req.params.sessionid;
    var sessionIdExclude = excludeList['SESSID'];

    if (sessionIdExclude && sessionIdExclude[reqPath]) {
        callback(null, Common.STATUS_OK);
        return;
    }

    if (!sessionId) {
        callback("missing session id");
        return;
    }

    internalRequests.checkSessionId(sessionId, function(err, response) {
        if (err) {
            callback(err);
            return;
        }

        if (response.status === Common.STATUS_ERROR) {
            callback(response.message, Common.STATUS_ERROR);
            return;
        }

        if (response.status === Common.STATUS_OK) {
            callback(null, Common.STATUS_OK);
            return;
        }

        callback("unknown status");
    });
}

function getFilter(filter) {
    switch (filters[filter]) {
        case 0:
            return loginTokenFIlter;
        case 1:
            return sessionIdFilter;
        default:
            return null;
    }

}

module.exports = {
    getFilter: getFilter
};