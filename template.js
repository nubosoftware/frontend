"use strict";

var Common = require('./common.js');
var logger = Common.logger;

var Template = {
	'getTemplate' : getTemplate
};

module.exports = Template;

var fileCache = {};

var path = require("path"), fs = require("fs"), url = require("url");

var _ = require('underscore');

var root = path.resolve('.');


function getTemplate(dir,templateName,params) {
		try {
			var templateFile = path.join(dir, templateName);

			var realpath = path.resolve(path.join(root, templateFile));

			var stat = fs.statSync(realpath);

			if (!stat.isFile()) {
				logger.info("File not found: " + realpath);
				return "";
			}

			var cache = fileCache[templateFile];
			if (cache != null && cache.stat.mtime >= stat.mtime) {
				logger.info("Found in cache. file: " + realpath);
				var template = _.template(cache.data.toString());
				var result = template(params);
				return result;
			} else {
				var data = fs.readFileSync(realpath);

				fileCache[templateFile] = {
					"data" : data,
					"stat" : stat
				};
				console.log("Read changed file: " + realpath);
				var template = _.template(data.toString());
				var result = template(params);
				return result;

			}
		} catch(e) {
			logger.info("Error in getTemplate: "+e);
			return "";
		}
	}