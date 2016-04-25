"use strict";

var Common = require('./common.js');
var fs = require('fs');
var Lock = require('./lock.js');
var ffmpeg = require('fluent-ffmpeg');
var path = require('path');
var User = require('./user.js');
var STREAMS_DIR = '/streams/';
var LIVE_STREAMS_DIR = 'live/';
var logger = Common.logger;
var async = require('async');
var pathToMgmt = process.cwd();
var exec = require('child_process').exec;
var ffmpegPath = "/ffmpeg/ffmpeg";
ffmpeg.setFfmpegPath(path.join(pathToMgmt, ffmpegPath));
var DEBUG = true;
var URL_STREAM = 0;
var RESOURCE_STREAM = 1;
var FILE_STREAM = 2;
var FD_STREAM = 3;
var LIVE_STREAM = 4;


/*
 * This function encode any input file into a streamable file
*/
function createStream(req, res) {
    // https://login.nubosoftware.com/createStream?platId=[]&userId=[]url=[]&outputfile=[]
    logger.info(req.url)
    res.contentType = 'json';
    var url = req.params.url;
    var outputFileNoPath = req.params.outputfile;
    var fileType = req.params.fileType;
    var sessionId = req.params.sessionId;
    var clientType = req.params.clientType;
    var videoOrAudio = req.params.videoOrAudio;
    var liveDir = pathToMgmt + STREAMS_DIR + LIVE_STREAMS_DIR

    //Input validation
    var status = 1;
    var msg = '';
    if ( !url || url == '') {
        status = 0;
        msg = 'invalid url';
    } else if (!outputFileNoPath || outputFileNoPath == '') {
        status = 0;
        msg = 'invalid outputfile';
    } else if (!fileType || fileType == '') {
        status = 0;
        msg = 'invalid fileType';
    } else if (!sessionId || sessionId == '') {
        status = 0;
        msg = 'invalid sessionId';
    } else if (!clientType || clientType == '') {
        status = 0;
        msg = 'invalid clientType';
    } else if (!videoOrAudio || videoOrAudio == '') {
        status = 0;
        msg = 'invalid videoOrAudio';
    }

    if (status == 0 || !Common.isHandlingMediaStreams) {
        logger.error('mediaStream: ' + msg);
        var json = JSON.stringify({
            status : Common.isHandlingMediaStreams ? status : 0,
            file : "",
            redisCmd : ""
        });
        res.end(json);
        logger.error("MediaStream: " + msg);
        if (!Common.isHandlingMediaStreams) {
            logger.error("\n\n\n");
            logger.error("MediaStream:**************************************************************************");
            logger.error("MediaStream: Video is disabled by default to avoid server overload conditions...");
            logger.error("MediaStream: If you want to enable Video on this server, Please perform the following steps:");
            logger.error("MediaStream: 1 - Update node-static and restify <npm install restify; npm install node-static>");
            logger.error("MediaStream: 2 - Mkdir pathToMgmt/streams");
            logger.error("MediaStream: 3 - Mkdir pathToMgmt/streams/live");
            logger.error("MediaStream: 4 - FFmpeg (pathToMgmt/ffmpeg/ffmpeg) has a few dependencies...");
            logger.error("MediaStream: 5 - Run the following command to get all the build dependencies: 'pathToMgmt/ffmpeg/ffmpeg -i < INPUT FILE > -y -vcodec copy -movflags frag_keyframe+separate_moof+faststart -acodec copy -preset ultrafast -bsf:a aac_adtstoasc pathToMgmt/streams/out.mp4'");
            logger.error("MediaStream: 6 - For example - <cp pathToMgmt/ffmpeg/libx264.so.120 /usr/lib/x86_64-linux-gnu/> <cp pathToMgmt/ffmpeg/libass.so.4 /usr/lib/x86_64-linux-gnu/ >");
            logger.error("MediaStream: 7 - If no error can be found, then you might be able to stream video on Nubo");
            logger.error("MediaStream:**************************************************************************");
            logger.error("\n\n\n");
        }
        return;

    } else {

        var lock = new Lock({
            key: "lock_" + outputFileNoPath,
            logger: logger,
            numberOfRetries: 0,
            lockTimeout: 1000 * 60 // one minute max lock
        });

        lock.acquire(function(err, reply) {
            if (err) {
                var json = JSON.stringify({
                    status : 0,
                    file : "",
                    redisCmd : ""
                });
                res.end(json);
                logger.error("MediaStream: cannot create lock");
                return;
            } else if (reply == 1) {

                if (fileType == LIVE_STREAM) {
                    createLiveStream(req, res, lock);
                } else {
                    var userDir = pathToMgmt + STREAMS_DIR + sessionId
                    if (!fs.existsSync(userDir)){
                        fs.mkdirSync(userDir);
                    }
                    if (clientType == "Android") {
                        android_createStream(req, res, lock);
                    } else {
                        ios_createStream(req, res, lock);
                    }
                }
            } else if (reply == 0 && fileType == LIVE_STREAM) {

                var outputFile = path.join(liveDir, outputFileNoPath);
                var outputFileRelativePath = path.join(STREAMS_DIR + LIVE_STREAMS_DIR, outputFileNoPath);
                var retries = 60;
                var wait = 1000;
                var isLiveStream = true;
                sendResToPlayer("", outputFile, retries, wait, isLiveStream, function(err) {
                    if (err) {
                        logger.error("MediaStream: " + err);
                        status = 0;
                    }
                    var json = JSON.stringify({
                        status : status,
                        file : outputFileRelativePath,
                        redisCmd : outputFile
                    });
                    res.end(json);
                    return;
                });

            } else {
                // lock exists...
                var json = JSON.stringify({
                    status : 0,
                    file : "",
                    redisCmd : ""
                });
                res.end(json);
                logger.error("MediaStream: lock already exists...");
                return;
            }
        });
    }
}

