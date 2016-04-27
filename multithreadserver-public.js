var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var fs = require('fs');
var Common = require('./common.js');
var logger = Common.logger;

var NumOfTreads = 1;
Common.loadCallback = function(err, firstTimeLoad) {
    if (!firstTimeLoad)// execute the following code only in the first time
        return;

    if (cluster.isMaster) {

        if ((!isNaN("" + Common.NumOfTreads)) && (Common.NumOfTreads>0)) {
            NumOfTreads = Common.NumOfTreads
        }
        // Fork workers.
        for (var i = 0; i < NumOfTreads; i++) {
            cluster.fork();
        }
      
        cluster.on('exit', function(worker, code, signal) {
            logger.info('worker ' + worker.pid + ' died');
            if (worker.suicide !== true) cluster.fork();
        });

    } else {
        logger.info('worker ' + cluster.worker.id + ' started');
        require('./restserver.js').mainFunction(null, true);
    }
}
