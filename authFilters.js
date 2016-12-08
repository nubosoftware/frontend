var async = require('async');
var Login = require('./login.js');
var sessionModule = require('./session.js');
var Common = require('./common.js');
var Session = sessionModule.Session;
var internalRequests = require('./internalRequests.js');

var filters = {
    'LOGINTOKEN': 0
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

function getFilter(filter) {
    switch (filters[filter]) {
        case 0:
            return loginTokenFIlter;
        default:
            return null;
    }

}

module.exports = {
    getFilter: getFilter
};