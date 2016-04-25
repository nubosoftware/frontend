"use strict";

var async = require('async');
var Common = require('./common.js');
var logger = Common.logger;
var sessionModule = require('./session.js');
var Session = sessionModule.Session;
var setting = require('./settings.js');
var util = require('util');
var parser = require('xml2json');
var util = require('util');
var exec = require('child_process').exec;

var Firewall = {
    add : "add",
    remove : "remove",
    ipv4 : "v4",
    ipv6 : "v6"
};

var sysApps = ["com.android.email", "com.android.calendar", "com.mobisystems.editor.office_with_reg", "com.android.contacts", "com.nubo.nubosettings", "com.android.calculator2", "com.android.browser", "com.android.gallery", "com.android.camera"];

function loadAdminParamsFromSession(req, res, callback) {
    setting.loadAdminParamsFromSession(req, res, callback);
}

/*
 * The 'createRule' function shall receive rule params and return the iptables command
 * @appID - UID according to packages.list
 * @userID - logged in UID
 * @ip, @mask, @port, @protocol - rule params
 * @addOrRemove - add or delete rule from table
 * @ipVersion - v4 or v6
 * @email - email account
 */
function createRule(appID, userID, ip, mask, port, protocol, addOrRemove, ipVersion, accessStatus, callback) {

    var mUID = userID.toString() + appID.toString();

    if (accessStatus == "open") {
        var mOutputRuleV4 = "iptables -A " + userID + "_OUTPUT  -m owner --uid-owner " + mUID + " -j ACCEPT;";
        var mOutputRuleV6 = "ip6tables -A " + userID + "_OUTPUT  -m owner --uid-owner " + mUID + " -j ACCEPT;";
        var mInputRuleV4 = "iptables -A " + userID + "_INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT;";
        var mInputRuleV6 = "ip6tables -A " + userID + "_INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT;";
        callback(null, mOutputRuleV4 + mOutputRuleV6 + mInputRuleV4 + mInputRuleV6);
        return;
    }

    var mProtocol = " ";
    if (ipVersion == Firewall.ipv4) {
        var iptables = "iptables";
    } else if (ipVersion == Firewall.ipv6) {
        var iptables = "ip6tables";
    } else {
        callback("ERR:: Wrong ipVersion");
        return;
    }
    if (addOrRemove == Firewall.add) {
        var chainRule = iptables + " -A ";
    } else {
        var chainRule = iptables + " -D ";
    }

    var mIP = ip + "/" + mask;
    var mDPort = " --dport " + port;
    var mSPort = " --sport " + port;
    if (protocol != "All Protocols") {

        mProtocol = " -p " + protocol;
        var mOutputRule = chainRule + userID + "_OUTPUT -d " + mIP + mProtocol + mDPort + " -m owner --uid-owner " + mUID + " -j ACCEPT;";
        var mInputRule = chainRule + userID + "_INPUT -s " + mIP + mProtocol + mSPort + " -m state --state ESTABLISHED,RELATED -j ACCEPT;";
        callback(null, mOutputRule + mInputRule);
        return;
    } else {
        var mProtocolTcp = " -p TCP";
        var mProtocolUdp = " -p UDP";
        var mProtocolIcmp = " -p ICMP";

        var mOutputRuleTCP = chainRule + userID + "_OUTPUT -d " + mIP + mProtocolTcp + mDPort + " -m owner --uid-owner " + mUID + " -j ACCEPT;";
        var mInputRuleTCP = chainRule + userID + "_INPUT -s " + mIP + mProtocolTcp + mSPort + " -m state --state ESTABLISHED,RELATED -j ACCEPT;";
        var mOutputRuleUDP = chainRule + userID + "_OUTPUT -d " + mIP + mProtocolUdp + mDPort + " -m owner --uid-owner " + mUID + " -j ACCEPT;";
        var mInputRuleUDP = chainRule + userID + "_INPUT -s " + mIP + mProtocolUdp + mSPort + " -m state --state ESTABLISHED,RELATED -j ACCEPT;";
        var mOutputRuleICMP = chainRule + userID + "_OUTPUT -d " + mIP + mProtocolIcmp + " -m owner --uid-owner " + mUID + " -j ACCEPT;";
        var mInputRuleICMP = chainRule + userID + "_INPUT -s " + mIP + mProtocolIcmp + " -m state --state ESTABLISHED,RELATED -j ACCEPT;";
        callback(null, mOutputRuleTCP + mInputRuleTCP + mOutputRuleUDP + mInputRuleUDP + mOutputRuleICMP + mInputRuleICMP);
        return;
    }

}

