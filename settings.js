"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var Login = require('./login.js');
var sessionModule = require('./session.js');
var Session = sessionModule.Session;
var setPasscode = require('./setPasscode.js');
var async = require('async');
var EWSUtils = require('./EWSUtils.js');
var EWSSubscription = require('./EWSSubscription.js');


var ourSecret = getMainSecretKey();

var isDebug = getDebugMode();

var Settings = {
    'changePasscode' : changePasscode,
    'checkPasscode' : checkPasscode,
    'setLanguage' : setLanguage,
    'setAccount' : setAccount,
    'getSessionDetails' : getSessionDetails,
    'getMainSecretKey' : getMainSecretKey,
    'loadLoginParamsFromSession' : loadLoginParamsFromSession,
    'loadAdminParamsFromSession' : loadAdminParamsFromSession,
    'getDebugMode' : getDebugMode,
    'changeExpiredPassword' : changeExpiredPassword,
    'setNotificationStatusForApp' : setNotificationStatusForApp,
    'getNotificationsStatusForAllApps' : getNotificationsStatusForAllApps,
    'getNotificationsStatusForAllAppsInternal' : getNotificationsStatusForAllAppsInternal
};

module.exports = Settings;

function getMainSecretKey() {
    return "chewbacca";
};

function getDebugMode() {
    return (Common.settingsDebugMode == undefined) ? false : Common.settingsDebugMode;
};

function getSessionDetails(req, res, next) {
console.log(req.url)
    var status = 1;
    var secret = req.params.secret;
    if (secret != ourSecret) {
        res.send({
            status : '0',
            message : "Invalid secret"
        });
        return;
    }
    var session = req.params.session;
    if (session == null || session.length < 5) {
        res.send({
            status : '0',
            message : "Invalid session"
        });
        return;
    }
    logger.info("getSessionDetails session " + session);
    new Session(session, function(err, obj) {
        if (err || !obj) {
            var msg = "Session does not exist. err:" + err;
            logger.info(msg);
            res.send({
                status : '0',
                message : "Cannot find session"
            });
            return;
        }
        var email = obj.params.email;
        logger.info("getSessionDetails mail " + email);

        Common.db.User.findAll({
            where : {
                email : email
            },
        }).complete(function(err, results) {

            if (!!err) {
                res.send({
                    status : '0',
                    message : "Internal error: " + err
                });
                return;
            }

            if (!results || results == "") {
                res.send({
                    status : '0',
                    message : "Cannot find user"
                });
                return;
            }

            logger.info("getSessionDetails results[0] " + results[0].email);
            var firstName = results[0].firstname != null ? results[0].firstname : '';
            var lastName = results[0].lastname != null ? results[0].lastname : '';
            var jobTitle = results[0].jobtitle != null ? results[0].jobtitle : '';
            var orgDomain = results[0].orgdomain != null ? results[0].orgdomain : '';
            var orgEmail = results[0].orgemail != null ? results[0].orgemail : email;
            logger.info("getSessionDetails " + firstName + " " + lastName + " " + jobTitle + " " + orgDomain + " " + orgEmail);
            var isAdmin = results[0].isadmin != null ? results[0].isadmin : 0;
            var orgEmail = results[0].orgemail != null ? results[0].orgemail : '';

            res.send({
                status : '1',
                message : "ok",
                firstName : firstName,
                lastName : lastName,
                jobTitle : jobTitle,
                orgDomain : orgDomain,
                isAdmin : isAdmin,
                email : email,
                orgEmail : orgEmail,
                deviceid : obj.params.deviceid
            });
            return;
        });

    });
    // new Session
}// function getSessionDetails

function changePasscode(req, res, next) {
    changeOrCheckPasscode('change', req, res, next);
}

function checkPasscode(req, res, next) {
    changeOrCheckPasscode('check', req, res, next);
}

