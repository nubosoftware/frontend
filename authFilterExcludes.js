"use strict"

var Common = require("./common.js");

function excludeList() {

    var production = (Common.webCommon && Common.webCommon.production !== undefined) ? Common.webCommon.production : "true";

    var webClientList = {
        '/resources/demos/style.css' : 1,
        '/favicon.ico' : 1,
        '/html/player/login.html' : 1,
        '/html/player/player.css' : 1,
        '/html/player/css/toast.css' : 1,
        '/html/player/jquery-1.12.2.min.js' : 1,
        '/html/player/watermark.js' : 1,
        '/html/player/underscore-min.js' : 1,
        '/html/player/backbone-min.js' : 1,
        '/html/player/l10n.js' : 1,
        '/html/player/hmac-sha1.js' : 1,
        '/html/player/utf8.js' : 1,
        '/html/player/base.js' : 1,
        '/html/player/long.js' : 1,
        '/html/player/js/modernizr.webp.test.js' : 1,
        '/html/player/js/canvas2image.js' : 1,
        '/html/player/js/toast.js' : 1,
        '/html/player/inflate.min.js' : 1,
        '/html/player/jquery-ui.js' : 1,
        '/html/player/common.js' : 1,
        '/html/player/dropzone.js' : 1,
        '/html/player/lang/en.json' : 1,
        '/html/player/deps.js' : 1,
        '/html/player/images/x.png' : 1,
        '/html/player/images/clock.png' : 1,
        '/html/player/fonts/Roboto-Regular.ttf' : 1,
        '/html/player/fonts/Roboto-Light.ttf' : 1,
        '/html/player/images/logo.png' : 1,
        '/html/player/fonts/Roboto-Bold.ttf' : 1,
        '/html/player/fonts/FreebooterScript-Regular.ttf' : 1,
        '/html/player/images/connerr.png': 1,
        '/html/player/images/del.png' : 1,
        '/html/player/images/volcano.png' : 1,
        '/html/player/images/umbrella_ic.png' : 1,
        '/html/player/images/settings.png' : 1,
        '/html/player/images/video_recording.png' : 1,
        '/html/player/images/search.png' : 1,
        '/html/player/images/back.png' : 1,
        '/html/player/images/dragdrop.png' : 1,
        '/html/player/images/medal.png' : 1,
        '/html/player/images/welcome.png' : 1,
        '/html/player/images/nuboDefWallpaper.jpg' : 1,
        '/html/player/images/folder.png' : 1,
        '/html/player/images/Welcome_Word.png' : 1,
        '/download' : 1,
        '/html/ios/NuboClientIOS.plist' : 1,
        '/html/ios/NuboS.png' : 1,
        '/html/ios/NuboClientIOS.ipa': 1,
        '/html/ios/NuboL.png' : 1
    };

    if (production) {
        webClientList['/html/player/out.js'] = 1;
    } else {
        webClientList['/html/player/login.js'] = 1;
        webClientList['/html/player/wm.js'] = 1;
        webClientList['/html/player/zlibReader.js'] = 1;
        webClientList['/html/player/uxipReader.js'] = 1;
        webClientList['/html/player/uxipWriter.js'] = 1;
        webClientList['/html/player/uxip.js'] = 1;
        webClientList['/html/player/NuboOutputStreamMgr.js'] = 1;
        webClientList['/html/player/nubocache.js'] = 1;
    }

    var noFilterList = {
        '/activate' : 1,
        '/validate' : 1,
        '/registerOrg' : 1,
        '/getResourceListByDevice' : 1,
        '/sendEmailForUnknownJobTitle' : 1,
        '/captureDeviceDetails' : 1,
        '/resendUnlockPasswordLink' : 1,
        '/activationLink' : 1,
        '/unlockPassword' : 1,
        '/download' : 1,
        '/SmsNotification/sendSmsNotificationFromRemoteServer' : 1,
        '/Notifications/sendNotificationFromRemoteServer' : 1,
        '/getResource' : 1,
        '/EWSListener' : 1,
        '//EWSListener' : 1,
        '/startsession' : 1,
        '/checkPasscode' : 1
    }

    var excludeList = {
        'SESSID' : {
            '/authenticateUser' : 1,
            '/setPasscode' : 1,
            '/resetPasscode' : 1,
            '/file/uploadToLoginToken' : 1
        },
        'LOGINTOKEN' : {
            '/createStream' : 1,
            '/playPauseStream' : 1,
            '/file/uploadToSession' : 1,
            '/Notifications/pushNotification' : 1

        }
    }

    for (var key in noFilterList) {
        excludeList['LOGINTOKEN'][key] = noFilterList[key];
        excludeList['SESSID'][key] = noFilterList[key];
    }

    for (var key in webClientList) {
        excludeList['LOGINTOKEN'][key] = webClientList[key];
        excludeList['SESSID'][key] = webClientList[key];
    }

    return excludeList;
}

module.exports = {
    excludeList : excludeList
}