/*
 * The 'generateUserRules' function shall receive session and return iptables command
 * perform the following:
 * 			select apps that belong to user
 * 			select rules that belong to apps
 * 			call to getAppID with package name
 * 			call to createRule with rule params
 * @session - session params
 * @addOrRemove - add or delete rule from table
 */
function generateUserRules(email, userID, platID, addOrRemove, callback) {

    /*
     var email = session.params.email;
     var userID = session.params.localid;
     var platID = session.params.platid;*/

    var mRule = "";
    var mAccessStatus;
    var mMainDomain;
    
    async.series([
    	
    function(callback) {
    	
        removeRulesFromTable(userID, platID, function(err, delCmd) {
            if (err) {
                callback(err);
                return;
            } else if (!delCmd) {
                callback("ERROR:generateUserRules: failed to removeRulesFromTable");
                return;

            } else {
                var mV4Table = "iptables -N " + userID + "_INPUT;iptables -N " + userID + "_OUTPUT;";
                var mV6Table = "ip6tables -N " + userID + "_INPUT;ip6tables -N " + userID + "_OUTPUT;";
                var mV4Link = "iptables -A INPUT -j " + userID + "_INPUT;iptables -A OUTPUT -j " + userID + "_OUTPUT;";
                var mV6Link = "ip6tables -A INPUT -j " + userID + "_INPUT;ip6tables -A OUTPUT -j " + userID + "_OUTPUT;";
                mRule = delCmd + mV4Table + mV6Table + mV4Link + mV6Link;
                callback(null);
            }

        });

    },
    function(callback) {

        getMainDomainAndAccessStatus(email, function(err, mainDomain, accessStatus) {
            if (err) {
                callback(err);
                return;
            } else {
                mMainDomain = mainDomain;
                mAccessStatus = accessStatus;
                //TODO It's a temporary fix, need to be removed
                if (mAccessStatus == "open") {
                    generateOpenAccessRulesForSysApp(Firewall.add, mMainDomain, userID, platID, mAccessStatus, function(err, ruleCmd) {
                        if (err) {
                            callback(err);
                            return;
                        } else if (ruleCmd) {
                            mRule = mRule + ruleCmd;
                            callback(null);
                        }
                    });

                } else {
                    async.eachSeries(sysApps, function(packageName, callback) {
                        GeneralCreateRules(platID, userID, packageName, mMainDomain, Firewall.add, mAccessStatus, function(err, rule) {
                            if (err) {
                                callback("ERROR:GeneralCreateRules:createRule " + err);
                                return;
                            } else if (rule) {
                                mRule = mRule + rule;
                                callback(null);
                            } else {
                                callback(null);
                            }
                        });
                    }, function(err) {
                        if (err) {
                            logger.error(err);
                            callback(err);
                            return;
                        } else {
                            callback(null);
                            return;
                        }
                    });

                }
            }
        });
    },
    function(callback) {
    	
        Common.db.UserApps.findAll({
            attributes : ['packagename', 'maindomain'],
            where : {
                email : email,
            },
        }).complete(function(err, results) {

            if (!!err) {
                var msg = 'ERROR: generateUserRules - get packagename from user_apps' + err;
                callback(msg);
                return;
            } else if (!results || results == "") {
                callback(null);
                return;
            } else {
                var async_results = results;
                async.eachSeries(async_results, function(row_packagename, callback) {
                    var mainDomain = row_packagename.maindomain ? row_packagename.maindomain : null;
                    var packageName = row_packagename.packagename ? row_packagename.packagename : null;
                    GeneralCreateRules(platID, userID, packageName, mainDomain, Firewall.add, mAccessStatus, function(err, rule) {
                        if (err) {
                            callback("ERROR:GeneralCreateRules:createRule " + err);
                            return;
                        } else if (rule) {
                            mRule = mRule + rule;
                            callback(null);
                        } else {
                            callback(null);
                        }
                    });

                }, function(err) {
                    if (err) {
                        logger.error(err);
                        callback(err);
                        return;
                    } else {
                        callback(null);
                        return;
                    }
                });
            }

        });

    }], function(err) {

        if (err) {
            callback(err, mRule);
            return;
        } else {
            callback(null, mRule);
            return;
        }
    });
    //async.series([

}

