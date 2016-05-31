var filter = {
  "permittedMode": true,
  "rules" : [
    {
      "path": "/favicon.ico"
    },
    {
        "path": "/activate",
        "constraints": {
            "email": {},
            "deviceid": {
              "length": {
                "minimum": 5
              }
            },
            "imsi": {},
            "deviceName": {},
            "alreadyUser": {},
            "first": {},
            "last": {},
            "title": {},
            "deviceType": {},
            "silentActivation": {},
            "signature": {},
            "regid": {}
        }
    },
    {
        "path": "/registerOrg",
        "constraints": {
        }
    },
    {
        "path": "/activationLink",
        "constraints": {
        }
    },
    {
      "path": "/validate",
      "constraints": {
        "username": {
          "presence": true
        },
        "deviceid": {
          "presence": true
        },
        "activationKey": {
          "presence": true,
          "length": {
            "minimum": 5
          }
        },
        "playerVersion": {
          "presence": true
        }
      }
    },
    {
      "path": "/startsession",
      "constraints": {
        "loginToken": {},
        "timeZone": {},
        "platid": {}
      }
    },
    {
      "path": "^/html/.*",
      "regex": true
    }
  ]
};

module.exports = filter;

