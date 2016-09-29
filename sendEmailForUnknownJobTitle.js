"use strict";

// Hanan asked to remove this code and it will be deleted after remove in the clients

// first call goes to here
function sendEmailForUnknownJobTitle(req, res, next) {
	// http://login.nubosoftware.com/sendEmailForUnknownJobTitle?jobTitle=[title]
	res.contentType = 'json';
	res.send({
		status: Common.STATUS_OK,
		message: "ok"
	});
	return;

}

var SendEmailForUnknownJobTitle = {
	func: sendEmailForUnknownJobTitle
};

module.exports = SendEmailForUnknownJobTitle;