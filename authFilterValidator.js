var async = require('async');
var authFilters = require('./authFilters.js');

function AuthFilterValidator(filters, excludeList){
    if (!(this instanceof AuthFilterValidator)) {
        return new AuthFilterValidator(filters, excludeList);
    }

	this._filters = filters;
    this._exclideList = excludeList;
}

function igonorePaths(path){
    var resources = '/html/player/';

    if(path.substring(0, resources.length) === resources){
        return true;
    }

    return false;
}

AuthFilterValidator.prototype.validate = function(req, callback) {

    var reqPath = req.path(req.url);

    if(igonorePaths(reqPath)){
        callback(null);
        return;
    }

    var self = this;
        async.eachSeries(this._filters, function(filter, callback){
            filterFunc = authFilters.getFilter(filter);

            if(filterFunc){
                filterFunc(req, self._exclideList, callback);
            }
             else{
                callback("unknown filter");
            }
        },callback);
    }

module.exports = AuthFilterValidator;

