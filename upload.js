"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var Login = require('./login.js');
var url = require('url');
var formidable = require('formidable');
var util = require('util');
var path = require('path');
var mkdirp = require('mkdirp');
var User = require('./user.js');
var sessionModule = require('./session.js');
var Session = sessionModule.Session;
var createSSHSessions = require('./addAppsToProfiles.js').createSSHSessions;
var closeSSHSessions = require('./addAppsToProfiles.js').closeSSHSessions;
var async = require('async');
var ThreadedLogger = require('./ThreadedLogger.js');

var Upload = {'uploadToSession': uploadToSession,
		  'uploadToLoginToken' : uploadToLoginToken	
		  };

module.exports = Upload;

function uploadToLoginToken (req, res, next) {
	logger.info(req.url);
	var loginToken = req.params.loginToken;
	  if (loginToken == undefined || loginToken.length < 5 ) {
		var msg = "Invalid loginToken";
		res.send({status: '0' , message: msg}); 
		return;
	  }	
    new Login(loginToken,function (err, login) {
		 if (err) {		    
			var msg = "Invalid loginToken, err:"+err;
			res.send({status: '0' , message: msg}); 			
			return;
		 }
		 console.dir(login.loginParams);	
		 var userName= login.getUserName();
         var deviceID= login.getDeviceID();
		 upload(userName, deviceID, req, res);
		   	
	});
}

function uploadToSession (req, res, next) {
	var session = req.params.session;
	if (session == undefined || session.length < 4 ) {		
	  var msg = "Invalid session";
	  res.send({status: '0' , message: msg}); 
	  return;
	}
	logger.info("Upload from session "+ session);
	
	new Session(session,function(err,obj) {
	     if (err || !obj) {
		   var msg = "Session does not exist. err:"+err;  	
		   logger.info(msg);
		   res.send({status: '0' , message: "Cannot find session"}); 					
		   return;
		 }		 
		 var email = obj.params.email;
         var deviceID = obj.params.deviceid;		
		 upload(email, deviceID, req, res);		
	});
}


