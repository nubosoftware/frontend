var async = require('async');
var Login = require('./login.js');
var setting = require('./settings.js');
var sessionModule = require('./session.js');
var Session = sessionModule.Session;

var filters = {
    'SESSID': 0,
    'ISADMIN': 1,
    'LOGINTOKEN': 2
}

function sessionIdFilter(req, excludeList, callback) {
    var reqPath = req.path(req.url);
    var session = req.params.session;
    var sessIdExclude = excludeList['SESSID'];

    if (!session) {
        callback("missing session ID");
        return;
    }

    if (sessIdExclude && sessIdExclude[reqPath]) {
        callback(null);
        return;
    }

    new Session(session, function(err, obj) {
        if (err) {
            callback(err);
            return;
        }
        req.nubodata = {};
        req.nubodata.session = obj;
        callback(null)
    });
}

function isAdminFilter(req, excludeList, callback) {
    var reqPath = req.path(req.url);
    var isAdminExclude = excludeList['ISADMIN'];

    if (isAdminExclude && isAdminExclude[reqPath]) {
        callback(null);
        return;
    }

    setting.loadAdminParamsFromSession(req, null, function(err, login) {
        callback(err);
    });
}

function loginTokenFIlter(req, excludeList, callback) {
    var reqPath = req.path(req.url);
    var loginToken = req.params.loginToken;
    var loginTokenExclude = excludeList['LOGINTOKEN'];

    if (loginTokenExclude && loginTokenExclude[reqPath]) {
        callback(null);
        return;
    }

    if (!loginToken) {
        callback("missing loginToken");
        return;
    }

    new Login(loginToken, function(err, login) {
        if (err) {
            callback(err);
            return;
        }
        req.nubodata = {};
        req.nubodata.loginToken = login;
        callback(null);
    });
}

function getFilter(filter) {
    switch (filters[filter]) {
        case 0:
            return sessionIdFilter;
        case 1:
            return isAdminFilter;
        case 2:
            return loginTokenFIlter;
        default:
            return null;
    }

}

module.exports = {
    getFilter: getFilter
};