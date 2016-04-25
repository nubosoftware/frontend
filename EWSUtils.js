"use strict";

var fs = require('fs');
var https = require('https');
var httpntlm = require('httpntlm');
var async = require('async');
var Common = require('./common.js');
var logger = Common.logger;

// constants
var APPLICATION_NAME_MAIL = 'Email';
var APPLICATION_NAME_CALENDAR = 'Calendar';
var APPLICATION_NAME_MESSAGING = 'Messaging';

/*
 * Method to get EWS details for user by email and domain OR by subscription ID (2 options that effect the query, later the logic is the same)
 */
function getEWSDetails(emailAddress, mainDomain, subscriptionID, callback) {

    var query = ' select user_application_notifs.sendnotif as send_notif_ind, ' +
		        ' 	   users.subscriptionupdatedate as users_subscriptiondate, ' +
		        ' 	   users.subscriptionid as users_subscriptionid, ' +
		        ' 	   users.email as users_email, ' +
		        ' 	   users.orgdomain as users_maindomain, ' +
		        '      users.authtype as users_authtype, ' +
		        ' 	   orgs.serverurl as orgs_serverurl, ' +
		        '	   orgs.impersonationuser as orgs_user, ' +
	            '      orgs.authtype as orgs_authtype, ' +
		        ' 	   orgs.impersonationpassword as orgs_password, ' +
		        ' 	   users.serverurl as users_serverurl, ' +
		        ' 	   users.orguser as users_user, ' +
		        ' 	   users.orgpassword as users_password ' +
		        ' from users ' +
		        ' inner join orgs on orgs.maindomain = users.orgdomain ' +
		        ' left outer join user_application_notifs on (user_application_notifs.maindomain = orgs.maindomain and user_application_notifs.email = users.email and appname =:appname) ';

    var queryWhereClause;
    var queryParams;
    var subscribtionIDForLogger;

    // the query above can work in 2 scenarios, email and domain, or subscription id
    if (emailAddress != null && emailAddress.length > 0 && mainDomain != null && mainDomain.length > 0) {

        // get details by email and domain
        queryWhereClause = ' where users.email=:email and users.orgdomain=:domain';
        queryParams = {appname: APPLICATION_NAME_MAIL , email: emailAddress, domain: mainDomain};
    } else {
        subscribtionIDForLogger = subscriptionID;

        // get details by subscription ID
        queryWhereClause = ' where users.subscriptionid=:subscriptionid';
        queryParams = {appname : APPLICATION_NAME_MAIL, subscriptionid: subscriptionID};
    }

    // same logic to get details and build return object
    Common.sequelize.query(query + queryWhereClause, null, {raw: true},queryParams).then(function(results) {
        if (!results || results == "" || results.length <= 0) {
            callback(' No Results. Unable to find EWS details for user (' + emailAddress + ' and org ' + mainDomain + ') or subscription ' + subscribtionIDForLogger + '.',null);
        } else {
         // take first row
            var row = results[0];

            // variables for later use
            var details;
            var msg;
            var serverURL;
            var authType;

            // gets all data of the required profile
            var email =                  row['users_email']            != null ? row['users_email'] : '';
            var domain =                 row['users_maindomain']       != null ? row['users_maindomain'] : '';

            // subscription ID if exist
            var subscriptionID =         row['users_subscriptionid']   != null ? row['users_subscriptionid'] : '-1';

            // indication if we need to send notification for this user or not
            var sendNotifInd =           row['send_notif_ind']         != null ? row['send_notif_ind'] : 1; // if value not exist, default is send notification

            // last update date (keep alive) for this subscription ID
            var subscriptionUpdatedate = row['users_subscriptiondate'];

            // login details
            var userName =               row['users_user']              != null ? row['users_user'] : '';
            var impersonationUser =      row['users_user']      != null ? row['users_user'] : '';
            var impersonationPassword =  row['users_password']  != null ? row['users_password'] : '';

            // check if we should take details from organization level or user level
            if (row['orgs_serverurl'] != null && row['orgs_serverurl'].length > 0)
            {
                // take data from organization level
                serverURL =              row['orgs_serverurl']  != null ? row['orgs_serverurl'] : '';
                authType              =  row['orgs_authtype']   != null ? row['orgs_authtype'] : '';

            } else {
                // take data from user level
                serverURL =              row['users_serverurl'] != null ? row['users_serverurl'] : '';
                authType              =  row['users_authtype']  != null ? row['users_authtype'] : '';
            }

            // check again that details exist
            if (serverURL.length <= 0 || impersonationUser.length <= 0 || impersonationPassword.length <= 0) {
                msg = 'No Data. Unable to find EWS details for user ' + emailAddress + ' and org ' + mainDomain;
            } else {
                // remove http/https from server URL if exist
                if (serverURL.indexOf('://') >= 0) {
                    serverURL = serverURL.substr(serverURL.indexOf('://')+3)
                }

                // build return object
                details = {
                        serverURL : serverURL,
                        userName  : userName,
                        impersonationUser : impersonationUser,
                        impersonationPassword : Common.dec(impersonationPassword), // decode the password
                        emailAddress : email,
                        mainDomain : domain,
                        subscriptionID : subscriptionID,
                        subscriptionDate : subscriptionUpdatedate,
                        sendNotifInd : sendNotifInd,
                        authType : authType
                    };
            }
            callback(msg,details);
        }
    }).catch(function(err) {
        callback(err,null);
    });
}

