"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var async = require('async');
var util = require('util');
var exec = require('child_process').exec;

var Session,getSessionOfUserDevice,getUserPlatforms,getSessionsOfUser,setUserDeviceLock,releaseUserDeviceLock,getSessionFromPlatformReference;
var gatewayModule = require('./Gateway.js');




var Session = function (sessid, opts, callback) {
    if(typeof opts === "function") {
        callback = opts;
    } else {
        if(opts.logger) var logger = opts.logger;
    }
    
    var newSession = false;
	
	this.params = {sessid: sessid, suspend: 0, totalActiveSeconds: 0 };
	this.platform = [];
	this.logger = logger;
	
	this.save = function(callback) {         	 
	  (function (sess) {
	    if ( Object.keys(sess.params).length<=1 ) {
	      var stack = new Error().stack;
          console.log("Save session with one param: "+ stack );
        }

        Common.redisClient.hmset('sess_'+sess.params.sessid,sess.params,function (err, obj) {
		  if (err) {
		    logger.info("Error in save hmset:"+err);
			if (callback) callback(err,null);
			return;
		  } else {
		    if (newSession) {
		      newSession = false;
		      Common.redisClient.SADD('sessions',sess.params.sessid,function(err,reply){
	  		    if (err) {
	  	          if (callback) callback(err,sess);
	  		      return;
	  		    }
	  		    if (callback) callback(err,sess);
	  	      });
		    } else
			  if (callback) callback(err,sess);
		  } // else
	    }); //hmset 
	  }) (this); //function (sess)       
    }; // save
    
    this.suspend = function(suspend,callback) {
      var now = new Date();           
      this.params.suspend = suspend ;
	  this.params.suspendtime = now.toFormat("YYYY-MM-DD HH24:MI:SS");	  
	  this.save(function(err,sess){
	    if (err) {
	      if (callback) callback(err);
	      return;
	    }
	    if (suspend==0) {
	      Common.redisClient.ZREM('suspend_sessions',sess.params.sessid,function(err){
	        if (callback) callback(err);
	      });
	    } else {
	      Common.redisClient.ZADD('suspend_sessions',now.getTime(),sess.params.sessid,function(err){
	        if (callback) callback(err);
	      });
	    }
	  }); // save
    }; //suspend

    this.forceExit = function(callback) {
        var now = new Date();
        this.params.forceExit = 1;
        this.params.suspendtime = now.toFormat("YYYY-MM-DD HH24:MI:SS");
        this.save(function(err, sess) {
            if (err) {
                callback(err);
                return;
            }
            Common.redisClient.ZADD('suspend_sessions', 0, sess.params.sessid, function(err) {
                callback(err);
            });
        }); // save
    }; //forceExit

    this.del = function(callback) {
        var logger = this.logger;
        var self = this;

        Common.redisPool.acquire(function(err, client) {
            var multi = client.multi();
            multi.del('sess_' + self.params.sessid);
            multi.del('usersess_' + self.params.email + '_' + self.params.deviceid);
            multi.srem('sessions', self.params.sessid);
            multi.srem('usersess_' + self.params.email, self.params.sessid);
            multi.zrem('suspend_sessions', self.params.sessid);
            multi.exec(function(err, replies) {
                Common.redisPool.release(client);
                if (err) {
                    var errMsg = "session.del: " + err;
                    logger.error(errMsg);
                    callback(errMsg);
                    return;
                }

                callback(null);
                return;
            });
        });
    }

    this.deletePlatformReference = function(callback) {

        var logger = this.logger;
        var platid = this.params.platid;
        var sessid = this.params.sessid;
        var localid = this.params.localid;

        Common.redisPool.acquire(function(err, client) {
            var multi = client.multi();
            multi.del('platsess_' + platid + '_' + localid);
            multi.srem('platsesslist_' + platid, sessid);
            multi.exec(function(err, replies) {
                Common.redisPool.release(client);
                if (err) {
                    var errMsg = "session.deletePlatformReference: " + err;
                    logger.error(errMsg);
                    callback(errMsg);
                    return;
                }

                callback(null);
                return;
            });
        });
    }

    this.updatePlatformReference = function(callback){
      if (!this.params.platid || !this.params.localid) {
    	callback("Missing params for updatePlatformReference");
    	return;
      }
      var platid = this.params.platid;
      var sessid = this.params.sessid;
      Common.redisClient.set('platsess_'+this.params.platid+'_'+this.params.localid,this.params.sessid,function (err) {
        if (err) {
          var msg = "Error on set updatePlatformReference: "+err;
          callback(msg);
          return;
        }
          Common.redisClient.SADD('platsesslist_'+platid,sessid,function (err) {
            if (err) {
              var msg = "Error on set updatePlatformReference: "+err;
              callback(msg);
              return;
            }

            Common.redisClient.HINCRBY('platform_'+platid,'created_sessions_cnt',1,function (err) {
              if(err){
                var msg = "updatePlatformReference: failed updating sessions counter";
                callback(msg);
                return;
              }
              callback(null);
            });
        });
	  }); // Common.redisClient.set
    };

	this.setUserAndDevice = function(email,deviceid,callback) {
		this.params.email = email;
		this.params.deviceid = deviceid;
		this.save(function(err,sess){
			if (err) {
			  callback(err);
			  return;
			}
			Common.redisClient.set('usersess_'+email+'_'+deviceid,sess.params.sessid,function (err) {
                            if(err) {
                                callback(err);
                            } else {
                                Common.redisClient.sadd('usersess_'+email,sess.params.sessid,function (err) {
                                    if (err) {
                                        Common.redisClient.del('usersess_'+email+'_'+deviceid,function () {
                                            callback(err);
                                        });
                                    } else {
                                        callback(null);
                                    }
                                });
                            }
			}); // Common.redisClient.set 
		}); // this.save
					
	} // this.setUserAndDevice

  this.setPlatform = function(platobj) {
    this.platform = platobj;
  };

  this.setLogger = function(logobj) {
    this.logger = logobj;
  };

    this.lock = function(obj,callback) {
        (function(sess) {
            var _obj, _callback;
            if (typeof (obj) === "function") {
                _callback = obj;
                _obj = {retries: 1, wait:0};
            } else {
                _callback = callback;
                _obj = obj;
            }
            setUserDeviceLock(
                    sess.params.email, sess.params.deviceid,
                    _obj.retries, _obj.wait,
                    _callback, sess.logger
            );
        })(this);
    }

    this.unlock  = function(callback) {
        (function(sess) {
            releaseUserDeviceLock(
                    sess.params.email, sess.params.deviceid,
                    callback, sess.logger
            );
        })(this);
    }; //setUserDeviceLock

	if (sessid==null) { // generate new session
	    newSession = true;
	    if (Common.withService) {
            //override session id with username in motorola project
	        this.params.sessid = opts.UserName;
        } else {
            var buf = Common.crypto.randomBytes(48);
            this.params.sessid = buf.toString('hex');
        }
	  	callback(null,this);
	  	return;	  	  	 
	  	 		
	} else { // load an existing session
          newSession = false;
	  (function (sess) {	  
	    var  reply = Common.redisClient.hgetall('sess_'+sess.params.sessid,function (err, obj) {
          //console.dir(obj);	
	      if (err) {
	        logger.info("err:"+err);
	        callback(err,sess);
		    return;
	      }
		  if (obj!=null) {
                    sess.params = obj;
		    callback(err,sess);	  	  		   	         
		    return;
		  } else {
		    callback("Cannot find session "+sess.params.sessid,null);	  	  
		    return;
		  }
        }); //hgetall  
	  }) (this); // unction (sess)   
	} // else // load an existing session
		
};


