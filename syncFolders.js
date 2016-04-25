var async = require('async');
var util = require('util');
var Common = require('./common.js');
var platformModule = require('./platform.js');
var User = require('./user.js');
var Platform = platformModule.Platform;
var logger = Common.logger;
var exec = require('child_process').exec;

function doSync(sshstr,src, dst,direction,callback) {
    
    var sshCmd = "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -i "+Common.sshPrivateKey+" ";
    async.series([
        // make dirs - only on upload to platform
    function(callback) {
        if (direction<0) {
            callback();
            return;
        }
        var cmd = sshCmd + sshstr + " mkdir -p " + dst;
        logger.info("cmd: "+cmd);
        var child = exec(cmd, function(error, stdout, stderr) {
            logger.info('mkdir -p stdout: ' + stdout);
            logger.info('mkdir -p stderr: ' + stderr);
            if (error) {
                logger.info("Error in mkdir -p: " + error);
                callback(error);
                return;
            }
            callback(null);
        });
    },
    // rsync data
    function(callback) {
        
        var rsynccmd = 'rsync -avz --delete -e "'+sshCmd+'" ';
        var cmd = rsynccmd + src + " " + sshstr+":"+dst;
        if (direction<0) {
            cmd = rsynccmd + sshstr+":"+dst +  " " + src ;
        }
        logger.info("cmd: "+cmd);
        var child = exec(cmd, function(error, stdout, stderr) {
            logger.info('doSync stdout: ' + stdout);
            logger.info('doSync stderr: ' + stderr);
            if (error) {
                logger.info("Error in doSync: " + error);
                callback(error);
                return;
            }
            callback(null);
        });
    },
    // delete data on platform (only after download from platform)
    function(callback) {
        if (direction>0) {
            callback();
            return;
        }
        var cmd = sshCmd + sshstr + " rm -rf " + dst;
        logger.info("cmd: "+cmd);
        var child = exec(cmd, function(error, stdout, stderr) {
            logger.info('rm -rf stdout: ' + stdout);
            logger.info('rm -rf stderr: ' + stderr);
            if (error) {
                logger.info("Error in rm -rf: " + error);
                callback(error);
                return;
            }
            callback(null);
        });
    }], function(err) {
        callback(err);
    });

}

function syncToLocalNFSImp(session, direction , callback) {
    if (Common.syncToLocalNFS != true) {
        // do nothing if local NFS option is not set
        callback(null);
        return;
    }
    //var login = session.login;
    var localid = session.params.localid;
    var platform = session.platform;
    var UserName = session.params.email;//login.getUserName();
    var deviceID = session.params.deviceid; //login.getDeviceID();
    var sshstr = 'root@' + (Common.localNFS.isLoopbackIP == true ? "127.0.0.1" : platform.params.platform_ip);

    var nfspath = Common.nfshomefolder;
    var localnfspath = Common.localNFS.nfshomefolder;
    var userDeviceDataFolder = User.getUserDeviceDataFolder(UserName, deviceID);
    var userStorageFolder = User.getUserStorageFolder(UserName);

    var line1 = nfspath + userDeviceDataFolder;
    var line2 = nfspath + userStorageFolder;
    var src = [line1, line2];

    var dst = [localnfspath + userDeviceDataFolder, localnfspath + userStorageFolder];
    var mask = [false, false, false];

    async.series([
    function(callback) {
        doSync(sshstr, src[0], dst[0], direction, callback);
    },
    function(callback) {
        doSync(sshstr, src[1], dst[1], direction, callback);
    }], function(err) {
        callback(err);
    });
}

function syncToLocalNFS(session, callback) {
    syncToLocalNFSImp(session, 1 , callback);
}

function syncBackToStorage(session, callback) {
    syncToLocalNFSImp(session, -1 , callback);
}


var sync = {
    syncToLocalNFS : syncToLocalNFS,
    syncBackToStorage : syncBackToStorage
};

module.exports = sync;
