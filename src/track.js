"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var request = require('./request.js');

function trackAPI(eventData, callback) {
	if (!Common.trackURL) {
		if (callback) 
		 	callback("Missing trackURL");
		return;
	}
	
	eventData.tags = "Nubo App";	
	
	var options = {
		uri : Common.trackURL,
		method : 'POST',
		json : {
			"eventData" : eventData,
			"tid" : "t532564864136e76bedbadd30"			
		}
	};

	request(options, function(error, response, body) {
		var status = 1;
		var msg;
		if (!error && response.statusCode == 200) {
			status = body.status;			
			msg= "TrackAPI Result: "+JSON.stringify(body,null,2);			
		} else if (error){
			msg = "Error in request to TrackAPI: "+error;
		} else {
			msg = "Http error in TrackAPI: " + response.statusCode;
		}
		logger.info(msg);
		if (callback) {
			callback(status==0 ? null : msg);
		}
	});

}

var Track = {
	trackAPI : trackAPI
};
module.exports = Track; 