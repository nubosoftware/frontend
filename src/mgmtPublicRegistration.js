"use strict"

const Common = require("./common.js");
const internalRequests = require("./internalRequests.js");
const Service = require("./service.js");
const async = require("async");
const os = require("os");
const logger = Common.logger;
const fs = require('fs').promises;
const path = require('path');

const TTL = 30;
const REFRESH_RATE = 6;

var index = -1;
var ttlErrCnt = 0;

async function registerPromise() {
    try {
        const hostname = os.hostname();
        let version;
        let buildTime;

        try {
            // Attempt to read version.txt
            const versionContent = await fs.readFile(path.join(__dirname, '../version.txt'), 'utf8');
            const versionLines = versionContent.split('\n');
            versionLines.forEach(line => {
                const separatorIndex = line.indexOf(':');
                if (separatorIndex === -1) return;
                const key = line.slice(0, separatorIndex).trim();
                const value = line.slice(separatorIndex + 1).trim();
                if (key === 'VERSION') {
                    version = value;
                } else if (key === 'BUILD_TIME') {
                    buildTime = value;
                }
            });
        } catch (fileErr) {
            logger.warn(`mgmtPublicRegistration::registerPromise: Unable to read version.txt: ${fileErr}`);
            // Keep version and buildTime as undefined
        }

        // Call registerFrontEnd with promise wrapper
        const idx = await new Promise((resolve, reject) => {
            internalRequests.registerFrontEnd(hostname, version, buildTime, (err, idx) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(idx);
                }
            });
        });

        index = idx;
        return idx;

    } catch (err) {
        logger.error(`mgmtPublicRegistration::registerPromise: ${err}`);
        throw err;
    }
}

// Modify register to use registerPromise
function register(callback) {
    registerPromise()
        .then(() => callback(null))
        .catch(err => {
            console.error(err);
            callback(err);
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