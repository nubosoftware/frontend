// control EWS permission in exchange using the following link - https://msdn.microsoft.com/en-us/library/office/dn467892%28v=exchg.150%29.aspx

"use strict";

var Common = require('./common.js');
var logger = Common.logger;
var util = require('util');
var https = require('https');
var parser = require('xml2json');
var async = require('async');
var EWSXMLs = require('./EWSXMLs.js');
var EWSUtils = require('./EWSUtils.js');
var fs = require('fs');

// EWS constants
var EXCHANGE_FOLDER = 'inbox';
var EXCHANGE_FOLDER_EVENT = 'NewMailEvent';
var EXCHANGE_SUFFIX_URL = '/EWS/Exchange.asmx';
var LISTENER_SUFFIX_URL = '/EWSListener';
var KEEP_ALIVE_INTERVAL = Common.EWSKeepAliveInterval;


/*
 * Method used to subscribe profile to EWS (Exchange Web Services)
 */
function subscribeProfileToEWS(emailAddress , mainDomain, forceSubscription, callbackFunc) {
    var managementURL = Common.serverurl;

    // get login details from DB
    var ewsDetails;
    var subscriptionID = '-1';

    async.series([
      function (callback) {
          // first take EWS details from DB based on email and domain
          EWSUtils.getEWSDetails(emailAddress,mainDomain, null, function(err, details) {
              if (err) {
                  // Error on get user details or user not exist
                  callback(err);
              } else {
                  // assign the return value
                  ewsDetails = details;
                  
                  if (!Common.withService) {

                      // check if user is registered to receive email push notification, OW we don't need to continue
                      if (ewsDetails['sendNotifInd'] == 0)
                      {
                          logger.info('Profile ' + emailAddress + ' has disabled his notification setting');
                          callback('OK');
                      }
                      // if the user is already registered we don't have to re-register him unless the parameter forceSubscription is on
                      else if (ewsDetails['subscriptionID'] && ewsDetails['subscriptionID'] != -1 && ewsDetails['subscriptionDate'] &&  (((new Date()).getTime() - ewsDetails['subscriptionDate'].getTime()) < (KEEP_ALIVE_INTERVAL*3*60*1000)) && forceSubscription == false) 
                      {
                          logger.info('Profile ' + emailAddress + ' already registered to EWS, no need to re-register');
                          callback('OK');
                      }
                      // check if user is Exchange user, log and return OK
                      else if (ewsDetails['authType'] != '1' && ewsDetails['authType'] != 1) {
                          logger.info(emailAddress + ' is not defined as exchange');
                          callback('OK');
                      }
                      // check if user has Exchange details, OW do not register him to EWS
                      else if (ewsDetails['serverURL'] == null || ewsDetails['serverURL'].length <= 0 || ewsDetails['impersonationUser'] == null || ewsDetails['impersonationUser'].length <= 0 || ewsDetails['impersonationPassword'] == null || ewsDetails['impersonationPassword'].length <= 0) {
                          logger.info('Profile ' + emailAddress + ' is missing one of the details - user name, password or server URL');
                          callback('OK');
                      }
                      // continue, register user to EWS
                      else
                      {
                          callback(null);
                      }
                  } else {
                      if (ewsDetails['subscriptionID'] && ewsDetails['subscriptionID'] != -1 && ewsDetails['subscriptionDate'] &&  (((new Date()).getTime() - ewsDetails['subscriptionDate'].getTime()) < (KEEP_ALIVE_INTERVAL*3*60*1000)) && forceSubscription == false) {
                          logger.info('Profile ' + emailAddress + ' already registered to EWS, no need to re-register');
                          callback('OK');
                      } else {
                          callback(null);
                      }
                  }
              }
          });
      },

      function (callback) {
          // Just to be sure check again if we subscribe Exchange user
          if (ewsDetails['authType'] == '1' || ewsDetails['authType'] == 1) {

              // call internal method to register user to EWS
              subscribeProfileToEWSRequest(
                  emailAddress,
                  ewsDetails['userName'],   // the user name to authenticate with Exchange
                  mainDomain,
                  EXCHANGE_FOLDER,          //which folder to register in Exchange (Inbox)
                  EXCHANGE_FOLDER_EVENT,    // New mail event only
                  KEEP_ALIVE_INTERVAL,      // time interval that Exchange sends keep alive in minutes even if no mail is sent
                  managementURL + LISTENER_SUFFIX_URL, // which URL the Exchange is sending its notification to
                  ewsDetails['serverURL'],
                  EXCHANGE_SUFFIX_URL,
                  ewsDetails['impersonationUser'],  // the user name
                  ewsDetails['impersonationPassword'],
                  function (err, subscriptionIDResponse) {
                      if (err) {
                          callback(err);
                      } else {
                          subscriptionID = subscriptionIDResponse;
                          callback(null);
                      }
                  }
              );
          } else {
              callback(null);
          }
      },

      function (callback) {
          // update subscription ID for user (-1 if subscription failed).
          if (ewsDetails['authType'] == '1' || ewsDetails['authType'] == 1) {
              EWSUtils.updateSubscriptionForUser(emailAddress,subscriptionID, function(err) {
                  if (err) {
                      callback(err);
                  } else {
                      callback(null);
                  }
              });
          } else {
              callback(null);
          }
      }
      ],

      function (err) {
        if (err) {
            callbackFunc(err);
        } else {
            callbackFunc(null);
        }
      }
    );
}

/*
 * Method to perform the subscription of user to EWS
 */
function subscribeProfileToEWSRequest(emailAddress, userName, mainDomain, folderID, eventType, keepAliveInterval, listenerURL, exchangeHost, exchangeSuffixURL, impersonationUser, impersonationPassword, callback) {
    // get the registration XMl with user values
    EWSXMLs.getRegistrationXML(folderID,eventType,keepAliveInterval,listenerURL, function(xml) {
        var postRequest = null;
        var cred;
        if(Common.withService) {
            cred = {
                pfx: Common.nfshomefolder + mainDomain + '/' + emailAddress + '/certificate/cert.pfx',
                passphrase: '123456'
            };
        } else {
            cred = {
                user: impersonationUser,
                password: impersonationPassword
            };
            if (Common.EWSDomain) cred.domain = Common.EWSDomain;
        }
        var reqParams = {
            host: exchangeHost,
            path: exchangeSuffixURL,
            soTimeout: 10000
        };

        EWSUtils.doAuthorizedRequest(cred, reqParams, xml, function(err, buffer) {
            if(err) {
                callback(err,null);
            } else {
                var jsonObject;
                try {
                    // Change the XML to JSON
                    var jsonAsString = parser.toJson(buffer);
                    jsonObject = JSON.parse(jsonAsString);

                    // extract subscription ID
                    var subscriptionID = jsonObject['s:Envelope']
                                                ['s:Body']
                                                ['m:SubscribeResponse']
                                                ['m:ResponseMessages']
                                                ['m:SubscribeResponseMessage']
                                                ['m:SubscriptionId'];

                    // send back subscription ID
                    callback(null,subscriptionID);

                } catch (e) {
                    // try to parse the error and send it as callback
                    try {
                        var errorMessage = jsonObject['s:Envelope']['s:Body']['s:Fault']['faultstring']['$t'];
                        callback(errorMessage,null);
                    } catch (ex) {
                        // send general error if we couldn't find the error
                        callback('General error in EWS subscription for ' + emailAddress + ', Error buffer:\n' + buffer + '\n',null);
                    }
                }
            }
        });

    });
}

var EWSSubscription = {
    'subscribeProfileToEWS' : subscribeProfileToEWS
};

module.exports = EWSSubscription;
