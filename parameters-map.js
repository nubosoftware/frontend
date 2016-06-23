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
            "jobTitle" : constraints.requestedExcludeSpecialCharacters
        }
    }, {
        "path" : "/activate",
        "constraints" : {
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
            "signature" : {
                "presence" : "false",
                "length" : {
                    "minimum" : 1,
                    "maximum" : 255
                }
            },
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
            "token" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
            "cloneActivation" : {}
        }
    }, {
        "path" : "/validate",
        "constraints" : {
            "username" : userNameFormat,
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
            }
        }
    }, {
        "path" : "/startsession",
        "constraints" : {
            "loginToken" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
            "timeZone" : {
                "presence" : true,
                "format" : "[a-zA-Z\\/\\_\\-\\.]+",
            }
        }
    }, {
        "path" : "^/html/.*",
        "regex" : true
    }, {
        "path" : "/checkPasscode",
        "constraints" : {
            "loginToken" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
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
            "loginToken" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
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
            "loginToken" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            }
        }
    }, {
        "path" : "/authenticateUser",
        "constraints" : {
            "loginToken" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
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
            "session": constraints.requestedSessionIdConstr
        }
    }, {
        "path" : "/file/uploadToLoginToken",
        "constraints" : {
            "loginToken" : constraints.requestedLoginTokenConstr,
            "dontChangeName" : {
                "format" : "^[a-z]+$",
                "inclusion" : {
                    "within" : ["true", "false"]
                }
            },
            "destPath" :  constraints.pathConstr
        }
    }, {
        "path" : '/SmsNotification/sendSmsNotificationFromRemoteServer',
        "constraints" : {
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
                "format" : "[0-9a-zA-Z_\\.\\-]+",
                "length" : {
                    "minimum" : 6,
                    "maximum" : 25
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
            "deviceName" : constraints.excludeSpecialCharacters,
            "resolution" : constraints.excludeSpecialCharacters
        }
    }, {
        "path" : '/getResource',
        "constraints" : {
            "fileName" : constraints.pathConstr,
            "packageName" : {
                "presence" : true,
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
            "activationKey" : {
                "presence" : true,
                "length" : {
                    is : 96
                },
                "format" : "[a-f0-9]+"
            },
            "actionType" : {
                "presence" : false,
                "inclusion" : {
                    "within" : ["get"]
                }
            }
        }
    }, {
        "path" : '/download',
        "constraints" : {
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
    }
    ]
};

module.exports = filter;
