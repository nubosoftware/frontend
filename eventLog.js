"use strict";
var Common = require('./common.js');
var logger = Common.logger;

// Event Types
var EV_CONST = {
    // Event Types
    EV_CREATE_PLAYER : 1,
    EV_RESET_PASSCODE : 2,
    EV_LOGIN : 3,
    EV_LOGOUT : 4,
    EV_EDIT_PROFILE : 5,
    EV_EXCHANGE_SETUP : 6,
    EV_AD_SYNC_START : 7,
    EV_AD_SYNC_END : 8,
    EV_ADD_PROFILE : 9,
    EV_DELETE_PROFILE : 10,
    EV_ACTIVATE_PROFILE : 11,
    EV_DEACTIVATE_PROFILE : 12,
    EV_ACTIVATE_DEVICE : 13,
    EV_DEACTIVATE_DEVICE : 14,
    EV_CREATE_GROUP : 15,
    EV_DELETE_GROUP : 16,
    EV_ADD_TO_GROUP : 17,
    EV_REMOVE_FROM_GROUP : 18,
    EV_UPLOAD_APK : 19,
    EV_ADD_APP_TO_PROFILE : 20,
    EV_REMOVE_APP_FROM_PROFILE : 21,
    EV_ADD_APP_TO_GROUP : 22,
    EV_REMOVE_APP_FROM_GROUP : 23,

    // Event Levels
    INFO : 'info',
    WARN : 'warn',
    ERR : 'err',
};

/**
 * createEvent
 * Adds an event to table events_log in DB
 *
 * @param event_type   Type of event as published in the list of constants (EV_*)
 * @param email        Email of the user who caused the event (string)
 * @param extra_info   Additional information regarding the action
 *                     (for example when activating a device this would be the deviceId) (string)
 * @param level        INFO, WARN or ERR constants
 * @param callback     function(err)
 */
function createEvent(event_type, email, extra_info, level, callback) {
    var time = new Date();
    // Retreive user's maindomain

    Common.db.User.findAll({
        attributes : ['orgdomain'],
        where : {
            email : email
        },
    }).complete(function(err, results) {
        if (!!err) {
            callback('reportEvent Error:' + err);
            return;
        }

        if (!results || results == "") {
            callback('reportEvent Error: Cannot find user');
            return;
        }

        // Retreive maindomain
        var maindomain = (results[0].orgdomain ? results[0].orgdomain : '');
        console.log("maindomain " + maindomain + ", event_type " + event_type + ", email " + email + ", time " + time);
        Common.db.EventsLog.create({
            eventtype : event_type,
            email : email,
            maindomain : maindomain,
            extrainfo : extra_info,
            time : time,
            level : level
        }).then(function(results) {
            console.log('results');
            callback(null);
            return;
        }).catch(function(err) {
            console.log('err');
            logger.error('reportEvent Error: Cannot Insert to table.\n' + 'event_type=' + event_type + ' email=' + email + ' maindomain=' + maindomain + '\n extra_info=' + extra_info + ' time=' + time + 'level=' + level + '\nERROR: ' + err);
            callback(err);
            return;
        });

    });

}

module.exports = {
    EV_CONST : EV_CONST,
    createEvent : createEvent
};
