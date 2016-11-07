"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var crypto = require('crypto');
var util = require('util');
var User = require('./user.js');
var querystring = require("querystring");
var Template = require('./template.js');
var Geo = require('./geo.js');
var MailingList = require('./mailingList.js').MailingList;
var Track = require('./track.js');
var ThreadedLogger = require('./ThreadedLogger.js');
var eventLog = require('./eventLog.js');
var smsNotification = require('./SmsNotification.js');
var internalRequests = require('./internalRequests.js');

// Event log Const
var EV_CONST = eventLog.EV_CONST;
var EV_CREATE_PLAYER = EV_CONST.EV_CREATE_PLAYER;
var INFO = EV_CONST.INFO;

var EMAIL_SIZE = 255;

function createLogEvents(deviceid, email, domain, firstName, lastName, regid, creationData, deviceType, activationKey, callback) {
    var eventtype = EV_CREATE_PLAYER;
    var extra_info = 'email:' + email + ' firstName:' + firstName + ' lastName:' + lastName
        + ' regid:' + regid + ' creationData:' + creationData + ' deviceType:' + deviceType
        + ' activationKey:' + activationKey;

    // Create event in Eventlog
    eventLog.createEvent(eventtype, email, domain, extra_info, INFO, function(err) {
        logger.error(err);
        callback(null);
    });
}

function returnInternalError(err, res) {
    var status = 3;
    // internal error
    var msg = "Internal error";
    if (err != null) {
        msg += ", " + err;
    }
    logger.info(msg);
    if (res != undefined) {
        res.send({
            status : status,
            message : msg
        });
    }
    return;
}

function validateEmail(email) {
    // http://stackoverflow.com/a/46181/11236
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (email.length > EMAIL_SIZE) {
        return false;
    }
    return re.test(email);
}

function registerOrg(req, res, next) {
    var logger = new ThreadedLogger();
    var msg = "";
    var status = 0;
    //ok
    var secret = req.params.secret;
    if (secret != Common.registerOrgPassword) {
        status = 1;
        msg = "Invalid secret";
    }
    var first = req.params.first;
    if (!first || first == "") {
        status = 1;
        msg = "Invalid first name";
    }
    var last = req.params.last;
    if (!last || last == "") {
        status = 1;
        msg = "Invalid last name";
    }
    var email = req.params.email;
    if (!email || !validateEmail(email)) {
        status = 1;
        msg = "Invalid email";
    }
    logger.user(email);
    var domain = req.params.domain;
    if (!domain || domain == "") {
        status = 1;
        msg = "Invalid domain";
    }

    if (status != 0) {
        res.send({
            status : status,
            message : msg
        });
        return;
    }
    internalRequests.createDomainForUser(domain, logger, function(err) {
        if (err) {
        	logger.error("Internal error, error is: " + err);
            status = 1;
            msg = "Internal error";
            res.send({
                status : status,
                message : msg
            });
            return;
        }

        var params = {
            first : first,
            last : last,
            email : email,
            domain : domain

        };

        // send ok status
        res.send({
            status : 0,
            message : "OK"
        });

        var html = Template.getTemplate("./emailTemplates", "trialWelcome.html", params);

        // send email to us
        var mailOptions = {
            from : "anat.l@nubosoftware.com",
            // sender address
            fromname : "Anat Litan",
            to : email,
            // list of receivers
            toname : first + " " + last,
            bcc : "israel@nubosoftware.com",
            subject : "Your Nubo Trial is Ready",
            // Subject line
            html : html
        };
        logger.info("Before send message");
        Common.mailer.send(mailOptions, function(success, message) {
            if (!success) {
                logger.info("sendgrid error: " + message);
            } else {

            }
        });

    });

}

function activate(req, res, next) {
    // https://login.nubosoftware.com/activate?deviceid=[deviceid]&email=[email]&first=[first]&last=[last]&title=[title]&signature=[signature]
    var logger = new ThreadedLogger();
    res.contentType = 'json';

    var emailReq = req.params.email;
    if (Common.withService) {
        if (emailReq == undefined) {
            execActivate(req, res, next, emailReq, emailReq);
        } else {
            //email is actually username.
            //retreive email from users table
            Common.db.User.findAll({
                attributes : ['email'],
                where : {
                    username : emailReq
                },
            }).complete(function(err, results) {

           	 	if (!!err) {
           	 		logger.error("activate. Error on get email from username: " + emailReq + ", err: "+err);
           	 		returnInternalError("Internal error, please contact administrator", res);
           	 		return;
           	 	}
        		  
           	 	if (!results || results == "") {
           	 		logger.error("activate. Error on get email from username. Could not find username: " + emailReq + ", err: "+err);
           	 		returnInternalError("Activation failed, wrong user name or activation details", res);
           	 		return;
           	 	}
        		  
           	 	if (results.length > 1) {
           	 		logger.error("activate. Error on get email from username. Found more than one username: " + emailReq + ", err: "+err);
           	 		returnInternalError("Activation failed, can not validate user details", res);
           	 		return;
           	 	}

                results.forEach(function(row) {
                    execActivate(req, res, next, row.email, emailReq);
                });
            });
        }
    } else {
        execActivate(req, res, next, emailReq, null);
    }
}

