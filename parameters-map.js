"use strict";
var constraints = require("./validateConstraintsPredefine.js");
var Common = require("./common.js");

var userNameFormat;

if (Common.withService) {
    userNameFormat = {"presence": true,"format": "[a-zA-Z0-9.@_-]+","length": {"minimum": 1,"maximum": 255}};
} else {
    userNameFormat = {"email" : true,"presence" : true,"length": {"minimum": 1,"maximum": 255}};
} 


var filter = {
    "permittedMode": true,
    "rules": [{
        "path": "/favicon.ico"
    }, {
        "path": "/sendEmailForUnknownJobTitle",
	"constraints" : {
	    "jobTitle" : constraints.requestedExcludeSpecialCharacters
	}
    }, {
        "path": "/activate",
        "constraints": {
            "email": {
		"email" : true,
		"presence" : true
	    },
            "deviceid": {
                "presence": true,
                "format": "[a-zA-Z0-9_-.@]+",
                "length": {
                    "minimum": 1,
                    "maximum": 255
                }
            },
            "imsi": {
		"presence": true,
                "format": "[0-9]+",
                "length": {
                    "minimum": 1,
                    "maximum": 15
            	},
		"numericality" : {
                    "onlyInteger" : true
                }
	    },
            "deviceName": constraints.excludeSpecialCharacters,
            "alreadyUser": {
		"presence" : false,
                "inclusion" : ["Y", "N"]
	    },
            "first": constraints.excludeSpecialCharacters,
            "last": constraints.excludeSpecialCharacters,
            "title": constraints.excludeSpecialCharacters,
            "deviceType": {
		"presence" : false,
                "inclusion" : ["iphone", "Web", "Android"]
	    },
            "silentActivation": {
                "presence": "false",
                "inclusion": {
                    "within": ["true", "false"]
                }
            },
            "signature": {
		"presence": "false",
		"length": {
                    "minimum": 1,
                    "maximum": 255
            	}
	    },
            "regid": {
                "presence": false,
		"format": "[a-zA-Z0-9_-.]+",
		"length": {
                    "minimum": 1,
                    "maximum": 255
            	}
	    }
        }
    }, {
        "path": "/registerOrg",
        "constraints": {
            "secret": constraints.excludeSpecialCharacters,
            "first": constraints.excludeSpecialCharacters,
            "last": constraints.excludeSpecialCharacters,
            "email": {
                "presence": true,
		"email" : true
            },
            "domain": {
                "presence": true,
		"format": "[a-zA-Z0-9_-.]+"
            }
        }
    }, {
        "path": "/activationLink",
        "constraints": {
            "token": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
            "cloneActivation": {
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            }
        }
    }, {
        "path": "/validate",
        "constraints": {
            "username": userNameFormat,
            "deviceid": {
                "presence": true,
                "format": "[a-zA-Z0-9_-.@]+",
                "length": {
                    "minimum": 1,
                    "maximum": 255
                }
            },
            "activationKey": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
            "playerVersion": {
                "presence": true,
                "format": "^[0-9]+(\\.)[0-9]$",
                "length": {
                    "minimum": 3,
                    "maximum": 255
                }
            }
        }
    }, {
        "path": "/startsession",
        "constraints": {
            "loginToken": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
        }
    }, {
        "path": "^/html/.*",
        "regex": true
    }, {
        "path": "/checkPasscode",
        "constraints": {
            "loginToken": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
            "passcode": {
                "presence": true,
		"length": {
                    "minimum": 6,
                    "maximum": 25
                }

            }
        }
    }, {
        "path": "/setPasscode",
        "constraints": {
            "loginToken": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
            "passcode": {
                "presence": true,
		"length": {
                    "minimum": 6,
                    "maximum": 25
                }
            },
            "oldpasscode": {
                "presence": true,
		"length": {
                    "minimum": 6,
                    "maximum": 25
                }

	    }
        }
    }, {
        "path": "/resetPasscode",
        "constraints": {
            "loginToken": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            }
        }
    }, {
        "path": "/authenticateUser",
        "constraints": {
            "loginToken": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
            "user": userNameFormat,
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
            "activationKey": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            }
        }
    }, {
        "path": "/unlockPassword",
        "constraints": {
            "loginemailtoken": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
            "email": userNameFormat
        }
    }, {
        "path": "/file/uploadToSession",
        "constraints": {
            "session": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            }
        }
    }, {
        "path": '/SmsNotification/sendSmsNotificationFromRemoteServer',
        "constraints": {
            "toPhone": {
                "presence": true,
		"format": "[0-9-+]+",
		"length": {
                    "minimum": 9,
                    "maximum": 36
                }
            },
            "body": {
                "presence": true,
		"format": "[0-9a-zA_Z_.-]+",
		"length": {
                    "minimum": 1,
                    "maximum": 255
                }
            },
            "serverID": {
                "presence": true,
		"format": "[0-9a-zA_Z]+",
		"length": {
                    "minimum": 1,
                    "maximum": 64
                }
            },
            "serverAuthKey": {
                "presence": true,
		"format": "[0-9a-zA_Z_.-]+",
		"length": {
                    "minimum": 6,
                    "maximum": 25
                }

            }
        }
    }, {
        "path": '/Notifications/sendNotificationFromRemoteServer',
        "constraints": {
            "type": {
                "presence": true
            },
            "notifyLocation": constraints.excludeSpecialCharacters,
            "serverID": {
                "presence": true,
		"format": "[0-9a-zA_Z]+",
		"length": {
                    "minimum": 1,
                    "maximum": 64
                }
            },
            "serverAuthKey": {
                "presence": true,
		"format": "[0-9a-zA_Z_.-]+",
		"length": {
                    "minimum": 6,
                    "maximum": 25
                }
            },
            "notifyTime": constraints.excludeSpecialCharacters,
            "notifyTitle": constraints.excludeSpecialCharacters,
            "deviceType": {
                "presence" : true,
                "inclusion" : ["iphone", "Web", "Android"]
            },
            "pushRegID": {
                "presence": false,
		"format": "[a-zA-Z0-9_-.]+",
		"length": {
                    "minimum": 1,
                    "maximum": 255
            	}
            }
        }
    }, {
        "path": '/getResourceListByDevice',
        "constraints": {
            "deviceName": constraints.excludeSpecialCharacters,
            "resolution": constraints.excludeSpecialCharacters
        }
    }, {
        "path": '/captureDeviceDetails',
        "constraints": {
            "activationKey": {
                "presence": true,
                "length": {
                    is: 96
                },
                "format": "[a-f0-9]+"
            },
            "actionType": {
                "presence" : false,
                "inclusion": {
                    "within": ["get"]
                }
            }
        }
    }]
};

module.exports = filter;
