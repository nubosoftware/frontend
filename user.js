"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var url = require('url');
var request = require('request');
var exec = require('child_process').exec;
var mkdirp = require('mkdirp');
var async = require('async');
var addExchangeNotify = require('./handleExchange.js');
var EWSUtils = require('./EWSUtils.js');
var NEW_USER_TAR = 'new_user.tar.gz';

var CERTIFICATE_FILE = 'cert.pfx';
var CERTIFICATE_DIRECTORY = 'certificate';
var DEFAULT_PASSWORD = '123456';

var AUTO_LOGIN_FILE = 'autoLogin';

function copyFile(src, dst, callback) {
    var reader = Common.fs.createReadStream(src);
    var writer = Common.fs.createWriteStream(dst);
    var isFinished = false;
    reader.pipe(writer);
    writer.on('finish', function() {
        logger.info("Finished writing to " + dst);
        if (!isFinished)
            callback(null);
    });
    writer.on('error', function(err) {
        logger.info("Error writing to " + dst + ": " + err);
        if (!isFinished) {
            isFinished = true;
            callback("Error writing to " + dst);
        }
    });
    reader.on('error', function(err) {
        logger.info("Error reading from " + src + ": " + err);
        if (!isFinished) {
            isFinished = true;
            callback("Error reading from " + src);
        }
    });
}

function createDomainForUser(domain, logger, callback) {
    //look for org with the same manin domain
    async.waterfall(
        [
            function(callback) {
                var defaults = {
                    authtype : '0',
                    orgname : '',
                    serverurl : '',
                    securessl : '1',
                    signature : ''
                }
                Common.db.Orgs.findOrCreate({
                    where : {
                        maindomain : domain
                    },
                    defaults: defaults
                }).complete(function(err, results) {
                    if (!!err) {
                        var msg = "Error while createUser while selecting main domain: " + err;
                        logger.error(msg);
                        callback(msg);
                    } else {
                        callback(null, results);
                    }
                });
            },
            function(results, callback) {
                if(results[1]) {
                    postNewOrgProcedure(domain, logger, function(err) {
                        callback(null, results);
                    });
                } else {
                    callback(null, results);
                }
            },
            function(results, callback) {
                var org_obj = results[0].dataValues;
                org_obj.maindomain = domain;
                org_obj.authtype = results[0].authtype != null ? results[0].authtype : '0';
                org_obj.orgname = results[0].orgname != null ? results[0].orgname : '';
                org_obj.serverurl = results[0].serverurl != null ? results[0].serverurl : '';
                org_obj.securessl = results[0].securessl != null ? results[0].securessl : '1';
                org_obj.signature = results[0].signature != null ? results[0].signature : '';
                org_obj.passcodeexpirationdays = results[0].passcodeexpirationdays || 0;
                org_obj.passcodeminchars = results[0].passcodeminchars || 6;
                org_obj.passcodetype = results[0].passcodetype || 0;
                callback(null, org_obj);
                // return existing domain settings
            }
        ], function(err, res) {
            if(err) {
                logger.error("createDomainForUser failed with err: " + err);
            }
            callback(err, res);
        }
    );
}

var attachToDomainDefaultApps = function(maindomain, logger, callback) {
    var nfsModule = require('./nfs.js');
    var apkModule = require('./apk.js');
    var uploadApkModule = require('./uploadAPK.js');
    async.waterfall(
        [
            function(callback) {
                var nfs;
                nfsModule(
                    {
                        nfs_idx: Common.nfsId
                    },
                    function(err, nfsobj) {
                        if (err) {
                            logger.warn("Cannot create nfs obect err: " + err);
                            nfs = {
                                params: {
                                    nfs_ip: "192.168.122.1",
                                    nfs_path: Common.nfshomefolder
                                }
                            };
                            callback(null, nfs);     // TODO: return err
                        } else {
                            nfs = nfsobj;
                            callback(null, nfs);
                        }
                    }
                );
            },
            function(nfs, callback) {
                var apkFiles = [];
                Common.defaultApps.forEach(function(packageName) {
                    apkFiles.push(nfs.params.nfs_path + "/apks/" + packageName + ".apk");
                });
                callback(null, apkFiles);
            },
            function(apkFiles, callback) {
                apkModule.parceFiles(apkFiles, function(err, packObjArr) {
                    if(apkFiles.length !== packObjArr.length) {
                        var msg = "Cannot find all packages";
                        logger.error(msg);
                        callback(msg, []);
                    }
                    callback(null, packObjArr);
                });
            },
            function(packObjArr, callback) {
                async.eachSeries(
                    packObjArr,
                    function(packObj, callback) {
                        uploadApkModule.update_apk_progress(
                            packObj["manifest"]["package"]["name"], packObj["manifest"]["package"]["versionName"],
                            packObj["manifest"]["package"]["versionCode"], maindomain,
                            packObj["manifest"]["application-label"], packObj["manifest"]["application-label"],
                            '0', 0, '',
                            function(err) {
                                if (err) {
                                    logger.error("update_apk_progress return err: ", err);
                                }
                                callback(err);
                            }
                        );
                    },
                    function(err) {
                        callback(err);
                    }
                );
            },
        ], function(err) {
            callback(err);
        }
    );
};

var postNewOrgProcedure = function(domain, logger, callback) {
    async.series(
        [
            function(callback) {
                var groupObj = {
                    groupname : "All",
                    maindomain : domain
                };
                require("./createGroup.js").createGroupInternal(groupObj, [], {logger: logger}, function(err) {
                    if(err) {
                        logger.error("createDomainForUser cannot create group All for new domain " + domain + " err: " + err);
                    }
                    callback(null);
                });
            },
            function(callback) {
                attachToDomainDefaultApps(domain, logger, function(err) {
                    callback(null);
                });
            },
            function(callback) {
                require("./installApps.js").addAppsToGroups(domain, [""], ["All"], Common.defaultApps, function(err) {
                    if(err) {
                        logger.error("createDomainForUser cannot install apps to group All for new domain " + domain + " err: " + err);
                    }
                    callback(null);
                });
            }
        ], function(err) {
            callback(err);
        }
    );
}