function changeOrCheckPasscode(cmd, req, res, next) {
    //https://login.nubosoftware.com/settings/changePasscode?secret=[]&session=[]&curPasscode=[]&newPasscode=[
    var status = 1;
    var secret = req.params.secret;
    if (secret != ourSecret) {
        res.send({
            status : '0',
            message : "Invalid secret"
        });
        return;
    }
    var session = req.params.session;
    if (session == null || session.length < 5) {
        res.send({
            status : '0',
            message : "Invalid session"
        });
        return;
    }
    var curPasscode = req.params.curPasscode;
    if (curPasscode == null || curPasscode.length < 5) {
        res.send({
            status : '0',
            message : "Invalid curPasscode"
        });
        return;
    }
    if (cmd == 'change') {
        var newPasscode = req.params.newPasscode;
        if (setPasscode.validatePassword(newPasscode) == 0) {
            res.send({
                status : '0',
                message : "Invalid newPasscode"
            });
            return;
        }
    }
    new Session(session, function(err, obj) {
        if (err || !obj) {
            var msg = "Session does not exist. err:" + err;
            logger.info(msg);
            res.send({
                status : '0',
                message : "Cannot find session"
            });
            return;
        }
        //logger.info('Session found: '+JSON.stringify(obj,null,2));
        var email = obj.params.email;
        if (email == "demo@nubosoftware.com") {
            logger.info("changeOrCheckPasscode by demo:" + req.url);
            res.send({
                status : '0',
                message : "Demo user cannot change data in db"
            });
            return;
        }

        Common.db.User.findAll({
            attributes : ['passcode'],
            where : {
                email : email
            },
        }).complete(function(err, results) {

            if (!!err) {
                res.send({
                    status : '0',
                    message : "Internal error: " + err
                });
                return;
            }

            if (!results || results == "") {
                res.send({
                    status : '0',
                    message : "Cannot find user"
                });
                return;
            }

            var passCol = results[0].passcode;
            if (passCol == null || passCol.length < 1) {
                res.send({
                    status : '0',
                    message : "Cannot find passcode"
                });
                return;
            }
            var dbPasscode = Common.dec(passCol);
            if (dbPasscode != curPasscode) {
                res.send({
                    status : '0',
                    message : "Current passcode does not match"
                });
                return;
            }
            if (cmd != 'change') {
                res.send({
                    status : '1',
                    message : "Passcode is valid!"
                });
                return;
            }

            Common.db.User.update({
                passcodeupdate: new Date(),
                passcode : newPasscode
            }, {
                where : {
                    email : email
                }
            }).then(function() {
                res.send({
                    status : '1',
                    message : "Passcode changed successfully."
                });
                return;

            }).catch(function(err) {
                res.send({
                    status : '0',
                    message : "Internal error: " + err
                });
                return;
            });

        });

    });
    // new Session

}

var mkdirp = require('mkdirp');

function loadLoginParamsFromSession(req, res, callback) {
    // https://login.nubosoftware.com/settings/[command]?secret=[]&session=[]&...other
    // params

    var secret = req.params.secret;
    if (secret != ourSecret) {
        callback("Invalid secret");
        return;
    }
    var session = req.params.session;
    if (session == null || session.length < 5) {
        callback("Invalid session");
        return;
    }
    new Session(session, function(err, obj) {
        if (err || !obj) {
            var msg = "Session does not exist. err:" + err;
            logger.info(msg);
            callback(msg);
            return;
        }
        // logger.info('Session found: '+JSON.stringify(obj,null,2));
        var loginToken = obj.params.loginToken;

        new Login(loginToken, function(err, login) {
            if (err) {
                msg = "Invalid loginToken, err:" + err;
                callback(msg);
                return;
            }
            // console.dir(login.loginParams);
            callback(null, login);
        });
        // new Login
    });
    // new Session
}

function loadAdminParamsFromSession(req, res, callback) {
    loadLoginParamsFromSession(req, res, function(err, login) {
        if (getDebugMode()) {
            callback(null, login);
        } else {
            if (login && login.loginParams.isAdmin != 1) {
                /*TODO: BUG: functions that use in that function request login object even in error case */
                callback("User is not admin", login);
            } else {
                callback(err, login);
            }
        }
    });
}

