"use strict"

var cluster = require('cluster');
var os = require('os');
var fs = require('fs');
const async = require("async");

var Common = require('./common.js');
var mgmtPublicRegistration = require("./mgmtPublicRegistration.js");

var logger = Common.logger;

var NumOfTreads = 1;
var serverAtExitProcess = false;

Common.loadCallback = function(err, firstTimeLoad) {
    if (!firstTimeLoad) // execute the following code only in the first time
        return;

    var refreshTTLService = mgmtPublicRegistration.refreshTTLService();

    if (cluster.isMaster) {

        register(function(err) {
            if (err) {
                logger.error("multithreadserver-public: " + err);
                process.exit(1);
                return;
            }

            refreshTTLService.start();

            if ((!isNaN("" + Common.NumOfTreads)) && (Common.NumOfTreads > 0)) {
                NumOfTreads = Common.NumOfTreads
            }
            // Fork workers.
            for (var i = 0; i < NumOfTreads; i++) {
                cluster.fork();
            }

            cluster.on('exit', function(worker, code, signal) {
                logger.info('multithreadserver-public: worker ' + worker.id + ' died');
                if (worker.suicide !== true && !serverAtExitProcess) {
                    cluster.fork();
                }
            });
        })

    } else {
        logger.info('multithreadserver-public: worker ' + cluster.worker.id + ' started');
        require('./restserver.js').mainFunction(null, true);
    }

    if (cluster.isMaster) {
        process.on('SIGINT', function() {
            if (serverAtExitProcess) {
                return;
            } else {
                serverAtExitProcess = true;
            }

            logger.info("multithreadserver-public: cluster Caught interrupt signal");

            async.series([
                function(callback) {
                    refreshTTLService.stop(callback);
                },
                function(callback) {
                    mgmtPublicRegistration.unregister(callback);
                }
            ], function(err) {
                if (err) {
                    logger.error("multithreadserver-public: " + err);
                    process.exit(1);
                }

                logger.info("multithreadserver-public: exited");
                process.exit(0);
            })
        });
    }
}

function register(callback) {

    var registered = false;
    var error;
    var hostname = os.hostname();

    async.whilst(
        function() {
            return (!registered && !serverAtExitProcess);
        },
        function(callback) {
            mgmtPublicRegistration.register(function(err) {
                if (err) {
                    logger.error("multithreadserver-public::register: " + err);
                    error = err;
                    setTimeout(function() {
                        callback(null);
                    }, 5000);
                } else {
                    error = null;
                    registered = true;
                    return callback(null);
                }
            });
        },
        function(err) {
            if (error) {
                logger.error("multithreadserver-public::register: unable to register Front End");
                return callback("unable to register Front End");
            }

            return callback(null);
        }
    );
}