function createUser(regEmail, org_obj, logger, callback) {
    var domain = org_obj.maindomain;
    var authType = org_obj.authtype;
    var serverURL = org_obj.serverurl;
    var secureSSL = org_obj.securessl;
    var signature = org_obj.signature;

    //look if that user already exists
    logger.info("createUser %s %s %s %s %s %s ", regEmail, domain, serverURL, secureSSL, signature, authType);

    async.waterfall(
        [
            function(callback) {
                var defaults = {
                    username : regEmail,
                    orgdomain : domain,
                    passcode : '',
                    passcodeupdate: new Date(),
                    orgemail : regEmail,
                    orguser : '',
                    orgpassword : '',
                    serverurl : (org_obj.authType !== "0") ? org_obj.serverurl : serverURL,
                    securessl : (org_obj.authType !== "0") ? org_obj.serverssl : secureSSL.toString(),
                    signature : (org_obj.authType !== "0") ? org_obj.signature : signature,
                    authtype : (org_obj.authType !== "0") ? org_obj.authtype : authType.toString(),
                    loginattempts : 0,
                    isactive : 1,
                };
                Common.db.User.findOrCreate({
                    where : {
                        email : regEmail
                    },
                    defaults: defaults
                }).complete(function(err, results) {
                    if (!!err) {
                        var msg = "Error while createUser while selecting user: " + err;
                        logger.error(msg);
                        callback(msg);
                    } else {
                        callback(null, results);
                    }
                });
            },
            function(results, callback) {
                if(results[1]) {
                    postNewUserProcedure(regEmail, domain, logger, function(err) {
                        callback(null, results);
                    });
                } else {
                    callback(null, results);
                }
            },
            function(results, callback) {
                logger.info("Found user: " + results[0].username);
                createUserApplicationNotif(regEmail, domain);

                var user_obj = results[0].dataValues;
                user_obj.email = regEmail;
                user_obj.username = results[0].username != null ? results[0].username : '';
                user_obj.passcode = Common.dec(results[0].passcode);
                user_obj.passcodeupdate = results[0].passcodeupdate;
                user_obj.passcodetypechange =  results[0].passcodetypechange;
                user_obj.orgemail = results[0].orgemail != null ? results[0].orgemail : '';
                user_obj.orguser = results[0].orguser != null ? results[0].orguser : '';
                user_obj.orgpassword = Common.dec(results[0].orgpassword);
                //If authType !=0 that means that we
                //take exchange params from orgs table
                user_obj.serverurl = results[0].serverurl != null ? results[0].serverurl : '';
                user_obj.serverssl = results[0].securessl != null ? results[0].securessl : '1';
                user_obj.signature = results[0].signature != null ? results[0].signature : '';
                user_obj.authtype = results[0].authtype != null ? results[0].authtype : '0';
                user_obj.isactive = results[0].isactive != null ? results[0].isactive : 0;
                user_obj.isadmin = results[0].isadmin != null ? results[0].isadmin : 0;
                user_obj.encrypted = results[0].encrypted != null ? results[0].encrypted : 0;
                // if we can't find values for loginattempts assume the worst. user receives login lock.
                user_obj.loginattempts = results[0].loginattempts != null ? results[0].loginattempts : 3;
                user_obj.lang = results[0].language ? (results[0].language || "en") : "en";
                user_obj.countrylang = results[0].countrylang ? (results[0].countrylang || 'US') : 'US';
                user_obj.localevar = results[0].localevar ? (results[0].localevar || '') : '';
                user_obj.dcname = results[0].dcname;
                user_obj.dcurl = results[0].dcurl;
                user_obj.orgdomain = results[0].orgdomain;
                //logger.info("Loaded user %s %s %s %s %s %s %s %s", lpasscode, lorgEmail, lorgUser, lorgPassword, lserverURL, lsecureSSL, lsignature, lauthType);
                callback(null, user_obj);
            },
            function(user_obj, callback) {
                createUserApplicationNotif(regEmail, domain);
                callback(null, user_obj);
            }
        ], function(err, res) {
            if(err) {
                logger.error("createUser failed with err: " + err);
            }
            callback(err, res);
        }
    );
}

var postNewUserProcedure = function(email, domain, logger, callback) {
    async.series(
        [
            function(callback) {
                require("./addProfilesToGroup.js").addProfilesToGroupInternal("All", domain, "", false, [email], function(status) {
                    if(status != "added profiles to group successfully") {
                        logger.error("createUser cannot attach user " + email + " to group All of domain " + domain);
                    }
                    callback(null);
                });
            }
        ], function(err) {
            callback(err);
        }
    );
}

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

function createOrReturnUserAndDomain(email, logger, callback) {
    //calculate the domain from the user
    var domain;
    getUserDomain(email, function (orgDomainFromDB ) {
        if (orgDomainFromDB)
            domain = orgDomainFromDB;
        else
            domain = email.substr(email.indexOf('@') + 1);

        createDomainForUser(domain, logger, function(err, org_fixed_obj) {
            if (err) {
                callback(err);
                return;
            }
            //domain, authType, orgName, serverURL, secureSSL, signature

            //logger.info("callback of createDomainForUser %s %s %s %s %s %s ",domain,authType,orgName,serverURL,secureSSL,signature);
            createUser(email, org_fixed_obj, logger, function(err, user_fixed_obj) {
                if (err) {
                    callback(err);
                    return;
                }
                //logger.info("createOrReturnUserAndDomain %s %s %s %s %s %s %s %s %s %s %s", email, domain, authTypeU, orgName, serverURLU, passcode, orgEmail, orgUser, orgPassword, secureSSLU, signatureU);
                var callback_obj = {
                    email: email,
                    username: user_fixed_obj.username,
                    domain: user_fixed_obj.orgdomain,
                    authType: org_fixed_obj.authtype !== "0" ? org_fixed_obj.authtype : user_fixed_obj.authtype,
                    orgName: org_fixed_obj.orgname,
                    orgEmail: user_fixed_obj.orgemail,
                    passcode: user_fixed_obj.passcode,
                    passcodeupdate: user_fixed_obj.passcodeupdate,
                    passcodeexpirationdays: org_fixed_obj.passcodeexpirationdays,
                    exchange_conf: {
                        orgUser: user_fixed_obj.orguser,
                        orgPassword: user_fixed_obj.orgpassword,
                        serverURL: org_fixed_obj.authtype !== "0" ? org_fixed_obj.serverurl : user_fixed_obj.serverurl,
                        secureSSL: org_fixed_obj.authtype !== "0" ? org_fixed_obj.securessl : user_fixed_obj.securessl,
                        signature: user_fixed_obj.signature
                    },
                    isAdmin: user_fixed_obj.isadmin,
                    loginattempts: user_fixed_obj.loginattempts,
                    lang: user_fixed_obj.lang,
                    countrylang: user_fixed_obj.countrylang,
                    localevar: user_fixed_obj.localevar,
                    encrypted: user_fixed_obj.encrypted,
                    dcname: user_fixed_obj.dcname,
                    dcurl: user_fixed_obj.dcurl
                }
                callback(null, callback_obj, user_fixed_obj, org_fixed_obj);
            });
            // createUser
        });
        //  createDomainForUser
    });

}// createOrReturnUserAndDomain

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

