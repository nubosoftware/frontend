"use strict";
var Common = require('./common.js');

function getJS(req, res, next) {
    var webCommon = Common.webCommon || {};    
    var body = "var Common = " + JSON.stringify(webCommon);
    res.end(body);
}

function getJSON(req, res, next) {
    var webCommon = Common.webCommon || {};
    res.send(webCommon);
}

module.exports = {
    getJS,
    getJSON
};
