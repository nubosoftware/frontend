"use strict";

var Common = require( './common.js' );
var logger = Common.logger;
var http = require( './http.js' );
var url = require( "url" );
var internalRequests = require( './internalRequests.js' );
var User = require( './user.js' );
var async = require('async');

module.exports = {
    createTrialProd : createTrialProd
};

function createTrialProd(req, res, next) {
    // https://server_url/createTrialProd?email=[]
    res.contentType = 'json';
    var status = 1;
    var msg = "";
    var domainEmail = "";

    var email = req.params.email;
    if (!email || email == "") {
        logger.info( "createTrial. Invalid email " + email );
        status = 0;
        msg = "Invalid parameters";
    }

    var forceAdmin = req.params.forceAdmin;
    if (!forceAdmin || !forceAdmin == "Y") {
        forceAdmin = "N";
    }

    if (status != 1) {
        res.send( {
            status : status,
            message : msg
        } );
        return;
    }
    
    createTrialInternal(email, forceAdmin, function(err) {
        if (err) {
            res.send({
                status : 0,
                message : err
            });
            return;
        }
        
        res.send({
            status : 1,
            message : "created admin successfully"
        });
        return;
    });
}

function createTrialInternal(email, forceAdmin, callback) {
    var myDomain = "";
    var isFirstTime = false;
    
    async.series([
        function(callback) {
            User.checkUserDomain( email, function(err, domain) {
                myDomain = domain;
                if (err) {
                    if (err === "Domain not found") {
                        isFirstTime = true;
                        callback(null);
                        return;
                    }
                    isFirstTime = false;
                    callback(err);
                    return;
                } else {
                    isFirstTime = false;
                    callback(null);
                    return;
                }
            });
        }, function(callback) {
            if (!isFirstTime) {
                Common.db.User.findAll({
                    attributes : ['username', 'email', 'isadmin', 'orgdomain'],
                    where : {
                        isadmin : 1,
                        orgdomain : myDomain
                    },
                }).complete( function(err, results) {
                    
                    if (!!err) {
                        var errormsg = 'Error on get admin details: ' + err;
                        logger.error(errormsg);
                        callback(errormsg);
                        return;
                        
                        // goes here if we don't find this admin in the database
                    } else if (results.length === 0) {
                        callback(null);
                        return;
                    } else {
                        if (forceAdmin == "Y") {
                            callback(null);
                            return;
                        } else {
                            // we found admin, so we send err that admin already exists
                            callback("Admin is already exists in organization");
                            return;
                        }
                    }
                });
            } else {
                callback(null);
                return;
            }
        }, function(callback) {
            internalRequests.createOrReturnUserAndDomain( email, logger, function(err, user, userObj, orgObj) {
                if (err) {
                    logger.error( "checkIfNeedRedirection: couldn't get user, " + err );
                    callback(err);
                    return;
                }
                callback(null);
                return;
            } );
        }, function(callback) {
            internalRequests.setAdminInDB(email, myDomain, function(err) {
                if (err) {
                    logger.info( "err setAdminInDB" + err );
                    callback(err);
                    return;
                }
                callback(null);
                return;
            })
        }], function(err) {
            if (err) {
                logger.info( "Error - - - - " + err );
                callback(err);
                return;
            }
            logger.info( "Done..." );
            callback(null);
            return;
        } );
}