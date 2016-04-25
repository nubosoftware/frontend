"use strict";


var Common = require('./common.js');
var async = require('async');
var logger = Common.logger;

var GW_MAX_CONNECTIONS = 1000;

var disableGateway = function(gwObj, callback) {
    if (gwObj === undefined ||
            gwObj === null) {
        var msg = "disableGateway. failed to disable gateway. gwObj: "+gwObj;
        callback(msg);
        return;
    }

    gwObj.isGWDisabled = true;
    Common.redisClient.hmset('gateway_'+gwObj.index, gwObj, function (err, retObj) {
        if (err) {
            var msg = "disableGateway: cannot execute hmset, err:"+err;
            callback(msg);
        } else {
            if (retObj == 'OK') {
                //terminate all gateways' sessions
                Common.redisClient.SMEMBERS('gwsesslist_'+gwObj.index,function(err,replies){
                    if (err) {
                        var msg = "disableGateway: cannot execute SMEMBERS, err:"+err;
                        callback(msg);
                    } else {
                        if (replies.length > 0) {
                            var processedSessions = 0;
                            var StartSessionModule = require('./StartSession.js');
                            for (var i=0;i<replies.length;i++) {
                                StartSessionModule.endSession(replies[i], function(err) {
                                    if (err) {
                                        logger.error("disableGateway: failed to end session");
                                    }

                                    ++processedSessions;
                                    if (processedSessions >= replies.length) {
                                        callback(null);
                                    }
                                });
                            }
                        } else {
                            removeGateway(gwObj.index, function(err) {
                                if (err) {
                                    var msg = "disableGateway: err: "+err;
                                    callback(msg);
                                } else {
                                    callback(null);
                                }
                            })
                        }
                    }
                });
            } else {
                var msg = "disableGateway: failed disabling gwIndex: "+gwObj.index+", err:"+err;
                callback(msg);
            }
        }
    });
};

var removeGateway = function(gwIndex, callback) {
    Common.redisPool.acquire(function(err, client) {
            var multi = client.multi();
            multi.zrem('gateways', gwIndex);
            multi.del('gateway_'+gwIndex);
            multi.del('gwsesslist_'+gwIndex);
            multi.exec(function (err, replies) {
                    if (err) {
                        logger.error("Cannot remove gateway from redis, err:", err);
                        callback(err);
                    } else {
                        callback(null);
                    }
                    Common.redisPool.release(client);
            });
    });
};

var updateGWSessionSet = function(gwIndex,inc,sessid,callback) {
    if (inc === 1) {
        Common.redisClient.SADD('gwsesslist_'+gwIndex,sessid,function (err) {
            if (err) {
                var msg = "updateGWSessionSet. Failed to add session: "+sessid+" to gwsesslist_"+gwIndex+", err: "+err;
                callback(msg);
            } else {
                callback(null);
            }
        });
    } else if (inc === -1) {
        Common.redisClient.SREM('gwsesslist_'+gwIndex,sessid,function (err) {
            if (err) {
                var msg = "updateGWSessionSet. Failed to add session: "+sessid+" to gwsesslist_"+gwIndex+", err: "+err;
                callback(msg);
            } else {
                callback(null);
            }
        });
    } else {
        var msg = "updateGWSessionSet. illegal session increase index: "+inc;
        callback(msg);
    }
};

//update gateway's number of sessions score
var updateGWSessionScore = function (gwIndex,inc,sessid, logger, callback) {
    Common.redisClient.ZINCRBY('gateways', inc, gwIndex, function(err,result) {
        if (err) {
            var msg = "updateGWSessionScore. Error increasing gateways score: " + err + ", gwIndex: "+gwIndex;
            callback(msg);
        } else {
                    logger.info("updateGWSessionScore. updated score: "+result);
                    if (result <= 0) {
                        Common.redisClient.hgetall('gateway_'+gwIndex,function (err, obj) {
                            if (err) {
                                var msg = "updateGWSessionScore. could not hgetall gwIndex: "+gwIndex;
                                logger.error(msg);
                                callback(msg);
                             } else {
                                if (obj || (inc < 0)) {
                                    if (!obj || (obj.isGWDisabled == 'true')) {
                                        removeGateway(gwIndex,function(err) {
                                            if (err) {
                                                logger.error(err);
                                            }

                                            callback(null);
                                        });
                                    } else {
                                        updateGWSessionSet(gwIndex,inc,sessid,function(err) {
                                            if (err) {
                                                logger.error(err);
                                            }

                                            callback(null);
                                        });
                                    }
                                } else {
                                    var msg = "updateGWSessionScore. could not find gwIndex: "+gwIndex;
                                    logger.error(msg);
                                    callback(msg);
                                }
                            }
                        });
                    } else {
                        updateGWSessionSet(gwIndex,inc,sessid,function(err) {
                            if (err) {
                                logger.error(err);
                            }

                            callback(null);
                        });
                    }
        }
    });
};