/*
 * Handle Live Stream - encode any stream into .m3u8
 * return res only when the first ts file is ready...
 */
function createLiveStream(req, res, lock) {

    res.contentType = 'json';
    var url = req.params.url;
    var outputFileNoPath = req.params.outputfile;
    var fileType = req.params.fileType;
    var sessionId = req.params.sessionId;
    var clientType = req.params.clientType;

    var pathToMgmt = process.cwd();
    var liveDir = pathToMgmt + STREAMS_DIR + LIVE_STREAMS_DIR

    var outputFile = path.join(liveDir, outputFileNoPath);
    var outputFileRelativePath = path.join(STREAMS_DIR + LIVE_STREAMS_DIR, outputFileNoPath);

    if (!fs.existsSync(liveDir)){
        fs.mkdirSync(liveDir);
    }

    if (DEBUG) {
        logger.info('mediaStream:: URL=' + url);
        logger.info('mediaStream:: outputFile=' + outputFile);
        logger.info('mediaStream:: sessionId=' + sessionId);
        logger.info('mediaStream:: outputFileRelativePath=' + outputFileRelativePath);
    }
    // Get user path
    Common.redisClient.hgetall("sess_" + sessionId, function(err, session) {
        if (err) {
            var json = JSON.stringify({
                status : "0",
                file : "",
                redisCmd : ""
            });
            sentResponse = true;
            res.end(json);
            lock.release(function(err, reply) {
                if (err) {
                    logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                } else if (reply != 1) {
                    logger.error("mediaStream ERROR: cannot release lock!");
                }
                return;
            });
        } else {
            fs.exists(outputFile, function(exists) {
                if (exists) {
                    var status;
                    addLiveCmdToRedis(sessionId, outputFileRelativePath, function(err) {
                        if (err) {
                            logger.error("mediaStream:createLiveStream:addLiveCmdToRedis SADD - return = " + err);
                            status : "0";
                        } else {
                            status : "1";
                        }
                        // response back
                        var json = JSON.stringify({
                            status : status,
                            file : outputFileRelativePath,
                            redisCmd : outputFile
                        });
                        res.end(json);
                    });
                    lock.release(function(err, reply) {
                        if (err) {
                            logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                        } else if (reply != 1) {
                            logger.error("mediaStream ERROR: cannot release lock!");
                        }
                        return;
                    });
                } else {
                    async.parallel([
                        function(callback){
                            var wait = 1000;//1 sec
                            var retries = 60;// 20 * 1 sec
                            var isLiveStream = true;
                            sendResToPlayer("", outputFile, retries, wait, isLiveStream, function(err) {
                                if (DEBUG) {
                                    logger.info("mediaStream:createLiveStream:isLiveStreamReady: return = " + err);
                                }
                                if (err) {
                                    var json = JSON.stringify({
                                        status : "0",
                                        file : "",
                                        redisCmd : ""
                                    });
                                    res.end(json);
                                    logger.error("mediaStream:createLiveStream:isLiveStreamReady: ERROR = " + err);
                                    callback(err);
                                } else {
                                    var json = JSON.stringify({
                                        status : "1",
                                        file : outputFileRelativePath,
                                        redisCmd : outputFile
                                    });
                                    res.end(json);

                                    addLiveCmdToRedis(sessionId, outputFileRelativePath, function(err) {
                                        if (err) {
                                            logger.error("mediaStream:createLiveStream:addLiveCmdToRedis: ERROR = " + err);
                                        }
                                        lock.release(function(err1, reply) {
                                            if (err1) {
                                                logger.error("mediaStream ERROR: cannot release lock! Error = " + err1);
                                            } else if (reply != 1) {
                                                logger.error("mediaStream ERROR: cannot release lock!");
                                            }
                                            callback(err + err1);
                                        });
                                    });
                                }
                            });
                        },

                        function(callback){
                            var cmd = pathToMgmt + ffmpegPath + " -i '" + url + "' -c:v copy -c:a libfdk_aac -b:a 32K -ar 24000 -hls_time 10 -hls_wrap 5 " + outputFile;
                            if (DEBUG) {
                                logger.info("createLiveStream cmd: " + cmd);
                            }
                            var child = exec(cmd, function(error, stdout, stderr) {
                                if (DEBUG) {
                                    logger.info("mediaStream createLiveStream stdout = ", stdout)
                                    logger.info("mediaStream createLiveStream stderr = ", stderr)
                                    logger.info("mediaStream createLiveStream error = ", error)
                                }
                                //TODO - clear redis and remove all files????
                                var filesToDelete = outputFile.slice(0, outputFile.length-5);

                                var delCmd = "rm " + filesToDelete + "*";
                                var child = exec(delCmd, function(error1, stdout1, stderr1) {
                                    if (DEBUG) {
                                        logger.info("mediaStream createLiveStream stdout1 = ", stdout1)
                                        logger.info("mediaStream createLiveStream stderr1 = ", stderr1)
                                        logger.info("mediaStream createLiveStream error1 = ", error1)
                                    }
                                    callback(error + error1);
                                });
                            });
                        },

                    ],
                    // optional callback
                    function(err, results){
                        if (err) {
                            logger.error("mediaStream createLiveStream  error = ", err)
                        }
                    });

                }
            });
        }
    });

}