function execActivate(req, res, next, email, username) {
    var msg = "";
    var status = 100;

    //read and validate params
    var deviceid = req.params.deviceid;
    if (deviceid == undefined || deviceid.length < 5) {
        status = 1;
        // invalid parameter
        msg = "Invalid device ID";
    }

    var imsi = req.params.imsi;

//    var email = req.params.email;
    if (email == undefined || !validateEmail(email)) {
        status = 1;
        // invalid parameter
        msg = "Invalid email address";
    }

    var deviceName = req.params.deviceName;
    if (deviceName == undefined || deviceName == '') {
        deviceName = "unknown";
    }
    var first = undefined, last = undefined, title = undefined;
    var alreadyUser = req.params.alreadyUser;
    if (alreadyUser != 'Y') {
        first = req.params.first;
        if (first == undefined || first.length < 1) {
            status = 1;
            // invalid parameter
            msg = "Invalid first name";
        }
        last = req.params.last;
        if (last == undefined || last.length < 1) {
            status = 1;
            // invalid parameter
            msg = "Invalid last name";
        }
        title = req.params.title;
        if (title == undefined || title.length < 1) {
            status = 1;
            // invalid parameter
            msg = "Invalid job title";
        }
    }

    // this line will ensure that we'll check that user already exist in our DB and only imported users from AD are allowed to enter
    if (Common.allowOnlyImportedADusers) {
        alreadyUser = 'Y';
    }

    var deviceType = req.params.deviceType;
    if (deviceType == undefined || deviceType.length < 1)
        deviceType = 'Android';

    var silentActivationStr = req.params.silentActivation;
    var silentActivation = false;
    if (silentActivation == 'Y')
        silentActivation = true;

    var clientIP = req.realIP;

    var plain="";
    var hmac = crypto.createHmac("sha1", '1981abe0d32d93967648319b013b03f05a119c9f619cc98f');
    if (Common.withService) {
        if (username != undefined) {
            plain = username + '_' + deviceid;
        }
    } else {
        plain = email + '_' + deviceid;
    }

    hmac.update(plain);
    var signatureconf = hmac.digest("hex");
    logger.info(util.format('Signature of %s is %s', plain, signatureconf));
    logger.info("Before params...");
    var signature = req.params.signature;
    if (signature == undefined || signature.length < 1 || signature != signatureconf) {
        status = 1;
        // invalid parameter
        msg = "Invalid signature";
        logger.info("signature err: " + msg);
    }
    logger.info("before regid ");
    var regid = req.params.regid;
    logger.info("reg id before if: " + regid);
    if (regid == undefined || regid.length < 1) {
        logger.info("reg id err");
        status = 1;
        // invalid parameter
        msg = "invalid reg id";
        logger.info("reg id err: " + msg);
    }

    logger.info("after regid ");

    if (status == 1) {
        logger.info("Error in activation:" + msg);
        res.send({
            status : status,
            message : msg,
        });

        return;
    }

    logger.info("After params...");

    if (Common.orgRedirectionMap) {

        var emailDomain;
        User.getUserDomain(email, function (orgDomainFromDB ) {
            if (orgDomainFromDB)
                emailDomain = orgDomainFromDB;
            else
                emailDomain = email.substr(email.indexOf('@') + 1);

            var redirect = Common.orgRedirectionMap[emailDomain];
            if (redirect && redirect != Common.serverurl) {
                msg = "Redirecting user from " + emailDomain + " to " + redirect;
                logger.info(msg);
                status = Common.STATUS_CHANGE_URL;
                res.send({
                    status : status,
                    message : msg,
                    mgmtURL : redirect
                });
                return;
            }
        });
    }

    var processActivation = function() {

        // mark old activation from the same device as invalid

        /*
        Common.db.Activation.findAll({
        attributes : ['deviceid', 'activationkey', 'status'],
        where : {
        deviceid : deviceid
        },
        }).complete(function(err, results) {

        if (!!err) {
        returnInternalError(err);
        return;
        }

        results.forEach(function(row) {
        if (row.status == 0) {
        var oldActivationKey = row.activationkey;
        logger.info("Found old activation: " + oldActivationKey);

        Common.db.Activation.update({
        status : '2'
        }, {
        where : {
        activationkey : oldActivationKey
        }
        }).then(function() {

        }).catch(function(err) {
        logger.info(err);
        res.send({
        status : '0',
        message : "Internal error: " + err
        });
        return;
        });

        } // id
        });
        });*/

        // generate activation key
        Common.crypto.randomBytes(48, function(ex, buf) {
            var token = buf.toString('hex');
            Common.crypto.randomBytes(48, function(ex, buf) {
                var emailtoken = buf.toString('hex');
                logger.info("token: " + token);

                // set creation date of the activation link
                var currentDate = new Date();

                // build expiration date 48 hours from creation date (make it settings later on)
                logger.info('Activation Timeout Period:' + Common.activationTimeoutPeriod);
                var expirationDate = new Date();
                expirationDate.setHours(expirationDate.getHours() + Common.activationTimeoutPeriod);

                // logger.info('Activation expirationDate:' + expirationDate.getHours());
                var domainEmail;
                User.getUserDomain(email, function (orgDomainFromDB ) {
                    if (orgDomainFromDB) {
                        domainEmail = orgDomainFromDB;
                    } else {
                        domainEmail = email.substr(email.indexOf('@') + 1);
                    }
                 // insert activationKey row to db
                    Common.db.Activation.create({
                        activationkey : token,
                        deviceid : deviceid,
                        status : 0,
                        email : email,
                        firstname : first,
                        lastname : last,
                        jobtitle : title,
                        emailtoken : emailtoken,
                        pushregid : regid,
                        firstlogin : 1,
                        resetpasscode : 0,
                        devicetype : deviceType,
                        createdate : currentDate,
                        expirationdate : expirationDate,
                        maindomain : domainEmail
                    }).then(function(results) {

                        // Create events in Eventlog
                        createLogEvents(deviceid, email, domainEmail, first, last, regid, currentDate, deviceType,token, function(err) {
                            if (err) {
                                logger.info('createLogEvents error:' + err);
                            }
                        });

                        logger.info("Added activation " + token);
                        status = 0;
                        msg = "Activation link has been sent";
                        res.send({
                            status : status,
                            activationKey : token,
                            message : msg
                        });

                        // declaration
                        var emailDomain;

                        // check if device exist
                        Common.db.UserDevices.findAll({
                            attributes : ['email', 'imei', 'active', 'devicename'],
                            where : {
                                email : email,
                                imei : deviceid
                            },
                        }).complete(function(err, results) {

                            if (!!err) {
                                returnInternalError(err, res);
                                return;

                            }

                            User.getUserDomain(email, function (orgDomainFromDB ) {
                                if (orgDomainFromDB) {
                                    emailDomain = orgDomainFromDB;
                                } else {
                                    emailDomain = email.substr(email.indexOf('@') + 1);
                                }
                                if (!results || results == "") {
                                    var isActive = 1;

                                    //by default when user do activate the device is active.
                                    Common.db.UserDevices.create({
                                        imei : deviceid,
                                        imsi : imsi,
                                        email : email,
                                        devicename : deviceName,
                                        active : isActive,
                                        maindomain : emailDomain,
                                        inserttime : new Date()
                                    }).then(function(results) {
                                        logger.info("user_devices created: device " + deviceid + " added to user: " + email);

                                    }).catch(function(err) {
                                        returnInternalError(err, res);
                                        return;
                                    });
                                    
                                } else {
                                    Common.db.UserDevices.update({
                                        imsi : imsi,
                                        inserttime : new Date()
                                    }, {
                                        where : {
                                            email : email,
                                            imei : deviceid
                                        }
                                    }).then(function() {
                                        logger.info("user_devices exist updated: device " + deviceid + " added to user: " + email);
                                    }).catch(function(err) {
                                        returnInternalError(err, res);
                                        return;
                                    });
                                }
                                
                                var demoUserList = [];
                                if (Common.demoUserList) {
                                    demoUserList = Common.demoUserList;
                                }

                                if (Common.autoActivation || Common.withService || email == 'ios@nubo-demo.com' ||
                                   (demoUserList.indexOf(email) > -1)) {
                                    var newreq = {
                                        params : {
                                            token : emailtoken
                                        },
                                        connection : {}
                                    };
                                    var newres = {
                                        send : function() {
                                            logger.info("Autoactivation: \n", arguments);
                                        }
                                    };
                                    require('./activationLink.js').func(newreq, newres, null);
                                    return;
                                }
                                
                                if (!silentActivation) {
                                    Common.db.Orgs.findAll({
                                        attributes : ['notifieradmin','deviceapprovaltype'],
                                        where : {
                                            maindomain : emailDomain
                                        },
                                    }).complete(function(err, results) {
                                        if (!!err) { // error on fetching org
                                            logger.error('Error on get orgs details for ' + emailDomain +', error: ' + err);
                                        } else { // get org details and act accordingly
                                            var row;
                                            if (results.length === 0) {
                                                row = {
                                                    notifieradmin: "",
                                                    deviceapprovaltype: 0
                                                }
                                            } else {
                                                row = results[0];
                                            }
                                            var notifieradmin = row.notifieradmin != null ? row.notifieradmin : '';
                                            var deviceapprovaltype = row.deviceapprovaltype != null ? row.deviceapprovaltype : 0;
                                            
                                            var senderEmail = "support@nubosoftware.com";
                                            var senderName = "Nubo Support";
                                            
                                            // define to recepient and subject based on device approval type
                                            var toEmail = '';
                                            var emailSubject = '';
                                            var toName = '';
                                            if (deviceapprovaltype == 0) { // default behavior, user approve himself
                                                toEmail = email;
                                                emailSubject = 'Create a Player';
                                                toName = first + " " + last;
                                            } else if (deviceapprovaltype == 1) { // manually only by admin
                                                toEmail = notifieradmin;
                                                emailSubject = 'Create a Player for ' + first + ' ' + last;
                                                toName = notifieradmin;
                                            } else if (deviceapprovaltype == 2) { // both for admin and user
                                                toEmail = [notifieradmin,email];;
                                                emailSubject = 'Create a Player for ' + first + ' ' + last;
                                                toName = '';
                                            }
                                            
                                            var activationLinkURL = Common.serverurl + "html/player/login.html#activationLink/" + encodeURIComponent(emailtoken) + "/" + encodeURIComponent(email);
                                            logger.info("Activation Link: " + activationLinkURL);

                                            // setup e-mail data with unicode symbols
                                            var mailOptions = {
                                                from : senderEmail,
                                                // sender address
                                                fromname : senderName ,
                                                to : toEmail,
                                                // list of receivers
                                                toname : toName,
                                                subject : emailSubject,
                                                // Subject line
                                                text : "Dear " + first + " " + last + ", \nClick the following link to connect to your working environment, and then continue working from your mobile device.\n\n" + activationLinkURL + "\n\n- The Nubo Team",
                                                // plaintext body
                                                html : "<p>Dear " + first + " " + last + ",</p><p> \nClick the following link to connect to your working environment, and then continue working from your mobile device.</p>\n\n" + "<p><a href=\"" + activationLinkURL + "\">" + first + " " + last + " – Player Activation</a></p>  \n\n<p>- The Nubo Team</p>" // html body
                                            };
                                            
                                            Common.mailer.send(mailOptions, function(success, message) {
                                                if (!success) {
                                                    logger.info("sendgrid error: " + message);
                                                } else {

                                                }
                                            });

                                            // send SMS only if user can approve himself
                                            if (Common.activateBySMS && (deviceapprovaltype == 0 || deviceapprovaltype == 2)) {
                                                Common.db.User.findAll({
                                                    attributes : ['mobilephone'],
                                                    where : {
                                                        email : email,
                                                    },
                                                }).complete(function(err, results) {
                                                    if (!!err) {
                                                        status = 1;
                                                        msg = "Internal Error: " + err;
                                                        logger.info("reset passcode find user by email error: " + msg);
                                                    } else if (!results || results == "") {
                                                        status = 1;
                                                        msg = "Cannot find user " + login.getUserName();
                                                        logger.info("reset passcode find user by email error, " + msg);
                                                    } else {
                                                        var mobilePhone = results[0].mobilephone != null ? results[0].mobilephone : '';

                                                        // some validation on mobile phone even they are coming from the data base
                                                        if (mobilePhone != null && mobilePhone.length > 0 && mobilePhone.length < 20) {
                                                            smsNotification.sendSmsNotificationInternal(mobilePhone,'Click your Nubo activation link ' + activationLinkURL, function(message, status) {
                                                                logger.info(message);
                                                            });
                                                        }
                                                    }
                                                });
                                            }

                                            if (Common.mailChimpAPIKey) {
                                                var mailingList = new MailingList();
                                                mailingList.subscribe(email, first, last, clientIP);
                                            }
                                        }
                                    });
                                    
                                    
                                   

                                    var appid = deviceid + "_" + token;

                                    Track.trackAPI({
                                        customAppID : appid,
                                        customSessID : appid,
                                        type : 'Activation request',
                                        appType : 'Nubo',
                                        ip : clientIP,
                                        userParams : {
                                            email : email,
                                            firstname : first,
                                            lastname : last,
                                            title : title
                                        },
                                        other : {
                                            dcname : Common.dcName,
                                            devicetype : deviceType,
                                            alreadyuser : alreadyUser,
                                            deviceid : deviceid
                                        }
                                    });

                                    if (Common.isGeoIP == true) {
                                        Common.geoip.lookup(clientIP, function(err, data) {
                                            if (!err) {
                                                logger.info("Country: " + data.countryCode);
                                                var geoipInfo = data;
                                                var params = {
                                                    name : first + " " + last,
                                                    email : email,
                                                    title : title,
                                                    devicetype : deviceType,
                                                    deviceid : deviceid,
                                                    geoipInfo : geoipInfo
                                                };

                                                var mailOptions = {
                                                    from : "support@nubosoftware.com",
                                                    // sender address
                                                    fromname : "Nubo Support",
                                                    to : Common.adminEmail,
                                                    // list of receivers
                                                    toname : Common.adminName,
                                                    subject : (Common.dcName != "" ? Common.dcName + " - " : "") + "Player Activation - " + email + ( geoipInfo ? ' [' + geoipInfo.countryCode + ']' : ''),
                                                    // Subject line
                                                    text : JSON.stringify(params, null, 2)
                                                };

                                                mailOptions.html = mailOptions.text.replace(/\n/g, "<br />");

                                                Common.mailer.send(mailOptions, function(success, message) {
                                                    if (!success) {
                                                        //logger.info("sendgrid error: "+message);
                                                    } else {
                                                        //logger.info("Message sent to "+email);
                                                    }

                                                });
                                                //Common.mailer.send

                                            } else {
                                                logger.info("GeoIP Error: " + err);
                                            }
                                        });
                                        // Common.geoip.lookup
                                    }
                                }
                            });
                        });
                    }).catch(function(err) {
                        returnInternalError(err, res);
                        return;
                    });
                });
            });
        });
    };

    function checkRedirection() {
        if (Common.isGeoIP == true && Common.countryRedirectionMap) {
            Geo.lookup(clientIP, function(err, data) {
                if (!err && data) {
                    redirect = Common.countryRedirectionMap[data.countryCode];
                    if (redirect && redirect != Common.serverurl) {
                        // need to redirect user no another server based on geographic location
                        msg = "Redirecting user from " + data.countryCode + " to " + redirect;
                        logger.info(msg);
                        status = Common.STATUS_CHANGE_URL;
                        res.send({
                            status : status,
                            message : msg,
                            mgmtURL : redirect
                        });
                        return;
                    } else {
                        processActivation();
                    }
                } else {
                    processActivation();
                }
            });
        } else {
            processActivation();
        }
    }

    if (alreadyUser == 'Y') {

        Common.redisClient.get('activate_ip_' + clientIP, function(err, obj) {
            if (err) {
                logger.info("Activate erorr in get activate_ip_: " + err);
                res.send({
                    status : 3,
                    message : "Activate error in get activate_ip"
                });
                return;
            }
            var attmpts = Number(obj);

            // disable too many attempts in case of load balancer in front
            if (Common.disableIPBlockMechanism) {
            	attmpts = 0;
            }

            if (attmpts >= 3) {
                logger.info("Activate too many already user attmepts for ip: " + clientIP);
                res.send({
                    status : 3,
                    message : "Activate too many already user attempts"
                });
                return;
            }
            attmpts++;
            User.getUserDetails(email, function(err, cfirstname, clastname, cjobtitle) {
                if (err) {
                    Common.redisClient.setex('activate_ip_' + clientIP, 3600, attmpts, function(err) {
                        logger.info("Email not found: " + email);
                        res.send({
                            status : 1,
                            message : "Email not found",
                        });
                    });
                    return;
                }
                first = cfirstname;
                last = clastname;
                title = cjobtitle;
                logger.info("alreadyUser. first:" + first);
                checkRedirection();

            });

        });

    } else {
        logger.info("processActivation. email: " + email);
        /*User.checkUserDomain(email, function(err, domain) {
         if (err) {
         logger.info("Activation company not found for domain " + domain);
         res.send({
         status: 2,
         message: "Company not found"
         });
         return;
         }
         checkRedirection();
         });*/
        checkRedirection();
    }

}

var Activate = {
    func : activate,
    registerOrg : registerOrg
};

module.exports = Activate;