function setLanguage(req, res, next) {
    //https://login.nubosoftware.com/settings/setLanguage?secret=[]&session=[]&langCode=[]&countryCode=[]

    var langCode = req.params.langCode;
    if (langCode == null || langCode.length < 2) {
        res.send({
            status : '0',
            message : "Invalid langCode"
        });
        return;
    }
    var localevar = req.params.localevar;
    if (localevar == null) {
        localevar = '';
    }
    var countryCode = req.params.countryCode;
    if (countryCode == null || countryCode.length < 2) {
        res.send({
            status : '0',
            message : "Invalid countryCode"
        });
        return;
    }
    loadLoginParamsFromSession(req, res, function(err, login) {
        if (err) {
            res.send({
                status : '0',
                message : err
            });
            return;
        }
        var userName = login.getUserName();
        var deviceID = login.getDeviceID();
        var setLanguageValues = {
            langCode : langCode
        };
        var setCountryValues = {
            countryCode : countryCode
        };

        if (userName != "demo@nubosoftware.com") {

            Common.db.User.update({
                language : langCode, 
                countrylang : countryCode,
                localevar : localevar
            }, {
                where : {
                    email : userName
                }
            }).then(function() {
                res.send({
                    status : '1',
                    message : "Language changed successfully."
                });
                return;
            }).catch(function(err) {
                res.send({
                    status : '0',
                    message : "Internal error: " + err
                });
                return;
            });

        } else {
            res.send({
                status : '0',
                message : "Demo user does not change any data in DB"
            });
            logger.info("setLanguage by demo:" + req.url);
            return;
        }
    });
}





// Change expired password
// This function update 'firstlogin' to 1 (create startup.json)
// When a user login to Nubo with an expired password he will be prompted to change the password (login screen)

function changeExpiredPassword(req, res, next) {
    //https://login.nubosoftware.com/settings/changeExpiredPassword?secret=[]&session=[]
    logger.info("changeExpiredPassword. url:" + req.url);
    var session = req.params.session;
    if (session == null || session.length < 5) {
        res.send({
            status : '0',
            message : "Invalid session"
        });
        return;
    } else {
        var domain = req.params.domain;
        logger.debug("settings::changeExpiredPassword: domain= " + domain);
        loadLoginParamsFromSession(req, res, function(err, login) {
            if (err) {
                res.send({
                    status : '0',
                    message : err
                });
                return;
            }
            var registrationEmail = login.getUserName();
            if (registrationEmail == "demo@nubosoftware.com") {
                res.send({
                    status : '0',
                    message : "Demo user cannot change data in db"
                });
                logger.info("changeExpiredPassword by demo:" + req.url);
                return;
            } else {
                Common.db.Activation.update({
                    firstlogin : 1
                }, {
                    where : {
                        email : registrationEmail
                    }
                }).then(function() {
                    var Notification = require('./Notifications.js');
                    if (Common.withService) {
                        Notification.udpNotification(registrationEmail, "Email password has expired", " ", " ", -1, function(err) {
                            if (err) {
                                logger.error('ERROR::udpNotification:: ' + err);
                                res.send({
                                    status : '1',
                                    message : 'ERROR::udpNotification:: ' + err
                                });
                                return;
                            } else {
                                res.send({
                                    status : '1',
                                    message : "password changed successfully."
                                });
                                return;

                            }
                        });

                    } else {
                        Notification.GCMNotification(registrationEmail, "Your Email Password has Expired", " ", " ", -1, function(err) {
                            if (err) {
                                logger.error('ERROR::GCMNotification:: ' + err);
                                res.send({
                                    status : '1',
                                    message : 'ERROR::GCMNotification:: ' + err
                                });
                                return;
                            } else {
                                res.send({
                                    status : '1',
                                    message : "password changed successfully."
                                });
                                return;
                            }
                        });

                    }

                }).catch(function(err) {
                    res.send({
                        status : '0',
                        message : "Internal error: " + err
                    });
                    return;
                });

            }

        });
    }
}







