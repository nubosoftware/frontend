var fs = require('fs');
var async = require('async');

var modified;
var encrypt;
var decrypt;
var logger;

function readFile(fileName, parameters, enc, dec, callback, log) {
    modified = false;
    encrypt = enc;
    decrypt = dec;
    logger = log;

    var settings;
    var newSettings;
    var decryptedSettings;

    async.series([
        // read file
        function(callback) {
            fs.readFile(fileName, function(err, data) {
                if (err) {
                    callback(err);
                    return;
                }

                var rawSettings = data.toString().replace(/[\n|\t]/g, '');
                logger.debug("readFile: " + rawSettings);
                try {
                    settings = JSON.parse(rawSettings);
                    callback(null);
                } catch (err) {
                    callback(err + ", while parsing " + fileName);
                }
            });
        },
        // encrypt fields in case some value changed
        function(callback) {
            try {
                newSettings = parseParameters('enc', settings, parameters);
                callback(null);
            } catch (err) {
                callback("encrypting " + err);
            }
        },
        // write file back after encryption
        function(callback) {
            if (modified) {
                var newSettingsToFile = JSON.stringify(newSettings, null, 4);
                fs.writeFile(fileName, newSettingsToFile, function(err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                });
            }
            callback(null);

        },
        // decrypt fields
        function(callback) {
            try {
                decryptedSettings = parseParameters('dec', settings, parameters);
                callback(null);
            } catch (err) {
                callback("decrypting " + err);
            }
        }
    ], function(err) {

        if (err) {
            if (logger)
                logger.error("readFile: " + err);

            callback(err);
            return;
        }

        callback(null, decryptedSettings);
    });
}

function parseParameters(mode, data, parameters) {
    for (var k in parameters) {
        if (typeof data[k] === "object" && data[k] !== null) {
            if (typeof data[k] !== typeof parameters[k])
                throw ("type of parameter " + k + " not same in data and paramters");

            data[k] = parseParameters(mode, data[k], parameters[k]);
        } else {
            if (mode === 'dec' && data[k]) {
                if (typeof data[k] === "string") {
                    if (data[k].indexOf("enc:") === 0) {
                        data[k] = decrypt(data[k]);
                    }
                } else throw ("paramter \"" + k + ": " + data[k] + "\" should be type of string");

            } else if (mode === 'enc' && data[k]) {
                if (typeof data[k] === "string") {
                    if (data[k].indexOf("enc:") !== 0) {
                        data[k] = encrypt(data[k]);
                        modified = true;
                    }
                } else throw ("paramter \"" + k + ": " + data[k] + "\" should be type of string");
            }

        }
    }

    return data;
}

module.exports = {
    readFile: readFile
};