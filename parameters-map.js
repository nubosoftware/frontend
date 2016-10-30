"use strict";
var constraints = require("nubo-validateConstraints");
var Common = require("./common.js");

var userNameFormat;

if (Common.withService) {
    userNameFormat = {
        "presence" : true,
        "format" : "[a-zA-Z0-9\\.@_\\-]+",
        "length" : {
            "minimum" : 1,
            "maximum" : 255
        }
    };
} else {
    userNameFormat = {
        "email" : true,
        "presence" : true,
        "length" : {
            "minimum" : 1,
            "maximum" : 255
        }
    };
}

var filter = {
    "permittedMode" : true,
    "rules" : [{
        "path" : "/favicon.ico"
    }, {
        "path" : "/sendEmailForUnknownJobTitle",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "jobTitle" : constraints.requestedExcludeSpecialCharacters
        }
    }, {
        "path" : "/activate",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "email" : {
                "email" : true,
                "presence" : true
            },
            "deviceid" : {
                "presence" : true,
                "format" : "[a-zA-Z0-9_\\-\\.@]+",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 255
                }
            },
            "imsi" : {
                "format" : "^[^<>'\"/;`%!$&|]*$",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 15
                }
            },
            "deviceName" : constraints.excludeSpecialCharacters,
            "alreadyUser" : {
                "presence" : false,
                "inclusion" : ["Y", "N"]
            },
            "first" : constraints.excludeSpecialCharacters,
            "last" : constraints.excludeSpecialCharacters,
            "title" : constraints.excludeSpecialCharacters,
            "deviceType" : {
                "presence" : false,
                "inclusion" : ["iPhone", "iPad", "Web", "Android"]
            },
            "silentActivation" : {
                "inclusion" : {
                    "within" : [" ", "true", "false"]
                }
            },
            "signature" : constraints.excludeSpecialCharacters,
            "regid" : {
                "presence" : false,
                "format" : "[a-zA-Z0-9_\\-\\.]+",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 255
                }
            },
            "playerVersion" : {
                "presence" : false,
                "format" : "^[0-9]+[\\.0-9a-z\\-]+",
                "length" : {
                    "minimum" : 3,
                    "maximum" : 255
                }
            },
            "additionalDeviceInfo" : constraints.excludeSpecialCharacters
        }
    }, {
        "path" : "/registerOrg",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "secret" : constraints.excludeSpecialCharacters,
            "first" : constraints.excludeSpecialCharacters,
            "last" : constraints.excludeSpecialCharacters,
            "email" : {
                "presence" : true,
                "email" : true
            },
            "domain" : {
                "presence" : true,
                "format" : "[a-zA-Z0-9_\\-\\.]+"
            }
        }
    }, {
        "path" : "/activationLink",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "token" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
            "cloneActivation" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            }
        }
    }, {
        "path" : "/validate",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "username" : constraints.excludeSpecialCharacters,
            "deviceid" : {
                "presence" : true,
                "format" : "[a-zA-Z0-9_\\-\\.@]+",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 255
                }
            },
            "activationKey" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
            "playerVersion" : {
                "presence" : true,
                "format" : "[a-zA-Z0-9\.\-]+",
                "length" : {
                    "minimum" : 3,
                    "maximum" : 255
                }
            },
            "timeZone" : {
                "format" : "[a-zA-Z\\/\\_\\-\\.]+"
            }
        }
    }, {
        "path" : "/startsession",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "loginToken" : constraints.requestedLoginTokenConstr,
            "timeZone" : {
                "format" : "[a-zA-Z\\/\\_\\-\\.]+",
            }
        }
    }, {
        "path" : "^/html/.*",
        "regex" : true
    }, {
        "path" : "/checkPasscode",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "loginToken" : constraints.requestedLoginTokenConstr,
            "passcode" : {
                "presence" : true,
                "length" : {
                    "maximum" : 25
                }

            }
        }
    }, {
        "path" : "/setPasscode",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "loginToken" : constraints.requestedLoginTokenConstr,
            "passcode" : {
                "presence" : true,
                "length" : {
                    "minimum" : 6,
                    "maximum" : 25
                }
            },
            "oldpasscode" : {
                "length" : {
                    "minimum" : 6,
                    "maximum" : 25
                }

            }
        }
    }, {
        "path" : "/resetPasscode",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "loginToken" : constraints.requestedLoginTokenConstr
        }
    }, {
        "path" : "/authenticateUser",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "loginToken" : constraints.requestedLoginTokenConstr,
            "user" : constraints.excludeSpecialCharacters,
            "password" : {
                "presence" : true,
                "length" : {
                    "minimum" : 6,
                    "maximum" : 25
                }
            }
        }
    }, {
        "path" : "/resendUnlockPasswordLink",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "activationKey" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            }
        }
    }, {
        "path" : "/unlockPassword",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "loginemailtoken" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
            "email" : userNameFormat
        }
    }, {
        "path": "/file/uploadToSession",
        "constraints": {
            "sessionid" : constraints.requestedSessionIdConstr,
            "session": constraints.excludeSpecialCharacters
        }
    }, {
        "path" : "/file/uploadToLoginToken",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "loginToken" : constraints.requestedLoginTokenConstr,
            "existsOnSDcard" : {"presence" : false,"inclusion" : {"within" : ["external://", "internal://"]}},
            "dontChangeName" : {
                "format" : "^[a-z]+$",
                "inclusion" : {
                    "within" : ["true", "false"]
                }
            },
            "destPath" :  constraints.pathConstr,
            "isMedia" : constraints.excludeSpecialCharacters
        }
    }, {
        "path" : '/SmsNotification/sendSmsNotificationFromRemoteServer',
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "toPhone" : {
                "presence" : true,
                "format" : "[0-9-+]+",
                "length" : {
                    "minimum" : 9,
                    "maximum" : 36
                }
            },
            "body" : {
                "presence" : true,
                "format" : "[0-9a-zA-Z_\\.\\-]+",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 255
                }
            },
            "serverID" : {
                "presence" : true,
                "format" : "[0-9a-zA-Z]+",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 64
                }
            },
            "serverAuthKey" : {
                "presence" : true,
                "format" : "[0-9a-zA-Z_\\.\\-]+",
                "length" : {
                    "minimum" : 6,
                    "maximum" : 25
                }

            }
        }
    }, {
        "path" : '/Notifications/sendNotificationFromRemoteServer',
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "type" : {
                "presence" : true
            },
            "notifyLocation" : constraints.excludeSpecialCharacters,
            "serverID" : {
                "presence" : true,
                "format" : "[0-9a-zA-Z]+",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 64
                }
            },
            "serverAuthKey" : {
                "presence" : true,
                "format" : "[0-9a-zA-Z_\\.\\-+=/]+",
                "length" : {
                    "minimum" : 6,
                    "maximum" : 100
                }
            },
            "notifyTime" : constraints.excludeSpecialCharacters,
            "notifyTitle" : constraints.excludeSpecialCharacters,
            "deviceType" : {
                "presence" : true,
                "inclusion" : ["iPhone", "iPad", "Web", "Android"]
            },
            "pushRegID" : {
                "presence" : false,
                "format" : "[a-zA-Z0-9_\\-\\.]+",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 255
                }
            }
        }
    }, {
        "path" : '/getResourceListByDevice',
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "deviceName" : constraints.excludeSpecialCharacters,
            "resolution" : constraints.excludeSpecialCharacters
        }
    }, {
        "path" : '/getResource',
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "fileName" : constraints.pathConstr,
            "packageName" : {
                "presence" : false,
                "format" : {
                    "pattern" : "[a-zA-Z0-9_\\.\\-]+"
                },
                "length" : {
                    "minimum" : 1,
                    "maximum" : 128
                }
            }
        }
    }, {
        "path" : '/captureDeviceDetails',
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "session" : {
                "presence" : false,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9_\\-\\.]+"
            },
            "actionType" : {
                "presence" : false,
                "inclusion" : {
                    "within" : ["get"]
                }
            },
            "activationKey" : constraints.excludeSpecialCharacters
        }
    }, {
        "path" : '/download',
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "dtype" : {
                "presence" : false,
                "inclusion" : {
                    "within" : ["IOS1", "IOS2"]
                }
            }
        }
    }, {
        "path" : "/Notifications/pushNotification",
        "constraints" : {
            "sessionid" : constraints.requestedSessionIdConstr,
            "email": {"email" : true, "presence" : true},
            "titleText": constraints.requestedExcludeSpecialCharacters,
            "notifyTime": {},
            "notifyLocation": {},
            "appName" : {
                "inclusion" : {
                    "within" : ["-1", "0", "1", "2"]
                }
            }
        }
    }, {
        "path" : "/EWSListener",
        "constraints" : {}
    }, {
        "path" : "/getStreamsFile",
        "constraints" : {
            "loginToken" : constraints.requestedLoginTokenConstr,
            "streamName" : {"presence" : false, "format" : "[a-zA-Z0-9_\\.]+", "length" : {"minimum" : 1, "maximum" : 255}},
            "isLive" : {"presence" : false, "inclusion" : ["true", "false"]}
        }
    }, {
        "path" : "/checkStreamsFile",
        "constraints" : {
            "loginToken" : constraints.requestedLoginTokenConstr,
            "streamName" : {"presence" : false, "format" : "[a-zA-Z0-9_\\.]+", "length" : {"minimum" : 1, "maximum" : 255}
            }
        }
    }

    ]
};

module.exports = filter;