function updateUserAccount(registrationEmail, orgEmail, authType, serverURL, domain,
		orgUser, orgPassword, secureSSL, signature, fromDevice, updateOtherDevices, updateMainDevice, callback) {

	// check for username field in db to avoid overwrite the username with email
	// after setup exchange
	Common.db.User.findAll({
        attributes : ['email', 'username'],
        where : {
            email : registrationEmail
        },
    }).complete(function(err, results) {

        if (!!err) {
            callback("Internal error: " + err);
            return;
        }

        if (!results || results == "") {
            callback("Cannot find user by email " + registrationEmail);
        }

        var dbUserName = (results[0].username != null && results[0].username.length > 0) ? results[0].username : registrationEmail;

	    Common.db.User.update({
	        authtype : authType,
	        serverurl : serverURL,
	        orgemail : orgEmail,
	        orguser : orgUser,
	        orgpassword : Common.enc(orgPassword),
	        securessl : secureSSL,
	        signature : signature,
	        username : dbUserName
	    }, {
	        where : {
	            email : registrationEmail
	        }
	    }).then(function() {

	        if (authType == 2) {
	            authType = '1';
	            serverURL = 'https://m.google.com';
	            orgUser = registrationEmail;
	        }

	        var setAccountValues = {};
	        if (authType != 0) {
	            var parsedURL = url.parse(serverURL);
	            setAccountValues = {
	                'accountType' : authType,
	                'email' : registrationEmail,
	                'orgEmail' : orgEmail,
	                'username' : orgUser,
	                'password' : orgPassword,
	                'serverName' : parsedURL.hostname,
	                'domain' : domain,
	                'serverPort' : parsedURL.port == null ? '443' : parsedURL.port,
	                'secureSSL' : secureSSL,
	                'signature' : signature
	            };

	        }

	        if (authType != 0 && updateOtherDevices) {
	            addExchangeNotify.registerToExAccount(registrationEmail, authType, parsedURL.hostname, domain, orgUser, orgPassword, secureSSL, function(msg) {
	                logger.info("addExchangeNotify.registerToExAccount return " + msg);
	            });
	        }
	        addSettingsToDevices(registrationEmail, fromDevice, 'setAccount', setAccountValues, updateOtherDevices, updateMainDevice, function(err) {
	            if (err) {
	                logger.error("Error: " + err);
	                callback(err);
	                // return with error
	                return;
	            }
	            callback(null);
	            // return withno error
	        });

	    }).catch(function(err) {
	        var msg = "Error while setUserDetails: " + err;
	        logger.info(msg);
	        callback(msg);
	        // return error
	        return;
	    });
    });

}

function loadSettingsUpdateFile(userName, deviceID, callback) {
    var folderName = Common.nfshomefolder + getUserDeviceDataFolder(userName, deviceID) + Common.settingsfolder;
    var fileName = folderName + "startup.json";
    logger.info("loadSettingsUpdateFile: fileName = " + fileName);
    Common.fs.readFile(fileName, function(err, data) {
        if (err) {
            logger.error("Error in loadSettingsUpdateFile: " + err);
            callback(err, {});
            return;
        }
        logger.info("loaded file: " + data.toString());
        var res = JSON.parse(data.toString());
        callback(null, res);
    });
}


/**
*  Prepares object for statup.json when a user has a certificate
*
*  @domain   - mainDomain for user
*  @email    -  Email address that identifies user
*  @deviceId -  User's device Id
*  @callback
*
**/
function handleCertificatesForUser(domain, email, deviceId, callback) {
    var path = require('path');
    // Check if this user has a certificate
    var certsFolder = Common.nfshomefolder + getUserHomeFolder(email)+ CERTIFICATE_DIRECTORY+path.sep;
    var certFile = certsFolder + CERTIFICATE_FILE;
    var folderName = Common.nfshomefolder + getUserDeviceDataFolder(email, deviceId);
    var settingsFolder = folderName + Common.settingsfolder;
    var pathToCertInSettings = settingsFolder + CERTIFICATE_FILE;

    if (Common.fs.existsSync(certFile)) {
        logger.info("User is using a certificate");
        prepareCertificateSettings(domain, email, deviceId, function(settings, err) {
            if(!!err) {
                logger.info('err='+err);
                callback(err);
                return;
            }
            // Check if certificate already exists in settings
            if (!Common.fs.existsSync(pathToCertInSettings)) {
                logger.info("Certificate exists but not in settings directory");
                saveSettingsUpdateFile(settings, email, deviceId, function(err) {
                    if (!!err) {
                        callback(err);
                        return;
                    }
                    // Copy certificate to user's data folder - already handles the callback
                    copyFile(certFile, pathToCertInSettings, function(err) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        Common.fs.chmodSync(pathToCertInSettings, '666');
                        callback(null);
                    });
                });
            } else {
                // Certificate is already in settings folder, check whether it's changed
                var cmd = 'diff ' + certFile + ' ' + pathToCertInSettings;
                var child = exec(cmd, function(error, stdout, stderr) {
                    logger.info('stdout: ' + stdout);
                    if (stdout) {
                        logger.info('Certificate has changed. Copying new certificate...');
                        // Copy certificate to user's data folder - already handles the callback
                        copyFile(certFile, pathToCertInSettings, function(err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            Common.fs.chmodSync(pathToCertInSettings, '666');
                            callback(null);
                        });
                        return;
                    }
                    logger.info('Certificate hasn\'t changed');
                    callback(null);
                });
            }
        });
    } else {
        logger.info("User is not using a certificate");
        callback(null);
    }
}


function prepareCertificateSettings(domain, email, deviceId, callback) {
    // Need: domain to get serverurl, authtype , signature and securessl
    logger.info('certificatesForUserExists domain='+domain+' email='+email);
    Common.db.Orgs.findAll({
        attributes : ['serverurl', 'authtype', 'signature', 'securessl'],
    }, {
        where : {
            maindomain : domain
        }
    }).complete(function(err, results) {
        if (!!err) {
            var msg = 'Error in certificatesForUserExists: '+ err;
            logger.info(msg);
            callback(null, msg);
            return;
        }

        if (!results || results == "") {
            var msg = 'ERROR: No serverurl found for domain '+domain;
            logger.info(msg);
            callback(null, msg);
            return;
        }
        var parsedURL = url.parse(results[0].serverurl);
        var settings = {
            "setAccount": {
                'accountType' : results[0].authtype,
                //'email' : email,
                'orgEmail' : email,
                //'username' : 'tmp_user',
                //'password' : 'tmp_pass',
                'serverName' : parsedURL.hostname,
                'domain' : domain,
                'serverPort' : parsedURL.port == null ? '443' : parsedURL.port,
                'secureSSL' : results[0].securessl,
                'signature' : results[0].signature,
                'useCertificate' : true,
                'certPassword' : DEFAULT_PASSWORD
            }
        };
        callback(settings, null);
    })
}


function saveSettingsUpdateFile(settings, userName, deviceID, callback) {

    var str = JSON.stringify(settings, null, 4);
    var fs = Common.fs;

    var folderName = Common.nfshomefolder + getUserDeviceDataFolder(userName, deviceID);
    if (!Common.fs.existsSync(folderName)) {
        var errMsg = "folder " + folderName + " dosen't exists";
        logger.error("Error: saveSettingsUpdateFile: " + errMsg);
        callback(errMsg);
        return;
    }
    var settingsFolder = folderName + Common.settingsfolder;

    Common.fs.mkdir(settingsFolder, function(err) {
        if (err) {
            if (!Common.fs.existsSync(settingsFolder)) {
                logger.error("saveSettingsUpdateFile: mkdir failed, Folder can not be created. ignore command." + err);
                callback("the folder " + settingsFolder + " does not exist");
                return;
            }
            // ignor mkdir error - the folder already exists
        }
        fs.chmodSync(settingsFolder, '0777');
        var fileName = settingsFolder + "startup.json";

        logger.info("write file: " + fileName);
        // Everything should be synced! we are calling this function sometimes without waiting for a callback
        Common.fs.writeFileSync(fileName, str);

        if (Common.fs.existsSync(fileName)) {
            fs.chmodSync(fileName, '0777');
            callback(null); // No certificate
        } else {
            callback("can't chmod file: " + fileName);
        }
    });

}