getSessionOfUserDevice = function(email, deviceid, callback) {

    Common.redisClient.get('usersess_' + email + '_' + deviceid, function(err, reply) {
        if (err) {
            callback(err, null);
            return;
        }
        if (reply == null) {
            callback(null, null); // session not found with no error
            return;
        }
        new Session(reply, function(err, obj) {
            if (err) {
                logger.error("getSessionOfUserDevice: " + err);
                callback(err, null);
                return;
            }

            callback(null, obj); //return found session   
        }); // new Session

    }); // Common.redisClient.get 
}; //getSessionOfUserDevice


getSessionsOfUser = function(email,callback) {
    Common.redisClient.SMEMBERS('usersess_'+email,function (err,replies) {
        if (err) {
            callback(err,null);
            return;
        }
        if (replies==null) {
            callback(null,null); // session not found with no error
            return;
        }
        var sessions = [];
        var i = 0;
        async.eachSeries(replies, function(reply, callback) {
            new Session(reply,function(err,obj) {
                if (err) {
                    console.log("Error: "+err);
                    callback(err,null);
                    return;
                }
                sessions[i] = obj;
                i++;
                callback(null);
            }); // new Session
            }, function(err) {
                 if (err) {
                     logger.info(err);
                 }
                 callback(sessions);
         });

    }); // Common.redisClient.get
}; //getSessionsOfUser

