"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var platformModule = require('./platform.js');
var async = require('async');
var SimpleSSH = require('./simplessh.js');
var handleExchangeLock = false;

function registerToExAccount(exEmail,authType,parsedURL,domain, exUser , exPassword,secureSSL,callback) {//email,authType,parsedURL,domain, orgUser , orgPassword,secureSSL,   //exUser,exPass,exServerURL,
    var ssh = null;
    var platform = null;
    var useADB = Common.useADB;
    var adbpre = null;
    var adbQuote = '"';
    var adbSlash = '\\';
    
    async.series([
        // Set lock
        function(callback) {
            function getlock(retries, wait) {
                if (retries < 0) {
                    var err = "Cannon get lock for creation exchange account";
                    logger.info(err);
                    callback(err);
                } else {
                    if (handleExchangeLock) {
                        setTimeout(function() {
                            plat.lock(retries-1,wait);
                        }, wait);
                    } else {
                        handleExchangeLock = true;
                        logger.info("Get handleExchangeLock:" + handleExchangeLock);
                        callback(null);
                    }
                }
            }
            getlock(10, 700);
        },
        function(callback) {
          platformModule.getAvailablePlatform('ex', null, logger, function(err,obj){
          if (err) {
            callback(err);
            return;
          }
          if (obj==null) {
              callback("can not found available exchange platform!");
              return;
          }
          platform = obj;
          //useADB=false;
          if (useADB==true)
            adbpre = 'adb -s ' + platform.params.platformline + ' shell ';
          else
            adbpre = 'ANDROID_ASSETS=/system/app LD_LIBRARY_PATH=/vendor/lib:/system/lib BOOTCLASSPATH=/system/framework/core.jar:/system/framework/conscrypt.jar:/system/framework/okhttp.jar:/system/framework/core-junit.jar:/system/framework/bouncycastle.jar:/system/framework/ext.jar:/system/framework/framework.jar:/system/framework/framework2.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/mms-common.jar:/system/framework/android.policy.jar:/system/framework/services.jar:/system/framework/apache-xml.jar:/system/framework/webviewchromium.jar sh -c ';
          callback(null);
          return;               
           });
       }, //// function(callback)

//******************************************
//open ssh connection
//create account
     function(callback){
     	platform.initSsh(logger, function(err, sshobj) {
          if (err) {            
            callback(err);
          } else {
          	if (sshobj) {
            	ssh = sshobj;
            	adbpre = platform.adbpre;
            	callback(null);
          	} else {            	
            	callback("initSsh return null object");
          	}
          }
        });                         
     },
     // Check logcat for errors
     function(callback){
        if (domain){
            exUser = domain + "\\" + exUser;
        }
        //var cmd = adbpre + adbQuote + 'adb shell am start -a android.intent.action.MAIN -n com.android.email/.activity.Welcome' + adbQuote;     
        //var cmd = adbpre + adbQuote + 'adb shell am start -a android.intent.action.MAIN -d \'\\"content://ui.email.android.com/view/mailbox?ACCOUNT_ID=1152921504606846976&MAILBOX_ID=-4\\"\' -e DEBUG_PANE_MODE 2' + adbQuote;
        var cmd = adbpre + adbQuote + 'setprop ro.test_harness true && am start -a com.android.email.CREATE_ACCOUNT -e EMAIL '+exEmail+' -e USER \\"Exchange\\" -e INCOMING eas+ssl+trustallcerts+://'+encodeURIComponent(exUser)+':'+encodeURIComponent(exPassword)+'@'+parsedURL+':443 -e OUTGOING eas+ssl+trustallcerts+://'+encodeURIComponent(exUser)+':'+encodeURIComponent(exPassword)+'@'+parsedURL + ":443" + adbQuote;
        //var cmd = adbpre + adbQuote + 'adb shell am force-stop com.android.email' + adbQuote;                  
 + adbQuote;        
        console.log("cmd: "+cmd);
       ssh.exec(cmd,function(err,code, signal,sshout){
            if (err) {
              var msg = "ERROR - create user account: "+err;                      
              callback(msg);                            
              return;
            }          
            callback(null);
         }); // ssh.exec
     }, //function(callback)

//*****************************************
function(callback){  
setTimeout(function() {
            console.log('time to sleep');
            callback(null);
            }, 5000);
           
},

//*****************************************
//open ssh connection
  ],function(err, results){
        handleExchangeLock = false;
        logger.info("Free handleExchangeLock:" + handleExchangeLock);
      if (ssh!=null) {
      ssh.end();
    }
    if (err) {  
        logger.error("error while creating exchamge account "+err);
        callback(err);
        return
    } else {
        logger.info("user account created automatically on exchange platform");
        callback(null);
        return
    }
  });// async.series

}
/*
//only for test!
Common.loadCallback = function(err) {
  if (err) {
      console.log("Error: "+err);
      Common.quit();
      return;
  }
    registerToExAccount("israel@nubo.co",1,"10.1.21.34:443","", "israel" , "Password1","", function(msg) {
        if (err) {
              console.log("Error: sdf "+err);
              Common.quit();
              return;
        }
        console.log("create account - only for test - done ");
        Common.quit();
    });
    //Common.quit();
}//end for test
*/

var addExchangeNotify = {
    registerToExAccount: registerToExAccount
  };
module.exports = addExchangeNotify;