function saveIMSettingsFile(email, userName, deviceID, localid, callback) {
    Common.redisClient.hgetall('imserver',function (err, obj) {
        if (err) {
            var errMsg = "get imserver from redis faile. cannot execute hgetall, err:"+err;
            logger.error(errMsg);
            callback(errMsg);
            return;
        } else {
            if (obj) {
                var setIMParams = {
                    'imServerSSL' : obj.im_ssl,
                    'imServerDomain' : obj.im_domain,
                    'imFirstUrl' : obj.im_first_url,
                    'imSecondUrl' : obj.im_sec_url,
                    'imServerPort' : obj.im_port,
                    'imUserName' : userName,
                    'imImagePriDomain' : obj.im_image_pri_domain,
                    'imImageSecDomain' : obj.im_image_sec_domain,
                    'imImagePort' : obj.im_image_port
                };

                var imSettings = {};
                imSettings['imParams'] = setIMParams;
                var jsonStr = JSON.stringify(imSettings, null, 4);

                var fs = Common.fs;

                var folderName = Common.nfshomefolder + getUserDeviceDataFolder(email, deviceID);
                if (!Common.fs.existsSync(folderName)) {
                    var errMsg = "folder " + folderName + " dosen't exists";
                    logger.error("Error: saveIMSettingsFile: " + errMsg);
                    callback(errMsg);
                    return;
                }

                var settingsFolder = folderName + Common.settingsfolder;

                Common.fs.mkdir(settingsFolder, function(err) {
                    if (err) {
                        if (!Common.fs.existsSync(settingsFolder)) {
                            var errMsg = "saveIMSettingsFile: mkdir failed, Folder can not be created. ignore command." + err;
                            logger.error(errMsg);
                            callback(errMsg);
                            return;
                        }
                        // ignor mkdir error - the folder already exists
                    }

                    var fileName = settingsFolder + "imparams.json";
                    Common.fs.readFile(fileName, 'utf8', function(err, data) {
                        if(data) {
                            var parsedData = JSON.parse(data);
                            if (parsedData.imParams.imServerDomain == obj.im_domain &&
                                    parsedData.imParams.imFirstUrl == obj.im_first_url &&
                                    parsedData.imParams.imSecondUrl == obj.im_sec_url &&
                                    parsedData.imParams.imServerPort == obj.im_port &&
                                    parsedData.imParams.imServerSSL == obj.im_ssl &&
                                    parsedData.imParams.imUserName == userName &&
                                    parsedData.imParams.imImagePriDomain == obj.im_image_pri_domain &&
                                    parsedData.imParams.imImageSecDomain == obj.im_image_sec_domain &&
                                    parsedData.imParams.imImagePort == obj.im_image_port)
                            {
                                //there was no change in imserver data
                                callback(null);
                                return;
                            }
                        }
                        Common.fs.writeFile(fileName, jsonStr, function(err) {
                            if (err) {
                                var errMsg = "can't write file: " + fileName;
                                logger.error(errMsg);
                                callback(errMsg);
                                return;
                            }
                            if (Common.fs.existsSync(fileName)) {
                                //fs.chmodSync(fileName, '0777');
                                fs.chownSync(fileName, 101000, 101000);
                                callback(null);
                                return;
                            } else {
                                var errMsg = "can't chmod file: " + fileName;
                                logger.error(errMsg);
                                callback(errMsg);
                                return;
                            }
                        });
                    });
                });
            } else {
                var errMsg = "imserver does not exist";
                logger.error(errMsg);
                callback(errMsg);
                return;
            }
        }
    });
}

/**
*  Prepares autoLogin file
*
*  @domain   -  mainDomain for user
*  @email    -  Email address that identifies user
*  @deviceId -  User's device Id
*  @callback
*
**/
function handleAutoLoginForUser(domain, email, deviceId, callback) {
    var path = require('path');
    // Check if this user has an autologin file
    var folderName = Common.nfshomefolder + getUserDeviceDataFolder(email, deviceId);
    // No longer just for browser
    //var browserFolder = folderName + Common.browserfolder;
    var pathToAutoLoginInBrowser = folderName + AUTO_LOGIN_FILE;

    if (Common.autoLogin) {
        // Create file in browser directory
        prepareAutoLoginFile(email, pathToAutoLoginInBrowser, function(err) {
            if(!!err) {
                logger.info('err='+err);
                callback(err);
                return;
            }
            Common.fs.chmodSync(pathToAutoLoginInBrowser, '444');
            callback(null);
        });
    }
    else{
         callback(null);
    }
}

function prepareAutoLoginFile(email, autoLoginFilePath, callback) {
    Common.db.User.findAll({
        attributes : ['orguser', 'orgpassword'],
        where : {
            email : email
        }
    }).complete(function(err, results) {
        if (!!err) {
            var msg = "Error while prepareAutoLoginFile while selecting user: " + err;
            logger.info(msg);
            callback(msg);
            return;
        }

        // There must be a result if no error had occcurred
        var orguser = results[0].orguser != null ? results[0].orguser : '';
        var orgpassword = Common.dec(results[0].orgpassword);

        // Write to file
        Common.fs.writeFile(autoLoginFilePath, orguser + '\n' + orgpassword + '\n', function(err) {
            if(!!err) {
                callback(err);
                return;
            }

            // Insert all sites in json to a string
            var data = "";
            async.eachSeries(Common.autoLogin, function(site, callback1) {
                data += site + '\n';
                callback1(null);
            }, function(err) {
                if (err) {
                    callback(err);
                    return;
                }
                Common.fs.appendFile(autoLoginFilePath, data, 'utf8', callback);
            });
        });
    });
};