function setAccount(req, res, next) {
    //https://login.nubosoftware.com/settings/addAccount?secret=[]&session=[]&accountType=[exchange/google]&email=[]&username=[]&password=[]&serverName=[]&serverPort=[]&secureSSL=[Y/N]&signature=[]

    //logger.info("setAccount. url:" + req.url); //contain password
    var accountType = req.params.accountType;
    if (accountType == null || accountType.length < 1 || (accountType != 0 && accountType != 1 && accountType != 2)) {
        res.send({
            status : '0',
            message : "Invalid accountType"
        });
        return;
    }
    var orgEmail = req.params.email;
    if (orgEmail == null || orgEmail.length < 2) {
        res.send({
            status : '0',
            message : "Invalid email"
        });
        return;
    }
    var username = req.params.username;
    if (username == null || username.length < 2) {
        res.send({
            status : '0',
            message : "Invalid user name"
        });
        return;
    }
    var password = req.params.password;
    if (password == null || password.length < 2) {
        res.send({
            status : '0',
            message : "Invalid password"
        });
        return;
    }
    var serverName = req.params.serverName;
    if (serverName == null || serverName.length < 2) {
        res.send({
            status : '0',
            message : "Invalid serverName"
        });
        return;
    }
    var serverPort = req.params.serverPort;
    if (serverPort == null || serverPort < 2) {
        res.send({
            status : '0',
            message : "Invalid serverPort"
        });
        return;
    }
    var secureSSL = req.params.secureSSL;
    if (secureSSL == null || secureSSL.length < 1 || (secureSSL != 0 && secureSSL != 1)) {
        res.send({
            status : '0',
            message : "Invalid secureSSL"
        });
        return;
    }
    var signature = req.params.signature;
    if (signature == null || signature.length < 2) {
        res.send({
            status : '0',
            message : "Invalid signature"
        });
        return;
    }

    var session = req.params.session;
    if (session == null || session.length < 5) {
        res.send({
            status : '0',
            message : "Invalid session"
        });
        return;
    }
    var domain = req.params.domain;
    logger.debug("settings::setAccount: domain= " + domain);

    // Bug: re-write orgdomain while user create email with domain...
    // Will discuss in more details in 'database structure' meeting

    /*
     if (domain == null || domain.length < 2) {
     //in case that the domain is invalid - we use the current domain.
     new Session(session, function(err, obj) {
     if (err || !obj) {
     var msg = "Session does not exist. err:" + err;
     logger.info(msg);
     res.send({
     status : '0',
     message : "Cannot find session"
     });
     return;
     }
     var email = obj.params.email;

     Common.db.User.findAll({
     attributes : ['orgdomain'],
     where : {
     email : email
     },
     }).complete(function(err, results) {

     if (!!err) {
     logger.error("ERROR:setAccount: can't get orgdomain.");
     }

     domain = results[0].orgdomain ? results[0].orgdomain : '';
     logger.debug("setAccount: The orgdomain is: " + domain);
     });

     });
     }*/

    loadLoginParamsFromSession(req, res, function(err, login) {
        if (err) {
            res.send({
                status : '0',
                message : err
            });
            return;
        }
        console.dir(login);
        var registrationEmail = login.getUserName();
        if (registrationEmail == "demo@nubosoftware.com") {
            res.send({
                status : '0',
                message : "Demo user cannot change data in db"
            });
            logger.info("setAccount by demo:" + req.url);
            return;
        }
        var deviceID = login.getDeviceID();
        var serverURL = 'https://' + serverName + (serverPort != 443 ? ':' + serverPort : '');
        var validateUsername = username;

        logger.info("Validate user name: " + validateUsername);
        var User = require('./user.js');
        User.validateAuthentication(login.getMainDomain(), registrationEmail, accountType, serverURL, domain, validateUsername, password, secureSSL, signature, function(err) {
            if (err) {
                logger.error("Error validateAuthentication failed: " + err);
                res.send({
                    status : '0',
                    message : err
                });
                return;
            }
            //if the account is valid than updateUserAccout
            //** The second parameter should be orgorgEmail. we use registrationEmail for visual reasons.
            User.updateUserAccount(registrationEmail, registrationEmail, accountType, serverURL, domain, username, password, secureSSL, signature, deviceID, true, false, function(err) {
                if (err) {
                    logger.error("Error updateUserAccount failed: " + err);
                    res.send({
                        status : '0',
                        message : err
                    });
                    return;
                }
                
                async.series([
                      function (callback) {
                          res.send({
                              status : '1',
                              message : 'Account of the user: ' + registrationEmail + ' changed to: ' + orgEmail
                          });              
                          callback(null);
                      },
                      
                      // register account to EWS services
                      function (callback) { 
                          
                          // only for Exchange
                          if (accountType == 1) {
                              EWSSubscription.subscribeProfileToEWS(registrationEmail, login.getMainDomain(), true, function (err) {
                                  if (err) {
                                      // log the error but don't fail the process
                                      logger.error("Problem setting EWS subscription: " + err);
                                      callback(null);
                                  } else {
                                      callback(null);
                                  }
                               });
                          } else {
                              callback(null);
                          }
                      }],
                      function (err) {
                          // log the error
                          logger.error(err);
                      }
                );
            });
            // updateUserAccount

        });
        // validateAuthentication
    });
    // loadLoginParamsFromSession
} // setAccount