function updateOnlineUsersOpenCloseAccess(domain, callback) {

    var usersess = [];
    Common.db.User.findAll({
        attributes : ['email'],
        where : {
            orgdomain : domain
        },
    }).complete(function(err, results) {

        if (!!err) {
            callback('ERROR: updateOnlineUsersOpenCloseAccess.findAll' + err);
            return;
        }

        if (!results || results == "") {
            callback(null);
            return;

        } else {
            results.forEach(function(row) {
                var email = row.email != null ? row.email : '';
                usersess.push("usersess_" + email);
            });

            Common.redisClient.sunion(usersess, function(err, replies) {
                if (err) {
                    callback("ERROR:updateOnlineUsersRule.SUNION " + err);
                    return;
                } else if (!replies) {
                    callback(null);
                    return;
                } else {
                    //sharon
                    async.eachSeries(replies, function(row, callback) {
                        Common.redisClient.hgetall("sess_" + row, function(err, session) {
                            if (err) {
                                callback("ERROR:" + err);
                                return;
                            } else {
                                generateUserRules(session.email, session.localid, session.platid, Firewall.add, function(err, ruleCmd) {
                                    if (err) {
                                        callback("ERROR:updateOnlineUsersOpenCloseAccess.generateUserRules " + err);
                                        return;
                                    } else {
                                        var PlatformModule = require('./platform.js');
                                        PlatformModule.addOnlineRuleToPlatform(session.platid, '', ruleCmd, function(err) {
                                            if (err) {
                                                callback("Error:: updateRulesInIptables.PlatformModule.addOnlineRuleToPlatform " + err);
                                            } else {
                                                callback(null);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }, function(err) {
                        if (err) {
                            logger.error(err);
                            callback(err);
                            return;
                        } else {
                            callback(null);
                            return;
                        }
                    });
                }
            });
        }

    });

}

function GeneralCreateRules(platID, userID, packageName, domain, addOrRemove, accessStatus, callback) {

    var mRule = "";
    if (accessStatus == "open") {
        getAppID(platID, packageName, function(err, appID) {
            if (err) {
                callback("ERROR:GeneralCreateRules: getAppID " + err);
                return;
            } else if (appID) {
                createRule(appID, userID, null, null, null, null, null, null, accessStatus, function(err, rule) {
                    if (err) {
                        callback("ERROR:GeneralCreateRules:createRule " + err);
                        return;
                    } else if (rule) {
                        callback(null, rule);
                        return;
                    } else {
                        callback("ERROR:GeneralCreateRules:createRule rule is null");
                        return;
                    }
                });
            } else {
                callback("ERROR:GeneralCreateRules:getAppID appID is null!!!");
                return;
            }
        });
    } else {

        Common.db.AppRules.findAll({
            attributes : ['ip', 'port', 'protocol', 'mask', 'ipversion'],
            where : {
                packagename : packageName,
                maindomain : domain,
            },
        }).complete(function(err, results) {
            if (err) {
                callback('ERROR:GeneralCreateRules: get rules from app_rules' + err);
                return;
            } else if (!results || results == "") {
                callback(null);
            } else {
                async.eachSeries(results, function(row_rule, callback) {
                    var mIP = row_rule.ip ? row_rule.ip : null;
                    var mPort = row_rule.port ? row_rule.port : null;
                    var mProtocol = row_rule.protocol ? row_rule.protocol : null;
                    var mMask = row_rule.mask ? row_rule.mask : null;
                    var mIpVersion = row_rule.ipversion ? row_rule.ipversion : null;
                    getAppID(platID, packageName, function(err, appID) {
                        if (err) {
                            callback("ERROR:GeneralCreateRules: getAppID " + err);
                            return;
                        } else if (appID) {
                            createRule(appID, userID, mIP, mMask, mPort, mProtocol, addOrRemove, mIpVersion, accessStatus, function(err, rule) {
                                if (err) {
                                    callback("ERROR:GeneralCreateRules:createRule " + err);
                                    return;
                                } else if (rule) {
                                    mRule = mRule + rule;
                                    callback(null);
                                } else {
                                    callback("ERROR:GeneralCreateRules:createRule rule is null");
                                    return;
                                }
                            });
                        } else {
                            callback("ERROR:GeneralCreateRules:getAppID appID is null!!!");
                            return;
                        }
                    });
                }, function(err) {
                    if (err) {
                        logger.error(err);
                        callback(err);
                        return;
                    } else {
                        callback(null, mRule);
                        return;
                    }
                });
            }

        });
    }
}

/*
 * The 'getAppID' function shall receive platID, appName,  return appUID
 * @platID - platform id
 * @packageName - package name
 */
function getAppID(platID, packageName, callback) {

    var mPackageName;
    if (packageName == "com.android.email") {
        mPackageName = "com.android.exchange";
    } else {
        mPackageName = packageName;
    }
    Common.redisClient.hget('platform_' + platID + '_packagesUID', mPackageName, function(err, replies) {
        if (err) {
            callback("ERROR:" + err);
            return;
        } else {
            callback(null, replies);
            return;
        }
    });
}

/*
 * The 'addNuboRules' function shall receive platID and return iptables command
 * that allow MGMT and GW on a private network to connect to platform
 * @platID - platform id
 */
function addNuboRules(platform_ip, callback) {

    var mgmtIP;
    var mServerurl = Common.serverurl;

    if (platform_ip != null) {
        var mPlatform_ip_out = "iptables -I OUTPUT -d " + platform_ip + "/" + Common.nuboMask + " -j ACCEPT;";
        var mPlatform_ip_in = "iptables -I INPUT -s " + platform_ip + "/" + Common.nuboMask + " -j ACCEPT;";
        var mLocalHost_ip_out = "iptables -I OUTPUT -d 127.0.0.1 -j ACCEPT;";
        var mLocalHost_ip_in = "iptables -I INPUT -s 127.0.0.1 -j ACCEPT;";
        var mIptablesPolicy = "iptables -P INPUT DROP;iptables -P OUTPUT DROP;";

        validateIP(mServerurl, function(validateResult) {
            if (validateResult === false) {
                var mServerurl1 = mServerurl.split("://");
                mServerurl1 = ((mServerurl1[mServerurl1.length - 1]).split(/[:/]/g))[0];
                var cmd = 'nslookup ' + mServerurl1 + '| grep "Address: "';
                logger.info("cmd: " + cmd);
                var child = exec(cmd, function(error, stdout, stderr) {
                    mgmtIP = stdout.replace(/["Address: ""\n"]/g, "");
                    if (error) {
                        callback("ERROR::addNuboRules: Cannot find MGMT IP");
                        return;
                    } else {
                        validateIP(mgmtIP, function(validateResult) {
                            if (validateResult === false) {
                                callback("ERROR::addNuboRules: Invalid MGMT IP");
                                return;
                            } else {
                                var mHost_ip_out = "iptables -I OUTPUT -d " + mgmtIP + " -j ACCEPT;";
                                var mHost_ip_in = "iptables -I INPUT -s " + mgmtIP + " -j ACCEPT;";
                                var mIptablesCMD = mPlatform_ip_out + mPlatform_ip_in + mHost_ip_out + mHost_ip_in + mLocalHost_ip_in + mLocalHost_ip_out + mIptablesPolicy;
                                logger.info(" firewall - mIptablesCMD  - " + mIptablesCMD);
                                callback(null, mIptablesCMD);
                                return;
                            }
                        });

                    }
                });
            } else {
                var mHost_ip_out = "iptables -I OUTPUT -d " + mServerurl + " -j ACCEPT;";
                var mHost_ip_in = "iptables -I INPUT -s " + mServerurl + " -j ACCEPT;";
                var mIptablesCMD = mPlatform_ip_out + mPlatform_ip_in + mHost_ip_out + mHost_ip_in + mLocalHost_ip_in + mLocalHost_ip_out + mIptablesPolicy;
                logger.info(" firewall - mIptablesCMD  - " + mIptablesCMD);
                callback(null, mIptablesCMD);
                return;
            }
        });
    } else {
        callback("ERROR:: Cannot find platform_ip");
        return;
    }

}

/*
 * The 'saveAppsUID' function shall receive packagesList, platID and save packagename<->uid in redis
 * @packagesList - list of all apps from platform
 * @platID - platform id
 */
function saveAppsUID(packagesList, platID, callback) {
	
    var mPackageArray = {};
    async.series([

    function(callback) {
        packagesList.forEach(function(row) {
            mPackageArray[row.packageName] = row.offset;
        });
        callback(null);
    },

    function(callback) {
        Common.redisClient.hmset('platform_' + platID + '_packagesUID', mPackageArray, function(err, obj) {
            if (err) {
                callback(err);
                return;
            } else {
                callback(null);
                return;
            }
        });
    }], function(err, results) {
        if (err) {
            callback("ERR::saveAppsUID::" + err);
            return;
        } else {
            callback(null);
            return;
        }
    });
}

/*
 * The 'updateOnlineUsersRule' function shall receive new rule params and serach for online user
 * and call to updateRulesInIptables with user session
 * @packageName - package name
 * @ip, @mask, @port, @protocol, @ipVersion- rule params
 * @addOrRemove - add or delete rule from table
 */
function updateOnlineUsersRule(packageName, ip, port, protocol, mask, domain, ipVersion, addOrRemove, callback) {

    var email;
    if (sysApps.indexOf(packageName) >= 0) {
        updateOnlineUsersOpenCloseAccess(domain, function(err) {
            if (err) {
                logger.error(err);
                callback(err);
            } else {
                callback(null);
            }

        });
    }
    //updateOnlineUsersOpenCloseAccess
    var usersess = [];
    Common.db.UserApps.findAll({
        attributes : ['email'],
        where : {
            packagename : packageName,
            maindomain : domain
        },
    }).complete(function(err, results) {

        if (!!err) {
            callback('ERROR: updateOnlineUsersRule.findAll' + err);
            return;
        }

        if (!results || results == "") {
            //check in  sysApps
            callback(null);
            return;

        } else {
            results.forEach(function(row) {
                email = row.email != null ? row.email : '';
                usersess.push("usersess_" + email);
            });

            Common.redisClient.sunion(usersess, function(err, replies) {
                if (err) {
                    callback("ERROR:updateOnlineUsersRule.SUNION " + err);
                    return;
                } else if (!replies) {
                    callback(null);
                    return;
                } else {
                    updateRulesInIptables(packageName, ip, port, protocol, mask, domain, ipVersion, addOrRemove, replies, email, function(err) {
                        if (err) {
                            callback("ERROR:updateOnlineUsersRule.updateRulesInIptables " + err);
                            return;
                        } else {
                            callback(null);
                            return;
                        }
                    });
                }
            });
        }

    });

}

/*
 * The 'updateRulesInIptables' function shall receive new rule params sessions and update all online users
 * @packageName - package name
 * @ip, @mask, @port, @protocol, @ipVersion- rule params
 * @addOrRemove - add or delete rule from table
 * @sessions - sessions array
 */
function updateRulesInIptables(packageName, ip, port, protocol, mask, domain, ipVersion, addOrRemove, sessions, email, callback) {

    var limit = 5;
    var mAccessStatus;

    getMainDomainAndAccessStatus(email, function(err, mainDomain, accessStatus) {
        if (err) {
            callback(err);
            return;
        } else {
            mAccessStatus = accessStatus;
        }
    });

    async.eachLimit(sessions, limit, function(session, callback) {
        Common.redisClient.hgetall("sess_" + session, function(err, replies) {
            if (err) {
                callback("ERROR:" + err);
                //return;
            } else if (!replies) {
                callback(null);
                //return;
            } else {
                getAppID(replies.platid, packageName, function(err, appID) {
                    if (err) {
                        callback("Error:: updateRulesInIptables.getAppID " + err);
                        //return;
                    } else {
                        createRule(appID, replies.localid, ip, mask, port, protocol, addOrRemove, ipVersion, mAccessStatus, function(err, rule) {
                            if (err) {
                                callback("Error:: updateRulesInIptables.createRule " + err);
                                //return;
                            } else {
                                var PlatformModule = require('./platform.js');
                                PlatformModule.addOnlineRuleToPlatform(replies.platid, '', rule, function(err) {
                                    if (err) {
                                        callback("Error:: updateRulesInIptables.PlatformModule.addOnlineRuleToPlatform " + err);
                                    } else {
                                        callback(null);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }, function(err) {
        // Check if there was a problem with the apk itself and notify the user
        if (err) {
            logger.error(err);
            callback(err);
            return;
        } else {
            callback(null);
            return;
        }
    });
}

/*
 * The 'removeRulesFromTable' function shall receive session and return command to remove all user rules from table
 * @sessions - sessions array
 */
function removeRulesFromTable(userID, platID, callback) {

    var mV4Table = "iptables -F " + userID + "_INPUT;iptables -X " + userID + "_INPUT;iptables -F " + userID + "_OUTPUT;iptables -X " + userID + "_OUTPUT;";
    var mV6Table = "ip6tables -F " + userID + "_INPUT;ip6tables -X " + userID + "_INPUT;ip6tables -F " + userID + "_OUTPUT;ip6tables -X " + userID + "_OUTPUT;";
    var mV4Link = "iptables -D INPUT -j " + userID + "_INPUT;iptables -D OUTPUT -j " + userID + "_OUTPUT;";
    var mV6Link = "ip6tables -D INPUT -j " + userID + "_INPUT;ip6tables -D OUTPUT -j " + userID + "_OUTPUT;";

    callback(null, mV4Link + mV6Link + mV4Table + mV6Table);
    return;

}

/*
 * The 'installAPKGetRuleForRunningUser'
 */

function addRuleForRunningUserFromInstallAPK(packageName, domain, addOrRemove, userIdInPlatform, platformID, email, callback) {

    var mAccessStatus;
    getMainDomainAndAccessStatus(email, function(err, mainDomain, accessStatus) {
        if (err) {
            callback(err);
            return;
        } else {
            mAccessStatus = accessStatus;
            if (mAccessStatus == "open") {
                getAppID(platformID, packageName, function(err, appID) {
                    if (err) {
                        callback("ERROR:GeneralCreateRules: getAppID " + err);
                        return;
                    } else if (appID) {
                        createRule(appID, userIdInPlatform, null, null, null, null, null, null, mAccessStatus, function(err, rule) {
                            if (err) {
                                callback("ERROR:GeneralCreateRules:createRule " + err);
                                return;
                            } else if (rule) {
                                var PlatformModule = require('./platform.js');
                                PlatformModule.addOnlineRuleToPlatform(platformID, '', rule, function(err) {
                                    if (err) {
                                        callback("Error:: updateRulesInIptables.PlatformModule.addOnlineRuleToPlatform " + err);
                                        return;
                                    } else {
                                        callback(null);
                                        return;
                                    }
                                });
                            } else {
                                callback("ERROR:GeneralCreateRules:createRule rule is null");
                                return;
                            }
                        });
                    } else {
                        callback("ERROR:GeneralCreateRules:getAppID appID is null!!!");
                        return;
                    }
                });

            } else {
                Common.db.AppRules.findAll({
                    attributes : ['ip', 'port', 'protocol', 'mask', 'ipversion'],
                    where : {
                        maindomain : domain,
                        packageName : packageName,
                    },
                }).complete(function(err, results) {
                    if (!!err) {
                        callback(err);
                        return;
                    } else {
                        async.eachSeries(results, function(row, callback) {
                            var ip = row.ip != null ? row.ip : '';
                            var port = row.port != null ? row.port : '';
                            var protocol = row.protocol != null ? row.protocol : '';
                            var mask = row.mask != null ? row.mask : '';
                            var ipVersion = row.ipversion != null ? row.ipversion : '';
                            getAppID(platformID, packageName, function(err, appID) {
                                if (err) {
                                    callback("Error:: updateRulesInIptables.getAppID " + err);
                                } else {
                                    createRule(appID, userIdInPlatform, ip, mask, port, protocol, addOrRemove, ipVersion, mAccessStatus, function(err, rule) {
                                        if (err) {
                                            callback("Error:: updateRulesInIptables.createRule " + err);
                                        } else {
                                            var PlatformModule = require('./platform.js');
                                            PlatformModule.addOnlineRuleToPlatform(platformID, '', rule, function(err) {
                                                if (err) {
                                                    callback("Error:: updateRulesInIptables.PlatformModule.addOnlineRuleToPlatform " + err);
                                                } else {
                                                    callback(null);
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }, function(err) {
                            if (err) {
                                logger.error(err);
                                callback(err);
                                return;
                            } else {
                                callback(null);
                                return;
                            }
                        });
                    }
                });
            }
        }
    });

}

function validateIP(ip, callback) {

    var r,
        m,
        x,
        i,
        j,
        f = String.fromCharCode;
    if (!ip || ip == "") {
        callback(false);
        return;
    }
    m = ip.match(/^(?:\d{1,3}(?:\.|$)){4}/);
    // IPv4
    if (m) {
        try {
            m = m[0].split('.');
            m = f(m[0]) + f(m[1]) + f(m[2]) + f(m[3]);
            // Return if 4 bytes, otherwise false.
            callback(m.length === 4 ? "v4" : false);
            return;
        } catch (e) {
            callback(false);
            return;
        }
    }

    r = /^((?:[\da-f]{1,4}(?::|)){0,8})(::)?((?:[\da-f]{1,4}(?::|)){0,8})$/;
    m = ip.match(r);
    // IPv6
    if (m) {
        try {
            // Translate each hexadecimal value.
            for ( j = 1; j < 4; j++) {
                // Indice 2 is :: and if no length, continue.
                if (j === 2 || m[j].length === 0) {
                    continue;
                }
                m[j] = m[j].split(':');
                for ( i = 0; i < m[j].length; i++) {
                    m[j][i] = parseInt(m[j][i], 16);
                    // Would be NaN if it was blank, return false.
                    if (isNaN(m[j][i])) {
                        callback(false);
                        // Invalid IP.
                        return;
                    }
                    m[j][i] = f(m[j][i] >> 8) + f(m[j][i] & 0xFF);
                }
                m[j] = m[j].join('');
            }
            x = m[1].length + m[3].length;
            if (x === 16) {
                callback("v6");
                return;
            } else if (x < 16 && m[2].length > 0) {
                callback("v6");
                return;
            }
        } catch (e) {
            callback(false);
            return;
        }
    }
    callback(false);
    // Invalid IP.
    return;
}

function getMainDomainAndAccessStatus(email, callback) {

    var mMainDomain;
    var mAccessStatus;

    Common.db.User.findAll({
        attributes : ['orgdomain'],
        where : {
            email : email
        },
    }).complete(function(err, results) {

        if (!!err) {
            callback("ERROR:isNeedToGenerateOpenAccessRules: failed to getOrgdomainFromTable");
            return;
        } else if (results[0].orgdomain) {
            mMainDomain = results[0].orgdomain;
            Common.db.Orgs.findAll({
                attributes : ['accessstatus'],
                where : {
                    maindomain : mMainDomain
                },
            }).complete(function(err, results) {

                if (!!err) {
                    callback("ERROR:isNeedToGenerateOpenAccessRules: failed to getAccessStatusFromTable");
                    return;
                } else {
                    mAccessStatus = results[0].accessstatus;
                    callback(null, mMainDomain, mAccessStatus);
                    return;
                }

            });
        } else {
            callback("ERROR:isNeedToGenerateOpenAccessRules: failed to getOrgdomainFromTable");
            return;
        }

    });

}

function generateOpenAccessRulesForSysApp(addOrRemove, domain, userID, platID, openAccess, callback) {

    var mRule = "";

    async.eachSeries(sysApps, function(packageName, callback) {
        getAppID(platID, packageName, function(err, appID) {
            if (err) {
                callback("ERROR:generateOpenAccessRulesForSysApp: getAppID " + err);
                return;
            } else if (appID) {
                createRule(appID, userID, null, null, null, null, Firewall.add, null, openAccess, function(err, rule) {
                    if (err) {
                        callback("ERROR:generateOpenAccessRulesForSysApp:createRule " + err);
                        return;
                    } else if (rule) {
                        mRule = mRule + rule;
                        callback(null);
                    } else {
                        callback("ERROR:generateOpenAccessRulesForSysApp:createRule rule is null");
                        return;
                    }
                });
            } else {
                callback("ERROR:generateOpenAccessRulesForSysApp:getAppID appID is null!!!");
                return;
            }
        });
    }, function(err) {
        if (err) {
            logger.error(err);
            callback(err);
            return;
        } else {
            callback(null, mRule);
            return;
        }
    });

}

var firewall = {
    saveAppsUID : saveAppsUID,
    addNuboRules : addNuboRules,
    generateUserRules : generateUserRules,
    updateOnlineUsersRule : updateOnlineUsersRule,
    Firewall : Firewall,
    removeRulesFromTable : removeRulesFromTable,
    addRuleForRunningUserFromInstallAPK : addRuleForRunningUserFromInstallAPK,
    validateIP : validateIP,
    updateOnlineUsersOpenCloseAccess : updateOnlineUsersOpenCloseAccess
};

module.exports = firewall;
