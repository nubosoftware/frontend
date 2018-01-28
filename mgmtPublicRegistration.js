"use strict"

const Common = require("./common.js");
const internalRequests = require("./internalRequests.js");
const Service = require("./service.js");
const async = require("async");
const os = require("os");
const logger = Common.logger;

const TTL = 30;
const REFRESH_RATE = 6;

var index = -1;
var ttlErrCnt = 0;

function register(callback) {

    var hostname = os.hostname();

    internalRequests.registerFrontEnd(hostname, function(err, idx) {
        if (err) {
            logger.error("mgmtPublicRegistration::register: " + err);
            return callback(err);
        }

        index = idx;
        return callback(null);
    });
}

function refreshTTL(callback) {
    internalRequests.refreshFrontEndTTL(index, function(err) {
        if (err) {
            ttlErrCnt++;
            logger.error("mgmtPublicRegistration::refreshTTL: " + err);
            if (ttlErrCnt == (REFRESH_RATE / 2)) {
                ttlErrCnt = 0;
                unregister(function(err) {
                    if (err) {
                        return callback(err);
                    } else {
                        return register(callback);
                    }
                });
            } else {
                return callback(err);
            }
        } else {
            return callback(null);
        }
    });
}

function unregister(callback) {

    internalRequests.unregisterFrontEnd(index, function(err) {
        if (err) {
            logger.error("mgmtPublicRegistration::unregister: " + err);
            return callback(err);
        }

        return callback(null);
    });
}

function refreshTTLService() {
    var mon = new Service(refreshTTL, {
        period: TTL / REFRESH_RATE
    });

    return mon;
}


module.exports = {
    register: register,
    refreshTTLService: refreshTTLService,
    unregister: unregister
}