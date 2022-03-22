"use strict"

var Common = require('./common.js');
var logger = Common.logger;
const axios = require('axios');
const _ = require('underscore');

/**
 * Class that sends notification using NCM (Nubo Service)
 */
class NCMSender {

    /**
     * the identifier of the sender
     */
    senderID;

    /**
     * The server URL
     */
    serverURL;

    /**
     *
     * @param {String} _senderID
     * @param {String} _serverURL
     */
    constructor(_senderID, _serverURL) {
        //super();
        this.senderID = _senderID;
        this.serverURL = _serverURL;
    }

    /**
     * Send notification
     * @param {Object} message
     * @param {Array} regIDs
     * @param {Number} nOfRetries
     * @param {CallableFunction} cb
     */
    send(message, regIDs, nOfRetries, cb) {
        this.sendMessage(message, regIDs, nOfRetries).then((result) => {
            logger.info(`NCM sendMessage result: ${JSON.stringify(result, null, 2)}`);
            cb(null, result);
        }).catch(err => {
            logger.error(`NCM sendMessage error: ${err}`, err);
            cb(err);
        });
    }

    /**
     * Send notification
     * @param {Object} message
     * @param {Array} regIDs
     * @param {Number} nOfRetries
     */
    async sendMessage(message, regIDs, nOfRetries) {
        let results = [];
        for (const regID of regIDs) {
            let msg = {
                toRegID: regID
            };
            _.extend(msg, message.params.data);
            let data = {
                sender: this.senderID,
                msg
            }
            let success = false;
            let trycnt = 0;
            while (!success && trycnt < nOfRetries) {
                try {
                    trycnt++;
                    let response = await axios({
                        method: "post",
                        url: `${this.serverURL}/sendMessage`,
                        data
                    });
                    success = true;
                    results.push({
                        status: response.status,
                        data: response.data
                    });
                    break;
                } catch (err) {
                    logger.info(`sendMessage error: ${err}`);
                    if (trycnt >= nOfRetries) {
                        if (err.response) {
                            results.push({
                                status: err.response.status,
                                data: err.response.data
                            });
                        } else {
                            results.push({
                                status: -1,
                                data: err.message
                            });
                        }
                        break;
                    } else {
                        await sleep(1000);
                    }
                }
            }
        }
        return results;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = NCMSender;
/*
    "NCMSenderID": "3b49ddad-1bab-4e0d-b678-29558c15e2f6",
    "NCMServerURL": "https://eu01.nubosoftware.com:19443"
*/
/*var mainFunction = function (err, firstTimeLoad) {
    if (err) {
        console.log("Fatal Error: " + err);
        Common.quit();
        return;
    }

    if (!firstTimeLoad) // execute the following code only in the first time
        return;
    let ncmSender = new NCMSender("3b49ddad-1bab-4e0d-b678-29558c15e2f6", "https://eu01.nubosoftware.com:19443");
    let message = {
        "params": {
            "data": {
                "type": "1s",
                "notifyTime": "",
                "title": "This is a test message",
                "notifyLocation": "test 1234..",
                "enableSound": "1",
                "enableVibrate": "0",
                "nuboPackageID": "ALL"
            }
        },
        "contentAvailable": true,
        "priority": "high"
    };
    let regIDs = ["6101d6b5-9aa9-549d-bf87-1c843adc3df3"];
    ncmSender.send(message,regIDs,4,function(err,result) {
        console.log(`result: ${JSON.stringify(result,null,2)}`);
        Common.quit();s
    });
}

Common.loadCallback = mainFunction;*/