/*
 * get user details by its subscription id to EWS
 */
function getUserDetailsBySubscriptionID(subscriptionID, callback) {
    Common.db.User.findAll({
        attributes : ['email', 'orgdomain'],
        where : {
            subscriptionid : subscriptionID
        },
    }).complete(function(err, results) {
        if (!!err) {
            // general error with database
            callback('Error on get user details by subscription ' + subscriptionID + ', error is: '+ err, null);
        } else if (!results || results == "" || results.length <= 0) {
            // goes here if we don't find this profile in the database
            callback('Cannot find user by subscription : ' + subscriptionID, null);
        } else {
            // gets all data of the required profile, should be only one row
            var email = results[0].email != null ? results[0].email : '';
            var domain = results[0].orgdomain != null ? results[0].orgdomain : '';

            details = {
                emailAddress : email,
                mainDomain : domain
            };
            callback(null,details);
        }
    });
}

/*
 * update keep alive and subscription ID to EWS for user
 */
function updateSubscriptionForUser(emailAddress, subscriptionID,callback) {
    Common.db.User.update({
        subscriptionid : subscriptionID,
        subscriptionupdatedate : new Date()
    }, {
        where : {
            email : emailAddress
        }
    }).then(function() {
        // do nothing
        callback(null);
    }).catch(function(err) {
        // callback error message
        callback('Function - updateSubscriptionForUser, Error on updating subscription details on profile: ' + emailAddress + ', error is:' +  err);
    });
}

/*
 * update keep alive interval for subscription ID
 */
function updateSubscriptionForSubscriptionID(subscriptionID, callback) {
    Common.db.User.update({
        subscriptionupdatedate : new Date()
    }, {
        where : {
            subscriptionid : subscriptionID
        }
    }).then(function() {
        // do nothing everything is OK
        callback(null);
    }).catch(function(err) {
        // callback error message
        callback('Function - updateSubscriptionForSubscriptionID, Error on updating subscription details on subscription id: ' + subscriptionID + ', error is:' +  err);
    });
}

/*
 * check if subscription id is exist and valid. If it's -1 it means we need to delete subscription for this subscription id
 */
function validateSubscriptionForUser(ewsDetails, callback) {
    if (ewsDetails['subscriptionID'] && ewsDetails['subscriptionID'] != null && ewsDetails['subscriptionID'] != '-1') {
        callback(null,'OK');
    } else {
        callback(null,'Unsubscribe');
    }
}

