var async = require('async');
var authFilters = require('./authFilters.js');
var Common = require('./common.js');

function AuthFilterValidator(filters, excludeList) {
    if (!(this instanceof AuthFilterValidator)) {
        return new AuthFilterValidator(filters, excludeList);
    }

    this._filters = filters;
    this._excludeList = excludeList;

}

AuthFilterValidator.prototype.validate = function(req, callback) {

    var reqPath = req.path(req.url);

    var self = this;
    var retStatus = Common.STATUS_ERROR;
    var retMsg = 'shouldn\'t happen!!!';
    var retErr = null;

    async.eachSeries(this._filters, function(filter, callback) {
        filterFunc = authFilters.getFilter(filter);

        if (filterFunc) {
            filterFunc(req, self._excludeList, function(err, status, msg) {
                if (err) {
                    retErr = err;
                    callback('break');
                    return;
                }

                retMsg = msg;
                retStatus = status;

                if (status != Common.STATUS_OK) {
                    callback('break');
                    return;
                }

                callback(null);
            });
        } else {
            retErr = "unknown filter";
            callback('break');
        }
    }, function(err) {
        callback(retErr, retStatus, retMsg);
    });
}

module.exports = AuthFilterValidator;