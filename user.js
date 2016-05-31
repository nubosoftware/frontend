"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var async = require('async');

function createUserApplicationNotif(email, domain) {

    var notifArray = ["Calendar","Email","Messenger"];
    async.each(notifArray, function(row, callback) {

        Common.db.UserApplicationNotifs.findAll({
            attributes : ['email'],
            where : {
                appname    : row,
                email      : email,
                maindomain : domain
            },
        }).complete(function(err, results) {

            if (!!err) {
                callback(err);
                return;
            }

            if (!results || results == "") {

                // Insert new entry to database
                Common.db.UserApplicationNotifs.create({
                    maindomain : domain,
                    email : email,
                    appname : row,
                    sendnotif : 1
                }).then(function(results) {
                    callback(null);
                }).catch(function(err) {
                    var msg = "can't create notification status for " + row + ", error is:" + err;
                    callback(msg);
                    return;
                });
            } else {
                callback(null);
                return;
            }
        });
    });
}

function checkUserDomain(email, callback) {
    //calculate the domain from the user
    var domain;
    getUserDomain(email, function (orgDomainFromDB ) {
        if (orgDomainFromDB)
            domain = orgDomainFromDB;
        else
            domain = email.substr(email.indexOf('@') + 1);

        //look for org with the same manin domain
        Common.db.Orgs.findAll({
            attributes : ['authtype', 'orgname', 'serverurl', 'securessl', 'signature'],
            where : {
                maindomain : domain
            },
        }).complete(function(err, results) {

            if (!!err) {
                var msg = "Error while checkUserDomain while selecting main domain: " + err;
                logger.info(msg);
                callback(msg, domain);
                return;
            }

            if (results.length < 1 || results[0].count < 2 || results[0].authtype == null || results[0].authtype == "") {
                callback("Domain not found", domain);
            } else {
                callback(null, domain);
            }
        });
    });
}

function setUserDetails(email, firstName, lastName, jobTitle, callback) {
    logger.info("Update user " + email + ", firstName: " + firstName + ", lastName:" + lastName + ", jobTitle:" + jobTitle);

    if (Common.withService) {
        Common.db.User.update({
            firstname : firstName,
            lastname : lastName,
            jobtitle : jobTitle
        }, {
            where : {
                email : email
            }
        }).then(function() {
            callback(null, email, firstName, lastName, jobTitle);
            // return data withno error
        }).catch(function(err) {
            var msg = "Error while setUserDetails: " + err;
            logger.info(msg);
            callback(msg);
            // return error
            return;
        });
    } else {

        Common.db.User.update({
            firstname : firstName,
            lastname : lastName,
            jobtitle : jobTitle,
            username : email
        }, {
            where : {
                email : email
            }
        }).then(function() {
            callback(null, email, firstName, lastName, jobTitle);
            // return data withno error
        }).catch(function(err) {
            var msg = "Error while setUserDetails: " + err;
            logger.info(msg);
            callback(msg);
            // return error
            return;
        });
    }

}

function getUserDetails(email, callback) {

    Common.db.User.findAll({
        attributes : ['email', 'firstname', 'lastname', 'jobtitle'],
        where : {
            email : email
        },
    }).complete(function(err, results) {

        if (!!err) {
            var msg = "Error while getUserDetails: " + err;
            logger.info(msg);
            callback(msg);
            // return error
            return;
        }

        if (results.length < 1 || results[0].count < 3) {
            var msg = "Error while getUserDetails: email not found:" + email;
            logger.info(msg);
            callback(msg);
            // return error
            return;
        }

        logger.info("user: " + results[0].email);
        var firstName = results[0].firstname != null ? results[0].firstname : '';
        var lastName = results[0].lastname != null ? results[0].lastname : '';
        var jobTitle = results[0].jobtitle != null ? results[0].jobtitle : '';
        callback(null, firstName, lastName, jobTitle);
        // return existing user data
    });

}

function getUserDeviceDataFolder(email, deviceid) {

    if (Common.withService) {
        if ((deviceid.indexOf("web") === 0) || (deviceid.indexOf(Common.withServiceWebDeviceID) === 0)) {
            deviceid = Common.withServiceWebDeviceID;
        } else {
            deviceid = Common.withServiceDeviceID;
        }
    }

    var folder = getUserHomeFolder(email) + deviceid + '/';

    return folder;
}