/*
 * Handle android stream
 * return res when (ffmpeg progress > 'firstreplace' frame)
*/
function android_createStream(req, res, lock) {
    // https://login.nubosoftware.com/createStream?platId=[]&userId=[]url=[]&outputfile=[]

    res.contentType = 'json';
    var url = req.params.url;
    var outputFileNoPath = req.params.outputfile;
    var fileType = req.params.fileType;
    var sessionId = req.params.sessionId;
    var videoOrAudio = req.params.videoOrAudio;
    var pathToMgmt = process.cwd();
    var tmpFile = path.join(pathToMgmt + STREAMS_DIR + sessionId, 'tmp_' + outputFileNoPath);
    var outputFile = path.join(pathToMgmt + STREAMS_DIR + sessionId, outputFileNoPath);
    var outputFileRelativePath = path.join(STREAMS_DIR + sessionId, outputFileNoPath);
    var bufferFile = outputFile + '_buff.mp4';
    var newFfmpeg;
    var firstreplace = 800;
    var replaceStep = 400;
    var sentResponse = false;
    var replaceIteration = true;
    var index = 0;
    if (DEBUG) {
        logger.info('mediaStream:: URL=' + url);
        logger.info('mediaStream:: outputFile=' + outputFile);
        logger.info('mediaStream:: outputFileRelativePath=' + outputFileRelativePath);
        logger.info('mediaStream:: tmpFile=' + tmpFile);
        logger.info('mediaStream:: bufferFile=' + bufferFile);
        logger.info('mediaStream:: sessionId=' + sessionId);
    }
    // Get user path
    Common.redisClient.hgetall("sess_" + sessionId, function(err, session) {
        if (err) {
            if (DEBUG)
                logger.info('mediaStream:: 1 returning response');
            var json = JSON.stringify({
                status: "0",
                file: "",
                redisCmd: ""
            });
            sentResponse = true;
            res.end(json);
            lock.release(function(err, reply) {
                if (err) {
                    logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                } else if (reply != 1) {
                    logger.error("mediaStream ERROR: cannot release lock!");
                }
                return;
            });

        } else {
            if (fileType == FILE_STREAM) {
                if (DEBUG)
                    logger.info("session.userName, session.deviceID = " + session.email + ", " + session.deviceid);
                url = Common.nfshomefolder + User.getUserStorageFolder(session.email, session.deviceid) + "media/" + url;
                if (DEBUG)
                    logger.info("mediaStream:: fileType == FILE_STREAM ; url = " + url);
            } else if (fileType == RESOURCE_STREAM) {
                url = "html/player/extres/" + url;
                if (DEBUG) {
                    logger.info("session.userName, session.deviceID = " + session.email + ", " + session.deviceid);
                    logger.info("mediaStream:: fileType == RESOURCE_STREAM ; url = " + url);
                }
            } else if (fileType == FD_STREAM) {
                if (DEBUG)
                    logger.info("session.userName, session.deviceID = " + session.email + ", " + session.deviceid);
                url = Common.nfshomefolder + User.getUserDeviceDataFolder(session.email, session.deviceid) + url;
                if (DEBUG)
                    logger.info("mediaStream:: fileType == FD_STREAM ; url = " + url);
            }

            fs.exists(tmpFile, function(exists) {
                // If the file already exists then return
                if (exists) {
                    if (DEBUG)
                        logger.info('mediaStream:: 2 returning response');
                    // response back all details once finish
                    var json = JSON.stringify({
                        status: "1",
                        file: outputFileRelativePath,
                        redisCmd: outputFile
                    });
                    sentResponse = true;
                    res.end(json);
                    lock.release(function(err, reply) {
                        if (err) {
                            logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                        } else if (reply != 1) {
                            logger.error("mediaStream ERROR: cannot release lock!");
                        }
                        return;
                    });

                } else {
                    //start main ffmpeg
                    if (DEBUG) {
                        logger.info('mediaStream:: main ffmpeg: url = ' + url + ', tmpFile = ' + tmpFile);
                    }
                    addCmdToRedis(sessionId, tmpFile, function(err) {
                        if (err)
                            logger.info("*ERROR*:: mediaStream:: addCmdToRedis return = " + err);
                    });
                    var bitStreamFilters = ['-movflags frag_keyframe+separate_moof+faststart', '-preset ultrafast', '-ar 44100', '-f mp3'];
                    if (videoOrAudio == "video") {
                       bitStreamFilters = ['-movflags frag_keyframe+separate_moof+faststart', '-acodec copy', '-preset ultrafast', '-bsf:a aac_adtstoasc'];
                    }
                    var cmd = ffmpeg(url).output(tmpFile).videoCodec('copy')
                        .addOptions(bitStreamFilters).on('end', function() {

                            if (DEBUG) {
                                logger.info('mediaStream:: addOptions ');
                            }

                        }).on('progress', function(progress) {

                            if (DEBUG) {
                                logger.info('mediaStream:: Proccessing progress=', progress.frames);
                            }
                            if (progress.frames > firstreplace && replaceIteration) {
                                firstreplace = firstreplace + replaceStep;
                                replaceIteration = false;
                                index = index + 1;
                                if (DEBUG) {
                                    logger.info("mediaStream:: new ffmpeg: tmpFile = " + tmpFile + ", bufferFile_" + index + ".mp4 = " + bufferFile + "_" + index + ".mp4");
                                }
                                newFfmpeg = ffmpeg(tmpFile).output(bufferFile + "_" + index + ".mp4").addOptions(['-vcodec copy', '-acodec copy'])
                                    .on('start', function(progress) {

                                        if (DEBUG) {
                                            logger.info('mediaStream:: start1 ');
                                        }
                                        // add ffmpeg to cgroup...
                                        addPidToCgroup(tmpFile, function(err) {
                                            if (err) {
                                                logger.error("mediaStream:addPidToCgroup:ERROR " + err);
                                            }
                                        });

                                    }).on('end', function(progress) {

                                        if (DEBUG) {
                                            logger.info('mediaStream:: end1 ');
                                        }
                                        if (DEBUG) {
                                            logger.info("mediaStream:: symlink1: bufferFile_" + index + ".mp4 = " + bufferFile + "_" + index + ".mp4 ,  outputFile_" + index + ".mp4 = " + outputFile + "_" + index + ".mp4");
                                        }
                                        fs.symlink(bufferFile + "_" + index + ".mp4", outputFile + "_" + index + ".mp4", function() {
                                            // Sometimes the progress emitter is not reached so do this here
                                            if (!sentResponse) {
                                                if (DEBUG)
                                                    logger.info('mediaStream:: 3 returning response');
                                                // response back all details once finish
                                                var json = JSON.stringify({
                                                    status: "1",
                                                    file: outputFileRelativePath,
                                                    redisCmd: outputFile
                                                });

                                                res.end(json);
                                                // So that we don't send a response twice
                                                sentResponse = true;
                                                lock.release(function(err, reply) {
                                                    if (err) {
                                                        logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                                                    } else if (reply != 1) {
                                                        logger.error("mediaStream ERROR: cannot release lock!");
                                                    }
                                                });
                                            }
                                            replaceIteration = true;
                                        });

                                    }).on('error', function(err, stdout, stderr) {

                                        if (DEBUG) {
                                            logger.info('mediaStream:createLiveStream: err1=' + err);
                                            logger.info('mediaStream:createLiveStream: stdout=' + stdout);
                                            logger.info('mediaStream:createLiveStream: stderr=' + stderr);
                                            logger.info('mediaStream:createLiveStream: ENDING PROCESS');
                                        }

                                    }).run();
                            }

                        }).on('start', function(progress) {

                            if (DEBUG) {
                                logger.info('mediaStream:: start ');
                            }

                            // add ffmpeg to cgroup...
                            addPidToCgroup(tmpFile, function(err) {
                                if (err) {
                                    logger.error("mediaStream:addPidToCgroup:ERROR " + err);
                                }
                            });

                        }).on('end', function(progress) {

                            if (DEBUG) {
                                logger.info('mediaStream:: end ');
                            }
                            if (newFfmpeg) {
                                newFfmpeg.kill('SIGKILL');
                            }
                            if (DEBUG) {
                                logger.info("mediaStream:: symlink2: tmpFile = " + tmpFile + ", outputFile = " + outputFile);
                            }

                            newFfmpeg = ffmpeg(tmpFile).output(outputFile).addOptions(['-vcodec copy', '-acodec copy'])
                                .on('start', function(progress) {

                                    if (DEBUG) {
                                        logger.info('mediaStream:: start2 ');
                                    }
                                    // add ffmpeg to cgroup...
                                    addPidToCgroup(tmpFile, function(err) {
                                        if (err) {
                                            logger.error("mediaStream:addPidToCgroup:ERROR " + err);
                                        }
                                    });

                                }).on('end', function(progress) {

                                    if (DEBUG) {
                                        logger.info('mediaStream:: end2 ');
                                    }
                                    replaceIteration = false;
                                    index = index + 1;
                                    if (!sentResponse) {
                                        sentResponse = true;
                                        if (DEBUG)
                                            logger.info('mediaStream:: 4 returning response');
                                        fs.symlink(outputFile, outputFile + "_" + index + ".mp4", function() {

                                            var json = JSON.stringify({
                                                status: "1",
                                                file: outputFileRelativePath,
                                                redisCmd: outputFile
                                            });
                                            res.end(json);
                                            lock.release(function(err, reply) {
                                                if (err) {
                                                    logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                                                } else if (reply != 1) {
                                                    logger.error("mediaStream ERROR: cannot release lock!");
                                                }
                                            });
                                        });

                                    }
                                    fs.closeSync(fs.openSync(outputFile + "_END_OF_STREAM.txt", 'w'));
                                    delCmdfromRedis(sessionId, tmpFile, function(err) {
                                        if (err)
                                            logger.info("ERROR:mediaStream delCmdfromRedis return = " + err);
                                    });


                                }).on('error', function(err, stdout, stderr) {

                                    if (DEBUG) {
                                        logger.info('mediaStream:: err1=' + err);
                                        logger.info('mediaStream:: stdout=' + stdout);
                                        logger.info('mediaStream:: stderr=' + stderr);
                                        logger.info('mediaStream:: ENDING PROCESS');
                                    }

                                }).run();

                        }).on('error', function(err, stdout, stderr) {

                            if (DEBUG) {
                                logger.info('mediaStream:: err=' + err);
                                logger.info('mediaStream:: stdout=' + stdout);
                                logger.info('mediaStream:: stderr=' + stderr);
                                logger.info('mediaStream:: ENDING PROCESS');
                            }

                        }).run();
                }
            });//fs.exists

        }//else
    });
}

