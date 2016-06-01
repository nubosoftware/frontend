var filter = {
    "permittedMode": true,
    "rules": [{
        "path": "/favicon.ico"
    }, {
        "path": "/sendEmailForUnknownJobTitle"
    }, {
        "path": "/activate",
        "constraints": {
            "email": {},
            "deviceid": {
                "presence": true,
                "format": "[a-zA-Z0-9\\_\\@\\-\\.]+",
                "length": {
                    "minimum": 3,
                    "maximum": 255
                }
            },
            "imsi": {},
            "deviceName": {},
            "alreadyUser": {},
            "first": {},
            "last": {},
            "title": {},
            "deviceType": {},
            "silentActivation": {
                "format": "^[a-z]+$",
                "inclusion": {
                    "within": ["true", "false"]
                }
            },
            "signature": {},
            "regid": {}
        }
    }, {
        "path": "/registerOrg",
        "constraints": {
            "secret": {
                "presence": true
            },
            "first": {
                "presence": true
            },
            "last": {
                "presence": true
            },
            "email": {
                "presence": true
            },
            "domain": {
                "presence": true
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
            "username": {
                "length": {
                    "minimum": 3,
                    "maximum": 255
                }
            },
            "deviceid": {
                "presence": true,
                "format": "[a-zA-Z0-9\\_\\@\\-\\.]+",
                "length": {
                    "minimum": 3,
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
            "timeZone": {}
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
                "presence": true
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
                "presence": true
            },
            "oldpasscode": {}
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
            "user": {
                "length": {
                    "minimum": 3,
                    "maximum": 255
                }
            },
            "password": {
                "presence": true
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
            "email": {}
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
                "presence": true
            },
            "body": {
                "presence": true
            },
            "serverID": {
                "presence": true
            },
            "serverAuthKey": {
                "presence": true
            }
        }
    }, {
        "path": '/Notifications/sendNotificationFromRemoteServer',
        "constraints": {
            "type": {
                "presence": true
            },
            "notifyLocation": {
                "presence": true
            },
            "serverID": {
                "presence": true
            },
            "serverAuthKey": {
                "presence": true
            },
            "notifyTime": {
                "presence": true
            },
            "notifyTitle": {
                "presence": true
            },
            "deviceType": {
                "presence": true
            },
            "pushRegID": {
                "presence": true
            }
        }
    }, {
        "path": '/getResourceListByDevice',
        "constraints": {
            "deviceName": {
                "presence": true
            },
            "resolution": {
                "presence": true
            }
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
                "format": "^[a-z]+",
                "inclusion": {
                    "within": ["get"]
                }
            }
        }
    }]
};

module.exports = filter;