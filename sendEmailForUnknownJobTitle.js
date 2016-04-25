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

// first call goes to here
function sendEmailForUnknownJobTitle(req, res, next) {
	// http://login.nubosoftware.com/sendEmailForUnknownJobTitle?jobTitle=[title]
	res.contentType = 'json';
	var status = 1;
	var msg = "";
	logger.info(req.url);

	var jobTitle = req.params.jobTitle;
	if (!jobTitle || jobTitle == "") {
		status = 0;
		msg = "Empty job Title";
	}

	if (status != 1) {
		res.send({
			status : status,
			message : msg
		});
		return;

	}

	// send email to us
	var mailOptions = {
		from : "anat.l@nubosoftware.com",
		// sender address
		fromname : "Anat Litan",
		to : "hanan@nubosoftware.com",
		// list of receivers
		toname : "Anat Litan",
		bcc : "",
		subject : "New Occupation Name",
		// Subject line
		html : jobTitle
	};
	logger.info("Before send message for unknown job title");
	Common.mailer.send(mailOptions, function(success, message) {
		if (!success) {
			logger.info("sendgrid error for unknown job title: " + message);
			res.send({
				status : '0',
				message : "Email for unknown job title failed"
			});
			return;
		} else {
			res.send({
				status : '1',
				message : "Email for unknown job title was sent successfully"
			});
			return;
		}
	});
}

var SendEmailForUnknownJobTitle = {
	func : sendEmailForUnknownJobTitle
};

module.exports = SendEmailForUnknownJobTitle;