/*
 * Handle iOS Stream
 * with .m3u8 streaming (HLS) format
 */
function ios_createStream(req, res, lock) {
    // https://login.nubosoftware.com/createStream?platId=[]&userId=[]url=[]&outputfile=[]

    res.contentType = 'json';
    var url = req.params.url;
    var outputFileNoPath = req.params.outputfile;
    var fileType = req.params.fileType;
    var sessionId = req.params.sessionId;
    var clientType = req.params.clientType;

    var pathToMgmt = process.cwd();
    var tmpFile = path.join(pathToMgmt + STREAMS_DIR + sessionId, 'tmp_' + outputFileNoPath);
    var outputFile = path.join(pathToMgmt + STREAMS_DIR + sessionId, outputFileNoPath);
    var outputFileRelativePath = path.join(STREAMS_DIR + sessionId, outputFileNoPath);
    var sentResponse = false;

    var userDir = pathToMgmt + STREAMS_DIR + sessionId
    if (!fs.existsSync(userDir)){
        fs.mkdirSync(userDir);
    }

    if (DEBUG) {
        logger.info('mediaStream:: URL=' + url);
        logger.info('mediaStream:: outputFile=' + outputFile);
        logger.info('mediaStream:: sessionId=' + sessionId);
        logger.info('mediaStream:: outputFileRelativePath=' + outputFileRelativePath);
        logger.info('mediaStream:: tmpFile=' + tmpFile);
        logger.info('mediaStream:: outputFileRelativePath = ' + outputFileRelativePath);
        logger.info('mediaStream:: outputFileNoPath = ' + outputFileNoPath);
    }
    // Get user path
    Common.redisClient.hgetall("sess_" + sessionId, function(err, session) {
        if (err) {
            var json = JSON.stringify({
                status : "0",
                file : "",
                redisCmd : ""
            });
            sentResponse = true;
            res.end(json);
            lock.release(function(err, reply) {
                if (err) {
                    logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                } else if (reply != 1) {
                    logger.error("mediaStream ERROR: cannot release lock!");
                }
                return;
            });
        }

        if (fileType == FILE_STREAM) {
            url = Common.nfshomefolder +  User.getUserStorageFolder(session.email, session.deviceid) + "media/" +url;
            if (DEBUG) {
                logger.info("session.userName, session.deviceID = " + session.email + ", " + session.deviceid);
                logger.info("mediaStream:: fileType == FILE_STREAM ; url = " + url);
            }
        } else if (fileType == RESOURCE_STREAM) {
            url = "html/player/extres/" + url;
            if (DEBUG) {
                logger.info("session.userName, session.deviceID = " + session.email + ", " + session.deviceid);
                logger.info("mediaStream:: fileType == RESOURCE_STREAM ; url = " + url);
            }
        } else if (fileType == FD_STREAM) {
            url = Common.nfshomefolder +  User.getUserDeviceDataFolder(session.email, session.deviceid) + url;
            if (DEBUG) {
                logger.info("session.userName, session.deviceID = " + session.email + ", " + session.deviceid);
                logger.info("mediaStream:: fileType == FD_STREAM ; url = " + url);
            }
        }

        fs.exists(outputFile, function(exists) {

            if (exists) {
                // response back
                var json = JSON.stringify({
                    status : "1",
                    file : outputFileRelativePath,
                    redisCmd : ""
                });
                res.end(json);
                sentResponse = true;
                lock.release(function(err, reply) {
                    if (err) {
                        logger.error("mediaStream ERROR: cannot release lock! Error = " + err);
                    } else if (reply != 1) {
                        logger.error("mediaStream ERROR: cannot release lock!");
                    }
                    return;
                });

            } else {

                var cmd = "touch " + tmpFile + ";chmod u+x " + tmpFile + ";touch " + outputFile + ";chmod u+x " + outputFile;
                var child = exec(cmd, function(error, stdout, stderr) {
                    if (DEBUG) {
                        logger.info("mediaStream stdout = ", stdout)
                        logger.info("mediaStream stderr = ", stderr)
                        logger.info("mediaStream error = ", error)
                    }
                    cmd = pathToMgmt + ffmpegPath + " -i '" + url + "' -flags -global_header -segment_time 0.5 -hls_time 1 -hls_list_size 0 " + tmpFile;

                    async.parallel([

                        function(callback){
                            if (DEBUG) {
                                logger.info("cmd: " + cmd);
                            }
                            var child = exec(cmd, function(error, stdout, stderr) {
                                if (DEBUG) {
                                    logger.info("mediaStream stdout = ", stdout)
                                    logger.info("mediaStream stderr = ", stderr)
                                    logger.info("mediaStream error = ", error)
                                }
                                callback(error);
                            });
                        },

                        function(callback){
                            addCmdToRedis(sessionId, cmd, function(err) {
                                if (DEBUG) {
                                    logger.info("mediaStream addCmdToRedis return = " + err);
                                }
                                callback(err);
                            });
                        },


                        function(callback){
                            var wait = 1000;//1 sec
                            var retries = 60;//
                            sendResToPlayer(outputFile, tmpFile, retries, wait, false, function(err) {
                                if (DEBUG) {
                                    logger.info("mediaStream sendResToPlayer return = " + err);
                                }
                                if (err) {
                                    if (!sentResponse) {
                                        var json = JSON.stringify({
                                            status : "0",
                                            file : "",
                                            redisCmd : ""
                                        });
                                        res.end(json);
                                        sentResponse = true;
                                    }
                                } else {
                                    if (!sentResponse) {
                                        var json = JSON.stringify({
                                            status : "1",
                                            file : outputFileRelativePath,
                                            redisCmd : tmpFile
                                        });
                                        res.end(json);
                                        sentResponse = true;
                                    }
                                }
                                lock.release(function(err1, reply) {
                                    if (err1) {
                                        logger.error("mediaStream ERROR: cannot release lock! Error = " + err1);
                                    } else if (reply != 1) {
                                        logger.error("mediaStream ERROR: cannot release lock!");
                                    }
                                    callback(err1 + err);
                                });
                            });

                        },

                        function(callback){
                            var wait = 1000;//1 sec
                            copyStreamFile(outputFile, outputFileRelativePath, tmpFile, res, wait, function(err) {
                                if (DEBUG) {
                                    logger.info("mediaStream copyStreamFile return = " + err);
                                }
                                if (err == "fileIsReady") {
                                    if (!sentResponse) {
                                        var json = JSON.stringify({
                                            status : "1",
                                            file : outputFileRelativePath,
                                            redisCmd : tmpFile
                                        });
                                        res.end(json);
                                        sentResponse = true;
                                        lock.release(function(err1, reply) {
                                            if (err1) {
                                                logger.error("mediaStream ERROR: cannot release lock! Error = " + err1);
                                            } else if (reply != 1) {
                                                logger.error("mediaStream ERROR: cannot release lock!");
                                            }
                                            callback(err1);
                                        });
                                    }
                                } else {
                                    callback(err);
                                }

                            });

                        }

                    ],
                    // optional callback
                    function(err, results){
                        delCmdfromRedis(sessionId, cmd, function(err) {
                            if (DEBUG) {
                                logger.info("mediaStream delCmdfromRedis return = " + err);
                            }
                            return;
                        });
                    });

                });//var child = exec

            }
        });
    });
}


