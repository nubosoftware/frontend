"use strict";

/**
 *	simplessh.js
 *  Simple class for ssh client to the nubo host
 */
var Common = require('./common.js');
var Connection = require('ssh2');
var sshPool = Common.sshPool;

var CreateConnection = function(opts, extras, callback) {
    if (!opts.privateKey) opts.privateKey = require('fs').readFileSync(Common.sshPrivateKey);

    this.logger = ((extras && extras.logger) ? extras.logger : Common.logger);
    this.isReady = false;
    this.connection = new Connection();
    this.connError = false;
    this.stack = new Error().stack;
    this.poolLine = opts.username + "@" + opts.host + ':' + opts.port;

    (function(sshobj) {
        sshobj.connection.on('ready', function() {
            sshobj.logger.info('Connection :: ready');
            if (!sshobj.isReady) {
                sshobj.isReady = true;
                sshPool[sshobj.poolLine] = sshobj;
                Common.logger.info("!!!!! NEW POOL: \n", Object.getOwnPropertyNames(sshPool));
                if (callback) callback(null, sshobj);
            }
        });
        sshobj.connection.on('error', function(err) {
            sshobj.logger.info('Connection :: error :: ' + err);
            sshobj.connError = true;
            delete sshPool[sshobj.poolLine];
            sshobj.connection.end();
            if (!sshobj.isReady) { // connection was not OK
                sshobj.isReady = true;
                if (callback) callback(err, sshobj);
            }
        });
        sshobj.connection.on('end', function() {
            sshobj.logger.info('Connection :: end ' + sshobj.poolLine);
            sshobj.connError = true;
            delete sshPool[sshobj.poolLine];
            if (!sshobj.isReady) { // connection was not OK
                sshobj.isReady = true;
                if (callback) callback("Connection ended before ready", sshobj);
            }
        });
        sshobj.connection.on('close', function(had_error) {
            sshobj.logger.info('Connection :: close ' + sshobj.poolLine);
            sshobj.connError = true;
            delete sshPool[sshobj.poolLine];
            if (!sshobj.isReady) { // connection was not OK
                sshobj.isReady = true;
                if (callback) callback("Connection closed before ready", sshobj);
            }
        });
        sshobj.logger.info("simpleSSH connect to " + opts.username + '@' + opts.host + ':' + opts.port);
        sshobj.connection.connect(opts);
    })(this);

    this.exec = function(cmd, callback) {
        this.execWithTimeout(cmd, 60000, callback);
    }

    this.execWithTimeout = function(cmd, timeout, callback) {
        var execStack = new Error().stack;
        (function(sshobj) {
            var sshout = "";
            var done = false;
            var timeOutCmd = null;
            var streamCode, streamSignal;
            var connStream = null;
            if (sshobj.connError) {
                sshobj.logger.info('exec :: Connetion error');
                if (callback) callback('exec :: Connetion error');
                return;
            }

            if (timeout > 0) {
                timeOutCmd = setTimeout((function() {
                    sshobj.logger.info('Stream :: timeout for cmd: ' + cmd);
                    var err = "Timeout" + ", stack:" + execStack;
                    if(connStream)
                        connStream.emit('close');
                    if (!done) {
                        done = true;
                        callback(err, -110, null, sshout);
                    }
                }), timeout); // setTimeout
            }

            sshobj.connection.exec(cmd, function(err, stream) {
                var err = null;
                if (err) {
                    sshobj.logger.info('exec :: err: ' + err);
                    if (callback) callback(err + ", stack:" + execStack);
                    return;
                };

                connStream = stream;
                stream.on('data', function(data, extended) {
                    //sshobj.logger.info('simpleSSH '+(extended === 'stderr' ? 'STDERR: ' : 'STDOUT: ') + data);
                    sshout += data;
                }); // stream.on('data'
                stream.on('exit', function(code, signal) {
                    //sshobj.logger.info('Stream :: exit :: sshout: '+sshout);
                    if (timeOutCmd) clearTimeout(timeOutCmd);
                    if (!done) {
                        done = true;
                        callback(err, code, signal, sshout);
                    }
                }); // stream.on('end'
            })
        })(this);
    };

    this.end = function() {
        this.logger.info('NO END ' /* + (new Error().stack)*/ );
    }
}

var assert = require('assert');
module.exports = function(opts, extras, callback) {
    //    Common.logger.info("!!!!! POOL: \n", Object.getOwnPropertyNames(sshPool));
    assert((typeof callback === 'function'), "Wrong usage in module permanentssh");
    if (!opts.port) opts.port = 22;
    if (!opts.pingInterval) opts.pingInterval = 15 * 1000; //deprecated
    if (!opts.keepaliveInterval) opts.keepaliveInterval = 15 * 1000;
    var logger = ((extras && extras.logger) ? extras.logger : Common.logger);
    var poolLine = opts.username + "@" + opts.host + ':' + opts.port;

    if (sshPool[poolLine]) {
        sshPool[poolLine].logger = logger;
        logger.info("OK... " + poolLine + " already in pool");
        if (callback) callback(null, sshPool[poolLine]);
    } else {

        logger.info("Wait... connecting to " + poolLine);
        new CreateConnection(opts, extras, callback);
    }
}