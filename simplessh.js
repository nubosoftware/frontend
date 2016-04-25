"use strict";

/**
 *	simplessh.js
 *  Simple class for ssh client to the nubo host 
 */
var Common = require('./common.js');
var logger = Common.logger;
var Connection = require('ssh2');

//var SimpleSSH;

module.exports = function (sshhost,sshuser,callback,specialLogger,sshport) {
  this.mylogger = (specialLogger ? specialLogger : logger); 
  this.isReady = false;
  this.connection = new Connection();
  this.connError = false;
  this.stack = new Error().stack;

  var connectTimeoutID = null;
  var disconnectTimeoutID = null;

  (function (simpleSSH) {
    simpleSSH.connection.on('ready', function() {
      //simpleSSH.mylogger.info('simpleSSH Connection :: ready');
      if (!simpleSSH.isReady) {
        simpleSSH.isReady = true;
        if (connectTimeoutID) clearTimeout(connectTimeoutID);
        if (callback) callback(null,simpleSSH);    
      }      
      disconnectTimeoutID = setTimeout((function() {
          simpleSSH.mylogger.info("Called disconnectTimeoutID on ready");
          simpleSSH.mylogger.info("SSH session connection was not dissconnected after 5 minutes! Stopping connection... stack:"+simpleSSH.stack);
          simpleSSH.end();
      }), 300000); // setTimeout 5 minutes for disconnect
      
    });
    simpleSSH.connection.on('error', function(err) {
      simpleSSH.mylogger.info('simpleSSH Connection :: error :: ' + err);
      simpleSSH.connError = true;
      if (!simpleSSH.isReady) { // connection was not OK
        simpleSSH.isReady = true;
        if (connectTimeoutID) clearTimeout(connectTimeoutID);
        if (callback) callback(err,simpleSSH);
      }
    }); 
    simpleSSH.connection.on('end', function() {
      //simpleSSH.mylogger.info('simpleSSH Connection :: end');
      simpleSSH.connError = true;
      if (!simpleSSH.isReady) { // connection was not OK
        simpleSSH.isReady = true;
        if (connectTimeoutID) clearTimeout(connectTimeoutID);
        if (callback) callback("Connection ended before ready",simpleSSH);
      }
    });
    simpleSSH.connection.on('close', function(had_error) {
      //simpleSSH.mylogger.info('simpleSSH Connection :: close');
      if (disconnectTimeoutID) clearTimeout(disconnectTimeoutID);
      simpleSSH.connError = true;    
      if (!simpleSSH.isReady) { // connection was not OK
        simpleSSH.isReady = true;
        if (connectTimeoutID) clearTimeout(connectTimeoutID);
        if (callback) callback("Connection closed before ready",simpleSSH);
      }
    });
    simpleSSH.mylogger.info("simpleSSH connect to "+sshuser+'@'+sshhost+' using key '+Common.sshPrivateKey); 
    simpleSSH.connection.connect({
      host: sshhost,
      port: (sshport ? sshport : 22),
      username: sshuser,
      privateKey: require('fs').readFileSync(Common.sshPrivateKey)
    });	
    connectTimeoutID = setTimeout((function() {
      if (!simpleSSH.isReady) {
         simpleSSH.mylogger.info('simpleSSH Stream :: timeout for connect');
         simpleSSH.isReady = true;
         if (callback) callback("Timeout",simpleSSH);  
      }
    }), 15000); // setTimeout
    
  
  }) (this); // (function (simpleSSH) {
  
  this.exec = function (cmd,callback) {
    this.execWithTimeout(cmd,60000,callback);
  }
  this.execWithTimeout = function (cmd,timeout,callback) {
    if (disconnectTimeoutID) clearTimeout(disconnectTimeoutID);
    var execStack = new Error().stack;
    (function (simpleSSH) {
      function resetConnectionTimeout() {
            if (disconnectTimeoutID) clearTimeout(disconnectTimeoutID);
            disconnectTimeoutID = setTimeout((function() {
                simpleSSH.mylogger.info("Called disconnectTimeoutID on execWithTimeout");
                simpleSSH.mylogger.info("SSH session connection was not dissconnected after 5 minutes! Stopping connection... stack:"+simpleSSH.stack);
                simpleSSH.end();
            }), 300000); // setTimeout 5 minutes for disconnect
      }
      var sshout = "";	
      var isExit = false;
      var timeOutID = null;
      var streamCode,streamSignal;
      var streamEnded = false;
      if(simpleSSH.connError) {
        simpleSSH.mylogger.info('simpleSSH exec :: Connetion error');
        if (callback) callback('simpleSSH exec :: Connetion error');
        return;  
      }
      simpleSSH.connection.exec(cmd, function(err, stream) {
        if (err) {
            simpleSSH.mylogger.info('simpleSSH exec :: err: ' + err);
        	if (callback) callback(err+", stack:"+execStack);
        	return;
        };
        if (timeout>0) {
           timeOutID = setTimeout((function() {
              if (!isExit) {
                 simpleSSH.mylogger.info('simpleSSH Stream :: timeout for cmd: '+cmd);
                isExit=true;
                if (callback) callback("Timeout"+", stack:"+execStack,0, 0,sshout);  
              }
           }), timeout); // setTimeout
        }
        stream.on('data', function(data, extended) {
          //simpleSSH.mylogger.info('simpleSSH '+(extended === 'stderr' ? 'STDERR: ' : 'STDOUT: ')
          //      + data);
          sshout += data;      
        }); // stream.on('data'
    
        stream.on('exit', function(code, signal) {
          //simpleSSH.mylogger.info('simpleSSH Stream :: exit :: code: ' + code + ', signal: ' + signal);
          streamCode = code;
          streamSignal = signal;
          if (streamEnded && !isExit) { // end already called before exit
            isExit=true;
            if (timeOutID) clearTimeout(timeOutID);
            resetConnectionTimeout();
            if (callback) callback(null,streamCode, streamSignal,sshout);    
          }
          
        }); // stream.on('exit'
        stream.on('close', function() {
          //simpleSSH.mylogger.info('simpleSSH Stream :: close ');
          if (streamCode!=null && !isExit) {
            isExit=true;
            if (timeOutID) clearTimeout(timeOutID);
            resetConnectionTimeout();
            if (callback) callback(null,streamCode, streamSignal,sshout); 
          }
        }); // stream.on('close'
        stream.on('end', function() {
          //simpleSSH.mylogger.info('simpleSSH Stream :: end :: sshout: '+sshout);
          if (streamCode==null) {
            streamEnded = true;
            return;  
          }
          if (!isExit) {
            isExit=true;
            if (timeOutID) clearTimeout(timeOutID);
            resetConnectionTimeout();
            if (callback) callback(null,streamCode, streamSignal,sshout);  
          }
        }); // stream.on('end'
        
        
      }); //
      
    }) (this); // (function (simpleSSH) {
  }; //this.exec
  
  this.end = function() {
        this.connection.end();
  }

}