/*
 * Method to get EWS details for user by email and domain OR by subscription ID (2 options that effect the query, later the logic is the same)
 */
function getCalendarSyncUsers(callback) {

    var query = " select user_application_notifs.sendnotif as send_notif_ind, " +
                "      users.email as users_email, " +
                "      users.username as users_mainusername, " +
                "      users.orgdomain as users_maindomain, " +
                "      users.serverurl as users_serverurl, " +
                "      users.orguser as users_user, " +
                "      users.orgpassword as users_password, " +
                "      orgs.serverurl as orgs_serverurl, " +
                "      orgs.impersonationuser as orgs_user, " +
                "      orgs.impersonationpassword as orgs_password " +
                " from users " +
                " inner join orgs on orgs.maindomain = users.orgdomain " +
                " left outer join user_application_notifs on (user_application_notifs.maindomain = orgs.maindomain and user_application_notifs.email = users.email and appname =:appname) " +
                " where users.subscriptionid is not null and users.subscriptionid != '-1' and users.subscriptionid != '' and users.isactive = 1 and (orgs.authtype = 1 or (orgs.authtype = 0 and users.authtype = '1')) and (user_application_notifs.sendnotif is null or user_application_notifs.sendnotif = 1) ";

    var queryParams = {appname : APPLICATION_NAME_CALENDAR};
    
    var calendarSyncUsers = new Array();
    
    // get details and build return object
    Common.sequelize.query(query, null, {raw: true},queryParams).then(function(results) {
        if (!results || results == "" || results.length <= 0) {
            callback('No users need to sync calendar events',null);
        } else {
            // run on all services and run them
            results.forEach(function(row) {
                // variables for later use
                var details;
                var serverURL;
                var authType;

                // gets all data of the required profile
                var email =                  row['users_email']            != null ? row['users_email'] : '';
                var domain =                 row['users_maindomain']       != null ? row['users_maindomain'] : '';

                // login details
                var userName =               row['users_user']      != null ? row['users_user'] : '';
                var impersonationUser =      row['users_user']      != null ? row['users_user'] : '';
                var impersonationPassword =  row['users_password']  != null ? row['users_password'] : '';

                // main user name
                var mainUserName =  row['users_mainusername']  != null ? row['users_mainusername'] : '';

                // check if we should take details from organization level or user level
                if (row['orgs_serverurl'] != null && row['orgs_serverurl'].length > 0)
                {
                    // take data from organization level
                    serverURL =              row['orgs_serverurl']  != null ? row['orgs_serverurl'] : '';
                } else {
                    // take data from user level
                    serverURL =              row['users_serverurl'] != null ? row['users_serverurl'] : '';
                }

                // remove http/https from server URL if exist
                if (serverURL.indexOf('://') >= 0) {
                    serverURL = serverURL.substr(serverURL.indexOf('://')+3)
                }

                // build return object
                details = {
                    serverURL : serverURL,
                    userName  : userName,
                    impersonationUser : impersonationUser,
                    impersonationPassword : Common.dec(impersonationPassword), // decode the password
                    emailAddress : email,
                    mainDomain : domain,
                    mainUserName : mainUserName
                };
                calendarSyncUsers.push(details);
            });
            callback(null,calendarSyncUsers);
        }
    }).catch(function(err) {
        callback(err,null);
    });
}

/*
 * Execute authorized requsest EWS server
 * Parameters:
 *   cred - object describe user
 *     user, password, pfx, passphrase
 *   reqParams - object descibe EWS server and connection
 *     host, path, soTimeout
 *   reqData - string of request body
 *   callback(err, resData) - callback function
 */