function setNotificationStatusForApp(req, res, next) {
    //https://login.nubosoftware.com/settings/setNotificationStatusForApp?secret=[]&session=[]&appName=[]&notificationStatus=[]

    var appName = req.params.appName;
    if (appName == null || appName.length <= 0) {
        res.send({
            status : '0',
            message : "Invalid App Name"
        });
        return;
    }
    var notificationStatus = req.params.notificationStatus;
    if (notificationStatus == null || (notificationStatus != 0 && notificationStatus != 1)) {
        res.send({
            status : '0',
            message : "Invalid Notification Status"
        });
        return;
    }
    loadLoginParamsFromSession(req, res, function(err, login) {
        if (err) {
            res.send({
                status : '0',
                message : err
            });
            return;
        }
        var userName = login.getUserName();
        var mainDomain = login.getMainDomain();
        if (userName != "demo@nubosoftware.com") {
            
            Common.db.UserApplicationNotifs.findAll({
                attributes : ['appname','maindomain','email','sendnotif'],
                where : {
                    appname    : appName,
                    email      : userName,
                    maindomain : mainDomain
                },
            }).complete(function(err, results) {
                if (!!err) {
                    res.send({
                        status : '0',
                        message : "Internal error: " + err
                    });
                    return;

                }
                if (!results || results == "") {

                    // Insert new entry to database
                    Common.db.UserApplicationNotifs.create({
                        maindomain : mainDomain,
                        email : userName,
                        appname : appName,
                        sendnotif : notificationStatus
                    }).then(function(results) {
                        async.series([
                              function (callback) {
                                  res.send({
                                      status : '1',
                                      message : "Notification status was added successfully"
                                  });                   
                                  callback(null);
                              },
                              
                              function (callback) { 
                                  // remove notification, Email only
                                  if (appName == 'Email') {
                                      if (notificationStatus == 0) { 
                                          EWSUtils.updateSubscriptionForUser(userName, "-1", function (err) {
                                             if (err) {
                                                 callback(err);
                                             } else {
                                                 callback(null);
                                             }
                                          });
                                      } else {
                                          EWSSubscription.subscribeProfileToEWS(userName, mainDomain, true,  function (err) {
                                              if (err) {
                                                  callback(err);
                                              } else {
                                                  callback(null);
                                              }
                                           });                                      
                                      }
                                  } else {
                                      callback(null);
                                  }
                              }],
                              
                              function (err) {
                              }
                        );
                        return;
                    }).catch(function(err) {
                        res.send({
                            status : '0',
                            message : "can't create notification status for " + appName + ", error is:" + err
                        });
                        return;
                    });
                } else {
                    // update existing entry
                    Common.db.UserApplicationNotifs.update({
                        sendnotif : notificationStatus
                    }, {
                        where : {
                            maindomain : mainDomain,
                            email : userName,
                            appname : appName
                        }
                    }).then(function(results) {
                        async.series([
                              function (callback) {
                                  res.send({
                                      status : '1',
                                      message : "Notification status was updated successfully"
                                  });
                                  callback(null);
                              },
                              
                              function (callback) { 
                                  // remove notification,. Email only
                                  if (appName == 'Email') {
                                      if (notificationStatus == 0) {
                                          EWSUtils.updateSubscriptionForUser(userName, "-1", function (err) {
                                             if (err) {
                                                 callback(err);
                                             } else {
                                                 callback(null);
                                             }
                                          });
                                      } else {
                                          // if turned on, subscribeprofile to EWS (Exchange Web Services)
                                          EWSSubscription.subscribeProfileToEWS(userName, mainDomain, true, function (err) {
                                              if (err) {
                                                  callback(err);
                                              } else {
                                                  callback(null);
                                              }
                                           });                                      
                                      }
                                  } else {
                                      callback(null);
                                  }
                              }],
                              
                              function (err) {
                                    // do nothing, just print to log
                                    if (err) {
                                        logger.error("Error in updating notification settings:" + err);
                                    }
                              }
                        );
                        return;
                    }).catch(function(err) {
                        res.send({
                            status : '0',
                            message : "can't update notification status for " + appName + ", error is:" + err
                        });
                        return;
                    });
                }
            });

        } else {
            res.send({
                status : '0',
                message : "Demo user does not change any data in DB"
            });
            logger.info("setLanguage by demo:" + req.url);
            return;
        }
    });
}