/*
 * Clear all ffmpeg tasks (on session end...)
 */
function removeUserStreams(sessionId, callback) {

    if (DEBUG) {
        logger.info("mediaStream Reached removeUserStreams");
    }
    var userStreamsFolder = process.cwd() + STREAMS_DIR + sessionId;
    Common.redisClient.SMEMBERS(sessionId + '_streams', function(err, replies) {
        if (err) {
            logger.err("mediaStream:: can't get streams: " + err);
            callback(err);
            return;

        } else if (!replies || replies == "") {
            var errormsg = 'sessions is null or empty: ' + err;
            if (DEBUG) {
                logger.info("streams list is null or empty");
            }

            fs.exists(userStreamsFolder, function(exists) {

                if (exists) {
                    var delFolderCmd = "rm -r " + userStreamsFolder;
                    var child = exec(delFolderCmd, function(error, stdout, stderr) {
                        if (DEBUG) {
                            logger.info("mediaStream child stdout = ", stdout)
                            logger.info("mediaStream child stderr = ", stderr)
                            logger.info("mediaStream child error = ", error)
                        }
                        callback(error);
                        return;
                    });
                } else {
                    callback(null);
                    return;
                }
            });


        } else {
            if (DEBUG) {
                logger.info("mediaStream: removeUserStreams:delCmdfromRedis");
            }
            async.eachSeries(replies, function(itemCmd, callback) {
                delCmdfromRedis(sessionId, itemCmd, function(err) {
                    if (err)
                        logger.error("mediaStream: removeUserStreams internal error " + err);
                    callback(null);
                });
            }, function(err) {
                //remove user stream folder
                fs.exists(userStreamsFolder, function(exists) {
                    if (exists) {
                        var delFolderCmd = "rm -r " + userStreamsFolder;
                        var child = exec(delFolderCmd, function(error, stdout, stderr) {
                            if (DEBUG) {
                                logger.info("mediaStream child stdout = ", stdout)
                                logger.info("mediaStream child stderr = ", stderr)
                                logger.info("mediaStream child error = ", error)
                            }
                            callback(error + err);
                            return;
                        });
                    } else {
                        callback(err);
                        return;
                    }
                });
            });

        }
    });
}


