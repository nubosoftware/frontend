"use strict";
/**
 * timeLog.js
 * Track the execution times of lonf operations
 * Write the output to the Commons.logger or to the logger supplied by the constructor
 */
var Common = require('./common.js');
var logger = Common.logger;
var MailChimpAPI = require('mailchimp').MailChimpAPI;

var MailingList = function(specialLogger) {
	this.apiKey = Common.mailChimpAPIKey;

	try {
		this.api = new MailChimpAPI(this.apiKey, {
			version : '2.0'
		});
	} catch (error) {
		logger.error("MailChimpAPI error: " + error.message);
	}

	this.subscribe = function(email, firstName, lastName, ipAddress,callback) {
		this.api.call('lists', 'subscribe', {
			id : Common.mailChimpListID,
			email : {
				email : email
			},
			merge_vars : {
				optin_ip : ipAddress,
				FNAME : firstName,
				LNAME : lastName
			},			
			double_optin : false // no double optin

		}, function(error, data) {
			if (error)
				logger.error("subscribe error: " + error.message);
			else
				logger.info(JSON.stringify(data, null, 2));
			if (callback) {
				callback(error);
			}
			
		});
	}
};

module.exports = {
	MailingList : MailingList
};