// in params:
// email - user's email
// userIdInPlatforms - empty array
//
// out:
// platforms - array of Platforms
// uniquePlatforms - array of Platforms
// userIdInPlatforms - array of localid in each platform (same length as platforms)
getUserPlatforms = function(email, callback) {
    var platforms = [];
    var uniquePlatforms = [];
    var userIdInPlatforms = [];
    var foundPlatIds = [];
    var deviceIds = [];
    var j = 0;
    getSessionsOfUser(email, function(sessArray){
        var i = 0;
        async.eachSeries(sessArray, function(session, callback) {
            var Platform = require('./platform.js').Platform;
            new Platform(session.params.platid, '', function(err,obj) {
                if (err) {
                    console.log("Error: "+err);
                } else {
                    platforms.push(obj);
                    // Save user id for later
                    userIdInPlatforms[i] = session.params.localid;
                    i++;
                    if (!foundPlatIds[session.params.platid]) {
                        foundPlatIds[session.params.platid] = true;
                        uniquePlatforms[j] = obj;
                        j++;
                    }
                }
                callback(null);
            }); // new Session
            }, function(err) {
                if (err) {
                    logger.info(err);
                }
                for (var k = 0; k < sessArray.length; ++k) {
                    deviceIds[k] = sessArray[k].params.deviceid;
                }
                callback(null, platforms, uniquePlatforms, userIdInPlatforms, deviceIds); // Exit function without error
         });
    });
};

getSessionFromPlatformReference = function(platid,localid,callback) {
	
  Common.redisClient.get('platsess_'+platid+'_'+localid,function (err,reply) {
    if (err) {
      callback(err,null);
      return;	
    }
    if (reply==null) {
    	callback(null,null); // session not found with no error
    	return;
    }
    new Session(reply,function(err,obj) {
		if (err) {
		  console.log("Error: "+err);
		  callback(err,null);
		  return;
		}
		//console.log('Session: '+JSON.stringify(obj,null,2));
		callback(null,obj); //return found session		
	}); // new Session
			
  }); // Common.redisClient.get	
}; //getSessionFromPlatformReference

setUserDeviceLock = function(email,deviceid,retries,wait,callback,specialLogger) {
  var mylogger = (specialLogger ? specialLogger : logger); 	
  mylogger.info("Try to get lock on "+email+'_'+deviceid);	
  Common.redisClient.SETNX('lock_'+email+'_'+deviceid,1,function (err,reply) {
    if (err) {
      mylogger.info("Error in the lock "+email+'_'+deviceid+" ,err: "+err);
      callback(err);
      return;	
    }
    if (reply==1) { 
        mylogger.info("*********Successfull lock on "+email+'_'+deviceid);
    	callback(null); // sucessfull lock
    	return;
    }
    if (retries<=0) {
        mylogger.info("Timeout in lock on "+email+'_'+deviceid); 
    	callback("Lock already exists");
    } else {
      mylogger.info("Wait on lock "+email+'_'+deviceid+", retries: "+retries); 	
      setTimeout(function() {              	                     
        setUserDeviceLock(email,deviceid,retries-1,wait,callback,specialLogger);
      }, wait);	
    }    			
  }); // Common.redisClient.SETNX	
}; //setUserDeviceLock

releaseUserDeviceLock  = function(email,deviceid,callback,specialLogger) {
  var mylogger = (specialLogger ? specialLogger : logger); 	
  mylogger.info("Try to release lock on "+email+'_'+deviceid);		
  Common.redisClient.DEL('lock_'+email+'_'+deviceid,function (err,reply) {
    if (err) {
      mylogger.info("Error in release lock "+email+'_'+deviceid+" ,err: "+err);
      callback(err);
      return;	
    }
    if (reply==1) {
      mylogger.info("*********Lock Released: "+email+'_'+deviceid);	  
    } else {
      mylogger.info("Lock not found !: "+email+'_'+deviceid+", reply: "+reply);
    }    
    callback(null);    			
  }); // Common.redisClient.SETNX	
}; //setUserDeviceLock

// test function
 var test = function() {
   /*
	var sess = new Session(null,function(err,obj) {
		if (err) {
		  console.log("Error: "+err);
		  return;
		}
		console.log('Session: '+JSON.stringify(obj,null,2));
		obj.params.deleteFlag = 0 ;
		obj.params['test1'] = 'test2';
		obj.save();
		
	});
	*/
	new Session('6cd8c879ca5b9a6ad067070b1ef0d79a045e64f1602f941de46d7fffac8c8a63f6ff3a0e760d6fa6e5664e6f14e900d5',function(err,obj) {
		if (err) {
		  console.log("Error: "+err);
		  return;
		}
		console.log('Session: '+JSON.stringify(obj,null,2));
		obj.params.deleteFlag = 5 ;
		obj.params['test1'] = 'gfdgfdg';
		obj.save();
		
	});
};

//test(); 

module.exports = {Session: Session, 
  getSessionOfUserDevice:getSessionOfUserDevice,
  getSessionsOfUser:getSessionsOfUser,
  setUserDeviceLock: setUserDeviceLock,
  releaseUserDeviceLock: releaseUserDeviceLock,
  getSessionFromPlatformReference: getSessionFromPlatformReference,
  getUserPlatforms : getUserPlatforms
  };