function addCmdToRedis(sessionId, cmd, callback) {

    Common.redisClient.SADD(sessionId + '_streams', cmd, function (err) {
        callback(err);
    });
}


function addLiveCmdToRedis(sessionId, cmd, callback) {

    // add ffmpeg to cgroup...
    try {

    } catch (err) {

    }
    addPidToCgroup(cmd, function(err) {
        if (err) {
            logger.error("mediaStream:addPidToCgroup:ERROR " + err);
        }

        Common.redisClient.SADD("LIVE_STREAM_" + cmd, sessionId, function (err) {
            if (err) {
                callback(err);
                return;
            } else {
                Common.redisClient.SADD(sessionId + '_streams', cmd, function (err) {
                     if (err) {
                        callback(err);
                        return;
                    } else {
                        Common.redisClient.SADD("LIVE_LIST", sessionId, function (err) {
                            callback(err);
                            return;
                        });
                    }
                });
            }
        });
    });
}

/*
 * clear redis lists
 */
function delCmdfromRedis(session, cmd, callback) {
    // handle live stream...
    if (DEBUG) {
        logger.info("mediaStream: delCmdfromRedis: session = " + session);
        logger.info("mediaStream: delCmdfromRedis: cmd = " + cmd);
        logger.info("mediaStream: delCmdfromRedis: index = " + cmd.indexOf(STREAMS_DIR + LIVE_STREAMS_DIR));
        logger.info("mediaStream: delCmdfromRedis: typeof = " + typeof(cmd.indexOf(STREAMS_DIR + LIVE_STREAMS_DIR)));
    }
    if (cmd.indexOf(STREAMS_DIR + LIVE_STREAMS_DIR) !== -1) {
        //A live stream.............
        Common.redisClient.SREM(session + '_streams', cmd,function (err) {
            if (!err) {
                Common.redisClient.SREM("LIVE_STREAM_" + cmd, session,function (err) {
                    if (!err) {
                        Common.redisClient.SCARD("LIVE_STREAM_" + cmd, function(err, replies) {
                            if (err) {
                                callback(err);
                                return;
                            } else if (replies == 0 || !replies || replies == '') {
                                //clear from LIVE_LIST, kill ffmpeg and delete files
                                Common.redisClient.SREM("LIVE_LIST", session, function (err) {
                                    if (err) {
                                        callback(err);
                                        return;
                                    } else {
                                        killFfmpegProcess(cmd, function(err) {
                                            if (err) {
                                                logger.error("mediaStream:killFfmpegProcess:ERROR " + err);
                                            }
                                            callback(err);
                                            return;
                                        });
                                    }
                                });
                            } else {
                                callback(err);
                                return;
                            }
                        });
                    } else {
                        callback(err);
                        return;
                    }
                });
            } else {
                callback(err);
                return;
            }
        });

    } else {
        Common.redisClient.SREM(session + '_streams', cmd,function (err) {

            killFfmpegProcess(cmd, function(err) {
                if (err) {
                    logger.error("mediaStream:killFfmpegProcess:ERROR " + err);
                }
                callback(err);
                return;
            });

        });
    }
}

/*
 * kill ffmpeg
 */
