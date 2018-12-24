function PlayerCmd() {}

PlayerCmd.sync = -1;
PlayerCmd.touchEvent = 1;
PlayerCmd.keyEvent = 2;
PlayerCmd.playerLogin = 3;
PlayerCmd.playerDisconnected = 4;
PlayerCmd.switchUser = 5;
PlayerCmd.setKeyboardHeight = 6;
PlayerCmd.platformProcessConnected = 7;
PlayerCmd.setKeyboardState = 8;
PlayerCmd.orientationChange = 9;
PlayerCmd.clearProcessCache = 14;
PlayerCmd.roundTripData = 17;
PlayerCmd.recentApps = 18;
//igor commands
PlayerCmd.homeKeyEvent = 20;
PlayerCmd.notificationCancel = 21;
PlayerCmd.searchKeyEvent = 22;
PlayerCmd.notificationOpen = 23;
PlayerCmd.requestState = 24;

// Video commands
PlayerCmd.VideoErrorEvent = 25;
PlayerCmd.VideoCompleteEvent = 26;
PlayerCmd.VideoBufferEvent = 27;
PlayerCmd.VideoInfoEvent = 28;
PlayerCmd.VideoSeekEvent = 29;
PlayerCmd.VideoProgress = 30;
PlayerCmd.OnVideoSizeChanged = 31;
PlayerCmd.VideoDuration = 37;

// Keyboard commands
PlayerCmd.TxtCompose = 50;
PlayerCmd.TxtCommit = 51;
PlayerCmd.TxtDeleteText = 52;
PlayerCmd.TxtSetRegion = 53;
PlayerCmd.TxtFinishComposing = 54;
PlayerCmd.TxtSetSelection = 55;
PlayerCmd.TxtKeyEvent = 56;
PlayerCmd.TxtEditorAction = 57;

PlayerCmd.gl_Return = 90;
PlayerCmd.gl_Feedback = 91;

function DrawCmd() {}

DrawCmd.glRenderCmd = 128;
DrawCmd.glAttachToWindow = 129;
DrawCmd.audioCmd = 130;
DrawCmd.setDirtyRect = 1;
DrawCmd.drawColor1 = 2;
DrawCmd.saveLayer = 3;
DrawCmd.restoreLayer = 4;
DrawCmd.drawText = 5;
DrawCmd.drawText1 = 6;
DrawCmd.drawRect = 7;
DrawCmd.drawBitmap = 8;
DrawCmd.saveLayerAlpha = 9;
DrawCmd.drawColor2 = 10;
DrawCmd.drawLine = 11;
DrawCmd.drawLines = 12;
DrawCmd.drawRect1 = 13;
DrawCmd.drawRoundRect = 14;
DrawCmd.drawBitmap1 = 15;
DrawCmd.setDensity = 16;
DrawCmd.drawTextRun = 17;
DrawCmd.ninePatchDraw = 18;
DrawCmd.drawBitmap6 = 19;
DrawCmd.drawPosText1 = 20;
DrawCmd.drawPosText2 = 21;
DrawCmd.drawBitmap8 = 22;
DrawCmd.drawPlayerLoginAck = 23;
DrawCmd.oldToast = 24;
DrawCmd.drawBitmapMatrix = 25;
DrawCmd.drawPath = 26;

DrawCmd.drawPoints = 27;
DrawCmd.countLocationUpdates = 28;
DrawCmd.setPackageName = 29;
DrawCmd.drawOval = 30;
DrawCmd.drawArc = 31;
DrawCmd.drawCircle = 32;
DrawCmd.drawPath2 = 33;

DrawCmd.MediaObject_stop = 71;
DrawCmd.Video_createNewSurfaceView = 72;
DrawCmd.MediaObject_release = 73;
DrawCmd.MediaObject_reset = 74;
DrawCmd.Video_pauseVideo = 75;
DrawCmd.Video_seekTo = 76;
DrawCmd.UpdateCursor = 77;
DrawCmd.MediaObject_play = 78;
DrawCmd.MediaObject_newObject = 79;
DrawCmd.MediaObject_prepare = 80;
DrawCmd.Video_attachToSurface = 81;
DrawCmd.Video_setVolume = 82;

DrawCmd.toast = 83;
DrawCmd.nuboTestSocketAck = 84;
DrawCmd.authenticateNuboApp = 85;
DrawCmd.closeClientApp = 89;


//immediate draw commands
DrawCmd.IMMEDIATE_COMMAND = 100;
//dummy command
DrawCmd.writeTransaction = 101;
DrawCmd.pushWindow = 102;
DrawCmd.popWindow = 103;
DrawCmd.showWindow = 104;
DrawCmd.hideWindow = 105;
DrawCmd.drawWebView = 106;
DrawCmd.showSoftKeyboard = 107;
DrawCmd.prepKeyboardLayout = 108;
DrawCmd.removeProcess = 109;
DrawCmd.setWndId = 110;
DrawCmd.initPopupContentView = 111;
DrawCmd.updatePopWindow = 112;

// igor commands
DrawCmd.wallpaperOffset = 113;
DrawCmd.toggleMenu = 114;
DrawCmd.toggleSearch = 115;
DrawCmd.wallpaperID = 116;
DrawCmd.incomingNotification = 117;

//NON-igor command
DrawCmd.resizeWindow = 118;
DrawCmd.sendKeyboardExtractedText = 119;
DrawCmd.updateScreenOrientation = 120;
DrawCmd.clearProcessCacheAck = 121;
DrawCmd.prepareViewCache = 122;
DrawCmd.roundTripDataAck = 123;
DrawCmd.outgoingCall = 124;
DrawCmd.setTopTask = 125;
DrawCmd.setWindowPos = 126;

if (typeof module != 'undefined') {
    module.exports = {
        PlayerCmd: PlayerCmd,
        DrawCmd: DrawCmd,
    };
}

