var webClientList = {
    '/resources/demos/style.css': 1,
    '/favicon.ico': 1,
    '/html/player/login.html': 1,
    '/html/player/player.css': 1,
    '/html/player/css/toast.css': 1,
    '/html/player/jquery-1.12.2.min.js': 1,
    '/html/player/watermark.js': 1,
    '/html/player/underscore-min.js': 1,
    '/html/player/backbone-min.js': 1,
    '/html/player/l10n.js': 1,
    '/html/player/hmac-sha1.js': 1,
    '/html/player/utf8.js': 1,
    '/html/player/base.js': 1,
    '/html/player/long.js': 1,
    '/html/player/js/modernizr.webp.test.js': 1,
    '/html/player/js/canvas2image.js': 1,
    '/html/player/js/toast.js': 1,
    '/html/player/inflate.min.js': 1,
    '/html/player/jquery-ui.js': 1,
    '/html/player/common.js': 1,
    '/html/player/dropzone.js': 1,
    '/html/player/lang/en.json': 1,
    '/html/player/deps.js': 1,
    '/html/player/login.js': 1,
    '/html/player/wm.js': 1,
    '/html/player/zlibReader.js': 1,
    '/html/player/uxipReader.js': 1,
    '/html/player/uxipWriter.js': 1,
    '/html/player/uxip.js': 1,
    '/html/player/NuboOutputStreamMgr.js': 1,
    '/html/player/nubocache.js': 1,
    '/html/player/images/x.png': 1,
    '/html/player/fonts/Roboto-Regular.ttf': 1,
    '/html/player/fonts/Roboto-Light.ttf': 1,
    '/html/player/images/logo.png': 1,
    '/html/player/fonts/Roboto-Bold.ttf': 1,
    '/html/player/images/del.png': 1,
    '/html/player/images/volcano.png': 1,
    '/html/player/images/settings.png': 1,
    '/html/player/images/video_recording.png': 1,
    '/html/player/images/search.png': 1,
    '/html/player/images/back.png': 1,
    '/html/player/images/dragdrop.png': 1
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
        '/file/uploadToLoginToken': 1
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