var getAvailableGW = function(gw, opts, callback) {
    logger = opts.logger;

    Common.redisClient.ZRANGEBYSCORE('gateways', '-inf', '(' + GW_MAX_CONNECTIONS, function(err, gateways) {
        if (err || gateways.length<1) {
            var errMsg = "getAvailableGW: no avalible gateways";
            callback(errMsg, null);
            return;
        }

        //traverse all gateways sorted by score from min to max and find the first
        //gw that passes all filters
        async.detectSeries(gateways, function(gwIndex, callback) {
            Common.redisClient.hgetall('gateway_' + gwIndex ,function (err, gateway) {
                if (err || !gateway) {
                    var errMsg = "getAvailableGW: cannot get gw #" + gwIndex;
                    logger.error(errMsg);
                    callback(false);
                    return;
                }

                var isSSL = (gateway.ssl == 'false') ? false : true;
                var isGWDisabled = (gateway.isGWDisabled == 'false') ? false : true;

                if (!isGWDisabled && Common['useSSLGateway'] == isSSL){
                    logger.info("getAvailableGW: selected gateway #" + gwIndex);
                    gw.params = gateway;
                    callback(true);
                }
                else{
                    callback(false);
                }
            });
        }, function(foundGW){
            if(foundGW){
                callback(null, gw);
            }
            else{
                var errMsg = "getAvailableGW: didn't found avalible GW";
                callback(errMsg, gw);
            }
        });
    });
};

// callback(err, obj) - obj is null if gatway does not exist, else we get object {index: int, internal_ip : str, external_ip : str, controller_port : int, apps_port : int, player_port: int, ssl : bool}
var Gateway = function (gw_obj, opts, callback) {
    this.params = gw_obj;

    this.save = function(callback) {
      (function (obj) {
        Common.redisClient.hmset('gateway_'+obj.params.index, obj.params, function (err, reply) {
          if (err) {
            if (callback) callback(err,null);
          } else {
             Common.redisClient.ZADD('gateways',0, obj.params.index, function(err,reply) {
                 if (err) {
                     if (callback) callback(err,null);
                 } else {
                     if (callback) callback(null,reply);
                 }
              });//ZADD
          } // else
        }); //hmset
      }) (this); //function (obj)
    }; // saveGWObj

    if (gw_obj) {
        (function (gw) {
            if (gw.params.index === -1) {
                getAvailableGW(gw, opts, callback);
            } else {
                Common.redisClient.hgetall('gateway_'+gw.params.index,function (err, obj) {
                    if (err) {
                        var msg = "Gateway: cannot execute hgetall, err:"+err;
                        logger.error(msg);
                        callback(msg, null);
                    } else {
                        if (obj) {
                            logger.info("Gateway: return, obj: "+obj);
                            gw.params = obj;
                            callback(null, gw);
                        } else {
                            var msg = "Gateway: gateway_" +gw.params.index + " does not exist";
                            //logger.info(msg);
                            callback(msg, gw);
                        }
                    }
                });
            }
        }) (this); //function (gw)
    } else {
        var msg = "Could not create Gateway. null gateway obj";
        logger.error(msg);
        callback(msg, null);
    }
};

//register new gateway
var registerGateway = function(gw_obj, callback) {
    Common.redisClient.INCR('gatewayseq',function(err,reply){
        gw_obj.index = reply;
        new Gateway(gw_obj, {logger: logger}, function (err, obj) {
            if (err) {
                if (obj) {
                    obj.save(function(err) {
                        if (err) {
                            var msg = "Cannot save gateway, err:" + err;
                            logger.error(msg);
                            callback(msg);
                        } else {
                            logger.info(gw_obj.index + " successfully registered");
                            callback(null);
                        }
                    });
                } else {
                    var msg = "Cannot register gateway. null object. err:" + err;
                    logger.error(msg);
                    callback();
                }
            } else {
                var msg = "Cannot register gateway. Gateway already exist: "+gw_obj.index+", err:" + err;
                logger.error(msg);
                callback(msg);
            }
        });
    });
};


var GatewayModule = {
//    func: gateway_request,
    Gateway: Gateway,
    registerGateway: registerGateway,
    updateGWSessionScore: updateGWSessionScore,
    disableGateway: disableGateway
};
module.exports = GatewayModule;
