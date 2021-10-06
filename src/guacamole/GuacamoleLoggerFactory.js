"use strict";

const path = require('path');
const { createLogger , format, transports  } = require('winston');
const { combine, timestamp, label, printf } = format;

const myFormat = printf(info => {
    return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});

let globallogger = createLogger({
    format: combine(
        label({ label:  path.basename(process.argv[1], '.js') }),
        timestamp(),
        myFormat
    ),
    transports : [
        new (transports.Console)({
            timestamp: true,
            colorize: true
        })
    ],
    exitOnError : false
});

function getLogger() {
    return globallogger;
}

function setGlobalLogger(newLogger) {
    globallogger = newLogger;
}

module.exports = {
    getLogger,
    setGlobalLogger
};