function killFfmpegProcess(cmd, callback) {

    ffmpegPid(cmd, function(err, pids) {
        if (err) {
            logger.error("mediaStream:ffmpegPid:ERROR " + err);
            callback(err);
            return;
        } else {
            var pidStr = "";
            pids.forEach(function(pid, err) {
                if (pid !== "" && pid !== " ") {
                    pidStr = pidStr + pid + " ";
                }
            });
            if (pidStr === "") {
                callback(null);
                return;

            } else {

                var delCmd = "kill -9 " + pidStr;
                if (DEBUG) {
                    logger.info("mediaStream:killFfmpegProcess delCmd2: " + delCmd);
                }
                var child1 = exec(delCmd, function(error, stdout, stderr) {
                    if (DEBUG) {
                        logger.info("mediaStream killFfmpegProcess stdout = ", stdout)
                        logger.info("mediaStream killFfmpegProcess stderr = ", stderr)
                        logger.info("mediaStream killFfmpegProcess error = ", error)
                    }
                    callback(error);
                    return;
                });
            }
        }
    });

}

/*
 * update .m38u file every 'wait' sec
 */
function copyStreamFile(outputFile, outputFileRelativePath, tmpFile, res, wait, callback) {


    fs.readFile(tmpFile, 'utf8', function (err, data) {
        if (err) {
            callback(err);
            return;
        } else {
            if(data != null && data.length != 0 && data.indexOf('#EXT-X-ENDLIST') > -1) {
                fs.writeFileSync(outputFile, fs.readFileSync(tmpFile));
                callback("fileIsReady");
                return;
            } else {
                fs.writeFileSync(outputFile, fs.readFileSync(tmpFile));
                fs.appendFile(outputFile, '#EXT-X-ENDLIST', function (err) {
                    if (err)
                        logger.info("mediaStream - fs.appendFile - err = " + err);
                });
                setTimeout(function() {
                    copyStreamFile(outputFile, outputFileRelativePath, tmpFile, res, wait, callback);
                }, wait);
            }
        }
    });

}


/*
 * sending res when the first ts file is ready
 */
function sendResToPlayer(outputFile, tmpFile, retries, wait, isLiveStream, callback) {

    var numberOfTs = 1;
    var ts_file = tmpFile.slice(0, tmpFile.length-5) + numberOfTs + ".ts";

    fs.exists(ts_file, function(exists) {

        if (exists) {
            // response back all details once finish
            if (!isLiveStream) {
                fs.writeFileSync(outputFile, fs.readFileSync(tmpFile));
                fs.appendFile(outputFile, '#EXT-X-ENDLIST', function (err) {
                    if (DEBUG) {
                        logger.info("mediaStream - fs.appendFile err = " + err);
                    }
                    callback(null);
                    return;
                });
            } else {
                callback(null);
                return;
            }
        } else {
            if (retries <= 0) {
                if (DEBUG) {
                    logger.info("Timeout in sendResToPlayer! cannot play this video!!!!!!!!");
                }
                callback("Timeout in sendResToPlayer! cannot play this video!!!!!!!!");
                return 
            } else {
                if (DEBUG) {
                    logger.info("Wait on sendResToPlayer  retries: " + retries);
                }
                setTimeout(function() {
                    sendResToPlayer(outputFile, tmpFile, retries-1, wait, isLiveStream, callback);
                }, wait);
            }
        }
    });
}

/*
 * add or remove user from live list (in redis)
 */
function addOrRemoveUserFromLiveStream(sessionId, redisCmd, playOrPause, callback) {

    if (playOrPause === "play") {
        if (DEBUG) {
            logger.info("addOrRemoveUserFromLiveStream; play");
        }
        Common.redisClient.SADD("LIVE_STREAM_PLAYING_" + redisCmd, sessionId, function (err) {
            if (err) {
                logger.error("mediaStream:addOrRemoveUserFromLiveStream: SADD internal ERROR " + err);
                callback(err, null);
                return;
            } else {
                Common.redisClient.SCARD("LIVE_STREAM_PLAYING_" + redisCmd, function(err, replies) {
                    if (err || !replies || replies == '') {
                        logger.error("mediaStream:addOrRemoveUserFromLiveStream: SCARD internal ERROR " + err);
                        callback(err, null);
                        return;
                    } else if (replies == 1) {
                        ffmpegPid(redisCmd, function(err, pids) {
                            if (err) {
                                logger.error("mediaStream:addOrRemoveUserFromLiveStream:ffmpegPid:ERROR " + err);
                            }
                            callback(err,pids);
                            return;
                        });
                    } else {
                        if (DEBUG) {
                            logger.info("addOrRemoveUserFromLiveStream; replies = " + replies);
                        }
                        callback(null, null);
                        return;
                    }
                });
            }
        });
    } else {
        if (DEBUG) {
            logger.info("addOrRemoveUserFromLiveStream; pause");
        }


        Common.redisClient.SCARD("LIVE_STREAM_PLAYING_" + redisCmd, function(err, replies) {
            if (err || !replies || replies == '') {
                logger.error("mediaStream:addOrRemoveUserFromLiveStream: SCARD internal ERROR " + err);
                callback(err, null);
                return;
            } else {

                Common.redisClient.SREM("LIVE_STREAM_PLAYING_" + redisCmd, sessionId, function (err) {
                    if (err) {
                        logger.error("mediaStream:addOrRemoveUserFromLiveStream: internal ERROR " + err);
                        callback(err, null);
                        return;
                    } else {
                        if (replies == 1) {
                            ffmpegPid(redisCmd, function(err, pids) {
                                if (err) {
                                    logger.error("mediaStream:addOrRemoveUserFromLiveStream:ffmpegPid:ERROR " + err);
                                }
                                callback(err,pids);
                                return;
                            });
                        }
                    }
                });

            }
        });
    }

}


/*
 * get pid of ffmpeg
 */
