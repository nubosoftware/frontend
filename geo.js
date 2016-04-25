"use strict";

var Common = require('./common.js');
var logger = Common.logger;


function lookup(ip,callback) {
	if (Common.isGeoIP == false) {
		callback("GeoIP disabled",null);
		return;
	}
	if (ip.indexOf('127.0.0.1') == 0) {
		logger.info("GeoIP ignoring local address");
		callback("Local Address",null);	
		return;
	} 
	if (ip.indexOf('10.') == 0) 
	  ip="194.90.1.5";
	Common.redisClient.hgetall('geoip_'+ip,function (err, obj) {
		if (err) {
	       logger.info("GeoIP Redis Error: "+err);
	       callback(err,null);
		   return;
	     }
	     if (obj!=null) {
	     	logger.info( "Country (from redis): "+obj.countryCode );
	     	callback(null,obj);	     	     
	     	return;        	
	     } else { 
				Common.geoip.lookup( ip, function( err, data ) {
    				if( !err ) {
        				logger.info( "Country: "+data.countryCode );
        				// update geoip data in redis
        				Common.redisClient.hmset('geoip_'+ip,data,function (err, obj) {
        					if (err) {
		    					logger.info("Error in save hmset:"+err);								
								return;
		  					} else {
		    					Common.redisClient.expire('geoip_'+ip,2592000,function (err, obj) {		    		  			  								   
		    					});	
		  
		  					} // else	
        				});        				
        				callback(null,data);        				
    				} else {
        				logger.info( "GeoIP Error: " +err+", ip: "+ip);
        				callback("GeoIP Error: " +err,null);         				        				
    				}
    				
				}); // Common.geoip.lookup
		} // else
	}); // redisClient.hgetall
	
}

var Geo = {
	lookup: lookup
};

module.exports = Geo;
