"use strict";

var Common = require('./common.js');
var async = require('async');
var logger = Common.logger;

/*
 * replace the parameter {X} with given value through all text
 */
if (!String.format) {
    String.format = function(format) {
      var args = Array.prototype.slice.call(arguments, 1);
      return format.replace(/{(\d+)}/g, function(match, number) {
        return typeof args[number] != 'undefined'
          ? args[number]
          : match
        ;
      });
    };
}

/*
 * build XML to subscribe user to EWS (Exchange Web Services)
 */
function getRegistrationXML(folderID,eventType,keepAliveInterval,listenerURL,callback) {
    // body of XML sent to exchange
    var xml = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:mes="http://schemas.microsoft.com/exchange/services/2006/messages">' +
               '<soapenv:Header>' +
               '</soapenv:Header>' +
               '<soapenv:Body>' +
                   '<mes:Subscribe>' +
                       '<mes:PushSubscriptionRequest>' +
                           '<typ:FolderIds>' +
                               '<typ:DistinguishedFolderId Id="{0}"></typ:DistinguishedFolderId>' +
                           '</typ:FolderIds>'   +
                           '<typ:EventTypes>' +
                               '<typ:EventType>{1}</typ:EventType>' +
                           '</typ:EventTypes>' +
                           '<typ:StatusFrequency>{2}</typ:StatusFrequency>' +
                           '<typ:URL>{3}</typ:URL>' +
                       '</mes:PushSubscriptionRequest>' +
                   '</mes:Subscribe>' +
               '</soapenv:Body>' +
               '</soapenv:Envelope>';

    xml = String.format(xml,folderID,eventType,keepAliveInterval,listenerURL);
    callback(xml);
}

/*
 * Build XML that is returned to Exchange in each Exchange notification.
 */
function getNotificationResultXML(subscriptionStatus,callback) {
    var xml = '<?xml version="1.0" encoding="utf-8"?>' +
                                      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
                                          '<s:Body>' +
                                              '<SendNotificationResult xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">' +
                                                  '<SubscriptionStatus>{0}</SubscriptionStatus>' +
                                              '</SendNotificationResult>' +
                                          '</s:Body>' +
                                      '</s:Envelope>';
    xml = String.format(xml,subscriptionStatus);
    callback(xml);
}

/*
 * Build XML that is used to fetch item (mail) details
 */
function getItemXML(itemID,changeKey,callback) {
    // body of XML sent to exchange
    var xml =
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:mes="http://schemas.microsoft.com/exchange/services/2006/messages">' +
        '<soapenv:Header>' +
        '</soapenv:Header>' +
        '<soapenv:Body>' +
        '<mes:GetItem>' +
            '<mes:ItemShape>' +
                '<typ:BaseShape>IdOnly</typ:BaseShape>' +
                '<typ:AdditionalProperties>' +
                    '<typ:FieldURI FieldURI="item:Subject" />' +
                    '<typ:FieldURI FieldURI="message:From" />' +
                '</typ:AdditionalProperties>' +
            '</mes:ItemShape>' +
          '<mes:ItemIds>' +
            '<typ:ItemId Id="{0}" ChangeKey="{1}" />' +
          '</mes:ItemIds>' +
        '</mes:GetItem>' +
        '</soapenv:Body>' +
        '</soapenv:Envelope>';

    xml = String.format(xml,itemID,changeKey);
    callback(xml);
}

/*
 * Build XML that is used to get Calendar Folder details for user
 */
function getCalendarSyncXML(startDate,endDate,folderId,callback) {
    var xml = 
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:mes="http://schemas.microsoft.com/exchange/services/2006/messages">' +
            '<soapenv:Header>' +
             '</soapenv:Header>' +
            '<soapenv:Body>' +
                '<mes:FindItem Traversal="Shallow">' + 
                   '<mes:ItemShape>' +
                      '<typ:BaseShape>IdOnly</typ:BaseShape>' + 
                      '<typ:AdditionalProperties>' +
                          '<typ:FieldURI FieldURI="item:Subject" />' +
                          '<typ:FieldURI FieldURI="calendar:Start" />' +
                          '<typ:FieldURI FieldURI="calendar:End" />' +
                          '<typ:FieldURI FieldURI="item:ReminderMinutesBeforeStart" />' +
                          '<typ:FieldURI FieldURI="calendar:Location" />' +
                      '</typ:AdditionalProperties>' +
                   '</mes:ItemShape>' +
                   '<mes:CalendarView MaxEntriesReturned="1000" StartDate="{0}" EndDate="{1}" />' +
                  '<mes:ParentFolderIds>' +
                      '<typ:DistinguishedFolderId Id="{2}">' + '</typ:DistinguishedFolderId>' +
                   '</mes:ParentFolderIds>' +
            '</mes:FindItem>' +
         '</soapenv:Body>' +
    '</soapenv:Envelope>';
    
    xml = String.format(xml,startDate,endDate,folderId);
    callback(xml);
}


var EWSXMLs = {
    'getRegistrationXML'        : getRegistrationXML,
    'getNotificationResultXML'  : getNotificationResultXML,
    'getItemXML'                : getItemXML,
    'getCalendarSyncXML'        : getCalendarSyncXML
};

module.exports = EWSXMLs;