function ffmpegPid(cmd, callback) {
    var pid_cmd = "ps `pidof 'ffmpeg'` | grep " + cmd + " | awk '{print $1}'";
    var child = exec(pid_cmd, function(error, stdout, stderr) {
        if (DEBUG) {
            logger.info("mediaStream :ffmpegPid: cmd = ", pid_cmd)
            logger.info("mediaStream :ffmpegPid: stdout = ", stdout)
            logger.info("mediaStream :ffmpegPid: stderr = ", stderr)
            logger.info("mediaStream :ffmpegPid: error = ", error)
        }
        callback(error, stdout.split("\n"))
        return;
    });
}

/*
 * add process to cgroup
*/
function addPidToCgroup(cmd, callback) {
    ffmpegPid(cmd, function(err, pids) {
        if (err) {
            logger.error("mediaStream:ffmpegPid:ERROR " + err);
            callback(err);
            return;
        } else {
            async.eachSeries(pids, function(pid, callback) {
                if (pid != "") {
                    var cgroup_cmd = "echo " + pid.replace(/\n$/, '') + " > " + Common.ffmpegCgroupDir;
                    var child = exec(cgroup_cmd, function(error, stdout, stderr) {
                        if (DEBUG) {
                            logger.info("mediaStream !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!cmd = ", cgroup_cmd)
                            logger.info("mediaStream !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!stdout = ", stdout)
                            logger.info("mediaStream !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!stderr = ", stderr)
                            logger.info("mediaStream !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!error = ", error)
                        }
                        callback(error);
                    });
                } else {
                    callback(null);
                }
            }, function(err) {
                callback(err);
            });
        }
    });
}


/*
 * stop or resumes ffmpeg (if ffmpeg had previously been paused)
 *
 */
function playPauseStream(req, res) {
    // https://login.nubosoftware.com/playPauseStream?platId=[]&userId=[]url=[]&outputfile=[]

    res.contentType = 'json';
    var sessionId = req.params.sessionId;
    var redisCmd = req.params.redisCmd;
    var playOrPause = req.params.playOrPause;
    var playOrPauseCmd = "";
    if (DEBUG) {
        logger.info('mediaStream:playPauseStream: sessionId=' + sessionId);
        logger.info('mediaStream:playPauseStream: redisCmd=' + redisCmd);
        logger.info('mediaStream:playPauseStream: playOrPause = ' + playOrPause);
    }

//    checkIfFileExists
    fs.exists(redisCmd, function(exists) {
        if (!exists) {
            var json = JSON.stringify({
                status : "0",
                msg : "file does not exist"
            });
            res.end(json);
            return;
        } else {
            if (playOrPause == "play" && redisCmd != "") {
                playOrPauseCmd = "kill -CONT ";
            } else if (playOrPause == "pause" && redisCmd != "") {
                playOrPauseCmd = "kill -STOP ";
            } else {
                var json = JSON.stringify({
                    status : "0",
                    msg : "redisCmd " + playOrPause
                });
                res.end(json);
                return;
            }

            // handle live stream...
            if (redisCmd.indexOf(STREAMS_DIR + LIVE_STREAMS_DIR) !== -1) {
                //A live stream
                addOrRemoveUserFromLiveStream(sessionId, redisCmd, playOrPause, function(err, pids) {
                    if (err) {
                        logger.error("mediaStream:playPauseStream:addOrRemoveUserFromLiveStream " + err);
                    } else if (pids) {
                        var cmd = "";
                        pids.forEach(function(pid, err) {
                            if (pid != "")
                                cmd = cmd + playOrPauseCmd + pid + ";";
                        });
                        var child1 = exec(cmd, function(error, stdout, stderr) {
                            var json = JSON.stringify({
                                status : "1",
                                msg : "redisCmd " + playOrPause
                            });
                            res.end(json);
                            return;

                        });
                    } else {
                        var json = JSON.stringify({
                            status : "1",
                            msg : "redisCmd " + playOrPause
                        });
                        res.end(json);
                        return;
                    }
                });
            } else {
                ffmpegPid(redisCmd, function(err, pids) {
                    if (err) {
                        logger.error("mediaStream:ffmpegPid:ERROR " + err);
                    } else {
                        var cmd = "";
                        pids.forEach(function(pid, err) {
                            if (pid != "")
                                cmd = cmd + playOrPauseCmd + pid + ";";
                        });
                        var child1 = exec(cmd, function(error, stdout, stderr) {
                            var json = JSON.stringify({
                                status : "1",
                                msg : "redisCmd " + playOrPause
                            });
                            res.end(json);
                            return;

                        });

                    }
                });
            }
        }
    });
}




/*
 * debug...
 */
Common.loadCallback = function(err) {
    var url = process.argv[2];
    var outputFile = process.argv[3];
    var firstreplace = 1000;
    var tmpFile = 'tmp.3gp';
    var cmd = ffmpeg(url).output(tmpFile).videoCodec('libx264')
    //.toFormat('mp4')
    .addOptions(['-movflags frag_keyframe+separate_moof+faststart', '-profile:v baseline', '-acodec libfdk_aac']).on('progress', function(progress) {
        if (DEBUG)
            logger.info('mediaStream:: progress=', progress);
        if (progress.frames > firstreplace) {
            firstreplace += firstreplace;
            var newFfmpeg = ffmpeg(tmpFile).output(outputFile).addOptions(['-vcodec copy', '-acodec copy']).on('end', function() {
                if (DEBUG)
                    logger.info('mediaStream:: Created real output');
            }).run();
        }
    }).on('end', function() {
            logger.info('mediaStream:: Finished processing2');
    }).run();
    //Common.quit();
}

module.exports = {
    createStream : createStream,
    removeUserStreams : removeUserStreams,
    playPauseStream : playPauseStream
};