function doAuthorizedRequest(cred, reqParams, reqData, callback) {
    if(Common.EwsAuthorizationMethod ==="NTLM") {
        doNtlmAuthorizedRequest(cred, reqParams, reqData, callback);
    } else {
        doBasicAuthorizedRequest(cred, reqParams, reqData, callback);
    }
}

function doBasicAuthorizedRequest(cred, reqParams, reqData, callback) {
    async.waterfall([
            //Define user credentials
            function(callback) {
                var postRequest = {
                    host : reqParams.host,
                    path : reqParams.path,
                    method : "POST",
                    rejectUnauthorized : false,
                    headers : {
                        'Content-Type' : 'text/xml; charset=utf-8',
                        'Content-Length' : reqData.length
                    },
                };
                if(cred.password) {
                    var authorizationString;
                    if(cred.domain) {
                        authorizationString = cred.domain + "\\" + cred.user + ':' + cred.password;
                    } else {
                        authorizationString = cred.user + ':' + cred.password;
                    }
                    postRequest.headers.Authorization = 'Basic ' + new Buffer(authorizationString).toString('base64');
                }
                if(cred.passphrase) postRequest.passphrase = cred.passphrase;
                if(cred.pfx) {
                    postRequest.pfx = cred.pfx;
                    fs.readFile(cred.pfx, function(err, data) {
                        if(err) {
                            logger.error("Cannot read certificate file " + cred.pfx + " err: " + err);
                        } else {
                            postRequest.pfx = data;
                        }
                        callback(err, postRequest);
                    });
                } else {
                    callback(null, postRequest);
                }
            },
            //Do request
            function(postRequest, callback) {
                var buffer = "";
                var callbackDone = false;
                // define the request and handle response
                var newRequest = https.request(postRequest, function(newResponse) {
                    var resParams = {
                        statusCode: newResponse.statusCode
                    };
                    newResponse.on("data", function(data) {
                        buffer = buffer + data;
                    });
                    newResponse.on("end", function() {
                        if(!callbackDone) {
                            callbackDone = true;
                            callback(null, buffer, resParams);
                        }
                    });
                });
                // handle error on request to Exchange
                newRequest.on('error', function(err) {
                    if (newRequest) { newRequest.abort(); }
                    if(!callbackDone) {
                        callbackDone = true;
                        callback('General Error in EWS listener request err:' + err,null);
                    }
                });
                // set timeout on the connection
                if(reqParams.soTimeout) {
                    newRequest.on('socket', function(socket) {
                        socket.setTimeout(reqParams.soTimeout);
                        socket.on('timeout', function() {
                            newRequest.abort();
                            if(!callbackDone) {
                                callbackDone = true;
                                callback('timeout',null);
                            }
                        });
                    });
                }

                // write body content to request
                newRequest.write(reqData);

                // end request
                newRequest.end();
            }
        ],
        callback
    );
}

function doNtlmAuthorizedRequest(cred, reqParams, reqData, callback) {
    var reqOptions = {
        url: "https://" + reqParams.host + reqParams.path,
        username: cred.user,
        password: cred.password,
        domain: cred.domain,
        timeout: reqParams.soTimeout,
        headers : {
            'Content-Type' : 'text/xml; charset=utf-8',
            'Content-Length' : reqData.length
        },
        body: reqData
    };
    httpntlm.post(
        reqOptions,
        function (err, res){
            callback(err, res ? res.body : null, res);
        }
    );
}

var EWSUtils = {
    'validateSubscriptionForUser' : validateSubscriptionForUser,
    'updateSubscriptionForSubscriptionID' : updateSubscriptionForSubscriptionID,
    'updateSubscriptionForUser' : updateSubscriptionForUser,
    'getUserDetailsBySubscriptionID' : getUserDetailsBySubscriptionID,
    'getEWSDetails' : getEWSDetails,
    'getCalendarSyncUsers' : getCalendarSyncUsers,
    doAuthorizedRequest: doAuthorizedRequest
};

module.exports = EWSUtils;
