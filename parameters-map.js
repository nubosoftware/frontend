"use strict";
var constraints = require("nubo-validateConstraints");
var Common = require("./common.js");

var userNameFormat;

if (Common.withService) {
    userNameFormat = {
        "presence": true,
        "format": "^[a-zA-Z0-9.@_\\-]+$",
        "length": {
            "minimum": 1,
            "maximum": 255
        }
    };
} else {
    userNameFormat = constraints.emailConstrRequested
}

var filter = {
    "permittedMode": true,
    "rules": [{
            "path": "/favicon.ico"
        }, {
            //not needed anymore
            "path": "/sendEmailForUnknownJobTitle",
            "constraints": {
                "sessionid": constraints.requestedSessionIdConstr,
                "jobTitle": constraints.ExcludeSpecialCharactersRequested
            }
        }, {
            "path": "/activate",
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "email": constraints.emailConstrRequested,
                "deviceid": constraints.deviceIdConstrRequested,
                "imsi": {
                    "format": "^[0-9a-zA-Z]+$",
                    "length": {
                        "minimum": 1,
                        "maximum": 15
                    }
                },
                "deviceName": constraints.ExcludeSpecialCharactersOptional,
                "alreadyUser": {
                    "presence": false,
                    "inclusion": ["Y", "N"]
                },
                "first": constraints.ExcludeSpecialCharactersOptional,
                "last": constraints.ExcludeSpecialCharactersOptional,
                "title": constraints.ExcludeSpecialCharactersOptional,
                "deviceType": {
                    "presence": false,
                    "inclusion": ["iPhone", "iPad", "Web", "Android"]
                },
                "silentActivation": {
                    "inclusion": {
                        "within": [" ", "true", "false"]
                    }
                },
                "signature": constraints.ExcludeSpecialCharactersOptional,
                "regid": {
                    "presence": false,
                    "format": "^[.a-zA-Z0-9_-]+$",
                    "length": {
                        "minimum": 1,
                        "maximum": 255
                    }
                },
                "playerVersion": {
                    "presence": false,
                    "format": "^[0-9]+[.0-9a-z-]+$",
                    "length": {
                        "minimum": 3,
                        "maximum": 255
                    }
                },
                "additionalDeviceInfo": constraints.ExcludeSpecialCharactersOptional
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
                "cloneActivation": {
                    "presence": true,
                    "format": "^[a-z0-9]+$",
                    "length": {
                        "maximum": 96
                    }
                }
            }
        }, {
            "path": "/validate",
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "username": constraints.ExcludeSpecialCharactersOptional,
                "deviceid": constraints.deviceIdConstrRequested,
                "activationKey": constraints.tokenConstrRequested,
                "playerVersion": constraints.playerVersionConstrRequested,
                "timeZone": constraints.timeZoneConstrOptional
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
                "email": userNameFormat
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
            "path": '/SmsNotification/sendSmsNotificationFromRemoteServer',
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "toPhone": {
                    "presence": true,
                    "format": "^[0-9-+]+$",
                    "length": {
                        "minimum": 9,
                        "maximum": 36
                    }
                },
                "body": {
                    "presence": true,
                    "format": "^[.0-9a-zA-Z_\\-]+$",
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
                        "minimum": 6,
                        "maximum": 25
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
                "notifyLocation": constraints.ExcludeSpecialCharactersOptional,
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
                "notifyTitle": constraints.ExcludeSpecialCharactersOptional,
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
                "enableSound" : {
                    "inclusion": {
                        "within": ["0", "1"]
                    }
                },
                "showFullNotif" : {
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
            "path": '/getResource',
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "fileName": constraints.pathConstrRequested,
                "packageName": constraints.packageNameConstrRequested
            }
        }, {
            "path": '/captureDeviceDetails',
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "session": constraints.sessionIdConstrRequested,
                "activationKey": constraints.tokenConstrRequested
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
                "streamName": {
                    "format": "^[.a-zA-Z0-9_]+$",
                    "length": {
                        "minimum": 1,
                        "maximum": 255
                    }
                },
                "isLive": {
                    "inclusion": ["true", "false"]
                }
            }
        }, {
            "path": "/checkStreamsFile",
            "constraints": {
                "loginToken": constraints.requestedLoginTokenConstr,
                "streamName": {
                    "format": "^[.a-zA-Z0-9_]+$",
                    "length": {
                        "minimum": 1,
                        "maximum": 255
                    }
                }
            }
        }

    ]
};

module.exports = filter;
