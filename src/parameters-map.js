"use strict";

var Common = require("./common.js");
var validate = require('validate.js');
var constraints = require("@nubosoftware/nubo-validateconstraints")(validate);

var filter = {
    "rules": [{
        "path": "/favicon.ico"
    }, {
        //not needed anymore
        "path": "/sendEmailForUnknownJobTitle",
        "constraints": {
            "sessionid": constraints.requestedSessionIdConstr,
            "jobTitle": constraints.openTextConstrOptional
        }
    }, {
        "path": "/activate",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "email": constraints.userNameConstrRequested,
            "deviceid": constraints.deviceIdConstrRequested,
            "imsi": {
                "presence": false,
                "format": "^[0-9a-zA-Z]+$|^$",
                "length": {
                    "minimum": 0,
                    "maximum": 15
                }
            },
            "deviceName": constraints.ExcludeSpecialCharactersOptional,
            "alreadyUser": constraints.Y_N_boolConstrOptional,
            "first": constraints.ExcludeSpecialCharactersOptional,
            "last": constraints.ExcludeSpecialCharactersOptional,
            "title": constraints.openTextConstrOptional,
            "deviceType": {
                "inclusion": ["iPhone", "iPad", "Web", "Android","Desktop"]
            },
            "silentActivation": {
                "inclusion": {
                    "within": [" ", "true", "false"]
                }
            },
            "signature": constraints.ExcludeSpecialCharactersRequested,
            "regid": {
                "presence": false,
                "format": "^[.a-zA-Z0-9_\\-():]+$|^$",
                "length": {
                    "minimum": 0,
                    "maximum": 255
                }
            },
            "playerVersion": constraints.playerVersionConstrOptional,
            "additionalDeviceInfo": constraints.ExcludeSpecialCharactersOptional,
            "hideNuboAppPackageName": constraints.ExcludeSpecialCharactersOptional,
            "captcha": {},
            "phoneNumber": constraints.phoneNumberConstrOptional
        }
    }, {
        "path": "/registerOrg",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "secret": constraints.ExcludeSpecialCharactersOptional,
            "first": constraints.ExcludeSpecialCharactersOptional,
            "last": constraints.ExcludeSpecialCharactersOptional,
            "email": constraints.emailConstrRequested,
            "domain": constraints.adDomainNameConstrRequested
        }
    }, {
        "path": "/activationLink",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "token": {
                "presence": true,
                "format" : "^[a-f0-9]+$",
                "length" : {
                    "minimum": 5,
                    "maximum": 255
                }
            },
            "cloneActivation": constraints.activationConstrOptional,
            "email": constraints.emailConstrOptional,
            "smsActivation": constraints.boolConstrOptional
        }
    }, {
        "path": "/validate",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "username": constraints.ExcludeSpecialCharactersRequested,
            "deviceid": constraints.deviceIdConstrRequested,
            "activationKey": constraints.tokenConstrRequested,
            "playerVersion": constraints.playerVersionConstrRequested,
            "timeZone": constraints.timeZoneConstrOptional,
            "hideNuboAppPackageName": constraints.ExcludeSpecialCharactersOptional,
            "newProcess": constraints.boolConstrOptional,
            "sessionTimeout": constraints.IndexConstrOptional,
        },
        "bodyConstraints": {
            "customParams": {}
        },
    }, {
        "path": "/startsession",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "platid": constraints.platIdConstrOptional,
            "timeZone": constraints.timeZoneConstrOptional,
            "fastConnection": {
                "inclusion": {
                    "within": ["true"]
                }
            }
        }
    }, {
        "path": "^/html/|^/appstore/",
        "regex": true
    }, {
        "path": "/checkPasscode",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "passcode": constraints.passcodeConstrRequested
        }
    }, {
        "path": "/checkBiometric",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "token": constraints.passcodeConstrRequested
        }
    }, {
        "path": "/setPasscode",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "passcode": constraints.passcodeConstrRequested,
            "oldpasscode": constraints.passcodeConstrOptional,
            "passcode2": constraints.passcodeConstrOptional
        }
    }, {
        "path": "/resetPasscode",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.loginTokenConstrOptional,
            "activationKey":  constraints.tokenConstrOptional,
            "action": {
                "numericality": {
                    "onlyInteger": true,
                    "greaterThan": 0,
                    "lessThan": 20
                }
            },
        }
    }, {
        "path": "/authenticateUser",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "user": constraints.ExcludeSpecialCharactersRequested,
            "password": constraints.passcodeConstrRequested
        }
    }, {
        "path": "/resendUnlockPasswordLink",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "activationKey": constraints.tokenConstrRequested
        }
    }, {
        "path": "/unlockPassword",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginemailtoken": constraints.requestedLoginTokenConstr,
            "email": constraints.emailConstrRequested,
            "mainDomain": constraints.adDomainNameConstrRequested,
            "deviceID": constraints.deviceIdConstrRequested
        }
    }, {
        "path": "/file/uploadToSession",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "session": constraints.sessionIdConstrRequested,
            "isMedia": constraints.boolConstrOptional
        }
    }, {
        "path": "/file/uploadDummyFile",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr
        }
    }, {
        "path": "/file/uploadToLoginToken",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "existsOnSDcard": {
                "inclusion": {
                    "within": ["external://", "internal://"]
                }
            },
            "dontChangeName": {
                "inclusion": {
                    "within": ["true", "false"]
                }
            },
            "destPath": constraints.pathConstrOptional,
            "isMedia": constraints.boolConstrOptional
        }
    }, {
        "path": "/file/uploadFileToLoginToken",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "existsOnSDcard": {
                "inclusion": {
                    "within": ["external://", "internal://"]
                }
            },
            "dontChangeName": {
                "inclusion": {
                    "within": ["true", "false"]
                }
            },
            "destPath": constraints.pathConstrOptional,
            "isMedia": constraints.boolConstrOptional
        }
    }, {
        "path": '/SmsNotification/sendSmsNotificationFromRemoteServer',
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "toPhone": constraints.phoneNumberConstrRequested,
            "body": {
                "presence": true,
                "format": "^[.0-9a-zA-Z_\\- ]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 255
                }
            },
            "serverID": {
                "presence": true,
                "format": "^[.0-9a-zA-Z]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 64
                }
            },
            "serverAuthKey": {
                "presence": true,
                "format": "^[.0-9a-zA-Z_\\-]+$",
                "length": {
                    "minimum": 6
                }

            }
        }
    }, {
        "path": '/Notifications/sendNotificationFromRemoteServer',
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "type": {
                "presence": true
            },
            "notifyLocation": constraints.openTextConstrOptional,
            "serverID": {
                "presence": true,
                "format": "^[0-9a-zA-Z]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 64
                }
            },
            "serverAuthKey": {
                "presence": true,
                "format":  "^[0-9a-zA-Z_\\-+=/\$\@\!\&]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 256
                }
            },
            "notifyTime": constraints.ExcludeSpecialCharactersOptional,
            "notifyTitle": constraints.openTextConstrOptional,
            "deviceType": {
                "presence": true,
                "inclusion": ["iPhone", "iPad", "Web", "Android","Desktop"]
            },
            "pushRegID": {
                "presence": false,
                "format": "^[.a-zA-Z0-9_\\-():]+$|^$",
                "length": {
                    "minimum": 0,
                    "maximum": 255
                }
            },
            "ip": constraints.ipConstrOptional,
            "port": constraints.portNumberConstrOptional,
            "userName": constraints.ExcludeSpecialCharactersOptional,
            "enableVibrate": {
                "presence": false,
            },
            "enableSound": {
                "presence": false,
            },
            "showFullNotif": {
                "presence": false,
            },
            "packageID": {
                "presence": false,
                "format": "^[.a-zA-Z0-9_]+[a-zA-Z0-9_]([,][a-zA-Z0-9_:]+)?$|^$",
                "length": {
                    "minimum": 0,
                    "maximum": 255
                }
            }
            //"packageID": constraints.packageNameConstrOptional
        }
    }, {
        "path": '/getResourceListByDevice',
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "deviceName": constraints.ExcludeSpecialCharactersOptional,
            "resolution": constraints.ExcludeSpecialCharactersOptional
        }
    }, {
        "path": '/notificationPolling',
        "constraints": {
            "activationKey": constraints.tokenConstrRequested,
            "username": constraints.userNameConstrOptional,
            "timestamp": constraints.timeStampConstrOptional,
            "sessionid": constraints.sessionIdConstrOptional
        }
    }, {
        "path": '/getResource',
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "fileName": constraints.pathConstrRequested,
            "packageName": constraints.packageNameConstrRequested
        }
    }, {
        "path": '/captureDeviceDetails',
        "constraints": {
            "sessionid": constraints.sessionIdConstrRequested,
            "activationKey": constraints.activationConstrRequested
        }
    }, {
        "path": '/download',
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "dtype": {
                "inclusion": {
                    "within": ["IOS1", "IOS2"]
                }
            }
        }
    }, {
        "path": "/Notifications/pushNotification",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "email": constraints.emailConstrOptional,
            "titleText": constraints.ExcludeSpecialCharactersOptional,
            "notifyTime": constraints.ExcludeSpecialCharactersOptional,
            "notifyLocation": constraints.ExcludeSpecialCharactersOptional,
            "appName": constraints.ExcludeSpecialCharactersOptional,
            "authKey": constraints.ExcludeSpecialCharactersOptional,
            "contentId": constraints.ExcludeSpecialCharactersOptional,
        }
    }, {
        "path": "/EWSListener",
        "constraints": {}
    }, {
        "path": "/getStreamsFile",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "streamName": constraints.pathConstrRequested,
            "isLive": constraints.boolConstrRequested
        }
    }, {
        "path": "/checkStreamsFile",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "streamName": constraints.pathConstrRequested
        }
    }, {
        "path": "/resetPasscodeLink",
        "constraints": {
            "token": constraints.tokenConstrRequested,
            "email": constraints.emailConstrOptional
        }
    }, {
        "path": "/checkFidoAuth",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "requestType": {
                inclusion: {
                    within: ["onepassReq", "ssenstoneReq","ssenstoneResp","ssenstoneRegResponse"]
                }
            },
            "DEVICEHASH": {},
            "inputJSON": {}
        }
    }, {
        "path": "/reregisterFidoAuth",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "requestType": {
                inclusion: {
                    within: ["onepassReq", "ssenstoneReq","ssenstoneResp","ssenstoneRegResponse", "onepassAuth"]
                }
            },
            "DUID": {},
            "inputJSON": {}
        }
    }, {
        "path": "/getFidoFacets",
        "constraints": {
        }
    }, {
        "path": "/checkOtpAuth",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "OTPCode": {
                "format": "^[a-zA-Z0-9\=]*$",
                "presence": true,
                "length": {
                    "minimum": 1,
                    "maximum": 255
                }
            }
        }
    }, {
        "path": "/resendOtpCode",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr
        }
    }, {
        "path": "/getClientConf",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "supportedConf": constraints.NaturalNumberConstrRequested,
            "regid": {
                "presence": false,
                "format": "^[.a-zA-Z0-9_\\-():]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 255
                }
            }
        }
    }, {
        "path": "/recheckValidate",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
        }
    },
    {
        "path": "/logoutUser",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "deleteCacheDeviceData": constraints.Y_N_boolConstrOptional,
        }
    },
    {
        "path": "/declineCall",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
        }
    },
    {
        "path": "/receiveSMS",
        "constraints": {}
    },
    {
        "path": "/getAvailableNumbers",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "countryIso": constraints.ExcludeSpecialCharactersRequested
        }
    },
    {
        "path": "/subscribeToNumber",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "phoneNumber": constraints.ExcludeSpecialCharactersRequested
        }
    },
    {
        "path": "/closeOtherSessions",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
        }
    },
    {
        "path": "/getWebCommon",
        "constraints": {}
    },
    /*{
        "path": "/interfDeviceBiz/processRequest.do",
        "constraints": {
        },
        "headerConstraints": {
        },
        "bodyConstraints": {
        }
    },
    {
        "path": "/fido/deviceUaf/processUafRequest.do",
        "constraints": {
        },
        "headerConstraints": {
        },
        "bodyConstraints": {
        }
    },
    {
        "path": "/fido/deviceUaf/processUafResponse.do",
        "constraints": {
        },
        "headerConstraints": {
        },
        "bodyConstraints": {
        }
    },
    {
        "path": "/fido/deviceUaf/trustedFacets.do",
        "constraints": {
            "siteId": constraints.ExcludeSpecialCharactersOptional,
            "svcId": constraints.ExcludeSpecialCharactersOptional
        },
        "headerConstraints": {
        },
        "bodyConstraints": {
        }
    },*/
    {
        "regex": true,
        "path": "/api/.*",
        "constraints": {
        },
        "headerConstraints": {
        },
        "bodyConstraints": {

        }
    },
    {
        "regex": true,
        "path": "/client/.*",
        "constraints": {
        },
        "headerConstraints": {
        },
        "bodyConstraints": {

        }
    },
    {
        "regex": true,
        "path": "/plugins/.*",
        "constraints": {
        },
        "headerConstraints": {
        },
        "bodyConstraints": {

        }
    },
    {
        "regex": true,
        "path": "/html/.*",
        "constraints": {
        },
        "headerConstraints": {
        },
        "bodyConstraints": {

        }
    },



    ]
};

module.exports = filter;