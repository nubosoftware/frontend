var webClientList = {
    '/resources/demos/style.css': 1,
    '/favicon.ico': 1
}

var noFilterList = {
    '/validate': 1,
    '/activationLink': 1,
    '/activate': 1,
    '/resendUnlockPasswordLink': 1
}

var settingsList = {
    '/settings/changePasscode': 1,
    '/settings/checkPasscode': 1,
    '/settings/setLanguage': 1,
    '/settings/setAccount': 1,
    '/settings/getSessionDetails': 1,
    '/settings/changeExpiredPassword': 1,
    '/settings/setNotificationStatusForApp': 1,
    '/settings/getNotificationsStatusForAllApps': 1
}

var excludeList = {
    'SESSID': {
        '/checkPasscode': 1,
        '/startsession': 1,
        '/file/uploadToLoginToken' : 1
    },
    'ISADMIN': {
        '/cp/getSecurityPasscode': 1
    },
    'LOGINTOKEN': {
        '/startsession': 1,
        '/file/uploadToSession': 1
    }

}

for (var key in settingsList) {
    excludeList['ISADMIN'][key] = settingsList[key];
}

for (var key in noFilterList) {
    excludeList['LOGINTOKEN'][key] = noFilterList[key];
}

for (var key in webClientList) {
    excludeList['LOGINTOKEN'][key] = webClientList[key];
}


module.exports = excludeList;