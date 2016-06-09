"use strict";

var _ = require("underscore");
var constraints = {};

constraints.sessionIdConstr = {
    "format" : "[a-zA-Z0-9]+",
    "length" : {
        "minimum" : 1,
        "maximum" : 1000
    }
}

constraints.requestedSessionIdConstr = _.extend({presence: true}, constraints.sessionIdConstr);

constraints.loginTokenConstr = {
    "format" : "[a-z0-9]+",
    "length" : {
        "minimum" : 1,
        "maximum" : 100
    }
}

constraints.requestedLoginTokenConstr = _.extend({presence: true}, constraints.loginTokenConstr);

constraints.excludeSpecialCharacters = {
    "format" : "^[^<>'\"/;`%]*$",
    "length" : {
        "minimum" : 1,
        "maximum" : 255
    }
}

constraints.requestedExcludeSpecialCharacters = _.extend({presence: true}, constraints.excludeSpecialCharacters);

module.exports = constraints;
