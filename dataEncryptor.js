var fs = require('fs');
var async = require('async');

function parseParameters(mode, data, parameters, func) {
    var parsedData = JSON.parse(JSON.stringify(data));

    for (var k in parameters) {
        if (typeof parsedData[k] === "object" && parsedData[k] !== null) {
            if (typeof parsedData[k] !== typeof parameters[k])
                throw ("type of parameter " + k + " not same in data and paramters");

            parsedData[k] = parseParameters(mode, parsedData[k], parameters[k], func);
        } else {
            if (mode === 'dec' && parsedData[k]) {
                if (typeof parsedData[k] === "string") {
                    if (parsedData[k].indexOf("enc:") === 0) {
                        parsedData[k] = func(parsedData[k]);
                    }
                } else throw ("paramter \"" + k + ": " + parsedData[k] + "\" should be type of string");

            } else if (mode === 'enc' && parsedData[k]) {
                if (typeof parsedData[k] === "string") {
                    if (parsedData[k].indexOf("enc:") !== 0) {
                        parsedData[k] = func(parsedData[k]);
                        modified = true;
                    }
                } else throw ("paramter \"" + k + ": " + parsedData[k] + "\" should be type of string");
            }

        }
    }

    return parsedData;
}

module.exports = {
    parseParameters: parseParameters
};