function getUserDeviceDataFolderObj(email, deviceid){
     var deviceId = Common.getWithServiceDeviceID(deviceid) + '/';
     return {
        root: getUserHomeFolder(email),
        folder: deviceId
     };
}

function getUserStorageFolder(email) {
    var folder = getUserHomeFolder(email) + 'storage/';
    return folder;
}

function getUserStorageFolderObj(email) {
     return {
        root: getUserHomeFolder(email),
        folder: 'storage/'
     };
}

function getUserHomeFolder(email) {
    var re = new RegExp('(.*)@(.*)');
    var m = re.exec(email);
    var domain = "none";
    if (m != null && m.length >= 3) {
        domain = m[2];
    }
    var folder = '/' + domain + '/' + email + '/';
    return folder;
}

function updateUserConnectedDevice(email, imei, platform, gateway, logger, callback) {

    Common.db.UserDevices.update({
        platform: platform,
        gateway: gateway
    }, {
        where: {
            email: email,
            imei: imei
        }
    }).then(function() {
        callback(null);
    }).catch(function(err) {
        var errMsg = 'updateUserConnectedDevice: ' + err;
        logger.error(errMsg);
        callback(errMsg);
    });

}

function getUserConnectedDevices(email, logger, callback) {

    Common.db.UserDevices.findAll({
        attributes: ['email', 'imei', 'platform', 'gateway'],
        where: {
            email: email,
            platform: {
                ne: null
            },
            gateway: {
                ne: null
            }
        }
    }).complete(function(err, results) {

        if (!!err) {
            var errMsg = 'getUserConnectedDevices: ' + err;
            logger.error(errMsg);
            callback(errMsg);
            return;
        }

        // return all connected devices of the user
        callback(null, results);
    });

}

function updateUserDataCenter(email, dcname, dcurl, logger, callback) {

    Common.db.User.update({
        dcname: dcname,
        dcurl: dcurl
    }, {
        where: {
            email: email
        }
    }).then(function() {
        callback(null);
    }).catch(function(err) {
        var errMsg = 'updateUserDataCenter: ' + err;
        logger.error(errMsg);
        callback(errMsg);
    });

}

function getUserDataCenter(email, logger, callback) {

    Common.db.User.findAll({
        attributes: ['dcname', 'dcurl'],
        where: {
            email: email
        },
    }).complete(function(err, results) {

        if (!!err) {
            var errMsg = 'getUserDataCenter: ' + err;
            logger.error(errMsg);
            callback(errMsg);
            return;
        }

        // goes here if we don't find this profile in the database
        if (!results || results == "") {
            var errMsg = 'getUserDataCenter: cannot find user: ' + email;
            logger.error(errMsg);
            callback(errMsg);
            return;

        }
        
        callback(null, results[0].dcname, results[0].dcurl);
    });
}

function getUserDomain(email, callback) {
    //read the domain from the database

    Common.db.User.findAll({
        attributes : ['orgdomain'],
        where : {
            email : email
        },
    }).complete(function(err, results) {

        if (!!err) {
            var msg = "getUserDomain: Error while selecting orgdomain: " + err;
            logger.info(msg);
            callback(null);
            return;
        } else if (!results || results == "") {
            var msg = "getUserDomain: user does not exist in database";
            logger.info(msg);
            callback(null);
            return;

        } else {
            var orgdomain = results[0].orgdomain
            var msg = "getUserDomain: found orgdomain = " + orgdomain;
            logger.info(msg);
            callback(orgdomain);
        }
    });

}

var User = {
    setUserDetails : setUserDetails,
    getUserDetails : getUserDetails,
    getUserHomeFolder : getUserHomeFolder,
    getUserStorageFolder : getUserStorageFolder,
    getUserDeviceDataFolder : getUserDeviceDataFolder,
    checkUserDomain : checkUserDomain,
    createUserApplicationNotif : createUserApplicationNotif,
    updateUserConnectedDevice: updateUserConnectedDevice,
    getUserConnectedDevices: getUserConnectedDevices,
    updateUserDataCenter: updateUserDataCenter,
    getUserDataCenter: getUserDataCenter,
    getUserDomain : getUserDomain,
    getUserDeviceDataFolderObj: getUserDeviceDataFolderObj,
    getUserStorageFolderObj: getUserStorageFolderObj
};

module.exports = User;