function upload (userName, deviceID, req, res) {
        var destPath = req.params.destPath;
        var existsOnSDcard = req.params.existsOnSDcard;
        var isMedia  = req.params.isMedia;
        var dontChangeName  = req.params.dontChangeName;
        var loginToken = req.params.loginToken;
        var logger = new ThreadedLogger();
        logger.user(userName);
        var folder;
        var saveToPath;
	//logger.info(req.url);
	//console.dir(req.headers);
	//logger.info('req.headers: '+JSON.stringify(req.headers, undefined, 2));
	if(req.method === "POST") {
		if (existsOnSDcard != null && existsOnSDcard != '' && destPath != null && destPath != '') {
            dontChangeName = true;
            if (existsOnSDcard == "external://") {
                saveToPath = 'media/'+ destPath;
                folder = Common.nfshomefolder+User.getUserStorageFolder(userName) + saveToPath;
            } else if (existsOnSDcard == "internal://") {
                //TODO need to get user deviceID
                folder = Common.nfshomefolder+User.getUserDeviceDataFolder(userName, deviceID) + destPath;
            } else {
                logger.error("Upload error: wrong path");
                res.send({status: '0' , message: "Upload error: "});
                return;
            }
        } else {
            // Where this file should be saved to
            if (!destPath) {
                destPath = 'Download';
            }
            saveToPath = 'media/'+ destPath;
            folder = Common.nfshomefolder+User.getUserStorageFolder(userName) + saveToPath;

        }
    	var form = new formidable.IncomingForm();

        Common.fs.mkdir(folder, function (err) {
                if (err) {
                    if(err.code !== 'EEXIST') logger.info("Cannot create Download upload folder: "+err);
                    return;
                }
                Common.fs.chmod(folder, '775', function (err) {
                        if (err) {
                            logger.error("Error in make Download upload folder: "+err);
                            return;
                        }
                        Common.fs.chown(folder, 1023, 1023, function (err) {
                                if (err) {
                                    logger.error("Error in make Download upload folder: "+err);
                                    return;
                                }
                        });
                });
        });

        form.uploadDir = folder;
		form.on('fileBegin', function(name, file) {
			//logger.info("file begin: "+util.inspect({name: name, file: file}));
			logger.info("uploading file " + file.name + " to " + file.path);
			var fname = file.name;
			var newpath = path.dirname(file.path)+path.sep+fname;
            var tmppath = path.dirname(file.path)+path.sep+"." + fname + "_uploading";
			var cnt=0;
            if (!dontChangeName) {
                while (Common.fs.existsSync(newpath) || Common.fs.existsSync(tmppath)) {
    				cnt++;
    				newpath = path.dirname(file.path)+path.sep+path.basename(file.name,path.extname(file.name))+'_'+cnt+path.extname(file.name);
                    tmppath = path.dirname(file.path)+path.sep + "." + path.basename(file.name,path.extname(file.name)) + '_' + cnt+path.extname(file.name) + "_uploading";
    			}
             }
			file.path = tmppath;
		});


    form.parse(req, function(err, fields, files) {
            logger.logTime("upload ended");
            if (err) {
                logger.info("Upload error: "+err);
                res.send({status: '0' , message: "Upload error: "+err});
                return;
            }
            //logger.info("received upload: "+util.inspect({fields: fields, files: files}));
            if (files!=null) {
                // Is true if any of the files uploads went wrong
                var errorOccured = false;
                // For use in broadcast intent
                var partialPathToFiles = [];
                var fkeys = Object.keys(files);
                async.eachSeries(fkeys, function(fkey, cb) {
                    var fpath = files[fkey].path;
                    var fname = files[fkey].name;
                    logger.info("fpath="+fpath);

                    Common.fs.chmod(fpath, '775', function (err) {
                            errorOccured = errorOccured || (err != null);
                            Common.fs.chown(fpath, 1023, 1023, function(err){
                                    errorOccured = errorOccured || (err != null);
                                    //logger.info("Changed owner of "+fpath);
                                    var parts = fpath.split(/(.*)\//g);
                                    if (parts.length == 3) {
                                        var newfile;
                                        newfile = parts[1] + path.sep + parts[2].replace(/^\.(.*)_uploading$/, "$1");
                                        Common.fs.rename(fpath, newfile, function(err){
                                                errorOccured = errorOccured || (err != null);
                                                logger.info("File " + newfile + " ready for usage");
                                                //logger.info('logEB: fpath='+fpath+'  newfile='+newfile);
                                                //console.log('logEB: fname=',fname);
                                                partialPathToFiles.push(destPath+'/'+fname);
                                                cb(null);
                                        });
                                    } else {
                                        errorOccured = true;
                                        cb(null);
                                    }
                            });
                    });

                }, function(err) { // end of eachSeries
                    if (errorOccured) {
                        res.send({status: '0' , message: "Something went wrong"});
                    } else {
                        logger.logTime("files ready");
                        res.send({status: '1' , message: "File uploaded"});
                    }
                    // Send intent even if some of the files were not uploaded correctly
                    if (isMedia) {
                        broadcastMediaIntentOnPlatforms(userName, partialPathToFiles, function(){});
                    }
                });
            } else { // files == null
                res.send({status: '0' , message: "No files defined"});
            }
    });
    	    	
	} else {
		res.send({status: 1 , message: "not a post method"}); 
	}
}


/**
    Sends a broadcast intnet on user's platforms to inform them on new photos/videos
    @email                  user's email
    @partialPathToFiles     Array containing the paths to all new media files  (i.e DCIM/Camera/1.jpg)
**/
function broadcastMediaIntentOnPlatforms (email, partialPathToFiles, callback) {
    var sshSessions = [];
    var platforms = [];
    var userIdInPlatforms = [];
    var platUserObjs = [];

    async.series([
    // Generate a list of all user's platforms
    function(callback) {
        var session = require('./session.js');
        session.getUserPlatforms(email, function(err, p, u, userIds, devices) {
            platforms = p;
            userIdInPlatforms = userIds;
            callback(null);
        });
    },
    // Open SSH Connections to all user's platforms
    function(callback) {
        createSSHSessions(sshSessions, platforms, function() {
            callback(null);
        });
    },
    // Create array of objects {platform, userId}
    function(callback) {
        for(var i=0;i<platforms.length;i++){
            platUserObjs.push({platform:platforms[i],userId:userIdInPlatforms[i]});
        }
        callback(null);
    },
    // Send a broadcast Intent
    function(callback) {
        // Go over all user's platforms
        async.eachSeries(platUserObjs, function(platformObj, cb1) {
            // Support for multiple file uploads (not supported yet in REST)
            var platform = platformObj.platform;
            var userId = platformObj.userId;
            if(Common.platformType === "kvm") {
                async.eachSeries(partialPathToFiles, function(pathToFile, cb2) {
                    var broadcastParams = ' -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:/storage/emulated/legacy/'+
                        pathToFile;
                    var cmd = 'am broadcast --user ' + userId + broadcastParams;
                    platform.exec(cmd, function(err, code, signal, sshout) {
                        // Ignore errors
                        cb2(null);
                    });
                }, function(err) {
                    // Finished sending intents for all files on a single platform
                    cb1(null);
                });
            } else {
                platform.refreshMedia(userId, partialPathToFiles, function() {
                    cb1(null);
                });
            }
        }, function(err) {
            callback(null);
        });
    },
    // Close SSH sessions
    function(callback) {
        closeSSHSessions(sshSessions, function() {
            callback(null);
        });
    }], function(err) {
        // No need to check for errors here
        callback(null);
    });
}