function addSettingsToDevices(regEmail, deviceid, paramName, paramValues, updateOtherDevices, updateMainDevice, callback) {
    var foundDevices = {};
    logger.info("addSettingsToDevices. deviceid: " + deviceid + ", updateOtherDevices: " + updateOtherDevices + ", updateMainDevice: " + updateMainDevice);

    Common.db.Activation.findAll({
        attributes : ['deviceid', 'status'],
        where : {
            email : regEmail
        },
    }).complete(function(err, results) {

        if (!!err) {
            if (callback != null)
                callback("Internal error: " + err);
            return;
        }

        if (!results || results == "") {
            if (callback != null)
                callback(null);
            return;
        }

        results.forEach(function(row) {
            var newDeviceID = row.deviceid;
            if (newDeviceID == null || newDeviceID == "")
                return;

            // check if it this device id created the event and id we do not need to re-set it
            if (!updateMainDevice && newDeviceID == deviceid) {
                logger.info("Not update main device: " + newDeviceID);
                return;
            }
            // check if we already setup this device (duplicate activation)
            if (foundDevices[newDeviceID] != null) {
                logger.info("Device already updated: " + newDeviceID);
                return;
            }
            if (newDeviceID == deviceid || updateOtherDevices) {// device not processed yet
                foundDevices[newDeviceID] = newDeviceID;
                //                loadSettingsUpdateFile(regEmail, newDeviceID, function(err, settings) {
                //                    settings[paramName] = paramValues;
                var settings = {};
                settings[paramName] = paramValues;
                logger.info("Save settings to device: " + newDeviceID);
                logger.info("Save Settings ", settings);
                saveSettingsUpdateFile(settings, regEmail, newDeviceID, function(err) {
                    if (err) {
                        logger.error("Error saveSettingsUpdateFile : " + err);
                        return;
                    }
                    logger.info("Updated settings for " + regEmail + ", " + newDeviceID);
                });
                // saveSettingsUpdateFile
                //                }); // loadSettingsUpdateFile
            }
        });
        if (callback != null)
            callback(null);
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

/**
 * syncUserFolders - Sync user device folder and ssd folder to all remote location specified in settings
 * This function run in background and doesn't have callback. check log for errors
 * @param {Object} email
 * @param {Object} deviceid
 */
function syncUserFolders(email, deviceid) {
    if (!Common.nfsSyncLocations)
        return;
    for (var i = 0; i < Common.nfsSyncLocations.length; i++) {
        var remotehomefolder = Common.nfsSyncLocations[i] + '/';
        var deviceFolder = getUserDeviceDataFolder(email, deviceid);
        var storageFolder = getUserStorageFolder(email);
        // "ssh://nubo@na02.nubosoftware.com///ssd/data/homes"

        var cmd = 'unison ' + Common.nfshomefolder + ' ' + remotehomefolder + ' -path "' + storageFolder + '" -path "' + deviceFolder + '" -silent -times -force newer -batch -numericids -perms -1 -owner -group -servercmd "sudo /usr/bin/unison" ';
        logger.info("syncUserFolders. cmd: " + cmd);
        var child = exec(cmd, function(error, stdout, stderr) {
            logger.info('stdout: ' + stdout);
            logger.info('stderr: ' + stderr);
            if (error) {
                logger.info("Error happend in syncUserFolders script: " + error);
                return;
            }
        });
        // var child = exec
    } // for
}

// Insert all uer's apps as "to be installed" in device_apps
function enableNewDeviceApps(email, deviceId, time, hrTime, callback) {
    var maindomain;
    getUserDomain(email, function (orgDomainFromDB ) {
        if (orgDomainFromDB)
            maindomain = orgDomainFromDB;
        else
            maindomain = email.substr(email.indexOf('@') + 1);

        // Iterate over all user apps

        Common.db.UserApps.findAll({
            attributes : ['packagename'],
            where : {
                email : email,
                maindomain : maindomain
            },
        }).complete(function(err, results) {

            if (!!err) {
                msg = "Internal error: ";
                logger.info(msg);
                callback(msg);
                return;
                ;
            }

            if (!results || results == "") {
                logger.info("No installed packages found for user.");
                callback(null);
                return;
            }

            var addAppModule = require('./addAppsToProfiles.js');
            var insertToDeviceApps = addAppModule.insertToDeviceApps;
            var TO_BE_INSTALLED = addAppModule.TO_BE_INSTALLED;

            async.each(results, function(result, callback) {
                var packageName = result.packagename;
                // Insert app to device_apps
                insertToDeviceApps(email, deviceId, packageName, maindomain, TO_BE_INSTALLED, time, hrTime, function(err) {
                    callback(err);
                });
            }, function(err) {
                callback(err);
            });
        });
    });

}

function createUserFolders(email, deviceid, overwrite, time, hrTime, callback, demoUser) {

    var userFolder, userFolderSd, storageFolder, dataFolder;
    if (Common.withService) {
        if ((deviceid.indexOf("web") === 0) || (deviceid.indexOf(Common.withServiceWebDeviceID) === 0)) {
            deviceid = Common.withServiceWebDeviceID;
        } else {
            deviceid = Common.withServiceDeviceID;
        }
    }

    async.waterfall(
        [
            function(callback) {
                require('./nfs.js')(
                    {
                        nfs_idx: Common.nfsId
                    },
                    function(err, nfsobj) {
                        if (err) {
                            logger.error("Cannot create nfs obect err: " + err);
                            userFolder = Common.nfshomefolder + getUserHomeFolder(email);
                            userFolderSd = userFolder;
                        } else {
                            userFolder = nfsobj.params.nfs_path + getUserHomeFolder(email);
                            userFolderSd = (nfsobj.params.nfs_path_slow || nfsobj.params.nfs_path) + getUserHomeFolder(email);
                        }
                        dataFolder = userFolder + deviceid + '/';
                        storageFolder = userFolderSd + 'storage/media/Download';
                        callback(null);
                    }
                );
            },
            function(callback) {
                mkdirp(userFolder, function(err) {
                    if (err) {
                        var msg = "Unable to create user folder " + userFolder + " : " + err;
                        logger.info(msg);
                    }
                    callback(err);
                });
            },
            function(callback) {
                mkdirp(storageFolder, '0777', function(err) {
                    if (err) {
                        var msg = "Unable to create user folder " + storageFolder + ": " + err;
                        logger.info(msg);
                    }
                    callback(err);
                });
            },
            function(callback) {
                Common.fs.chmod(storageFolder, '777', function(err) {
                    callback(err);
                });
            },
            function(callback) {
                if (Common.demoSystem) {
                    logger.info("Create a demo Nubo.pdf file!");
                    var srcpdf = Common.nfshomefolder + "/Nubo.pdf";
                    var dstpdf = storageFolder + "/Nubo.pdf";
                    copyFile(srcpdf, dstpdf, function(err) {
                        logger.info("Copy err: " + err);
                        Common.fs.chmod(dstpdf, '777', function(err) {
                            cmd = "chown 1023.1023 -R " + userFolderSd + "storage/media";
                            exec(cmd, function(error, stdout, stderr) {
                                callback(null);
                            });
                        });
                    });
                } else {
                    callback(null);
                }
            },
            function(callback) {
                Common.fs.exists(dataFolder, function(exist) {
                    callback(null, exist);
                });
            },
            function(exist, callback) {
                if(exist) {
                    callback(null, exist);
                } else {
                    mkdirp(dataFolder, '0777', function(err) {
                        callback(err, exist);
                    });
                }
            },
            function(exists, callback) {
                if(!exists || overwrite) {
                    if (!demoUser) {
                        var tarFileName = NEW_USER_TAR;
                        var cmd = 'tar xvzf ' + Common.nfshomefolder + tarFileName + ' -C ' + dataFolder + ' ; chown 1023.1023 -R ' + userFolderSd + 'storage';
                        var child = exec(cmd, function(error, stdout, stderr) {
                            if(error) {
                                logger.info("STDOUT: " + stdout.trim());
                                logger.info("Error happend in createUserFolders script: " + stderr.trim());
                                callback("Error happend in createUserFolders script: " + stderr.trim());
                            } else {
                                logger.info('createUserFolders DONE');
                                enableNewDeviceApps(email, deviceid, time, hrTime, callback);
                            }
                        });
                        //exec
                    } else {
                        var cmd1 = "rsync -avz --delete " + userFolderSd + "demo-storage/ " + userFolderSd + "storage/";
                        var cmd2 = "rsync -avz --delete " + userFolder + "demo-device/ " + dataFolder;
                        var child = exec(cmd1 + " ; " + cmd2, function(error, stdout, stderr) {
                            if(error) {
                                logger.info("STDOUT: " + stdout.trim());
                                logger.info("Error happend in createUserFolders script: " + stderr.trim());
                                callback("Error happend in createUserFolders script: " + stderr.trim());
                            } else {
                                logger.info("STDOUT: " + stdout.trim());
                                logger.info('createUserFolders DONE ');
                                callback(null);
                            }
                        });
                        //exec
                    }
                } else {
                    callback(null);
                }
            }
        ], function(err) {
            if(err) {
                logger.error("createUserFolders finished with error: " + err);
            }
            callback(err);
        }
    );
}

function validateAuthentication(mainDomain, email, authType, serverURL, domain, orgUser, orgPassword, secureSSL, signature, callback) {

    var cred = {
        user: orgUser,
        password: orgPassword,
        domain: domain
    };
    if (Common.ActiveDirectoryAuthenticate == true)
        authType = 3;

    logger.info("serverURL: " + serverURL);
    if (authType && serverURL == "https://m.google.com") {
        logger.info("Validate google apps with active sync");
        authType = 2;
    }
    if (authType == 1) {//exchange active sync
        var parsedURL = url.parse(serverURL);
        var msg = "";
        var status = 0;

        var reqParams = {
            host: parsedURL.host,
            path: "/Microsoft-Server-ActiveSync?DeviceId=Nubo&DeviceType=Android",
            soTimeout: 30000
        };

        logger.info("Checking authntication... ");
        EWSUtils.doAuthorizedRequest(cred, reqParams, "", function(error, body, response) {
            if (error) {
                logger.error('error: ' + error);
                status = 0;
                msg = "Connection error";
                callback(msg);
                return;
            }
            logger.info('STATUS: ' + response.statusCode);
            if (response.statusCode != 505 && response.statusCode != 403 && response.statusCode != 501) {
                logger.info('HEADERS: ' + JSON.stringify(response.headers));
                logger.info("Body: " + body);
                msg = "Authentication error";
                callback(msg);
                return;
            } else {
                callback(null);
                // return success with no error
            }
        });
    } else if (authType == 2) {//google apps...
        var GoogleClientLogin = require('googleclientlogin').GoogleClientLogin;
        var googleAuth = new GoogleClientLogin({
            email : orgUser,
            password : orgPassword,
            service : 'mail',
            accountType : GoogleClientLogin.accountTypes.google
        });

        googleAuth.on(GoogleClientLogin.events.login, function() {
            logger.info("login: " + googleAuth.getAuthId());
            callback(null);
            // return success with no error
        });
        googleAuth.on(GoogleClientLogin.events.error, function(e) {
            logger.info("error: " + e.message);
            msg = "Authentication error";
            callback(null);
            return;
        });
        googleAuth.login();

    } else if (authType == 3) {
        var AuthenticateLDAP = require('./authenticateLDAP.js');
        AuthenticateLDAP.ldapUserAuth(cred, mainDomain, function(err, auth) {
            if (err || auth == false) {
                logger.error("ldapUserAuth failed");
                callback("failed");
                return;
            } else {
                callback(null);
                return;
            }
        });

    } else {
        callback("Invalid authType");
        // return error
    }

}

function validateUserFolders(UserName, deviceID, keys, callback) {
    var folder, folderSd;
    async.series([
    // check main folder
            function(callback) {
                require('./nfs.js')(
                    {
                        nfs_idx: Common.nfsId
                    },
                    function(err, nfsobj) {
                        if (err) {
                            logger.error("Cannot create nfs obect err: " + err);
                            folder = Common.nfshomefolder + getUserDeviceDataFolder(UserName, deviceID);
                            folderSd = Common.nfshomefolder + getUserStorageFolder(UserName);
                        } else {
                            folder = nfsobj.params.nfs_path + getUserDeviceDataFolder(UserName, deviceID);
                            folderSd = (nfsobj.params.nfs_path_slow || nfsobj.params.nfs_path) + getUserStorageFolder(UserName) + "/media";
                        }
                        callback(null);
                    }
                );
            },
    function(callback) {
        Common.fs.exists(folder, function(exists) {
            if (!exists) {
                var msg = "Folder " + folder + " doesn't exists!";
                logger.info(msg);
                callback(msg);
            } else
                callback(null);
        });
    },
    // check system folder
    function(callback) {
        var chfolder = folder + '/system';
        Common.fs.exists(chfolder, function(exists) {
            if (!exists) {
                var msg = "Folder " + chfolder + " doesn't exists!";
                logger.info(msg);
                callback(msg);
            } else
                callback(null);
        });
    },
    // check storage folder
    function(callback) {
        Common.fs.stat(folderSd, function(err, stat) {
            if (err) {
                var msg = "Folder " + folderSd + " doesn't exists!";
                logger.info(msg);
                callback(msg);
            } else
                callback(null);
        });
        // Common.fs.exists
    },
    // check if latest office exist in the folder if not copy files from tar
    // file
    function(callback) {
        var checkPath = folder + "com.mobisystems.editor.office_with_reg/files/gaClientId";
        Common.fs.exists(checkPath, function(exists) {
            if (!exists) {
                var tarFileName = 'office.tar.gz';
                var child = exec('tar xvzf ' + Common.nfshomefolder + tarFileName + ' -C ' + folder, function(error, stdout, stderr) {
                    if (error) {
                        logger.info("STDOUT: " + stdout.trim());
                        logger.info("Error happend in open office.tar.gz: " + stderr.trim());
                    } else {
                        logger.info('Created office file');
                    }
                    callback(null);
                });
            } else {
                callback(null);
            }
        });
    },
    // check if the folder version is correct - if not fix the folder permission
    // using fix_apps.sh script
    function(callback) {
        callback(null); //Skip this code 
        return;
//        var verfile = folder + "platforversion";
//        Common.fs.readFile(verfile, 'utf8', function(err, data) {
//            if (err) {
//                logger.error("Unable to find platforversion file for device: " + err);
//            }
//            if (err || data != Common.platforversion) {
//                logger.error("Fixing files due to platform vesion mismatch");
//
//                var product = Common.platformpath + '/out/target/product/x86_platform/';
//                var cmd = 'fix_apps.sh ' + folder + ' ' + product;
//                logger.info("cmd: " + cmd);
//                var child = exec(cmd, function(error, stdout, stderr) {
//                    logger.info('stdout: ' + stdout);
//                    logger.info('stderr: ' + stderr);
//                    if (error !== null) {
//                        logger.error('exec error: ' + error);
//                        var msg = "Unable to fix folder version: " + error;
//                        callback(msg);
//                    } else {
//                        Common.fs.writeFile(verfile, Common.platforversion, function(err) {
//                            if (err) {
//                                logger.error("Unable to write platforversion file: " + err);
//                            } else {
//                                logger.info("platforversion file updated");
//                            }
//                        });
//                        callback(null);
//
//                    }
//                });
//            } else {
//                //logger.info("Platform version is correct");
//                callback(null);
//            }
//        });
//        // Common.fs.exists
    },
    function(callback) {
        if (keys) {
            logger.info("Check encryption of user's directiories");
            var flag = Common.nfshomefolder + getUserDeviceDataFolder(UserName, deviceID) + ".crypted";
            Common.fs.exists(flag, function(exists) {
                if (!exists) {
                    var msg = "User's directory is not encrypted";
                    logger.info(msg);
                    encryptUserFolders(UserName, deviceID, keys, callback);
                } else
                    callback(null);
            });
        } else {
            callback(null);
        }
    }], function(err, results) {
        callback(err);
    });
}

function encryptUserDeviceDataFolders(UserName, deviceID, keys, callback) {
    var dev_dir = Common.nfshomefolder + getUserDeviceDataFolder(UserName, deviceID);
    var dev_dir_nonenc = dev_dir.substring(0, dev_dir.length - 1) + "_nonencrypted";
    async.series([
    function(callback) {
        Common.fs.exists(dev_dir_nonenc, function(exists) {
            if (!exists) {
                callback(null);
            } else {
                var msg = "oops... directory " + dev_dir_nonenc + " already exist";
                logger.info(msg);
                callback(msg);
            }
        });
    },
    function(callback) {
        encryptFolderLocked(dev_dir, dev_dir_nonenc, keys, callback);
    }], function(err, results) {
        console.log("Finish encryptUserDeviceDataFolders with err:" + err);
        callback(err);
    });
}

function encryptUserStorageFolders(UserName, deviceID, keys, callback) {
    var dev_dir = Common.nfshomefolder + getUserStorageFolder(UserName);
    var dev_dir_nonenc = dev_dir.substring(0, dev_dir.length - 1) + "_nonencrypted";
    var isCrypted = false;
    async.series([
    function(callback) {
        var flag = dev_dir + ".crypted";
        Common.fs.exists(flag, function(exists) {
            if (exists) {
                isCrypted = true;
                callback("already done");
            } else
                callback(null);
        });
    },
    function(callback) {
        Common.fs.exists(dev_dir_nonenc, function(exists) {
            if (!exists) {
                callback(null);
            } else {
                var msg = "oops... directory " + dev_dir_nonenc + " already exist";
                logger.info(msg);
                callback(msg);
            }
        });
    },
    function(callback) {
        encryptFolderLocked(dev_dir, dev_dir_nonenc, keys, callback);
    }], function(err, results) {
        console.log("Finish encryptUserStorageFolders with err:" + err);
        if (isCrypted)
            callback(null);
        else
            callback(err);
    });
}

function encryptUserFolders(UserName, deviceID, keys, callback) {
    async.parallel([
    function(callback) {
        encryptUserDeviceDataFolders(UserName, deviceID, keys, callback);
    },
    function(callback) {
        encryptUserStorageFolders(UserName, deviceID, keys, callback);
    }], function(err) {
        console.log("Finish encryptUserFolders with err:" + err);
        callback(err);
    });
}

function encryptFolderLocked(src, tmp, keys, callback) {
    async.series([
    function(callback) {
        Common.fs.rename(src, tmp, callback);
    },
    function(callback) {
        var cmd = "mkdir -m 0771 " + src + " && chown 1000.1000 " + src;
        //                logger.info("cmd: " + cmd);
        exec(cmd, function(error, stdout, stderr) {
            if (error) {
                callback("dir already exist");
            }
            callback(null);
        });
    },
    function(callback) {
        var cmd = "";
        // create new session for storage of keys
        cmd = "keyctl new_session \\\n";
        // load password
        cmd = cmd + " && keyctl add user mykey " + keys.ecryptfs_password + " @s \\\n";
        // load key
        cmd = cmd + " && keyctl add encrypted beefbeefbeefbeef \"load " + keys.ecryptfs_key + "\" @s \\\n";
        cmd = cmd + " && mkdir -p " + src + " \\\n" + " && mount -i -t ecryptfs -o ecryptfs_sig=beefbeefbeefbeef,ecryptfs_cipher=aes,ecryptfs_key_bytes=32" + " " + src + " " + src + " \\\n";
        // clean session, remove all loaded keys of session
        cmd = cmd + " && keyctl clear @s \\\n";
        // upload files to encrypted directory
        cmd = cmd + " && rsync -ra " + tmp + "/ " + src + "/ \\\n";
        cmd = cmd + " && umount -l " + src + "/ \\\n";
        // add sign that fs already encrypted
        cmd = cmd + " && touch " + src + "/.crypted \\\n";
        // if error happened on any stage of previous commands, try clean session, unmount and return false
        cmd = cmd + " || ( keyctl clear @s ; umount -l " + src + " ; false )";
        // keys clear and umount appear twice
        //                logger.info("cmd:\n" + cmd); //!!! Don't uncomment it, show password and key in log
        exec(cmd, function(error, stdout, stderr) {
            if (error) {
                callback("fail in encryptFolderLocked");
            } else
                callback(null);
        });
    }], function(err) {
        if (err)
            logger.info("User.encryptFolderLocked has been finished with error (" + err + ")");
        callback(err);
    });
}

var getUserDataSize = function(user, callback) {
   var cmd = "du --max-depth=0 -B1024 " + Common.nfshomefolder + getUserHomeFolder(user);
   exec(cmd, function(error, stdout, stderr) {
            if (error) {
                callback("cannot check data size, err:" + error);
            } else {
                callback(null, parseInt(stdout));
            }
   });
}


/**
*    Searches for new_user.tar.gz. If it doesn;t exist the creates one from the platform obj.
*    @platform - The platform from which we will generate the tar
*    @callback
**/
var createNewUserTar = function(platform, callback) {
    var path = require('path');
    var pathToNfs = Common.nfshomefolder;
    var apksDir = pathToNfs + 'apks' + path.sep;
    var pathToSrcTar = apksDir + NEW_USER_TAR;
    var pathToDstTar = pathToNfs + NEW_USER_TAR;
    var pathToTmpDir = pathToNfs + 'tmp';
    var pathToPackagesList = pathToNfs + 'packages.list';
    var pathToNewUserFiles = 'new_user_files';
    var localid;
    Common.fs.stat(pathToDstTar, function(err, stats) {
        if (!err) {
            logger.log('Found ' + Common.nfshomefolder + NEW_USER_TAR);
            callback(null);
            return;
        }

        logger.log('Cannot find ' + pathToDstTar + ' , Creating a new file');
        async.series([
            // Separate into 2 commands because the tar happens sometimes before directories are created
            // First ssh command
            function(callback) {
                var cmd = 'pm create-user createDirUser';
                platform.exec(cmd, function(err, code, signal, sshout) {
                    if (err) {
                        var msg = 'ERROR:: cannot connect to platform ' + err;
                        callback(msg);
                        return;
                    } else {
                        var re = new RegExp('Success: created user id ([0-9]+)');
                        var m = re.exec(sshout);
                        if(m) {
                            localid = m[1];
                            logger.log('Tempate user number ' + localid);
                            callback(null);
                        } else {
                            callback("Error with PM - cannot get localid");
                        }
                    }

                });
            },
            function(callback) {
                var cmd = 'mkdir -p /data/user/' + localid + '/system/media' +
                          '; chown system.system /data/user/' + localid + '/system';
                platform.exec(cmd, function(err, code, signal, exec_sshout) {
                    if (err) {
                        var msg = 'ERROR:: cannot connect to platform ' + err;
                        callback(msg);
                        return;
                    } else {
                        callback(null);
                    }

                });
            },
            // Second ssh command
            function(callback) {
                var cmd = 'cd /data/user/' + localid + '; /system/xbin/tar -czf /data/tmp/' + NEW_USER_TAR + ' ./'+
                          '; cp /data/system/packages.list /data/tmp/' +
                          '; pm remove-user ' + localid +
                          '; rm -rf /data/user/' + localid +
                          '; rm -rf /data/system/users/' + localid +
                          '; rm -rf /data/system/users/' + localid + '.xml';
                logger.info('cmd: '+cmd);
                platform.exec(cmd, function(err, code, signal, exec_sshout) {
                logger.info('exec_sshout: '+exec_sshout);
                    if (err) {
                        var msg = 'ERROR:: cannot connect to platform ' + err;
                        callback(msg);
                        return;
                    } else {
                        callback(null);
                        return;
                    }

                });
            },
            // Copy new_user.tar.gz to its directory
            function(callback) {
                logger.info('Copying ' + pathToSrcTar + ' to ' + pathToDstTar);
                copyFile(pathToSrcTar, pathToDstTar, callback);
            },
            // Copy new_user.tar.gz to its directory
            function(callback) {
                logger.info('Copying ' + apksDir + 'packages.list' + ' to ' + pathToPackagesList);
                copyFile(apksDir + 'packages.list', pathToPackagesList, callback);
            },
            // Delete new_user.tar.gz from apks/
            function(callback) {
                logger.info('Deleting ' + pathToSrcTar);
                Common.fs.unlink(pathToSrcTar, function (err) {
                  if (!err)
                      logger.info('Removed ' + NEW_USER_TAR + ' from apks');
                  callback(err);
                });
            },
            // Delete new_user.tar.gz from apks/
            function(callback) {
                Common.fs.unlink(apksDir + 'packages.list', function (err) {
                  if (!err)
                      logger.info('Removed ' + 'packages.list' + ' from apks');
                  callback(err);
                });
            },
            // Create tmp dir and open tar
            function(callback) {
                Common.fs.mkdir(pathToTmpDir, function (err) {
                    var tarFileName = NEW_USER_TAR;
                    var cmd = 'tar xvzf ' + pathToDstTar + ' -C ' + pathToTmpDir;
                    var child = exec(cmd, function(error, stdout, stderr) {
                        if (error) {
                            logger.info("STDOUT: " + stdout.trim());
                            var msg = "Error happend in untarring: " + stderr.trim();
                            callback(msg);
                            return;
                        } else {
                            logger.info('untar finished');
                            callback(null);
                        }
                    });
                });
            },
            // Copy OfficeSuite files to OfficeSuite directory
            function(callback) {
                var cmd = 'cp -r ' + pathToNewUserFiles + path.sep + 'officesuite_files' + path.sep + '* ' + pathToTmpDir + path.sep + 'com.mobisystems.editor.office_with_reg';
                logger.info("cmd: " + cmd);
                var child = exec(cmd, function(error, stdout, stderr) {
                    logger.info('stdout: ' + stdout);
                    logger.info('stderr: ' + stderr);
                    if (!!error) {
                        var msg = "Unable to copy OfficeSuite files " + error;
                        callback(msg);
                        return;
                    }
                    callback(null);
                });
            },
            // fix_apps
            function(callback) {
                var cmd = 'fix_apps.sh ' + pathToTmpDir + ' ' + pathToNfs;
                logger.info("cmd: " + cmd);
                var child = exec(cmd, function(error, stdout, stderr) {
                    logger.info('stdout: ' + stdout);
                    logger.info('stderr: ' + stderr);
                    if (!!error) {
                        var msg = "Unable to fix folder apps: " + error;
                        callback(msg);
                        return;
                    }
                    callback(null);
                });
            },
            // Re-create tar
            function(callback) {
                var cmd = 'tar -czf '+ pathToDstTar + ' -C ' + pathToTmpDir + ' .';
                logger.info("cmd: " + cmd);
                var child = exec(cmd, function(error, stdout, stderr) {
                    logger.info('stdout: ' + stdout);
                    logger.info('stderr: ' + stderr);
                    if (!!error) {
                        var msg = "Unable to tar: " + error;
                        callback(msg);
                        return;
                    }
                    callback(null);
                });
            },
            // Delete tmp dir
            function(callback) {
                var cmd = 'rm -rf ' + pathToTmpDir;
                logger.info("cmd: " + cmd);
                var child = exec(cmd, function(error, stdout, stderr) {
                    logger.info('stdout: ' + stdout);
                    logger.info('stderr: ' + stderr);
                    if (!!error) {
                        logger.info('Error: Unable to delete '+pathToTmpDir + '. Ignoring');
                    }
                    callback(null);
                });
            }
        ], function(err) {
            if (!!err)
                logger.info('Err='+err);
            callback(err);
        });
    });
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
    createOrReturnUserAndDomain : createOrReturnUserAndDomain,
    setUserDetails : setUserDetails,
    getUserDetails : getUserDetails,
    updateUserAccount : updateUserAccount,
    validateAuthentication : validateAuthentication,
    createUserFolders : createUserFolders,
    getUserHomeFolder : getUserHomeFolder,
    getUserStorageFolder : getUserStorageFolder,
    getUserDeviceDataFolder : getUserDeviceDataFolder,
    checkUserDomain : checkUserDomain,
    createDomainForUser : createDomainForUser,
    syncUserFolders : syncUserFolders,
    validateUserFolders : validateUserFolders,
    saveSettingsUpdateFile : saveSettingsUpdateFile,
    saveIMSettingsFile : saveIMSettingsFile,
    createNewUserTar : createNewUserTar,
    handleCertificatesForUser : handleCertificatesForUser,
    handleAutoLoginForUser : handleAutoLoginForUser,
    getUserDataSize: getUserDataSize,
    createUserApplicationNotif : createUserApplicationNotif,
    updateUserConnectedDevice: updateUserConnectedDevice,
    getUserConnectedDevices: getUserConnectedDevices,
    updateUserDataCenter: updateUserDataCenter,
    getUserDataCenter: getUserDataCenter,
    getUserDomain : getUserDomain,
    postNewUserProcedure : postNewUserProcedure,
    getUserDeviceDataFolderObj: getUserDeviceDataFolderObj,
    getUserStorageFolderObj: getUserStorageFolderObj
};
module.exports = User;

