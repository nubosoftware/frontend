"use strict";
var constraints = require("nubo-validateConstraints");
var Common = require("./common.js");

var userNameFormat;

if (Common.withService) {
    userNameFormat = {
        "presence": true,
        "format": "^[a-zA-Z0-9.@_-]+$",
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
                "token": constraints.requestedTokenConstr,
                "cloneActivation": constraints.requestedTokenConstr
            }
        }, {
            "path": "/validate",
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "username": constraints.ExcludeSpecialCharactersOptional,
                "deviceid": constraints.deviceIdConstrRequested,
                "activationKey": constraints.requestedTokenConstr,
                "playerVersion": {
                    "presence": true,
                    "format": "^[.a-zA-Z0-9-]+$",
                    "length": {
                        "minimum": 3,
                        "maximum": 255
                    }
                },
                "timeZone": {
                    "format": "^[a-zA-Z\/_-]+$",
                    "length": {
                        "minimum": 3,
                        "maximum": 255
                    }
                }
            }
        }, {
            "path": "/startsession",
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "loginToken": constraints.requestedLoginTokenConstr,
                "platid": constraints.platIdConstrOptional,
                "timeZone": {
                    "format": "^[a-zA-Z\/_-]+$",
                },
                "fastConnection": {
                    "inclusion": {
                        "within": ["true"]
                    }
                }
            }
        }, {
            "path": "^/html/.*",
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
                "user": constraints.ExcludeSpecialCharactersOptional,
                "password": {
                    "presence": true,
                    "length": {
                        "minimum": 6,
                        "maximum": 25
                    }
                }
            }
        }, {
            "path": "/resendUnlockPasswordLink",
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "activationKey": {
                    "presence": true,
                    "length": {
                        is: 96
                    },
                    "format": "^[a-f0-9]+$"
                }
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
            "path": "/file/uploadToLoginToken",
            "constraints": {
                "sessionid": constraints.sessionIdConstrRequested,
                "loginToken": constraints.requestedLoginTokenConstr,
                "existsOnSDcard": {
                    "presence": false,
                    "inclusion": {
                        "within": ["external://", "internal://"]
                    }
                },
                "dontChangeName": {
                    "inclusion": {
                        "within": ["true", "false"]
                    }
                },
                "destPath": constraints.pathConstrRequested,
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
                    "format": "^[.0-9a-zA-Z_-]+$",
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
                    "format": "^[.0-9a-zA-Z_-]+$",
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
                    "format": "^[0-9a-zA-Z_-+=/]+$",
                    "length": {
                        "minimum": 6,
                        "maximum": 100
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
                    "format": "^[a-zA-Z0-9_-]+$",
                    "length": {
                        "minimum": 1,
                        "maximum": 255
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
                "actionType": {
                    "inclusion": {
                        "within": ["get"]
                    }
                },
                "activationKey": constraints.requestedTokenConstr
            }
        }, {
            "path": '/download',
            "constraints": {
                "sessionid": constraints.sessionIdConstrOptional,
                "dtype": {
                    "presence": false,
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
                    "presence": false,
                    "format": "^[.a-zA-Z0-9_]+$",
                    "length": {
                        "minimum": 1,
                        "maximum": 255
                    }
                },
                "isLive": {
                    "presence": false,
                    "inclusion": ["true", "false"]
                }
            }
        }, {
            "path": "/checkStreamsFile",
            "constraints": {
                "loginToken": constraints.requestedLoginTokenConstr,
                "streamName": {
                    "presence": false,
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