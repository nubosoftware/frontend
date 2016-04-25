"use strict";

var Common = require('./common.js');
var logger = Common.logger;

module.exports = function(token, callback) {
    this.loginToken = token;

    //console.log("token="+token);
    //console.log("this.loginToken="+this.loginToken);

    this.loginParams = {
        isLogin : false
    };

    this.save = function(callback) {

        (function(login) {
            Common.redisClient.hmset('login_' + login.loginToken, login.loginParams, function(err, obj) {
                if (err) {
                    logger.info("Error in save hmset:" + err);
                    callback(err, null);
                    return;
                } else {
                    Common.redisClient.expire('login_' + login.loginToken, 600, function(err, obj) {
                        //if (callCallBack) {
                        //logger.info("login.loginParams.loginToken="+login.loginParams.loginToken);
                        callback(err, login);

                    });
                    //}
                }
            });
        })(this);
    };

    this.setUserName = function(userName) {
        this.loginParams.userName = userName;
    };

    this.setImUserName = function(imUserName) {
        this.loginParams.imUserName = imUserName;
    };

    this.setIsAdmin = function(isAdmin) {
        this.loginParams.isAdmin = isAdmin;
    };

    this.setIsActive = function(isActive) {
        this.loginParams.isActive = isActive;
    };

    this.setMainDomain = function(mainDomain) {
        this.loginParams.mainDomain = mainDomain;
    };

    this.setActivationKey = function(activationKey) {
        this.loginParams.activationKey = activationKey;
    };

    this.setAuthenticationRequired = function(authenticationRequired) {
        this.loginParams.authenticationRequired = authenticationRequired;
    };
    this.setPasscodeActivationRequired = function(passcodeActivationRequired) {
        this.loginParams.passcodeActivationRequired = passcodeActivationRequired;
    };

    this.setPasscode = function(passcode) {
        this.loginParams.passcode = passcode;
    };

    this.setValidLogin = function(isLogin) {
        this.loginParams.isLogin = isLogin;
    };

    this.setDeviceID = function(deviceID) {
        this.loginParams.deviceID = deviceID;
    };

    this.setFirstLogin = function(firstLogin) {
        this.loginParams.firstLogin = firstLogin;
    };

    this.setDeviceName = function(deviceName) {
        this.loginParams.deviceName = deviceName;
    };

    this.setDeviceType = function(deviceType) {
        this.loginParams.deviceType = deviceType;
    };

    this.setLang = function(languege) {
        this.loginParams.lang = languege;
    };

    this.setCountryLang = function(countrylang) {
        this.loginParams.countrylang = countrylang;
    };

    this.setLocalevar = function(localevar) {
        this.loginParams.localevar = localevar;
    };

    this.setEncrypted = function(encrypted) {
        this.loginParams.encrypted = encrypted;
    };

    this.setDcname = function(dcname) {
        this.loginParams.dcname = dcname;
    };

    this.setDcurl = function(dcurl) {
        this.loginParams.dcurl = dcurl;
    };

    this.getUserName = function() {
        return this.loginParams.userName;
    };

    this.getImUserName = function() {
        return this.loginParams.imUserName;
    };

    this.getActivationKey = function() {
        return this.loginParams.activationKey;
    };

    this.getAuthenticationRequired = function() {
        return this.loginParams.authenticationRequired;
    };

    this.getPasscodeActivationRequired = function() {
        return this.loginParams.passcodeActivationRequired;
    };

    this.getIsAdmin = function() {
        return this.loginParams.isAdmin;
    };

    this.getIsActive = function() {
        return this.loginParams.isActive;
    };

    this.getMainDomain = function() {
        return this.loginParams.mainDomain;
    };

    this.getPasscode = function() {
        return this.loginParams.passcode;
    };
    this.isValidLogin = function() {
        return this.loginParams.isLogin;
    };
    this.getDeviceID = function() {
        return this.loginParams.deviceID;
    };

    this.getFirstLogin = function() {
        return this.loginParams.firstLogin;
    };

    this.getLoginToken = function() {
        return this.loginParams.loginToken;
    };

    this.getDcname = function() {
        return this.loginParams.dcname;
    };

    this.getDcurl = function() {
       return this.loginParams.dcurl;
    };


    this.authenticateUser = function(authUser, authPassword, callback) {
        this.authUser = authUser;

    };

    if (this.loginToken == null) {// generate new login token and new login object
        var buf = Common.crypto.randomBytes(48);
        this.loginToken = buf.toString('hex');
        this.loginParams.loginToken = this.loginToken;
        this.loginParams.isLogin = false;
        this.loginParams.userName = '';
        this.loginParams.imUserName = '';
        this.save(callback);
        //logger.info('wrote object: '+JSON.stringify(this));

    } else {//read login object from redis
        (function(login) {
            var reply = Common.redisClient.hgetall('login_' + login.loginToken, function(err, obj) {
                //console.dir(obj);
                if (err) {
                    logger.info("err:" + err);
                    callback(err, login);
                    return;
                }
                if (obj != null) {
                    login.loginParams = obj;
                    Common.redisClient.ttl('login_' + login.loginToken, function(err, obj) {
                        login.loginParams.ttl = obj;
                        callback(err, login);
                    });

                    return;
                } else {
                    callback("Cannot find loginToken " + login.loginToken, null);
                    return;
                }
            });
        })(this);
        //logger.info('read object: '+JSON.stringify(reply));
    }
};

