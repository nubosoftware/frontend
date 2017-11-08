"use strict";

var Common = require("./common.js");
var constraints = require("nubo-validateConstraints")(Common.withService);

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
                "format": "^[0-9a-zA-Z]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 15
                }
            },
            "deviceName": constraints.ExcludeSpecialCharactersOptional,
            "alreadyUser": constraints.Y_N_boolConstrOptional,
            "first": constraints.ExcludeSpecialCharactersOptional,
            "last": constraints.ExcludeSpecialCharactersOptional,
            "title": constraints.openTextConstrOptional,
            "deviceType": {
                "inclusion": ["iPhone", "iPad", "Web", "Android"]
            },
            "silentActivation": {
                "inclusion": {
                    "within": [" ", "true", "false"]
                }
            },
            "signature": constraints.ExcludeSpecialCharactersRequested,
            "regid": {
                "presence": false,
                "format": "^[.a-zA-Z0-9_\\-()]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 255
                }
            },
            "playerVersion": constraints.playerVersionConstrOptional,
            "additionalDeviceInfo": constraints.ExcludeSpecialCharactersOptional,
            "hideNuboAppPackageName": constraints.ExcludeSpecialCharactersOptional
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
            "token": constraints.tokenConstrRequested,
            "cloneActivation": constraints.activationConstrOptional,
            "email": constraints.emailConstrOptional
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
            "hideNuboAppPackageName": constraints.ExcludeSpecialCharactersOptional
        }
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
        "path": "^/html/",
        "regex": true
    }, {
        "path": "/checkPasscode",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "passcode": constraints.passcodeConstrRequested
        }
    }, {
        "path": "/setPasscode",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr,
            "passcode": constraints.passcodeConstrRequested,
            "oldpasscode": constraints.passcodeConstrOptional
        }
    }, {
        "path": "/resetPasscode",
        "constraints": {
            "sessionid": constraints.sessionIdConstrOptional,
            "loginToken": constraints.requestedLoginTokenConstr
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
            "email": constraints.emailConstrRequested
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
                "format": "^[0-9a-zA-Z_\\-+=/]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 256
                }
            },
            "notifyTime": constraints.ExcludeSpecialCharactersOptional,
            "notifyTitle": constraints.openTextConstrOptional,
            "deviceType": {
                "presence": true,
                "inclusion": ["iPhone", "iPad", "Web", "Android"]
            },
            "pushRegID": {
                "presence": false,
                "format": "^[a-zA-Z0-9_\\-]+$",
                "length": {
                    "minimum": 1,
                    "maximum": 255
                }
            },
            "ip": constraints.ipConstrOptional,
            "port": constraints.portNumberConstrOptional,
            "userName": constraints.ExcludeSpecialCharactersOptional,
            "enableVibrate": {
                "inclusion": {
                    "within": ["0", "1"]
                }
            },
            "enableSound": {
                "inclusion": {
                    "within": ["0", "1"]
                }
            },
            "showFullNotif": {
                "inclusion": {
                    "within": ["0", "1"]
                }
            }
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
            "email": constraints.emailConstrRequested,
            "titleText": constraints.ExcludeSpecialCharactersRequested,
            "notifyTime": constraints.ExcludeSpecialCharactersOptional,
            "notifyLocation": constraints.ExcludeSpecialCharactersOptional,
            "appName": {
                "inclusion": {
                    "within": ["-1", "0", "1", "2"]
                }
            }
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
            "loginToken": constraints.requestedLoginTokenConstr
        }
    }, {
        "path": "/reregisterFidoAuth",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr
        }
    }, {
        "path": "/checkOtpAuth",
        "constraints": {
            "loginToken": constraints.requestedLoginTokenConstr,
            "OTPCode": {
                "format": "^[0-9]+$",
                "presence": true,
                "length": {
                    "is": 6
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
            "supportedConf": constraints.NaturalNumberConstrRequested
        }
    }]
};

module.exports = filter;