/*
 * 
 */
function getNotificationsStatusForAllApps(req, res, next) {
    //https://login.nubosoftware.com/settings/getNotificationsStatusForAllApps?secret=[]&session=[]

    loadLoginParamsFromSession(req, res, function(err, login)  {
        if (err) {
            res.send({
                status : '0',
                message : err
            });
            return;
        }
        var userName = login.getUserName();
        var mainDomain = login.getMainDomain();
        
        getNotificationsStatusForAllAppsInternal(userName, function(errorMessage, appsNotifResponse) {
            if (err) {
                res.send({
                    status : '0',
                    message : "Internal error: " + err
                });
                return;                
            }
            res.write(appsNotifResponse);
            res.end('');
            return;
        });
        
    });
}

function getNotificationsStatusForAllAppsInternal(userName, callback) {
    var resCnt = 0;
    
    Common.db.UserApplicationNotifs.findAll({
        attributes : ['appname','maindomain','email','sendnotif'],
        where : {
            email      : userName
        },
    }).complete(function(err, results) {

        if (!!err) {
            callback(err);
            return;
        }
        var buffer = '{"status":"1","appsNotifStatus":[';
        results.forEach(function(row) {

            
            // get all values of current row
            var appName = row.appname != null ? row.appname : '';
            var sendNotif = row.sendnotif != null ? row.sendnotif : '';

            var jsonNotifApp = {
                    appName : appName,
                    sendNotif : sendNotif
            };

            // separates every jsonUser
            if (resCnt > 0) {
                buffer += ',';
            }
            
            resCnt += 1;
            
            buffer += JSON.stringify(jsonNotifApp);
            
        });
        
        buffer += ']}';
        console.log('APPS NAMES:' + buffer);
        callback(null,buffer);
        return;
    });
    
}

/*
 *
 Test functions
 */
/*
 loadSettingsUpdateFile("israel@nubosoftware.com","351554052156594",function (err,starupSettings) {
 if (err) {
 logger.info("Error: "+err);
 return;
 }
 console.dir(starupSettings);
 });

 var starupSettings = {};
 starupSettings.lang = "TEST";
 starupSettings.account = {'action' : 'add' , 'type' : 'google'};
 saveSettingsUpdateFile(starupSettings,"israel@nubosoftware.com","351554052156594",function (err) {
 if (err) {
 logger.info("Error: "+err);
 return;
 }
 logger.info("Successfully saved file");
 });*/

