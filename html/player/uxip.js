/*
 * UXIP Protocol implementation in Java Script
 *uxipObj
 */

var psDisconnect = 0, psInit = 1, psConnected = 2, psDisconnecting = 3, psError = 4;
var keyboardProcessID = 0;

// used by roundTrip
var START_ROUND_TRIP_CHECK = true;
var RTT_THRESHOLD_TO_CLOSE_SOCKET = 2500;
var mBadRTTCounter = 0;
var MAX_BAD_RTT_SEQUENCE = 5;
var WRITE_TRANSACTION_TIMEOUT = 900000;
var SOCKET_READ_TIMEOUT = 30000;

// debug parameters
var TAG = "UXIP";
var DEBUG_PROTOCOL_NETWORK = false;
var DEBUG_PROTOCOL_NETWORK_STR = "_NETWORK";
var DEBUG_DRAW_COMMANDS_STR = "DRAW_CMD";
var PRINT_DRAW_COMMANDS = false;
var PRINT_NETWORK_COMMANDS = false;
var writeToDrawCmdLog = false;

function UXIP(parentNode, width, height, playbackMode, playbackFile) {
    "use strict";

    var UXIPself = this;
    var protocolState = psDisconnect;
    var msgTimer = null;
    // queued handle_message timer
    var publicinterface = {};
    var ws = null;
    var currentProcessId = null;
    var zlibReader = new ZlibReader();
    
    var handle_message, moreData, errorAndClose, getInitResponse, getDrawCommand, initProtocol, prepKeyboardLayout, 
    	popWindow, PushWindow, setWndId, ShowWindow, HideWindow, setWallpaperByID, toggleSearch, toggleMenu, drawBitmapIntoCanvas, 
    	prepareCanvasForPaint, setDirtyRect, writeTransaction, drawColor1, saveLayer, restoreLayer, drawText, drawText, drawText1, 
    	drawRect, drawBitmap, saveLayerAlpha, drawLine, drawLines, drawRect1, drawRoundRect, drawBitmap1, setDensity, 
    	ninePatchDraw, drawBitmap6, drawPosText1, drawPosText2, drawBitmap8, readNotification, updateWallpaperOffset, 
    	initPopupContentView, handleKeyEvent, dispatchKeyEvent, removeProcess, drawWebView, printArr, ninePatch_Draw, 
    	calculateStretch, drawStretchyPatch, showSoftKeyboard, updatePopWindow, resizeWindow, sendKeyboardExtractedText, 
    	updateScreenOrientation, drawBitmapMatrix, drawTextOnCanvas, drawPosTextOnCanvas, setTextAttFromPaint, drawTextRun, 
    	sendRoundTripDataCommand, prepareViewCache, roundTripDataAck, outgoingCall, drawPath, drawPoints, toast, setTopTask, 
        setWindowPos, getColorFromInt, setShaderToGrdColorStop, clearProcessCacheAck, setPackageName;

    var writer = new UXIPWriter(function(buffer) {
        ws.send(buffer);
    });
    var nuboCache = new NuboCache(function(processId) {
        writer.notifyClearProcessCache(processId);
    });
    var reader = new UXIPReader(nuboCache);
    var sessID;
    var canvasCtx;
    var domObj;
    var lastProcessID, lastWndID;
    var mWidth, mHeight, mParentNode;
    var wm;
    var waitForDraw = false;
    var lastExtractedText = "";
    var uxipObj = this;
    var lastTimeReceiveData = 0;
    var lastDataTime = 0;
    var timeoutid = 0;
    var mPlaybackMode = playbackMode;
    var mZlibData = true;
    
    var drawCmdLog = {};
    
    var connectTime = 0;
    var lastTSLabelTime = 0;
    var resourceURL;

    //function constructor(ctx, canvasObj,width,height) {
    mParentNode = parentNode;
    mWidth = width;
    mHeight = height;

    //parentNode.onmouseup = this.mouseEvent;
    //parentNode.onmousedown = this.mouseEvent;

    //}

    var mPackageNameList = [];

    publicinterface.connect = function(url, sessionID) {
        
        /*if (playbackMode) {
            mZlibData = false;
        }*/

        sessID = sessionID;
        console.log("connecting to " + url + ", sessID: " + sessID);
        var parser = document.createElement('a');
        parser.href = url;
        var host = parser.hostname;
        var protocol = parser.protocol;
        var port = parser.port;

        if (protocol == "ws:") {
            protocol = "http://";
        } else {
            protocol = "https://";
        }
        if (port != "") {
            port = ":" + port;
        }
        
        var mgmtURL = protocol + host + port;
        resourceURL = mgmtURL + "/html/player/";

        wm = new WindowManager(mParentNode, mWidth, mHeight - 45, uxipObj, sessionID, mgmtURL);

        zlibReader.ondata = function(data) {
            reader.addBuffer(data);
            if (!insideGetDrawCommand) {
                if (DEBUG_PROTOCOL_NETWORK) {
                    Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "inside draw command. will not call handle_message()");
                }
                handle_message();
            }
        };

        ws = new WebSocket(url, ['binary']);
        ws.binaryType = "arraybuffer";

        NuboOutputStreamMgr.getInstance().createSocket(parentNode, width, height, uxipObj, writer);

        ws.onmessage = function(e) {
            if (DEBUG_PROTOCOL_NETWORK) {
                Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "onmessage, e.data.byteLength=" + e.data.byteLength);
            }
            lastDataTime = new Date().getTime();
            if (mZlibData) {
                zlibReader.addBuffer(e.data);
                while (zlibReader.handle_message()) {
                    if (PRINT_NETWORK_COMMANDS) {
                        Log.d(DEBUG_PROTOCOL_NETWORK_STR, "Handled block....");
                    }
                    // console.log("Handled block....");
                }
            } else { // nocompression
                Log.v(TAG, "Getting uncompresses stream data");
                reader.addBuffer(e.data);
                if (!insideGetDrawCommand) {                    
                    handle_message();
                }
            }
        };

        ws.onopen = function() {
            if (DEBUG_PROTOCOL_NETWORK) {
                Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "websocket open");
            }
            if (protocolState == psDisconnect) {
                connectTime = new Date().getTime();
                if (!mPlaybackMode) {
                    initProtocol();
                } else {
                    protocolState = psConnected;
                }
            } else {
                Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, "Unexpected websocket open");
                ws.close();
            }
            clearTimer(timeoutid);
            timeoutid = setInterval(checkTimeOut, 12000);
        };

        ws.onclose = function(e) {
            var msg = "";
            if (e.code) {
                msg = " (code: " + e.code;
                if (e.reason) {
                    msg += ", reason: " + e.reason;
                }
                msg += ")";
            }
            //if (DEBUG_PROTOCOL_NETWORK) {
                Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, "WebSocket on-close event " + msg);
            //}
            clearTimer(timeoutid);
            protocolState = psDisconnect;
            if (!mPlaybackMode) {
                wm.killAll();
            }
            // ISRAEL 28/3/16 - temporary diable this for development
            //window.location.reload();

        };
        ws.onerror = function(e) {
            var msg = "";
            if (e.code) {
                msg = " (code: " + e.code;
                if (e.reason) {
                    msg += ", reason: " + e.reason;
                }
                msg += ")";
            }
            Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, "WebSocket on-error event " + msg);
        };

        //domObj.onclick=mouseEvent;

    };

    function checkTimeOut() {
        var d = new Date();
        var currTime = d.getTime();
        var diff = currTime - lastTimeReceiveData;
        console.log("checkTimeOut");

        if (diff > WRITE_TRANSACTION_TIMEOUT) {
            Log.e(TAG + " WRITE_TRANSACTION_TIMEOUT");
            errorAndClose();
            window.location.reload();
        }
    };

    function clearTimer(id) {
        if (id != null) {
            clearInterval(id);
        }
    };

    // event.type must be keypress
    function getChar(event) {
        if (event.which == null) {
            return String.fromCharCode(event.keyCode);
            // IE
        } else if (event.which != 0 && event.charCode != 0) {
            return String.fromCharCode(event.which);
            // the rest
        } else {
            return null;
            // special key
        }
    }


    this.keyEvent = function(eventt, processId, wndId, src) {
        if (eventt.type == "keypress") {
            var chr = getChar(eventt);
            if (isMobile) {
                var newText = $("#edVirtualKeyboard").val();
                console.log("newText: \""+newText+"\" , oldInputText: \""+oldInputText+"\"");
                if ( chr==" " && (newText.length-oldInputText.length) > 1) {
                    chr = newText.substr(oldInputText.length);
                }
                oldInputText = newText;
                console.log("#edVirtualKeyboard: "+newText+", chr: "+chr);
            }
            if (chr != null) {
                console.log("chr: "+chr);
                handleKeyEvent(processId, wndId, {
                    name : "KeyEvent",
                    action : KeyEvent.ACTION_MULTIPLE,
                    keyCode : KeyEvent.KEYCODE_UNKNOWN,
                    characters : chr
                });
                return true;
            }
        } else {
            var specialKey = -1;
            var key = eventt.which == null ? eventt.keyCode : eventt.which;
            console.log("key: "+key);
            switch(key) {
            case 8:
                //backspace
                specialKey = KeyEvent.KEYCODE_DEL;
                break;
            case 9:
                specialKey = KeyEvent.KEYCODE_TAB;
                break;
            case 13:
                specialKey = KeyEvent.KEYCODE_ENTER;
                break;
            case 17:
                specialKey = KeyEvent.KEYCODE_ALT_LEFT;
                break;
            case 18:
                specialKey = KeyEvent.KEYCODE_CTRL_LEFT;
                break;
            case 27:
                specialKey = KeyEvent.KEYCODE_ESCAPE;
                break;
            case 32:
                specialKey = KeyEvent.KEYCODE_SPACE;
                break;
            case 33:
                specialKey = KeyEvent.KEYCODE_PAGE_UP;
                break;
            case 34:
                specialKey = KeyEvent.KEYCODE_PAGE_DOWN;
                break;
            case 35:
                specialKey = KeyEvent.KEYCODE_MOVE_END;
                break;
            case 36:
                specialKey = KeyEvent.KEYCODE_MOVE_HOME;
                break;
            case 37:
                specialKey = KeyEvent.KEYCODE_DPAD_LEFT;
                break;
            case 38:
                specialKey = KeyEvent.KEYCODE_DPAD_UP;
                break;
            case 39:
                specialKey = KeyEvent.KEYCODE_DPAD_RIGHT;
                break;
            case 40:
                specialKey = KeyEvent.KEYCODE_DPAD_DOWN;
                break;
            case 46:
                specialKey = KeyEvent.KEYCODE_FORWARD_DEL;
                break;
            case 91:
                specialKey = KeyEvent.KEYCODE_BUTTON_START;
                break;
            case 112:
                specialKey = KeyEvent.KEYCODE_F1;
                break;
            case 113:
                specialKey = KeyEvent.KEYCODE_F2;
                break;
            case 114:
                specialKey = KeyEvent.KEYCODE_F3;
                break;
            case 115:
                specialKey = KeyEvent.KEYCODE_F4;
                break;
            case 116:
                specialKey = KeyEvent.KEYCODE_F5;
                break;
            case 117:
                specialKey = KeyEvent.KEYCODE_F6;
                break;
            case 118:
                specialKey = KeyEvent.KEYCODE_F7;
                break;
            case 119:
                specialKey = KeyEvent.KEYCODE_F8;
                break;
            case 120:
                specialKey = KeyEvent.KEYCODE_F9;
                break;
            case 121:
                specialKey = KeyEvent.KEYCODE_F10;
                break;
            case 122:
                specialKey = KeyEvent.KEYCODE_F11;
                break;
            case 123:
                specialKey = KeyEvent.KEYCODE_F12;
                break;
            case 144:
                specialKey = KeyEvent.KEYCODE_NUM_LOCK;
                break;
            }
            if (specialKey > 0) {
                console.log("specialKey: "+specialKey);
                eventt.preventDefault();
                var eventaction = (eventt.type == "keydown" ? KeyEvent.ACTION_DOWN : KeyEvent.ACTION_UP);
                handleKeyEvent(processId, wndId, {
                    name : "KeyEvent",
                    action : eventaction,
                    keyCode : specialKey
                });
            }
        }
        return true;
    };

    this.protocolState = function() {
        return protocolState;
    };

    var lastTouchX;
    var lastTouchY;

    this.mouseEvent = function(eventt) {

        var lastMouseDownTouchTime = eventt.lastMouseDownTouchTime;
        Log.d(TAG, "mouseEvent. event.type = " + eventt.type + " lastMouseDownTouchTime=" + lastMouseDownTouchTime);

        var src = eventt.src;
        var rect = src.getBoundingClientRect();

        var left = eventt.clientX - rect.left - src.clientLeft + src.scrollLeft;
        var top = eventt.clientY - rect.top - src.clientTop + src.scrollTop;
        Log.v(TAG, "mouseEvent.  type=" + eventt.type + ", timeStamp=" + eventt.timeStamp + ", left=" + left + ", top=" + top);

        writer.writeBoolean(false);
        //not null

        var timevar = {
            hi : 0,
            lo : 0
        };

        writer.writeLong(timevar);
        writer.writeLong(timevar);
        writer.writeInt(1);
        var action;

        if (eventt.type == "mouseup") {
            lastTouchX = null;
            lastTouchY = null;
            action = 1;
        } else if (eventt.type == "mousedown") {
                lastTouchX = left;
                lastTouchY = top;
                action = 0;
        } else if (eventt.type == "mousemove") {
            action = 2;
        }

        writer.writeInt(action);

        writer.writeInt(0);
        //properties.id
        writer.writeInt(1);
        //properties.toolType

        if (action != 2) {

            writer.writeFloat(0);
            // coords.orientation
            writer.writeFloat(90);
            // coords.toolMajor);
            writer.writeFloat(90);
            // coords.toolMinor);
            writer.writeFloat(90);
            // coords.touchMajor);
            writer.writeFloat(90);
            // coords.touchMinor);
        }

        writer.writeFloat(0.73);
        //coords.pressure);
        writer.writeFloat(0.26);
        //coords.size);
        writer.writeFloat(left);
        //coords.x
        writer.writeFloat(top);
        //coords.y
        writer.writeFloat(2);
        //e.getXPrecision());
        writer.writeFloat(2);
        //e.getYPrecision());

        if (action != 2) {
            writer.writeInt(0);
            // e.getMetaState());
            writer.writeInt(0);
            // e.getButtonState());
            writer.writeInt(0);
            // e.getEdgeFlags());
            writer.writeInt(4098);
            // touchscreen... //e.getSource());
            writer.writeInt(0);
            // e.getFlags());

        } else {
            var now = new Date().getTime();
            var interval = now - lastMouseDownTouchTime;
            var velocityX = (left - lastTouchX) / interval;
            var velocityY = (top - lastTouchY) / interval;
            writer.writeFloat(velocityX);
            writer.writeFloat(velocityY);
        }

        return true;
    };

    this.touchEvent = function(eventt/*, processId, wndId, src*/) {
        //eventt.preventDefault();
        var lastMouseDownTouchTime = eventt.lastMouseDownTouchTime;
        //Log.d(TAG, "touchEvent. processId=" + processId + ", wndId=" + wndId + " event.type = " + eventt.type + " lastMouseDownTouchTime=" + lastMouseDownTouchTime);

        /*
        if (eventt.type == "mousemove" && lastMouseDownTouchTime == null) {
                    return true;
                }*/
        

        //if (protocolState != psConnected)
            //return;

        var src = eventt.src;
        var rect = src.getBoundingClientRect();

        /*
        writer.writeInt(PlayerCmd.touchEvent);
                writer.writeInt(processId);
                writer.writeInt(wndId);*/
        
        writer.writeBoolean(false);
        var timevar = {
            hi : 0,
            lo : 0
        };
        writer.writeLong(timevar);
        writer.writeLong(timevar);
        console.log("eventt.touches.length: "+eventt.touches.length+", eventt.changedTouches: "+eventt.changedTouches.length);
        writer.writeInt(eventt.changedTouches.length); // number of touches
        var action;

        if (eventt.type == "touchend" || eventt.type == "touchcancel") {
            //lastMouseDownTouchTime = null;
            lastTouchX = null;
            lastTouchY = null;
            action = 1;
        } else if (eventt.type == "touchstart") {
            //if (lastMouseDownTouchTime == null) {
                //lastMouseDownTouchTime = new Date().getTime();
                //action = 0;
            //}
            action = 0;
        } else if (eventt.type == "touchmove") {
            action = 2;
        }
        writer.writeInt(action);

        for (var i=0; i < eventt.changedTouches.length; i++) {
            var touch =  eventt.changedTouches[i];
            console.log("touch.identifier: "+touch.identifier);
            writer.writeInt(/*touch.identifier*/i);
            //properties.id
            writer.writeInt(1);
            //properties.toolType
        }
        for (var i=0; i < eventt.changedTouches.length; i++) {
            var touch =  eventt.changedTouches[i];
            var left = touch.clientX - rect.left - src.clientLeft + src.scrollLeft;
            var top = touch.clientY - rect.top - src.clientTop + src.scrollTop;
            if (eventt.type == "touchstart" && i == 0) {
                // get last X and Y for velocity calculation later
                lastTouchX = left;
                lastTouchY = top;
            }
            Log.v(TAG, "touchPoint.  type=" + eventt.type + ", timeStamp=" + eventt.timeStamp + ", left=" + left + ", top=" + top+", force:"+touch.force);
            writer.writeFloat(0);
            //coords.orientation
            writer.writeFloat(touch.force ? touch.force : 0.73);
            //coords.pressure);
            writer.writeFloat(0.26);
            //coords.size);
            writer.writeFloat(90);
            //coords.toolMajor);
            writer.writeFloat(90);
            //coords.toolMinor);
            writer.writeFloat(90);
            //coords.touchMajor);
            writer.writeFloat(90);
            //coords.touchMinor);
            writer.writeFloat(left);
            //coords.x
            writer.writeFloat(top);
            //coords.y
        }
        writer.writeInt(0);
        //e.getMetaState());
        writer.writeInt(0);
        //e.getButtonState());
        writer.writeFloat(2);
        //e.getXPrecision());
        writer.writeFloat(2);
        //e.getYPrecision());
        writer.writeInt(0);
        //e.getEdgeFlags());
        writer.writeInt(4098);
        //touchscreen...    //e.getSource());
        writer.writeInt(0);
        //e.getFlags());
        if (action == 2) { // move event
            var now = new Date().getTime();
            var interval = now - lastMouseDownTouchTime;
            lastMouseDownTouchTime = now;
            var velocityX = (left - lastTouchX) / interval;
            var velocityY = (top - lastTouchY) / interval;
            writer.writeFloat(velocityX);
            writer.writeFloat(velocityY);
        }

        console.log("WRITE OLD");
        //writer.flush();
        return true;
    };

    errorAndClose = function() {
        protocolState = psError;
        ws.close();
    };

    moreData = function() {
        if (DEBUG_PROTOCOL_NETWORK) {
            Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "calling more data");
        }
        handle_message();
        /*if (msgTimer === null) {
         //console.log("More data to process, creating timer");
         msgTimer = setTimeout(function() {
         msgTimer = null;
         handle_message();
         }, 10);
         } else {
         //console.log("More data to process but timer already exists");
         }*/
    };

    var mobilecheck = function() {
        var check = false;
        (function(a,b){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true;})(navigator.userAgent||navigator.vendor||window.opera);
        return check;
    };
    var isMobile = mobilecheck();

    initProtocol = function() {
        protocolState = psInit;
        console.log("sessid=" + sessID);

        var baseDpi = getNuboFloat(163);
        if (isMobile) {
            baseDpi = getNuboFloat(326);
        }

        var mDensityDpi = 163;
        var baseScale = getNuboFloat(1);
        var mXDpi = baseDpi;
        var mYDpi = baseDpi;
        var mScaledDensity = baseScale;
        var mRotation = 0;
        var mNavBarHeightPortrait = 0;
        var mNavBarHeightLandscape = 0;
        var mNavBarWidth = 0;

        var romClientType = RomClientType.WEB;
        if (Modernizr.webp) {
            romClientType = romClientType | RomClientType.ROM_IMAGES_WEBP;
        } else {
            romClientType = romClientType | RomClientType.ROM_IMAGES_PNG;
        }
        if (isMobile) {
            romClientType = romClientType | RomClientType.ROM_HW_KEYBOARD_NONE;
        } else {
            romClientType = romClientType | RomClientType.ROM_HW_KEYBOARD_EXISTS;
        }

        var playerLogin;
        if (Common.withService) {
            playerLogin = UXIPself.nuboByte(PlayerCmd.playerLogin);
        } else {
            playerLogin = PlayerCmd.playerLogin;
        }

        NuboOutputStreamMgr.getInstance().setIsPlayerLogin(true);
        NuboOutputStreamMgr.getInstance().setSessionId(sessID);
        NuboOutputStreamMgr.getInstance().sendCmd(playerLogin, 123456, sessID, // write int int string
            mWidth, mHeight, mDensityDpi, // write all int
            mXDpi, mYDpi, mScaledDensity, // write all float
            mRotation, mNavBarHeightPortrait, mNavBarHeightLandscape, mNavBarWidth, romClientType, 17, // write all int
            'web', '1.2.0.81', '1.2', // write all string
            81, (4 * mHeight * mWidth), -1, ""); // write int, int, int , dataIntent withservice
        NuboOutputStreamMgr.getInstance().setIsPlayerLogin(false);

        //ws.send(buffer2);
        //ws.send(strBuff);
        //ws.send(buffer3);

    };

    handle_message = function() {
        if (waitForDraw)
            return;
        // do not continue if we wait for draw

        switch (protocolState) {
        case psDisconnect:
                if (!mPlaybackMode) {
                    console.log("Got data while disconnect or error");
                } else {
                    if (reader.canReadBytes(4)) {
                        //console.log("Got data while disconnect but in playback mode!!!");
                        if (getDrawCommand())
                            moreData();
                        else {
                            //console.log("No more data in playback mode!!!!");
                            //wm.killAll();
                        }
                    } else {
                        console.log("Got data while disconnect playback mode but finished all data!!!!");
                        wm.killAll();
                    }
                }
                break;
        case psDisconnecting:
        case psError:
            console.log("Got data while disconnect or error");
            break;
        case psConnected:
            if (getDrawCommand() && reader.canReadBytes(4)) {
                moreData();
            }
            break;
        default:
            if (getInitResponse() && reader.canReadBytes(4)) {
                moreData();
            }
            break;
        }
    };

    getInitResponse = function() {
        if (!reader.canReadBytes(4)) {
            Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, "Invalid init response size. waiting");
            return false;
        }
        var ack = reader.readInt();
        if (ack != DrawCmd.drawPlayerLoginAck) {
            Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, 'cmd is not drawPlayerLoginAck. terminating...');
            errorAndClose();
            return false;
        }

        if (!reader.canReadBytes(4)) {// go back and return if we dont have the result yet
            reader.rollback(4);
            return false;
        }

        var errcode = reader.readInt();
        if (errcode < 0) {
            Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, 'Error happend on gateway. Errno:  ' + errcode);
            errorAndClose();
            return false;
        } else {
            if (DEBUG_PROTOCOL_NETWORK) {
                Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, 'Loggedin.');
            }
            // user has logged in.
            protocolState = psConnected;
            return true;
        }

    };

    function DumpObject(obj, indent) {
        if (!indent)
            indent = 0;
        var od = new Object;
        var result = "";
        var len = 0;

        for (var property in obj) {
            var value = obj[property];
            if ( typeof value == 'string')
                value = "'" + value + "'";
            else if ( typeof value == 'object') {
                if ( value instanceof Array) {
                    value = "[ " + value + " ]";
                } else {
                    var ood = DumpObject(value, indent + 1);
                    value = "{ " + ood.dump + " }";
                }
            }
            result += "\n";
            for (var i = 0; i < indent; i++) {
                result += "  ";
            }
            result += "'" + property + "' : " + value + ", ";
            len++;
        }
        od.dump = result.replace(/, $/, "");
        od.len = len;

        return od;
    }

    var insideGetDrawCommand = false;

    /* draw commans message handler */
    getDrawCommand = function() {
        if (insideGetDrawCommand) {
            Log.e(TAG, "Calling getDrawCommand while running...");
            return false;
        }
        insideGetDrawCommand = true;
        var exitInsideDrawCommand = false;
        try {
            var headSize = 13;
            if (mPlaybackMode)
                headSize += 4;
            if (!reader.canReadBytes(headSize)) {
                if (DEBUG_PROTOCOL_NETWORK) {
                    Log.d(TAG, "Too short draw command header. waiting...");
                }
                insideGetDrawCommand = false;
                return false;
            }
            if (DEBUG_PROTOCOL_NETWORK) {
                reader.printState("start getDrawCommand");
            }
            drawCmdLog = {};

            reader.beginTransaction();
            var bytesCount = reader.readInt();
            var processId = reader.readInt();
            lastProcessID = processId;
            var cmdcode = reader.readByte();
            var wndId = reader.readInt();
            var timeStamp;
            if (mPlaybackMode) {
                timeStamp = reader.readInt();
            } else {
                timeStamp = 0;
            }
            lastWndID = wndId;

            if (writeToDrawCmdLog) {
                drawCmdLog.bytesCount = bytesCount;
                drawCmdLog.processId = processId;
                drawCmdLog.cmdcode = cmdcode;
                drawCmdLog.cmdName = drawCmdCodeToText(cmdcode);
                drawCmdLog.wndId = wndId;
                Log.v(TAG, "drawCmdLog.cmdName: " + drawCmdLog.cmdName + ", cmdcode: " + cmdcode);
            }

            //Log.v(TAG, "processId=" + processId + ", cmdcode=" + cmdcode + ", wndId=" + wndId+", bytesCount="+bytesCount);
            if (bytesCount > headSize && !reader.canReadBytes(bytesCount - headSize)) {
                if (DEBUG_PROTOCOL_NETWORK) {
                    Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "insufficient buffer. Rollback...");
                }
                reader.rollbackTransaction();
                insideGetDrawCommand = false;
                return false;
            }
            
            if (timeStamp > 0) {
                 var nowTime = new Date().getTime();
                 var timeDiff =  nowTime - connectTime;
                 // check if we need to wait before process this command
                 if (timeDiff < timeStamp) { 
                     var sleepTime = timeStamp - timeDiff + 1; 
                     Log.v(TAG,"Sleeping for "+ sleepTime + " ms");
                     reader.rollbackTransaction();
                     exitInsideDrawCommand = true;
                     setTimeout(function(){
                         insideGetDrawCommand = false;
                         handle_message();
                      }, sleepTime);
                      return false;
                 }
                 var labelDiff = nowTime - lastTSLabelTime;
                 if (labelDiff > 500) {
                     lastTSLabelTime = nowTime;
                     var displayTime = new Date(playbackStartTime + timeStamp);
                     $("#recordingTimeLbl").text( displayTime.toLocaleDateString()+" "+ displayTime.toLocaleTimeString());
                 } 
            }
            //errorAndClose();
            //return false;
            var func = null;

            if (DEBUG_PROTOCOL_NETWORK) {
                reader.printState("after header read");
            }

            switch (cmdcode) {
            case DrawCmd.setDirtyRect:
                func = setDirtyRect;
                break;
            case DrawCmd.writeTransaction:
                var d = new Date();
                lastTimeReceiveData = d.getTime();

                func = writeTransaction;
                break;
            case DrawCmd.drawColor1:
                func = drawColor1;
                break;
            case DrawCmd.saveLayer:
                func = saveLayer;
                break;
            case DrawCmd.restoreLayer:
                func = restoreLayer;
                break;
            case DrawCmd.drawText:
                func = drawText;
                break;
            case DrawCmd.drawText1:
                func = drawText1;
                break;
            case DrawCmd.drawRect:
                func = drawRect;
                break;
            case DrawCmd.drawBitmap:
                func = drawBitmap;
                break;
            case DrawCmd.saveLayerAlpha:
                func = saveLayerAlpha;
                break;
            case DrawCmd.drawColor2:
                func = drawColor1;
                break;
            case DrawCmd.drawLine:
                func = drawLine;
                break;
            case DrawCmd.drawLines:
                func = drawLines;
                break;
            case DrawCmd.drawRect1:
                func = drawRect;
                break;
            case DrawCmd.drawRoundRect:
                func = drawRect;
                break;
            case DrawCmd.drawBitmap1:
                func = drawBitmap1;
                break;
            case DrawCmd.setDensity:
                func = setDensity;
                break;
            case DrawCmd.drawTextRun:
                func = drawTextRun;
                break;
            case DrawCmd.ninePatchDraw:
                func = ninePatchDraw;
                break;
            case DrawCmd.drawBitmap6:
                func = drawBitmap6;
                break;
            case DrawCmd.drawPosText1:
                func = drawPosText1;
                break;
            case DrawCmd.drawPosText2:
                func = drawPosText2;
                break;
            case DrawCmd.drawBitmap8:
                func = drawBitmap8;
                break;
            case DrawCmd.drawBitmapMatrix:
                func = drawBitmapMatrix;
                break;
            case DrawCmd.popWindow:
                func = popWindow;
                break;
            case DrawCmd.pushWindow:
                func = PushWindow;
                break;
            case DrawCmd.setWndId:
                func = setWndId;
                break;
            case DrawCmd.showWindow:
                func = ShowWindow;
                break;
            case DrawCmd.hideWindow:
                func = HideWindow;
                break;
            case DrawCmd.wallpaperID:
                func = setWallpaperByID;
                break;
            case DrawCmd.toggleSearch:
                func = toggleSearch;
                break;
            case DrawCmd.toggleMenu:
                func = toggleMenu;
                break;
            case DrawCmd.showSoftKeyboard:
                func = showSoftKeyboard;
                break;
            case DrawCmd.prepKeyboardLayout:
                func = prepKeyboardLayout;
                break;
            case DrawCmd.removeProcess:
                func = removeProcess;
                break;
            case DrawCmd.incomingNotification:
                func = readNotification;
                break;
            case DrawCmd.wallpaperOffset:
                func = updateWallpaperOffset;
                break;
            case DrawCmd.initPopupContentView:
                func = initPopupContentView;
                break;
            case DrawCmd.updatePopWindow:
                func = updatePopWindow;
                break;
            case DrawCmd.drawWebView:
                func = drawWebView;
                break;
            case DrawCmd.resizeWindow:
                func = resizeWindow;
                break;
            case DrawCmd.sendKeyboardExtractedText:
                func = sendKeyboardExtractedText;
                break;
            case DrawCmd.updateScreenOrientation:
                func = updateScreenOrientation;
                break;
            case DrawCmd.prepareViewCache:
                func = prepareViewCache;
                break;
            case DrawCmd.roundTripDataAck:
                func = roundTripDataAck;
                break;
            case DrawCmd.outgoingCall:
                func = outgoingCall;
                break;
            case DrawCmd.drawPath:
                func = drawPath;
                break;
            case DrawCmd.toast:
            case DrawCmd.oldToast:
                func = toast;
                break;
            case DrawCmd.setTopTask:
                func = setTopTask;
                break;
            case DrawCmd.setWindowPos:
                func = setWindowPos;
                break;
            case DrawCmd.clearProcessCacheAck:
                func = clearProcessCacheAck;
                break;
            case DrawCmd.setPackageName:
                func = setPackageName;
                break;

            default:
                Log.e(TAG, "processId=" + processId + ", cmdcode=" + cmdcode + ", wndId=" + wndId);
                Log.e(TAG, "Illegal draw command " + cmdcode);
                var transactionSize = reader.getTransactionSize();
                if (bytesCount - transactionSize > 0)
                    reader.incrementOffsetAfterRead(bytesCount - transactionSize);
                reader.compact();
                return true;
            //errorAndClose();
            //return false;
            //break;
            }
            if (func != null) {
                // Log.d("AsiM", "processId=" + processId + ", cmdcode=" + cmdcode + ", cmdName=" + drawCmdCodeToText(cmdcode) + ", wndId=" + wndId);
                try {
                    if (DEBUG_PROTOCOL_NETWORK) {
                        Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "Before running func: " + cmdcode);
                    }
                    if (!func(processId, wndId, cmdcode)) {
                        if (DEBUG_PROTOCOL_NETWORK) {
                            Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "processId=" + processId + ", cmdcode=" + cmdcode + ", cmdName=" + drawCmdCodeToText(cmdcode) + ", wndId=" + wndId);
                            Log.d(TAG + DEBUG_PROTOCOL_NETWORK_STR, "insufficient buffer. Rollback...");
                        }
                        reader.rollbackTransaction();
                        return false;
                    } else {
                        var transactionSize = reader.getTransactionSize();
                        if (transactionSize != bytesCount) {
                            Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, "Error read incorrect number of bytes. required: " + bytesCount + ", actual: " + transactionSize);
                            if (transactionSize > bytesCount) {
                                errorAndClose();
                                return false;
                            } else {
                                reader.incrementOffsetAfterRead(bytesCount - transactionSize);
                            }
                        }
                        if (DEBUG_PROTOCOL_NETWORK) {
                            reader.printState("before compact");
                        }
                        reader.compact();
                        if (DEBUG_PROTOCOL_NETWORK) {
                            reader.printState("after compact");
                        }
                        // after successful buffer read we can compact buffer
                        if (writeToDrawCmdLog) {
                            console.log(DumpObject(drawCmdLog).dump);

                        }
                        return true;
                    } // if (!func(processId,
                }//try
                catch(err) {
                    //Handle errors here
                    Log.e(TAG + DEBUG_PROTOCOL_NETWORK_STR, "Error during draw command " + drawCmdCodeToText(cmdcode) + " err: " + err);
                    var transactionSize = reader.getTransactionSize();
                    if (bytesCount - transactionSize > 0)
                        reader.incrementOffsetAfterRead(bytesCount - transactionSize);
                    reader.compact();
                    return true;
                } // catch

            } else {// if (func !=
                Log.e(TAG, "What the func?");
            }
        } finally {
            if (!exitInsideDrawCommand)
                insideGetDrawCommand = false;
        }
    };

    setDirtyRect = function(processId, wndId) {
        var rect = reader.readRect();
        if (!rect.canRead) {
            return false;
        }
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "setDirtyRect. processId=" + processId + ", wndId=" + wndId + ", rect=" + JSON.stringify(rect));
        }
        wm.setDirtyRect(processId, wndId, rect);
        if (writeToDrawCmdLog) {
            drawCmdLog.rect = rect;
        }
        return true;
    };

    writeTransaction = function(processId, wndId) {
        //Log.v(TAG, "writeTransaction. processId=" + processId + ", wndId=" + wndId);
        //errorAndClose();
        wm.writeTransaction(processId, wndId);

        return true;
    };
    drawColor1 = function(processId, wndId, cmd) {
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "drawColor1. processId=" + processId + ", wndId=" + wndId);
        }
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        if (!reader.canReadBytes(4)) {
            return false;
        }

        var color = reader.readInt();
        var mode = 1;
        if (cmd != DrawCmd.drawColor2) {
            if (!reader.canReadBytes(1))
                return false;
            mode = reader.readByte();
        }

        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.color = color;
            drawCmdLog.mode = mode;
        }

        //Log.e(TAG, "drawColor1 with color=" + color + " PorterDuffMode=" + mode + " processId=" + processId + " wndId=" + wndId);
        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;

        if (mode == 0) {
            ctx.clearRect(0, 0, mWidth, mHeight);
        } else {
            var fcolor = "#" + color.toString(16);
            ctx.fillStyle = fcolor;
            ctx.fillRect(0, 0, mWidth, mHeight);
        }
        ctx.restore();

        /*

         if (PRINT_LOG)
         Log.v(TAG, "drawColor1 with color=" + color
         + " PorterDuffMode=" + mode
         + " processId="+processId+" wndId="+wndId
         + " bounds ="+bounds
         + " matrix="+matrix);
         if (Settings.disableOutput)
         return;

         CanvasManager cm = getWndCanvasMgr(processId, wndId);
         if (cm == null)
         {
         return;
         }

         cm.updateCanvasParams(bounds, matrix);

         Canvas c = cm.getCanvas();
         PorterDuff.Mode pdMode = dinp.ordinal2PDMode(mode);
         if (pdMode != null) {
         c.drawColor(color, pdMode);
         }							*/

        return true;
    };

    saveLayer = function(processId, wndId) {
        var paintRes = reader.readPaint(processId);
        if (!paintRes.canRead)
            return false;
        if (!reader.canReadBytes(1))
            return false;
        var saveFlags = reader.readByte();
        // Log.e(TAG, "saveLayer. processId=" + processId + ", wndId=" + wndId + ", saveFlags=" + saveFlags);
        Log.e("AsiM", "saveLayer. processId=" + processId + ", wndId=" + wndId + ", saveFlags=" + saveFlags);
        wm.saveLayerAlpha(processId, wndId, 255);
        if (writeToDrawCmdLog) {
            drawCmdLog.paintRes = paintRes;
            drawCmdLog.saveFlags = saveFlags;
        }
        return true;
    };

    restoreLayer = function(processId, wndId) {
        // Log.e(TAG, "restoreLayer. processId=" + processId + ", wndId=" + wndId);
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "restoreLayer. processId=" + processId + ", wndId=" + wndId);
        }
        wm.restoreLayer(processId, wndId);

        return true;
    };

    setTextAttFromPaint = function(ctx, paint) {
        var fontFamily = "NuboRoboto";
        if (paint.fontPath == "/system/fonts/AndroidClock.ttf")
            fontFamily = "AndroidClock";

        var fontStyle = "";
        switch(paint.typefaceStyle) {
        case Typeface.NORMAL:
            fontStyle = "";
            break;
        case Typeface.BOLD:
            fontStyle = "bold ";
            break;
        case Typeface.BOLD_ITALIC:
            fontStyle = "italic bold ";
            break;
        case Typeface.ITALIC:
            fontStyle = "italic ";
            break;
        }

        var fontStr = fontStyle + paint.textSize + "px " + fontFamily;
        // Log.e(TAG, "fontStr=" + fontStr + " paint.textScaleX = " + paint.textScaleX);
        ctx.font = fontStr;
        var fcolor = "#" + paint.color.toString(16);

        ctx.fillStyle = fcolor;
        switch(paint.textAlign) {
        case Align.LEFT:
            ctx.textAlign = "left";
            break;
        case Align.CENTER:
            ctx.textAlign = "center";
            break;
        case Align.RIGHT:
            ctx.textAlign = "right";
            break;
        }

    };

    drawTextOnCanvas = function(ctx, text, x, y, paint) {
        setTextAttFromPaint(ctx, paint);
        if (paint.textScaleX != 1 && paint.textScaleX > 0) {
            ctx.scale(paint.textScaleX * 0.9, 1);
            ctx.fillText(text, x * (1 / (paint.textScaleX * 0.9)), y);
        } else {
            ctx.fillText(text, x, y);
        }
    };

    drawPosTextOnCanvas = function(ctx, text, x, y, paint) {
        setTextAttFromPaint(ctx, paint);
        if ( x instanceof Array && y instanceof Array) {
            var minLength = 0;
            if (x.length > y.length)
                minLength = y.length;
            else
                minLength = x.length;
            if (text != null && text.length >= minLength) {
                for (var i = 0; i < minLength; i++) {
                    ctx.fillText(text[i], x[i], y[i]);
                }
            } else {
                Log.e(TAG, "drawPosTextOnCanvas:: incorrect text input. text = " + text + " minLength = " + minLength);
            }
        } else if ( x instanceof Array) {
            if (text != null && text.length >= x.length) {
                for (var i = 0; i < x.length; i++) {
                    ctx.fillText(text[i], x[i], y);
                }
            } else {
                Log.e(TAG, "drawPosTextOnCanvas:: incorrect text input. text = " + text + " posX.length = " + x.length);
            }
        } else if ( y instanceof Array) {
            if (text != null && text.length >= y.length) {
                for (var i = 0; i < y.length; i++) {
                    ctx.fillText(text[i], x, y[i]);
                }
            } else {
                Log.e(TAG, "drawPosTextOnCanvas:: incorrect text input. text = " + text + " posY.length = " + y.length);
            }
        } else {
            Log.e(TAG, "drawPosTextOnCanvas:: unimplemented command");
        }
    };

    drawText1 = function(processId, wndId, cmdcode) {
        //Log.v(TAG, "drawText. processId=" + processId + ", wndId=" + wndId + ", cmdcode=" + cmdcode);
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        var rsRet = reader.readCachedString(processId);

        if (!rsRet.canRead)
            return false;

        var textRes = rsRet.value;

        if (!reader.canReadBytes(16))
            return false;

        var start = reader.readInt();
        var end = reader.readInt();
        textRes = textRes.substring(start, end);

        var x = reader.readFloat();
        var y = reader.readFloat();

        var paintRes = reader.readPaint(processId);
        if (!paintRes.canRead)
            return false;
        var paint = paintRes.p;
        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.text = textRes;
            drawCmdLog.start = start;
            drawCmdLog.x = x;
            drawCmdLog.y = y;
            drawCmdLog.paint = paint;
        }
        // return true;
        //Log.e(TAG, "drawText. txt: "+textRes+", p: " + JSON.stringify(paint));
        //Log.e(TAG,"Draw text. textRes:"+textRes+", x:"+x+", y:"+y+", paint.fontFamilyName:"+paint.fontFamilyName+", paint.typefaceStyle:"+paint.typefaceStyle);
        //result.p.fontFamilyNam

        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;
        //Log.e(TAG, "drawText1. textRes:" + JSON.stringify(textRes));
        if (paint == null) {
            Log.e(TAG, "Null paint!");
            return true;
        }

        drawTextOnCanvas(ctx, textRes, x, y, paint);
        ctx.restore();
        return true;
    };

    drawText = function(processId, wndId, cmdcode) {
        //Log.v(TAG, "drawText. processId=" + processId + ", wndId=" + wndId + ", cmdcode=" + cmdcode);
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        var rsRet = reader.readCachedString(processId);

        if (!rsRet.canRead)
            return false;
        var textRes = rsRet.value;

        if (!reader.canReadBytes(8))
            return false;

        var x = reader.readFloat();
        var y = reader.readFloat();
        var paintRes = reader.readPaint(processId);
        if (!paintRes.canRead)
            return false;
        var paint = paintRes.p;
        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.text = textRes;
            drawCmdLog.x = x;
            drawCmdLog.y = y;
            drawCmdLog.paint = paint;
        }
        //Log.e(TAG, "drawText. txt: "+textRes+", p: " + JSON.stringify(paint));
        //Log.e(TAG,"Draw text. textRes:"+textRes+", x:"+x+", y:"+y+", paint.fontFamilyName:"+paint.fontFamilyName+", paint.typefaceStyle:"+paint.typefaceStyle);
        //result.p.fontFamilyNam
        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;
        //Log.e(TAG, "drawText1. textRes:" + JSON.stringify(textRes));
        if (paint == null) {
            Log.e(TAG, "Null paint!");
            return true;
        }
        drawTextOnCanvas(ctx, textRes, x, y, paint);
        ctx.restore();
        return true;
    };

    drawTextRun = function(processId, wndId, cmdcode) {
        //Log.v(TAG, "drawText. processId=" + processId + ", wndId=" + wndId + ", cmdcode=" + cmdcode);
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;

        var rsRet = reader.readCachedString(processId);
        if (!rsRet.canRead)
            return false;
        var textRes = rsRet.value;

        if (!reader.canReadBytes(16))
            return false;
        var start = reader.readInt();
        var end = reader.readInt();
        end = start + end;
        textRes = textRes.substring(start, end);

        var x = reader.readFloat();
        var y = reader.readFloat();
        var paintRes = reader.readPaint(processId);
        if (!paintRes.canRead)
            return false;
        var paint = paintRes.p;
        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.text = textRes;
            drawCmdLog.start = start;
            drawCmdLog.end = end;
            drawCmdLog.x = x;
            drawCmdLog.y = y;
            drawCmdLog.paint = paint;
        }
        //Log.e(TAG, "drawText. txt: "+textRes+", p: " + JSON.stringify(paint));
        //Log.e(TAG,"Draw text. textRes:"+textRes+", x:"+x+", y:"+y+", paint.fontFamilyName:"+paint.fontFamilyName+", paint.typefaceStyle:"+paint.typefaceStyle);
        //result.p.fontFamilyNam
        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;
        //Log.e(TAG, "drawText1. textRes:" + JSON.stringify(textRes));
        if (paint == null) {
            Log.e(TAG, "Null paint!");
            return true;
        }
        drawTextOnCanvas(ctx, textRes, x, y, paint);
        ctx.restore();
        return true;
    };

    getColorFromInt = function(intColor) {
        var ncolor = (intColor & 0xFFFFFF);
        var nalpha = intColor >>> 24;
        var nr = (intColor & 0xFF0000 ) >>> 16;
        var ng = (intColor & 0x00FF00 ) >>> 8;
        var nb = (intColor & 0x0000FF );
        var gColor = 'rgba(' + nr + ',' + ng + ',' + nb + ',' + (nalpha / 255) + ')';
        return gColor;
    };

    setShaderToGrdColorStop = function(positions, colors, gradient) {
        if (positions != null && positions > 1) {
            var size = colors.length < positions.length ? colors.length : positions.length;
            for (var i = 0; i < size; i++) {
                var gColor = getColorFromInt(colors[i]);
                gradient.addColorStop(positions[i], gColor);
            }
        } else {
            var colorlength = colors.length;
            var step = 1 / colorlength;
            var j = 0;
            var gcolor;
            for (var i = 0; i < 1; i = i + step) {
                gColor = getColorFromInt(colors[j++]);
                gradient.addColorStop(i, gColor);
            }
        }
    };

    drawRect = function(processId, wndId, cmd) {
        //Log.v(TAG, "drawRect. processId=" + processId + ", wndId=" + wndId);
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        if (!reader.canReadBytes(5)) {
            return false;
        }

        var r = reader.readRectF();
        if (!r.canRead) {
            return false;
        }
        // Log.v(TAG, "drawRect. readRectF:" + JSON.stringify(r));
        // Log.e(TAG, "drawRect. bm:" + JSON.stringify(bm));
        var left = Math.round(r.left);
        var top = Math.round(r.top);
        var right = Math.round(r.right);
        var bottom = Math.round(r.bottom);

        var rx = 0, ry = 0;

        if (cmd == DrawCmd.drawRoundRect) {
            if (!reader.canReadBytes(8))
                return false;
            rx = reader.readFloat();
            ry = reader.readFloat();
            Log.e("drawRoundRect. rx:" + rx + ", ry:" + ry);
        }

        var pres = reader.readPaint(processId);
        if (!pres.canRead) {
            return false;
        }

        if (pres.p == null) {
            return true;
        }

        // before continuing, make sure that the rect will be drawn in bounds.
        // first check if the rect and bounds are legal
        if (left >= right || top >= bottom || bm.bounds.left >= bm.bounds.right || bm.bounds.top >= bm.bounds.bottom) {
            return true;
        }

        // check if there is intersection between the rects
        if (bottom < bm.bounds.top || bm.bounds.bottom < top || right < bm.bounds.left || bm.bounds.right < left) {
            return true;
        }

        // update rect to intersection
        if (top < bm.bounds.top) {
            top = bm.bounds.top;
        }
        if (bottom > bm.bounds.bottom) {
            bottom = bm.bounds.bottom;
        }
        if (left < bm.bounds.left) {
            left = bm.bounds.left;
        }
        if (right > bm.bounds.right) {
            right = bm.bounds.right;
        }

        var p = pres.p;
        var grd = null;

        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.rect = r;
            drawCmdLog.rx = rx;
            drawCmdLog.ry = ry;
            drawCmdLog.paint = p;
        }
        //Log.e(TAG,"drawRect color: #"+p.color.toString(16));
        //Log.e(TAG,"drawRect rect: #"+JSON.stringify(r));
        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;

        if (p.shader != null) {
            // Log.d(TAG, "drawRect p: " + JSON.stringify(p));
            // Log.d(TAG, "drawRect with shader: " + JSON.stringify(p.shader));

            if (p.shader.stype == ShaderType.LinearGradient) {
                var x0 = p.shader.x0;
                var y0 = p.shader.y0;
                var x1 = p.shader.x1;
                var y1 = p.shader.y1;
                if (p.shader.localMatrix != null && p.shader.localMatrix.arr != null) {
                    var ma = p.shader.localMatrix.arr;
                    x0 = p.shader.x0 * ma[0] + p.shader.y0 * ma[3] + ma[2];
                    y0 = p.shader.x0 * ma[1] + p.shader.y0 * ma[4] + ma[5];
                    x1 = p.shader.x1 * ma[0] + p.shader.y1 * ma[3] + ma[2];
                    y1 = p.shader.x1 * ma[1] + p.shader.y1 * ma[4] + ma[5];
                    Log.e("LinearGradient with localMatrix: " + x0 + "," + y0 + "," + x1 + ",", y1);
                }

                /*
                 *[-1,0,0,0,-60.29999923706055,149,0,0,1]
                 startPoint.x = lgShader.x0 * lgShader.matrix.a + lgShader.y0 * lgShader.matrix.c + lgShader.matrix.tx;

                 startPoint.y = lgShader.x0 * lgShader.matrix.b + lgShader.y0 * lgShader.matrix.d + lgShader.matrix.ty;

                 CGPoint endPoint;

                 endPoint.x = lgShader.x1 * lgShader.matrix.a + lgShader.y1 * lgShader.matrix.c + lgShader.matrix.tx;

                 endPoint.y = lgShader.x1 * lgShader.matrix.b + lgShader.y1 * lgShader.matrix.d + lgShader.matrix.ty;
                 */
                var w = right - left;
                var h = bottom - top;

                ctx.rect(left, top, w, h);
                grd = ctx.createLinearGradient(x0, y0, x1, y1);
                setShaderToGrdColorStop(p.shader.positions, p.shader.colors, grd);
                ctx.fillStyle = grd;
                ctx.fill();
                ctx.restore();
                return true;
            } else if (p.shader.stype == ShaderType.BitmapShader) {
                var bitmap = p.shader.bitmap;
                var tileX = p.shader.tileX;
                var tileY = p.shader.tileY;
                var localMatrix = p.shader.localMatrix;
                if (tileX != 1 || tileY != 1) {
                    Log.e(TAG, "BitmapShader:: unimplemented tile types. tileX = " + tileX + " tileY = " + tileY);
                }
                drawBitmapIntoCanvas(processId, wndId, bm, null, null, p.shader.localMatrix, p, bitmap, 0, 0, null, DrawBitmapType.bitmapShader);
            } else if (p.shader.stype == ShaderType.RadialGradient) {
                var endRadius = Math.sqrt(p.shader.x * p.shader.x + p.shader.y * p.shader.y);
                // create radial gradient
                var grd = ctx.createRadialGradient(p.shader.x, p.shader.y, 0, p.shader.x, p.shader.y, endRadius);
                setShaderToGrdColorStop(p.shader.positions, p.shader.colors, grd);
            }

        }

        ///////////////////////////////////////////////////////////////////////////////
        //return true; //DEBUG
        var oldFillStyle = ctx.fillStyle;
        var oldStrokeStyle = ctx.strokeStyle;
        var oldAlpha = ctx.globalAlpha;
        var fcolor = "#" + p.color.toString(16);

        //Log.v(TAG, "fillStyle=" + fcolor);
        if (grd == null) {
            ctx.fillStyle = fcolor;
            ctx.strokeStyle = fcolor;
        } else {
            ctx.fillStyle = grd;
            ctx.strokeStyle = grd;
        }

        //if (p.alpha>0) {
        var w = right - left;
        var h = bottom - top;

        ctx.rect(left, top, w, h);

        ctx.globalAlpha = (p.alpha / 255.0);
        if (p.style == Style.FILL || p.style == Style.FILL_AND_STROKE) {
            ctx.fill();
        }
        if (p.style == Style.STROKE || p.style == Style.FILL_AND_STROKE) {
            ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = oldAlpha;
        ctx.fillStyle = oldFillStyle;
        ctx.strokeStyle = oldStrokeStyle;

        return true;
    };

    var pictureBitmap = null;

    drawWebView = function(processId, wndId) {
        //Log.v(TAG, "drawWebView. processId=" + processId + ", wndId=" + wndId);
        if (!reader.canReadBytes(4))
            return false;
        var checkState = reader.readInt();
        if (checkState == 6) {
            //
            //			pictureBitmap = picturesBitmap.get(wndId);
        } else if (checkState == 7) {
            var res = reader.readWebViewBitmap();
            if (!res.canRead)
                return false;
            pictureBitmap = res.bitmap;

        }
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        Log.e("drawWebView. bm=" + JSON.stringify(bm));
        drawBitmapIntoCanvas(processId, wndId, bm, null, null, null, null, pictureBitmap, 0, 0, null, DrawBitmapType.webView);
        return true;

    };

    /*
     *DrawBitmapType.stdBitmap = 0;
     DrawBitmapType.ninePatch = 1;
     DrawBitmapType.webView = 2;
     */

    var getJSON = function(url, success, jsonError, timeout) {
        if (timeout == null)
            timeout = 10000;
        $.ajax({
            dataType : "json",
            url : url,
            success : success,
            error : jsonError,
            'timeout' : timeout
        });
    };

    drawBitmapIntoCanvas = function(processId, wndId, bm, src, dst, matrix, p, bitmap, left, top, chunk, drawBitmapType) {
        var img = document.createElement("img");
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "drawBitmapIntoCanvas. bitmap.bitmapType: "+bitmap.bitmapType +", drawBitmapType: "+drawBitmapType);
        }
        img.onload = function(e) {
            //Log.v(TAG,"image loaded! "+img.src);
            //Log.e(TAG,"src: "+JSON.stringify(src));
            //Log.e(TAG,"dst: "+JSON.stringify(dst));
            //Log.e(TAG,"bm: "+JSON.stringify(bm));
            // bm: {"canRead":true,"bounds":{"canRead":true,"isNull":false,"left":-34,"top":-34,"right":70,"bottom":70},
            //"matrix":{"canRead":true,"isNull":false,"arr":[1,0,650,0,1,1010,0,0,1]}}

            //canvasCtx.setTransform(bm.matrix.arr[0],bm.matrix.arr[3],bm.matrix.arr[1],bm.matrix.arr[4],bm.matrix.arr[2],bm.matrix.arr[5]);

            var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
            if (ctx != null) {
                if (drawBitmapType == DrawBitmapType.ninePatch) {//nine patch image
                    ninePatch_Draw(ctx, dst, img, chunk);
                } else if (drawBitmapType == DrawBitmapType.webView) {//Web view draw
                    var sn = wm.getWindow(processId, wndId);
                    //		check which case is drawn and update matrix and clipBounds accordingly:
                    //		1. out of memory - in this case we should be receiving bitmap at the size of the screen
                    //		2. no out of memory - in this case we should be receiving bitmap of whole web page.
                    if ((sn.bounds.bottom + sn.matrix.arr[5]) == img.height) {
                        //Rect rect2 = new Rect();
                        //rect2.bottom = (int) (currentClipBounds.bottom + matValues[5]);
                        //rect2.right = (int) (currentClipBounds.right + matValues[2]);
                        //cm.updateCanvasParams(rect2, new Matrix());
                        var newbm = {
                            isNull : false
                        };
                        newbm.bounds = {
                            isNull : false,
                            left : sn.matrix.arr[2],
                            top : sn.matrix.arr[5],
                            right : (sn.bounds.right + sn.matrix.arr[2]),
                            bottom : (sn.bounds.bottom + sn.matrix.arr[5])
                        };
                        newbm.matrix = {
                            isNull : false
                        };
                        newbm.matrix.arr = [1, 0, 0, 0, 1, 0, 0, 0, 1];
                        Log.e("webView out of mem case! sn.bounds:" + JSON.stringify(sn.bounds) + ", sn.matrix:" + JSON.stringify(sn.matrix) + ", img.height=" + img.height + ", newbm:" + JSON.stringify(newbm));
                        ctx = wm.prepareCanvasForPaint(processId, wndId, newbm);

                    } else {
                        Log.e("webView std case! sn.bounds:" + JSON.stringify(sn.bounds) + ", sn.matrix:" + JSON.stringify(sn.matrix) + ", img.height=" + img.height);
                    }
                    ctx.drawImage(img, 0, 0);
                } else {// std image (no nine patch)
                    if (drawBitmapType == DrawBitmapType.bitmapShader) {
                        if (matrix != null && !matrix.isNull) {
                            ctx.setTransform(matrix.arr[0], matrix.arr[3], matrix.arr[1], matrix.arr[4], matrix.arr[2], matrix.arr[5]);
                        }
                        var ptrn = ctx.createPattern(img, 'repeat');
                        ctx.fillStyle = ptrn;
                        var sn = wm.getWindow(processId, wndId);
                        ctx.fillRect(0, 0, sn.canvas.width, sn.canvas.height);

                        // Alternate implementation but slower
                        // for (var w = 0; w < sn.canvas.width; w += img.width) {
                        // for (var h = 0; h < sn.canvas.height; h += img.height) {
                        // ctx.drawImage(img, w, h);
                        // }
                        // }
                    } else if (drawBitmapType == DrawBitmapType.drawBitmapMatrix) {
                        if (matrix != null && !matrix.isNull) {
                            // ctx.transform(matrix.arr[0], matrix.arr[3], matrix.arr[1], matrix.arr[4], matrix.arr[2], matrix.arr[5]);
                            ctx.setTransform(matrix.arr[0], matrix.arr[3], matrix.arr[1], matrix.arr[4], matrix.arr[2], matrix.arr[5]);
                        }
                        ctx.drawImage(img, left, top);
                    } else if (src == null || dst == null) {
                        ctx.drawImage(img, left, top);
                    } else {
                        if (!src.isNull) {
                            var srcWidth = (src.right - src.left) > img.width ? img.width : (src.right - src.left);
                            var srcHeight = (src.bottom - src.top) > img.height ? img.height : (src.bottom - src.top);
                            ctx.drawImage(img, src.left, src.top, srcWidth, srcHeight, dst.left, dst.top, (dst.right - dst.left), (dst.bottom - dst.top));
                        } else {
                            ctx.drawImage(img, dst.left, dst.top, (dst.right - dst.left), (dst.bottom - dst.top));
                        }
                        // ctx.drawImage(img, dst.left, dst.top, (dst.right - dst.left), (dst.bottom - dst.top));
                    }
                }
                ctx.restore();
            }

            waitForDraw = false;
            moreData();
        };

        img.onerror = function(e) {
            Log.e(TAG, "Error on loading image ");
            waitForDraw = false;
            moreData();
        };

        if (bitmap.bitmapType == "res") {
            img.crossOrigin = "Anonymous";
            getJSON(bitmap.path, function(data) {
                console.log("getJSON: "+JSON.stringify(data,null,2));
                if (data.status == 0) {
                  var fileContent = data.fileContent;
                  img.setAttribute("src", 'data:image/png;base64,' + fileContent);
                } else {
                    waitForDraw = false;
                    moreData();
                }
            },function(){
                console.log("getJSON: ERROR");
                waitForDraw = false;
                moreData();
            });
            //img.setAttribute("src", resourceURL + bitmap.path);
            //Log.v(TAG, "bitmap.path: " + bitmap.path);
        } else {
            var u8 = new Uint8Array(bitmap.data);
            var chars = "";
            for (var i = 0; i < u8.length; i++) {
                chars += String.fromCharCode(u8[i]);
            }
            var b64encoded = btoa(chars);
            //var b64encoded = btoa(String.fromCharCode.apply(null, u8));

            // 9patch is always in png format
            if (drawBitmapType == DrawBitmapType.ninePatch) {
                img.setAttribute("src", 'data:image/png;base64,' + b64encoded);
            } else if (Modernizr.webp) {// supports webp format
                img.setAttribute("src", 'data:image/webp;base64,' + b64encoded);
            } else {
                img.setAttribute("src", 'data:image/png;base64,' + b64encoded);
            }
        }
        waitForDraw = true;

        //var img=document.getElementById("scream");
        //context.
    };

    drawBitmap = function(processId, wndId) {
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "drawBitmap. processId=" + processId + ", wndId=" + wndId);
        }
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        var bitmapRet = reader.readBitmapCache(processId);
        if (!bitmapRet.canRead) {
            return false;
        }

        var src = reader.readRect();
        if (!src.canRead)
            return false;
        var dst = reader.readRect();
        if (!dst.canRead)
            return false;
        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var p = paintRet.p;

        //if (Settings.disableOutput)
        // return true;
        if (bitmapRet.retVal == NuboStatus.FAIL) {
            Log.e(TAG, "drawBitmap: bitmap could not be retrieved");
            return true;
        }
        var bitmap = bitmapRet.bitmap;

        drawBitmapIntoCanvas(processId, wndId, bm, src, dst, null, p, bitmap, 0, 0, null, DrawBitmapType.stdBitmap);

        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.src = src;
            drawCmdLog.dst = dst;
            drawCmdLog.paint = p;
            drawCmdLog.bitmap = bitmap;
        }

        return true;
    };

    saveLayerAlpha = function(processId, wndId) {
        //Log.e(TAG, "saveLayerAlpha. processId=" + processId + ", wndId=" + wndId);
        if (!reader.canReadBytes(2))
            return false;
        var alpha = reader.readByte();
        var saveFlags = reader.readByte();
        //Log.e(TAG, "saveLayerAlpha. processId=" + processId + ", wndId=" + wndId+", alpha="+alpha+", saveFlags="+saveFlags);
        wm.saveLayerAlpha(processId, wndId, alpha);
        if (writeToDrawCmdLog) {
            drawCmdLog.alpha = alpha;
            drawCmdLog.saveFlags = saveFlags;
        }
        return true;
    };

    drawLine = function(processId, wndId) {
        //Log.v(TAG, "drawLine. processId=" + processId + ", wndId=" + wndId);
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        if (!reader.canReadBytes(16))
            return false;
        var startX = reader.readFloat();
        var startY = reader.readFloat();
        var stopX = reader.readFloat();
        var stopY = reader.readFloat();
        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var p = paintRet.p;
        if (p == null) {
            return;
        }
        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;
        var fcolor = "#" + p.color.toString(16);
        //Log.v(TAG, "fillStyle=" + fcolor);
        ctx.fillStyle = fcolor;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(stopX, stopY);
        ctx.stroke();

        //Log.v(TAG, "Drawline: from (" + startX + "," + startY + ") to (" + stopX + "," + stopY + ")");
        ctx.restore();
        return true;
    };

    drawLines = function(processId, wndId) {
        //Log.v(TAG, "drawLines. processId=" + processId + ", wndId=" + wndId);
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;

        var pts = reader.readFloatArr();
        if (!pts.canRead)
            return false;
        if (!reader.canReadBytes(8))
            return false;
        var offset = reader.readInt();
        var count = reader.readInt();
        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var p = paintRet.p;
        if (p == null) {
            return;
        }

        if (bm.bounds.left == 0 && bm.bounds.right == 0 && bm.bounds.top == 0 && bm.bounds.bottom == 0) {
            return true;
        }

        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;
        var fcolor = "#" + p.color.toString(16);
        //Log.v(TAG, "fillStyle=" + fcolor);
        ctx.fillStyle = fcolor;
        //drawLines(ctx,pts.arr, offset, count, paint);
        for (var i = offset; (i + 3) < (offset + count) && (i + 3) < pts.arr.length; i += 4) {
            ctx.beginPath();
            ctx.moveTo(pts.arr[i], pts.arr[i + 1]);
            ctx.lineTo(pts.arr[i + 2], pts.arr[i + 3]);
            ctx.stroke();
            //Log.v(TAG, "Drawline: from (" + pts.arr[i] + "," + pts.arr[i + 1] + ") to (" + pts.arr[i + 2] + "," + pts.arr[i + 3] + ")");
        }
        ctx.restore();
        return true;
    };

    drawRect1 = function(processId, wndId) {
        Log.e(TAG, "drawRect1. processId=" + processId + ", wndId=" + wndId);
        return true;
    };

    drawRoundRect = function(processId, wndId) {
        Log.e(TAG, "drawRoundRect. processId=" + processId + ", wndId=" + wndId);
        return true;
    };

    drawBitmap1 = function(processId, wndId) {
        //Log.v(TAG, "drawBitmap1. processId=" + processId + ", wndId=" + wndId);
        // Bitmap bitmap, float left, float top, Paint paint
        // rawBitmap(Bitmap bitmap, Rect src, Rect dst, Paint paint) {

        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        var bitmapRet = reader.readBitmapCache(processId);
        if (!bitmapRet.canRead) {
            return false;
        }
        if (!reader.canReadBytes(8))
            return false;
        var left = reader.readFloat();
        var top = reader.readFloat();

        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var p = paintRet.p;

        //if (Settings.disableOutput)
        //	return;
        if (!bitmapRet.retVal == NuboStatus.FAIL) {
            Log.e(TAG, "drawBitmap: bitmap could not be retrieved");
            return true;
        }
        var bitmap = bitmapRet.bitmap;
        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.left = left;
            drawCmdLog.top = top;
            drawCmdLog.paint = p;
            drawCmdLog.bitmap = bitmap;
        }

        drawBitmapIntoCanvas(processId, wndId, bm, null, null, null, p, bitmap, left, top, null, DrawBitmapType.stdBitmap);

        return true;
    };

    setDensity = function(processId, wndId) {
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        if (!reader.canReadBytes(4)) {
            return false;
        }
        var density = reader.readInt();
        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.density = density;
        }
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "setDensity. processId=" + processId + ", wndId=" + wndId + ", density=" + density);
        }
        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null) {
            return true;
        }
        ctx.restore();
        return true;
    };

    printArr = function(arr) {
        var res = "[";
        for (var i = 0; i < arr.length; i++) {
            if (i > 0)
                res += ",";
            res += arr[i];
        }
        res += "]";
        return res;
    };

    calculateStretch = function(boundsLimit, startingPoint, srcSpace, numStrechyPixelsRemaining, numFixedPixelsRemaining) {
        var spaceRemaining = boundsLimit - startingPoint;
        var stretchySpaceRemaining = spaceRemaining - numFixedPixelsRemaining;
        return (srcSpace * stretchySpaceRemaining / numStrechyPixelsRemaining);
    };

    ninePatch_Draw = function(ctx, location, img, chunk) {

        var dst = {};
        var src = {};

        var x0 = chunk.xDivs[0];
        var y0 = chunk.yDivs[0];
        var initColor = 0;
        var numXDivs = chunk.numXDivs;
        var numYDivs = chunk.numYDivs;
        var i;
        var j;
        var colorIndex = 0;
        var color;
        var xIsStretchable;
        var initialXIsStretchable = (x0 == 0);
        var yIsStretchable = (y0 == 0);
        var bitmapWidth = img.width;
        var bitmapHeight = img.height;

        var oldFillStyle = ctx.fillStyle;
        var oldAlpha = ctx.globalAlpha;

        //SkScalar* dstRights = (SkScalar*) alloca((numXDivs + 1) * sizeof(SkScalar));
        var dstRights = new Array();
        var dstRightsHaveBeenCached = false;

        var numStretchyXPixelsRemaining = 0;
        for ( i = 0; i < numXDivs; i += 2) {
            numStretchyXPixelsRemaining += chunk.xDivs[i + 1] - chunk.xDivs[i];
        }
        var numFixedXPixelsRemaining = bitmapWidth - numStretchyXPixelsRemaining;
        var numStretchyYPixelsRemaining = 0;
        for ( i = 0; i < numYDivs; i += 2) {
            numStretchyYPixelsRemaining += chunk.yDivs[i + 1] - chunk.yDivs[i];
        }
        var numFixedYPixelsRemaining = bitmapHeight - numStretchyYPixelsRemaining;

        //Log.e(TAG,"NinePatch ["+bitmapWidth+" "+bitmapHeight+"] location ["+JSON.stringify(location)+"] divs ["+numXDivs+" "+numYDivs+
        //   "] numStretchyXPixelsRemaining: "+numStretchyXPixelsRemaining+" numStretchyYPixelsRemaining: "+numStretchyYPixelsRemaining);

        src.top = 0;
        dst.top = location.top;

        // debug ONLY
        /*src.left = 0;
        dst.left = location.left;

        src.right = bitmapWidth;
        dst.right = dst.left + bitmapWidth;

        src.bottom = bitmapHeight;
        dst.bottom = dst.top + bitmapHeight;

        drawStretchyPatch(ctx,src, dst,img,0,1);
        return;*/

        // The first row always starts with the top being at y=0 and the bottom
        // being either yDivs[1] (if yDivs[0]=0) of yDivs[0].  In the former case
        // the first row is stretchable along the Y axis, otherwise it is fixed.
        // The last row always ends with the bottom being bitmap.height and the top
        // being either yDivs[numYDivs-2] (if yDivs[numYDivs-1]=bitmap.height) or
        // yDivs[numYDivs-1]. In the former case the last row is stretchable along
        // the Y axis, otherwise it is fixed.
        //
        // The first and last columns are similarly treated with respect to the X
        // axis.
        //
        // The above is to help explain some of the special casing that goes on the
        // code below.

        // The initial yDiv and whether the first row is considered stretchable or
        // not depends on whether yDiv[0] was zero or not.
        for ( j = yIsStretchable ? 1 : 0; j <= numYDivs && src.top < bitmapHeight; j++, yIsStretchable = !yIsStretchable) {
            src.left = 0;
            dst.left = location.left;
            if (j == numYDivs) {
                src.bottom = bitmapHeight;
                dst.bottom = location.bottom;
            } else {
                src.bottom = chunk.yDivs[j];
                var srcYSize = src.bottom - src.top;
                if (yIsStretchable) {
                    dst.bottom = dst.top + calculateStretch(location.bottom, dst.top, srcYSize, numStretchyYPixelsRemaining, numFixedYPixelsRemaining);
                    numStretchyYPixelsRemaining -= srcYSize;
                } else {
                    dst.bottom = dst.top + srcYSize;
                    numFixedYPixelsRemaining -= srcYSize;
                }
            }

            xIsStretchable = initialXIsStretchable;
            // The initial xDiv and whether the first column is considered
            // stretchable or not depends on whether xDiv[0] was zero or not.
            for ( i = xIsStretchable ? 1 : 0; i <= numXDivs && src.left < bitmapWidth; i++, xIsStretchable = !xIsStretchable) {
                color = chunk.colors[colorIndex++];
                if (i == numXDivs) {
                    src.right = bitmapWidth;
                    dst.right = location.right;
                } else {
                    src.right = chunk.xDivs[i];
                    if (dstRightsHaveBeenCached) {
                        dst.right = dstRights[i];
                    } else {
                        var srcXSize = src.right - src.left;
                        if (xIsStretchable) {
                            dst.right = dst.left + calculateStretch(location.right, dst.left, srcXSize, numStretchyXPixelsRemaining, numFixedXPixelsRemaining);
                            numStretchyXPixelsRemaining -= srcXSize;
                        } else {
                            dst.right = dst.left + srcXSize;
                            numFixedXPixelsRemaining -= srcXSize;
                        }
                        dstRights[i] = dst.right;
                    }
                }
                // If this horizontal patch is too small to be displayed, leave
                // the destination left edge where it is and go on to the next patch
                // in the source.
                if (src.left >= src.right) {
                    src.left = src.right;
                    continue;
                }
                var drawFlag = true;
                // Make sure that we actually have room to draw any bits
                if (dst.right <= dst.left || dst.bottom <= dst.top) {
                    drawFlag = false;
                }
                // If this patch is transparent, skip and don't draw.
                //if (color == 0) {
                //	drawFlag=false;
                //}
                if (drawFlag) {
                    //Log.e(TAG,"drawStretchyPatch. src:"+JSON.stringify(src)+", dst:"+JSON.stringify(dst)+
                    //  ", initColor:"+initColor+", color:"+color);
                    drawStretchyPatch(ctx, src, dst, img, initColor, color);
                    //drawStretchyPatch(canvas, src, dst, bitmap, *paint, initColor,
                    //                  color, hasXfer);

                }

                src.left = src.right;
                dst.left = dst.right;
            }
            src.top = src.bottom;
            dst.top = dst.bottom;
            dstRightsHaveBeenCached = true;

        }

        ctx.globalAlpha = oldAlpha;
        ctx.fillStyle = oldFillStyle;

        //ctx.drawImage(img,location.left,location.top);

    };

    drawStretchyPatch = function(ctx, src, dst, img, initColor, colorHint) {
        // diabling this is for now. Under tracking to see if 9patch related issues will appear.
        if (false && colorHint != Res_png_9patch.NO_COLOR) {
            //((SkPaint*)&paint)->setColor(modAlpha(colorHint, paint.getAlpha()));
            //canvas->drawRect(dst, paint);
            //((SkPaint*)&paint)->setColor(initColor);
            var oldFillStyle = ctx.fillStyle;
            var oldAlpha = ctx.globalAlpha;
            ctx.beginPath();
            var color = (colorHint & 0xFFFFFF );
            var alpha = colorHint >>> 24;
            var fcolor = "#" + color.toString(16);
            //Log.e(TAG,"Fill Color: "+fcolor+", alpha:"+alpha);
            ctx.fillStyle = fcolor;
            var w = dst.right - dst.left;
            var h = dst.bottom - dst.top;
            ctx.rect(dst.left, dst.top, w, h);
            ctx.globalAlpha = (alpha / 255);
            ctx.fill();
            ctx.globalAlpha = oldAlpha;
            ctx.fillStyle = oldFillStyle;
            //Log.e(TAG,"drawRect sw="+sw+", sh="+sh+", dw="+dw+", dh="+dh);

            /*var color= (initColor & 0xFFFFFF );
             var alpha= initColor >>> 24;
             var fcolor = "#" + color.toString(16);
             Log.e(TAG,"Init Color: "+fcolor+", alpha:"+alpha);
             ctx.fillStyle = fcolor;
             ctx.globalAlpha = (alpha / 255);*/

            /*} else if (src.width() == 1 && src.height() == 1) {
             SkColor c;
             if (!getColor(bitmap, src.fLeft, src.fTop, &c)) {
             goto SLOW_CASE;
             }
             if (0 != c || hasXfer) {
             SkColor prev = paint.getColor();
             ((SkPaint*)&paint)->setColor(c);
             canvas->drawRect(dst, paint);
             ((SkPaint*)&paint)->setColor(prev);
             }*/
        } else {
            var sw = (src.right - src.left);
            var sh = (src.bottom - src.top);
            var dw = (dst.right - dst.left);
            var dh = (dst.bottom - dst.top);
            //Log.e(TAG,"drawImage sw="+sw+", sh="+sh+", dw="+dw+", dh="+dh);
            ctx.drawImage(img, src.left, src.top, sw, sh, dst.left, dst.top, dw, dh);
            //ctx.drawImage(img,src.left,src.top,sw, sh, dst.left, dst.top, sw, sh);
            //    SLOW_CASE:
            //        canvas->drawBitmapRect(bitmap, &src, dst, &paint);
        }
    };

    ninePatchDraw = function(processId, wndId) {
        //Log.v(TAG, "ninePatchDraw. processId=" + processId + ", wndId=" + wndId);
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;

        var location = reader.readRect();
        if (!location.canRead) {
            return false;
        }
        var status = reader.readBitmapCache(processId);
        if (!status.canRead) {
            return false;
        }

        var ninePatchRet = reader.readNinePatchChunkCache(processId);
        if (!ninePatchRet.canRead)
            return false;

        var mBitmap = status.bitmap;
        var mChunk = ninePatchRet.data;
        if (mChunk == null) {
            Log.e("mChunk is null!");
            return true;
        }
        //Log.e(TAG,"mBitmap.data.byteLength: "+mBitmap.data.byteLength);
        //Log.e(TAG,"mChunk.byteLength: "+mChunk.byteLength);

        var chunk = {};

        var npDV = new DataView(mChunk, 0);
        chunk.numXDivs = npDV.getUint8(1);
        chunk.numYDivs = npDV.getUint8(2);
        chunk.numColors = npDV.getUint8(3);
        chunk.paddingLeft = npDV.getInt32(12);
        chunk.paddingRight = npDV.getInt32(16);
        chunk.paddingTop = npDV.getInt32(20);
        chunk.paddingBottom = npDV.getInt32(24);

        var calcTotalSize = 4 + (chunk.numXDivs) * 4 + (chunk.numYDivs) * 4 + 16 + (chunk.numColors) * 4 + 12;

        //Log.e(TAG,"numXDivs:"+chunk.numXDivs+", numYDivs:"+chunk.numYDivs+", numColors:"+chunk.numColors+", calcTotalSize="+calcTotalSize);

        chunk.xDivs = new Int32Array(mChunk, 32, chunk.numXDivs);
        chunk.yDivs = new Int32Array(mChunk, 32 + (chunk.numXDivs) * 4, chunk.numYDivs);
        chunk.colors = new Uint32Array(mChunk, 32 + (chunk.numXDivs) * 4 + (chunk.numYDivs) * 4, chunk.numColors);
        //Log.e(TAG,"xDivs:"+printArr(chunk.xDivs)+", yDivs:"+printArr(chunk.yDivs)+", colors:"+printArr(chunk.colors));

        //Log.e(TAG,"chunk: "+JSON.stringify(chunk));

        if (!reader.canReadBytes(8)) {
            return false;
        }
        var bitmapDensity = reader.readInt();
        var canvasDensity = reader.readInt();

        if (status.retVal == NuboStatus.FAIL) {
            Log.v(TAG, "NinePatchDraw1: bitmap could not be retrieved");
            return true;
        }

        drawBitmapIntoCanvas(processId, wndId, bm, null, location, null, null, mBitmap, 0, 0, chunk, DrawBitmapType.ninePatch);
        //Log.e(TAG, "ninePatchDraw. bitmap:" + JSON.stringify(status) + ", ninePatchRet:" + JSON.stringify(ninePatchRet));
        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.location = location;
            drawCmdLog.bitmap = mBitmap;
            drawCmdLog.chunk = chunk;
            drawCmdLog.bitmapDensity = bitmapDensity;
            drawCmdLog.canvasDensity = canvasDensity;
        }
        return true;

        /*

        CanvasManager cm = getWndCanvasMgr(processId, wndId);
        if (cm == null)
        {
        return;
        }

        cm.updateCanvasParams(bounds, matrix);

        Canvas c = cm.getCanvas();
        c.setDensity(canvasDensity);
        mBitmap[0].setDensity(bitmapDensity);
        NinePatchDrawable npd = new NinePatchDrawable(null, mBitmap[0], mChunk, null, null);
        npd.setBounds(location);
        npd.draw(c);
        npd = null;*/

        //		if (drawcolor)
        //			saveToFile("NinePatchDraw1", mBitmap[0], processId,wndId);
        // return true;
    };

    drawBitmap6 = function(processId, wndId) {
        Log.e(TAG, "drawBitmap6. processId=" + processId + ", wndId=" + wndId);
        return true;
    };
    drawPosText1 = function(processId, wndId) {
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;

        var rsRet = reader.readCachedString(processId);
        if (!rsRet.canRead)
            return false;
        var textRes = rsRet.value;

        var posXRet = reader.readCachedFloatArray(processId);
        if (!posXRet.canRead) {
            return false;
        }
        var posX = posXRet.floatArr;

        var posYRet = reader.readCachedFloatArray(processId);
        if (!posYRet.canRead) {
            return false;
        }
        var posY = posYRet.floatArr;

        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var paint = paintRet.p;

        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;
        if (paint == null) {
            Log.e(TAG, "drawPosText2::Null paint!");
            return true;
        }

        drawPosTextOnCanvas(ctx, textRes, posX, posY, paint);
        ctx.restore();

        return true;
    };

    drawPosText2 = function(processId, wndId) {
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;

        var rsRet = reader.readCachedString(processId);
        if (!rsRet.canRead)
            return false;
        var textRes = rsRet.value;

        var posXRet = reader.readCachedFloatArray(processId);
        if (!posXRet.canRead) {
            return false;
        }
        var posX = posXRet.floatArr;

        if (!reader.canReadBytes(4))
            return false;
        var posY = reader.readFloat();

        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var paint = paintRet.p;

        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        if (ctx == null)
            return true;
        if (paint == null) {
            Log.e(TAG, "drawPosText2::Null paint!");
            return true;
        }

        drawPosTextOnCanvas(ctx, textRes, posX, posY, paint);
        ctx.restore();

        return true;
    };

    drawPoints = function(processId, wndId) {
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;

        var pointsX = reader.readCachedFloatArray(processId);
        if (!pointsX.canRead) {
            return false;
        }

        var pointsY = reader.readCachedFloatArray(processId);
        if (!pointsY.canRead) {
            return false;
        }

        if (!reader.canReadBytes(4))
            return false;
        var count = reader.readInt();

        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var paint = paintRet.p;

        Log.e(TAG, "drawPoints. processId=" + processId + ", wndId=" + wndId + ". Unimplemented.");

        return true;
    };

    drawBitmap8 = function(processId, wndId) {
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "drawBitmap8. processId=" + processId + ", wndId=" + wndId);
        }
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;
        var bitmapRet = reader.readBitmapCache(processId);
        if (!bitmapRet.canRead) {
            return false;
        }

        var src = reader.readRect();
        if (!src.canRead)
            return false;
        var dst = reader.readRectF();
        if (!dst.canRead)
            return false;
        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead)
            return false;
        var p = paintRet.p;

        if (bitmapRet.retVal == NuboStatus.FAIL) {
            Log.e(TAG, "drawBitmap8: bitmap could not be retrieved");
            return true;
        }
        var bitmap = bitmapRet.bitmap;

        drawBitmapIntoCanvas(processId, wndId, bm, src, dst, null, p, bitmap, 0, 0, null, DrawBitmapType.stdBitmap);

        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.src = src;
            drawCmdLog.dst = dst;
            drawCmdLog.paint = p;
            drawCmdLog.bitmap = bitmap;
        }

        return true;
    };

    drawBitmapMatrix = function(processId, wndId) {
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "drawBitmapMatrix. processId=" + processId + ", wndId=" + wndId);
        }
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead)
            return false;

        var bitmapRet = reader.readBitmapCache(processId);
        if (!bitmapRet.canRead) {
            return false;
        }

        // Bitmap b = dinp.readBitmap(cache);
        var matrix = reader.readMatrix();
        if (!matrix.canRead) {
            return false;
        }

        var paintRet = reader.readPaint(processId);
        if (!paintRet.canRead) {
            return false;
        }

        var p = paintRet.p;
        if (bitmapRet.retVal == NuboStatus.FAIL) {
            Log.v(TAG, "drawBitmapMatrix: bitmap could not be retrieved");
            return true;
        }
        var bitmap = bitmapRet.bitmap;
        drawBitmapIntoCanvas(processId, wndId, bm, null, null, matrix, p, bitmap, 0, 0, null, DrawBitmapType.drawBitmapMatrix);

        if (writeToDrawCmdLog) {
            drawCmdLog.bm = bm;
            drawCmdLog.matrix = matrix;
            drawCmdLog.paint = p;
            drawCmdLog.bitmap = bitmap;
        }

        return true;
    };

    drawPath = function(processId, wndId) {
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "drawPath. processId=" + processId + ", wndId=" + wndId);
        }
        var bm = reader.readBoundsAndMatrix();
        if (!bm.canRead) {
            return false;
        }
        var pathRes = reader.readCachedPath(processId);
        if (!pathRes.canRead) {
            return false;
        }
        var path = pathRes.path;
        var pRes = reader.readPaint(processId);
        if (!pRes.canRead) {
            return false;
        }
        // get canvas
        var ctx = wm.prepareCanvasForPaint(processId, wndId, bm);
        ctx.beginPath();

        var p = pRes.p;
        var grd = null;
        // set color values
        var oldFillStyle = ctx.fillStyle;
        var oldStrokeStyle = ctx.strokeStyle;
        var oldAlpha = ctx.globalAlpha;
        var fcolor = "#" + p.color.toString(16);

        var curPoint = 0;
        var Points = path.points;
        var segmentMask = path.segmentMask;
        for (var i = 0; i < path.verbs.length; i++) {
            switch(path.verbs[i]) {
            case 0:
                ctx.moveTo(Points[2 * curPoint], Points[2 * curPoint + 1]);
                //                Log.v(TAG, "Move to (" + Points[2*curPoint] + ", " + Points[2*curPoint+1] + ")");
                curPoint++;
                break;
            case 1:
                // Line
                if ((segmentMask & 1) != 0) {
                    ctx.lineTo(Points[2 * curPoint], Points[2 * curPoint + 1]);
                    //                    Log.v(TAG, "Line to (" + Points[2*curPoint] + ", " + Points[2*curPoint+1] + ")");
                }
                curPoint++;
                break;
            case 2:
                // Quad
                if ((segmentMask & 2) != 0) {
                    ctx.quadraticCurveTo(Points[2 * curPoint], Points[2 * curPoint + 1], Points[2 * curPoint + 2], Points[2 * curPoint + 3]);
                    //                    Log.v(TAG, "Quad to (" + Points[2*curPoint] + ", " + Points[2*curPoint+1] + "),(" +
                    //                            Points[2*curPoint+2] + ", " + Points[2*curPoint+3] + ")");
                }
                curPoint += 2;
                break;
            case 3:
                // Cubic
                if ((segmentMask & 4) != 0) {
                    ctx.bezierCurveTo(Points[2 * curPoint], Points[2 * curPoint + 1], Points[2 * curPoint + 2], Points[2 * curPoint + 3], Points[2 * curPoint + 4], Points[2 * curPoint + 5]);
                    //                    Log.v(TAG, "Quad to (" + Points[2*curPoint] + ", " + Points[2*curPoint+1] + "),(" +
                    //                            Points[2*curPoint+2] + ", " + Points[2*curPoint+3] + "),(" +
                    //                            Points[2*curPoint+4] + ", " + Points[2*curPoint+5] + ")");
                }
                curPoint += 3;
                break;
            case 4:
                // Close
                //                Log.v(TAG, "Close");
                ctx.closePath();
                break;
            case 5:
                // Done
                break;
            default:
                Log.e(TAG, "Wrong verb type " + Verbs[i] + " of point " + i);
                break;
            }
        }

        if (grd == null) {
            ctx.fillStyle = fcolor;
            ctx.strokeStyle = fcolor;
        } else {
            ctx.fillStyle = grd;
            ctx.strokeStyle = grd;
        }

        ctx.globalAlpha = (p.alpha / 255);
        if (p.style == Style.FILL || p.style == Style.FILL_AND_STROKE) {
            if (path.FillType == Path.FillType.WINDING) {
                ctx.fill("nonzero");
            } else if (path.FillType == Path.FillType.EVEN_ODD) {
                ctx.fill("evenodd");
            } else {
                ctx.fill();
            }
        }
        if (p.style == Style.STROKE || p.style == Style.FILL_AND_STROKE) {
            ctx.stroke();
        }

        ctx.globalAlpha = oldAlpha;
        ctx.fillStyle = oldFillStyle;
        ctx.strokeStyle = oldStrokeStyle;

        ctx.restore();
        return true;
    };

    toggleSearch = function() {
        if (!reader.canReadBytes(1)) {
            return false;
        }
        var show = reader.readBoolean();
        //mContrtoller.showSearchButton(show);
        return true;
    };

    toggleMenu = function() {
        if (!reader.canReadBytes(1)) {
            return false;
        }
        var show = reader.readBoolean();
        //mContrtoller.showMenuButton(show);
        return true;
    };

    showSoftKeyboard = function(processId, wndId) {
        if (!reader.canReadBytes(1)) {
            return false;
        }
        var show = reader.readBoolean();
        Log.e(TAG, "showSoftKeyboard. processId=" + processId + ", wndId=" + wndId + ", show=" + show);

        // notify platform on keyboard state
        // check if need to pass currentProcessId instead
        NuboOutputStreamMgr.getInstance().sendCmd(UXIPself.nuboByte(PlayerCmd.setKeyboardState), processId, show);
        keyboardProcessID = processId;

        if (show) {
            Log.e(TAG,"open edVirtualKeyboard");
            $( window ).scroll(function() {
                console.log("$( window ).scrollTop(): "+$( window ).scrollTop());
            });
            $("#edVirtualKeyboard").css({top: lastTouchY, left: lastTouchX, position:'fixed'});
            var input = document.querySelector('#edVirtualKeyboard');
            var focus = function() {
                //e.stopPropagation();
                //e.preventDefault();
                /*var clone = input.cloneNode(true);
                var parent = input.parentElement;
                parent.appendChild(clone);
                parent.replaceChild(clone, input);
                input = clone;*/
                window.setTimeout(function() {
                    input.value = input.value || "";
                    console.log("input focus");
                    input.focus();
                    //var evObj = document.createEvent('Events');
                    //evObj.initEvent('click', true, false);
                    //input.dispatchEvent(evObj);
                }, 200);
            };
            focus();
            //document.getElementById("edVirtualKeyboard").focus();
            // check if need to pass currentProcessId instead
            NuboOutputStreamMgr.getInstance().sendCmd(UXIPself.nuboByte(PlayerCmd.setKeyboardHeight), processId, mHeight/2);
        } else {
            console.log("Hide soft keyboard");
            $("#edVirtualKeyboard").blur();
        }
        return true;
    };

    toast = function(processId, wndId) {
        var rsRet = reader.readCachedString(processId);
        if (!rsRet.canRead)
            return false;
        var textRes = rsRet.value;

        if (!reader.canReadBytes(4)) {
            return false;
        }
        var duration = reader.readInt();
        if (duration == 0) {
            new Android_Toast({
                content : '<em>' + textRes + '</em>',
                duration : 2000
            });
        } else if (duration == 1) {
            new Android_Toast({
                content : '<em>' + textRes + '</em>',
                duration : 3500
            });
        }
        return true;
    };

    setWallpaperByID = function() {
        if (!reader.canReadBytes(8)) {
            return false;
        }
        var type = reader.readInt();
        var res = reader.readInt();

        Log.v(TAG, "setWallpaperByID.  type=" + type + ", res=" + res);
        publicinterface.PlayerView.setWallpaper(type, res);
        return true;
    };

    ShowWindow = function(processId, wndId) {
        // Log.e(TAG, "Show window. wndId=" + wndId);
        wm.showWindow(processId, wndId);
        return true;
    };

    HideWindow = function(processId, wndId) {
        // Log.v(TAG, "Hide window. wndId: " + wndId + ", processId: " + processId);
        wm.hideWindow(processId, wndId);
        return true;
    };

    setWndId = function(processId, wndId) {
        if (!reader.canReadBytes(4)) {
            return false;
        }
        //console.log("setWndId. wndId=" + wndId);
        var nuboWndId = reader.readInt();

        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "setWndId. wndId=" + wndId + ", nuboWndId=" + nuboWndId);
        }

        wm.updateWndId(processId, wndId, nuboWndId);
        return true;
    };

    popWindow = function(processId, wndId) {
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "PopWindow. processId=" + processId + ", wndId=" + wndId);
        }

        var nuboWndId = wndId;
        if (!reader.canReadBytes(4))
            return false;
        nuboWndId = reader.readInt();

        var isWindowStackEmpty = wm.removeWindowFromStack(processId, nuboWndId);

        if (isWindowStackEmpty) {
            var lastProcessId = wm.getLastNotKeyboardProcessIdOnStack(keyboardProcessID);
            if (!isNaN(lastProcessId) && lastProcessId != 0) {
                currentProcessId = lastProcessId;
            } else {
                Log.e(TAG, "popWindow:: there is no last processId");
            }
        }
        return true;
    };

    PushWindow = function(processId, wndId) {
        if (!reader.canReadBytes(5)) {
            return false;
        }

        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "Push window. wndId=" + wndId + ", processId=" + processId);
        }

        var nuboWndId = reader.readInt();
        var containerType = reader.readByte();

        var activityOrDialog = (containerType == ContainerType.ACTIVITY || containerType == ContainerType.DIALOG);

        if (activityOrDialog) {//AsiM - keep last process id for keyboard
            if (processId != currentProcessId) {
                currentProcessId = processId;
            }
        }

        var x = 0, y = 0, gravity = 0, orientation = 0, inputMethodMode = 0;
        var onTopOfKeyboard = false;
        var taskIdAndPos = -1;
        var parentWndId = -1;

        //Bitmap b = null; //TBD
        if (containerType == ContainerType.POPUPWINDOW) {
            if (!reader.canReadBytes(21)) {
                return false;
            }
            gravity = reader.readInt();
            x = reader.readInt();
            y = reader.readInt();
            orientation = reader.readByte();
            inputMethodMode = reader.readInt();
            parentWndId = reader.readInt();
        } else if (containerType == ContainerType.ACTIVITY) {
            if (!reader.canReadBytes(5))
                return false;
            orientation = reader.readByte();
            taskIdAndPos = reader.readInt();
        } else {
            if (!reader.canReadBytes(6))
                return false;
            onTopOfKeyboard = reader.readByte();
            orientation = reader.readByte();
            taskIdAndPos = reader.readInt();
        }

        var sn = wm.pushWndOnStack(processId, wndId, nuboWndId, containerType, gravity, x, y, onTopOfKeyboard, orientation, inputMethodMode, taskIdAndPos, parentWndId);

        if (writeToDrawCmdLog) {
            Log.d(TAG, "PushWindow succeeded. processId=" + processId + ", wndId=" + wndId + ", nuboWndId=" + nuboWndId + ", containerType: " + containerType);
            drawCmdLog.nuboWndId = nuboWndId;
            drawCmdLog.containerType = containerType;
            drawCmdLog.gravity = gravity;
            drawCmdLog.x = x;
            drawCmdLog.y = y;
            drawCmdLog.orientation = orientation;
            drawCmdLog.taskIdAndPos = taskIdAndPos;
        }

        return true;
    };

    var isPrepareKeyboard = false;
    var oldInputText = "";

    prepKeyboardLayout = function(processId, wndId) {
        Log.e(TAG, "prepKeyboardLayout.");
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "prepKeyboardLayout. processId=" + processId + ", wndId=" + wndId);
        }
        if (!reader.canReadBytes(8))
            return false;
        var inputType = reader.readInt();
        var imeOptions = reader.readInt();
        var hint = reader.readCachedString(processId);
        if (!hint.canRead)
            return false;
        var actionLabel = reader.readCachedString(processId);
        if (!actionLabel.canRead)
            return false;
        // read but not used parameters in Android
        if (!reader.canReadBytes(3))
            return false;
        var nonAndroidInputType = reader.readByte();
        var nonAndroidInputAction = reader.readByte();
        var nonAndroidIsSuggestionOn = reader.readBoolean();

        var text = reader.readCachedString(processId);
        if (!text.canRead) {
            return false;
        }
        if (isMobile) {
            console.log("prepKeyboardLayout. text: "+text.value);
            $("#edVirtualKeyboard").val(text.value);
            $("#edVirtualKeyboard").setCursorPosition(text.value.length);
            oldInputText = text.value;
            if (oldInputText == null) {
                oldInputText = "";
            }
        }
        isPrepareKeyboard = true;
        return true;
    };

    readNotification = function(processId, wndId) {
        var rsRet = reader.readString();
        if (!rsRet.canRead)
            return false;
        var textRes = rsRet.value;

        var bitmapRet = reader.readBitmapCache(-2);
        if (!bitmapRet.canRead) {
            Log.e(TAG, "!bitmapRet.canRead");
            return false;
        }
        return true;

    };

    updateWallpaperOffset = function() {
        if (!reader.canReadBytes(4))
            return false;
        var offset = reader.readFloat();
        return true;
        //mContrtoller.setWallpaperOffset(-offset);
    };

    initPopupContentView = function(processId, wndId) {
        if (!reader.canReadBytes(16))
            return false;

        var onScreenX = reader.readInt();
        var onScreenY = reader.readInt();
        var decorHeight = reader.readInt();
        var decorWidth = reader.readInt();

        Log.e(TAG, "initPopupContentView. onScreenX=" + onScreenX + ", onScreenY=" + onScreenY + ", decorHeight=" + decorHeight + ", decorWidth=" + decorWidth);
        // platform doesn't clean popup's window.
        wm.clearPopupCanvas(processId, wndId, onScreenX, onScreenY);
        //wm.updateWinLocation(processId,wndId,onScreenX,onScreenY,decorWidth,decorHeight);
        return true;
    };

    updatePopWindow = function(processId, wndId) {
        if (!reader.canReadBytes(17))
            return false;
        var onScreenX = reader.readInt();
        var onScreenY = reader.readInt();
        var decorHeight = reader.readInt();
        var decorWidth = reader.readInt();
        var force = reader.readBoolean();
        Log.e(TAG, "updatePopWindow. onScreenX=" + onScreenX + ", onScreenY=" + onScreenY + ", decorHeight=" + decorHeight + ", decorWidth=" + decorWidth + ", force:" + force);
        //wm.updateWinLocation(processId,wndId,onScreenX,onScreenY,decorWidth,decorHeight);
        return true;
    };

    removeProcess = function(processId, keyEvent) {
        Log.e(TAG, "removeProcess. processId=" + processId + ", keyEvent=" + keyEvent);
        wm.removeProcess(processId);
        var lastProcessId = wm.getLastNotKeyboardProcessIdOnStack(keyboardProcessID);
        if (!isNaN(lastProcessId) && lastProcessId != 0) {
            currentProcessId = lastProcessId;
        } else {
            Log.e(TAG, "removeProcess:: there is no last processId");
        }
        return true;
    };

    dispatchKeyEvent = function(processId, keyEvent) {
        Log.e(TAG, "dispatchKeyEvent. processId=" + processId + ", keyEvent=" + keyEvent + ", protocolState: " + protocolState);
        if (protocolState != psConnected)
            return;
        NuboOutputStreamMgr.getInstance().sendCmd(keyEvent, processId);
    };

    publicinterface.close = function() {
        ws.close();
    };
    publicinterface.clickHome = function() {
    	console.log("clickHome.");
        if (protocolState != psConnected)
            return;
        dispatchKeyEvent(currentProcessId, UXIPself.nuboByte(PlayerCmd.homeKeyEvent));

        // hide all window except launcher
        for (var i = 0; i < mPackageNameList.length; i++) {
            if (mPackageNameList[i].packName != "com.nubo.launcher") {
                var ws = wm.getWindow(mPackageNameList[i].processId, 0);
                if (ws != null) {
                    console.log("clickHome. wndId: " + ws.wndId);
                    HideWindow(mPackageNameList[i].processId, ws.wndId);
                }
            }
        }
    };

    publicinterface.clickSearch = function() {
        console.log("clickSearch.");
        if (protocolState != psConnected)
            return;
        dispatchKeyEvent(currentProcessId, UXIPself.nuboByte(PlayerCmd.searchKeyEvent));
    };

	publicinterface.clickMobileBack = function() {
        console.log("clickMobileBack.");
        
        if (protocolState != psConnected)
            return;
            
        var sn = wm.getWindow(currentProcessId, 0);
        if (sn == null)
            return;
            
        handleKeyEvent(currentProcessId, sn.wndId, {
            name : "KeyEvent",
            action : KeyEvent.ACTION_DOWN,
            keyCode : KeyEvent.KEYCODE_BACK
        });
        
        //new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK));
        handleKeyEvent(currentProcessId, sn.wndId, {
            name : "KeyEvent",
            action : KeyEvent.ACTION_UP,
            keyCode : KeyEvent.KEYCODE_BACK
        });
    };

    this.clickBack = function() {
        console.log("clickBack.");
        if (protocolState != psConnected)
            return;
        var sn = wm.getWindow(currentProcessId, 0);
        if (sn == null)
            return;
        handleKeyEvent(currentProcessId, sn.wndId, {
            name : "KeyEvent",
            action : KeyEvent.ACTION_DOWN,
            keyCode : KeyEvent.KEYCODE_BACK
        });
        //new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK));
        handleKeyEvent(currentProcessId, sn.wndId, {
            name : "KeyEvent",
            action : KeyEvent.ACTION_UP,
            keyCode : KeyEvent.KEYCODE_BACK
        });
        // new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK));
    };
    publicinterface.virtualKeyboardEvent = function(e) {
        var evtobj = e || event;
        if (protocolState != psConnected)
            return;
        var sn = wm.getWindow(currentProcessId, 0);
        if (sn == null)
            return;
        //console.log("key event from virtual keyboard");
        //console.log(evtobj);
        var retCode = uxipObj.keyEvent(evtobj, currentProcessId, sn.wndId, this);
        return retCode;
    };

    publicinterface.clickSettings = function() {
        if (protocolState != psConnected)
            return;
        var sn = wm.getWindow(currentProcessId, 0);
        if (sn == null)
            return;
        handleKeyEvent(currentProcessId, sn.wndId, {
            name : "KeyEvent",
            action : KeyEvent.ACTION_DOWN,
            keyCode : KeyEvent.KEYCODE_MENU
        });
        handleKeyEvent(currentProcessId, sn.wndId, {
            name : "KeyEvent",
            action : KeyEvent.ACTION_UP,
            keyCode : KeyEvent.KEYCODE_MENU
        });
    };

    handleKeyEvent = function(processId, wndId, event) {
        Log.e(TAG, "handleKeyEvent. processId=" + processId + ", wndId=" + wndId);
        if (protocolState != psConnected)
            return;

        NuboOutputStreamMgr.getInstance().sendCmd(UXIPself.nuboByte(PlayerCmd.keyEvent), processId ,wndId ,event);
    };

    if (START_ROUND_TRIP_CHECK && !mPlaybackMode) {
        var startRoundTrip = setInterval(function() {
            sendRoundTripDataCommand(currentProcessId, -1);
        }, 1000);
    }

    sendRoundTripDataCommand = function(processId, wndId) {
        if (protocolState != psConnected)
            return;

        var time = new Date().getTime();

        var diff = time - lastDataTime;
        if (diff > SOCKET_READ_TIMEOUT) {
            Log.e(TAG + " SOCKET_READ_TIMEOUT");
            errorAndClose();
            return;
        }

        NuboOutputStreamMgr.getInstance().sendCmd(UXIPself.nuboByte(PlayerCmd.roundTripData), processId, wndId, getNuboLongAsFloat(time));
    };

    function getNuboLongAsFloat(nuboLongAsFloat) {
        var nuboLaF = {
            name : "nuboLongAsFloat",
            val : nuboLongAsFloat
        };
        return nuboLaF;
    }

    function getNuboFloat(nuboFloat) {
        var nuboF = {
            name : "nuboFloat",
            val : nuboFloat
        };
        return nuboF;
    }

    this.nuboByte = function(nuboByte) {
        var nuboB = {
                name : "nuboByte",
                val : nuboByte
        };
        return nuboB;
    }

    roundTripDataAck = function() {
        var sendTimeLong = reader.readLongAsFloat();
        var currentTime = new Date().getTime();
        var timeDiff = currentTime - sendTimeLong;
        if (!mPlaybackMode && timeDiff > RTT_THRESHOLD_TO_CLOSE_SOCKET) {
            mBadRTTCounter++;
            if (mBadRTTCounter >= MAX_BAD_RTT_SEQUENCE) {
                Log.e(TAG, "BAD RoundTripData, " + mBadRTTCounter + " times of RTT > " + RTT_THRESHOLD_TO_CLOSE_SOCKET);
                mBadRTTCounter = 0;
                //AsiM - TODO: check if I need to restart after closing sockets
                errorAndClose();
            }
        } else {
            mBadRTTCounter = 0;
        }
        // OPTIONAL: can add debug connection colors here
        return true;
    };

    updateScreenOrientation = function() {
        if (!reader.canReadBytes(1)) {
            return false;
        }
        var screenOrientation = reader.readByte();
        if (writeToDrawCmdLog) {
            drawCmdLog.orientation = screenOrientation;
        }

        return true;
    };

    clearProcessCacheAck = function(processId) {
        nuboCache.clearAckedProcessCache(processId);

        return true;
    };

    setPackageName = function(processId) {
        var rsRet = reader.readCachedString(processId);
        if (!rsRet.canRead)
            return false;

        var packName = (rsRet.value == null) ? "" : rsRet.value;
        // console.log("****setPackageName.  processId: " + processId + ", packName: " + packName);
        if (packName.length > 0) {
            var line = {processId: processId, packName:packName};
            mPackageNameList.push(line);
        };

        return true;
    };

    prepareViewCache = function(processId, wndId) {
        var bitmapRet = reader.readBitmapCache(processId);
        if (!bitmapRet.canRead) {
            return false;
        }

        if (bitmapRet.retVal == NuboStatus.FAIL) {
            Log.e(TAG, "prepareViewCache: bitmap could not be retrieved");
        }

        return true;
    };

    sendKeyboardExtractedText = function(processId, wndId) {
        var rsRet = reader.readCachedString(processId);
        if (!rsRet.canRead)
            return false;
        lastExtractedText = (rsRet.value == null) ? "" : rsRet.value;
        return true;
    };

    resizeWindow = function(processId, wndId) {
        if (!reader.canReadBytes(1)) {
            return false;
        }
        var orientation = reader.readByte();
        Log.e(TAG, "resizeWindow. Should have rotated window");
        var sn = wm.getWindow(processId, wndId);
        if (sn == null) {
            Log.e(TAG, "resizeWindow. processId = " + processId + " dosent exist im wm");
            return true;
        }
        var containerType = sn.containerType;
        var activityOrDialog = (containerType == ContainerType.ACTIVITY || containerType == ContainerType.DIALOG);

        if (activityOrDialog) {//AsiM - keep last process id for keyboard
            if (processId != currentProcessId) {
                //wm.hideProcess(currentProcessId);
                currentProcessId = processId;
            }
        }

        return true;
    };

    outgoingCall = function(processId, wndId) {
        var action = reader.readCachedString(processId);
        var number = reader.readCachedString(processId);
        // there is no implementation for tablets that have no phone
        return true;
    };

    setTopTask = function() {
        if (!reader.canReadBytes(4)) {
            return false;
        }
        var taskId = reader.readInt();
        if (PRINT_DRAW_COMMANDS) {
            Log.d(TAG, "setTopTask. taskId = " + taskId);
        }
        wm.moveTaskToTop(taskId);
        return true;
    };

    setWindowPos = function(processId, wndId) {
        if (!reader.canReadBytes(4)) {
            return false;
        }
        var newTaskAndPos = reader.readInt();
        wm.updateWndTaskPos(processId, wndId, newTaskAndPos);
        return true;
    };

    // return constructor(ctx, canvasObj,width,height); // Return the public API interface
    return publicinterface;
}// End of RFB()

var RomClientType = {
    // main types
    ANDROID : 0,
    IOS : 1,
    WEB  : 2,
    // Client ROM support for images
    ROM_IMAGES_WEBP  : 0x00000000,
    ROM_IMAGES_PNG   : 0x00000100,
    ROM_IMAGES_JPG   : 0x00000200,
    ROM_IMAGES_MASK  : 0x00000F00,
    // Client ROM support for hardware keyboard
    ROM_HW_KEYBOARD_NONE   : 0x00000000,
    ROM_HW_KEYBOARD_EXISTS : 0x00001000
};

function Consts() {
}

Consts.TEMP_WINDOW_ID = 12345;

function Log() {
}

Log.v = function(tag, msg) {
    console.log("[" + tag + "] " + msg);
};
Log.e = function(tag, msg) {
    console.error("[" + tag + "] " + msg);
};
Log.d = function(tag, msg) {
    console.info("[" + tag + "] " + msg);
};

function ContainerType() {
};
ContainerType.ACTIVITY = 0x01;
ContainerType.DIALOG = 0x02;
ContainerType.POPUPWINDOW = 0x04;
ContainerType.DEFAULT = 0x08;
//Default is for all else

function PlayerCmd() {
}

PlayerCmd.sync = -1;
PlayerCmd.touchEvent = 1;
PlayerCmd.keyEvent = 2;
PlayerCmd.playerLogin = 3;
PlayerCmd.playerDisconnected = 4;
PlayerCmd.switchUser = 5;
PlayerCmd.setKeyboardHeight = 6;
PlayerCmd.platformProcessConnected = 7;
PlayerCmd.setKeyboardState = 8;
PlayerCmd.clearProcessCache = 14;
PlayerCmd.roundTripData = 17;
//igor commands
PlayerCmd.homeKeyEvent = 20;
PlayerCmd.notificationCancel = 21;
PlayerCmd.searchKeyEvent = 22;
PlayerCmd.notificationOpen = 23;
PlayerCmd.requestState = 24;

function drawCmdCodeToText(code) {
    for (var property in DrawCmd) {
        var value = DrawCmd[property];
        if (value == code)
            return property;
    }
    return code;
}

function DrawCmd() {
}

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

DrawCmd.toast = 83;

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

//drawBitmapType
function DrawBitmapType() {
}

DrawBitmapType.stdBitmap = 0;
DrawBitmapType.ninePatch = 1;
DrawBitmapType.webView = 2;
DrawBitmapType.drawBitmapMatrix = 3;
DrawBitmapType.bitmapShader = 4;

function NuboStatus() {
}

//return status
NuboStatus.OK = 0;
NuboStatus.FAIL = -1;

function BitmapSendRcvType() {
}

BitmapSendRcvType.fullBitmap = 1;
BitmapSendRcvType.cachedBitmap = 2;
BitmapSendRcvType.resourceBitmap = 3;
BitmapSendRcvType.assetBitmap = 4;

function PathSendRcvType() {
}

PathSendRcvType.fullPath = 1;
PathSendRcvType.cachedPath = 2;
// Path constants
function Path() {
}

Path.FillType = {
    WINDING : 0,
    EVEN_ODD : 1,
    INVERSE_WINDING : 2,
    INVERSE_EVEN_ODD : 3
};

function FloatArrSendRcvType() {
}

FloatArrSendRcvType.fullArray = 1;
FloatArrSendRcvType.cachedArray = 2;

function Typeface() {
}

Typeface.BOLD = 1;
Typeface.BOLD_ITALIC = 3;
Typeface.ITALIC = 2;
Typeface.NORMAL = 0;

function Style() {
}

Style.FILL = 0;
Style.STROKE = 1;
Style.FILL_AND_STROKE = 2;

function Cap() {
}

Cap.BUTT = 0;
Cap.ROUND = 1;
Cap.SQUARE = 2;

function Join() {
}

Join.MITER = 0;
Join.ROUND = 1;
Join.BEVEL = 2;

function Align() {
}

Align.LEFT = 0;
Align.CENTER = 1;
Align.RIGHT = 2;

function Paint() {
}

/** bit mask for the flag enabling antialiasing */
Paint.ANTI_ALIAS_FLAG = 0x01;
/** bit mask for the flag enabling bitmap filtering */
Paint.FILTER_BITMAP_FLAG = 0x02;
/** bit mask for the flag enabling dithering */
Paint.DITHER_FLAG = 0x04;
/** bit mask for the flag enabling underline text */
Paint.UNDERLINE_TEXT_FLAG = 0x08;
/** bit mask for the flag enabling strike-thru text */
Paint.STRIKE_THRU_TEXT_FLAG = 0x10;
/** bit mask for the flag enabling fake-bold text */
Paint.FAKE_BOLD_TEXT_FLAG = 0x20;
/** bit mask for the flag enabling linear-text (no caching) */
Paint.LINEAR_TEXT_FLAG = 0x40;
/** bit mask for the flag enabling subpixel-text */
Paint.SUBPIXEL_TEXT_FLAG = 0x80;
/** bit mask for the flag enabling device kerning for text */
Paint.DEV_KERN_TEXT_FLAG = 0x100;

function KeyEvent() {
}

KeyEvent.ACTION_DOWN = 0;
KeyEvent.ACTION_UP = 1;
KeyEvent.ACTION_MULTIPLE = 2;
KeyEvent.SOURCE_KEYBOARD = 257;
KeyEvent.KEYCODE_HOME = 3;
KeyEvent.KEYCODE_BACK = 4;
KeyEvent.KEYCODE_MENU = 82;
KeyEvent.KEYCODE_UNKNOWN = 0;
KeyEvent.KEYCODE_DEL = 0x00000043;
KeyEvent.KEYCODE_FORWARD_DEL = 112;   
KeyEvent.KEYCODE_ENTER = 0x00000042;
/** Key code constant: F1 key. */
KeyEvent.KEYCODE_F1 = 131;
/** Key code constant: F2 key. */
KeyEvent.KEYCODE_F2 = 132;
/** Key code constant: F3 key. */
KeyEvent.KEYCODE_F3 = 133;
/** Key code constant: F4 key. */
KeyEvent.KEYCODE_F4 = 134;
/** Key code constant: F5 key. */
KeyEvent.KEYCODE_F5 = 135;
/** Key code constant: F6 key. */
KeyEvent.KEYCODE_F6 = 136;
/** Key code constant: F7 key. */
KeyEvent.KEYCODE_F7 = 137;
/** Key code constant: F8 key. */
KeyEvent.KEYCODE_F8 = 138;
/** Key code constant: F9 key. */
KeyEvent.KEYCODE_F9 = 139;
/** Key code constant: F10 key. */
KeyEvent.KEYCODE_F10 = 140;
/** Key code constant: F11 key. */
KeyEvent.KEYCODE_F11 = 141;
/** Key code constant: F12 key. */
KeyEvent.KEYCODE_F12 = 142;
/** Key code constant: Num Lock key.
 * This is the Num Lock key; it is different from {@link #KEYCODE_NUM}.
 * This key alters the behavior of other keys on the numeric keypad. */
KeyEvent.KEYCODE_NUM_LOCK = 143;
/** Key code constant: Home Movement key.
 * Used for scrolling or moving the cursor around to the start of a line
 * or to the top of a list. */
KeyEvent.KEYCODE_MOVE_HOME = 122;
/** Key code constant: End Movement key.
 * Used for scrolling or moving the cursor around to the end of a line
 * or to the bottom of a list. */
KeyEvent.KEYCODE_MOVE_END = 123;
/** Key code constant: Left Control modifier key. */
KeyEvent.KEYCODE_CTRL_LEFT = 113;
/** Key code constant: Right Control modifier key. */
KeyEvent.KEYCODE_CTRL_RIGHT = 114;
/** Key code constant: Escape key. */
KeyEvent.KEYCODE_ESCAPE = 111;
/** Key code constant: Page Up key. */
KeyEvent.KEYCODE_PAGE_UP = 92;
/** Key code constant: Page Down key. */
KeyEvent.KEYCODE_PAGE_DOWN = 93;
/** Key code constant: Directional Pad Up key.
 * May also be synthesized from trackball motions. */
KeyEvent.KEYCODE_DPAD_UP = 19;
/** Key code constant: Directional Pad Down key.
 * May also be synthesized from trackball motions. */
KeyEvent.KEYCODE_DPAD_DOWN = 20;
/** Key code constant: Directional Pad Left key.
 * May also be synthesized from trackball motions. */
KeyEvent.KEYCODE_DPAD_LEFT = 21;
/** Key code constant: Directional Pad Right key.
 * May also be synthesized from trackball motions. */
KeyEvent.KEYCODE_DPAD_RIGHT = 22;
/** Key code constant: Left Alt modifier key. */
KeyEvent.KEYCODE_ALT_LEFT = 57;
/** Key code constant: Right Alt modifier key. */
KeyEvent.KEYCODE_ALT_RIGHT = 58;
/** Key code constant: Left Shift modifier key. */
KeyEvent.KEYCODE_SHIFT_LEFT = 59;
/** Key code constant: Right Shift modifier key. */
KeyEvent.KEYCODE_SHIFT_RIGHT = 60;
/** Key code constant: Tab key. */
KeyEvent.KEYCODE_TAB = 61;
/** Key code constant: Start Button key.
 * On a game controller, the button labeled Start. */
KeyEvent.KEYCODE_BUTTON_START = 108;
// Key code constant: Space key.
KeyEvent.KEYCODE_SPACE = 62;

function Res_png_9patch() {
}

Res_png_9patch.NO_COLOR = 1;
Res_png_9patch.TRANSPARENT_COLOR = 0;

function CacheDataType() {
}

CacheDataType.bitmap = 1;
CacheDataType.ninepatchBitmap = 2;
CacheDataType.ninepatchChunk = 3;

function ShaderType() {
}

ShaderType.LinearGradient = 1;
ShaderType.BitmapShader = 2;
ShaderType.RadialGradient = 3;

UXIPExport = {
    UXIP : UXIP,
    Paint : Paint,
    Style : Style,
    Cap : Cap,
    Join : Join,
    Align : Align,
    Typeface : Typeface,
    DrawCmd : DrawCmd,
    KeyEvent : KeyEvent,
    PlayerCmd : PlayerCmd,
    FloatArrSendRcvType : FloatArrSendRcvType
};

if ( typeof module != 'undefined') {
    module.exports = UXIPExport;
    UTF8 = require('./utf8.js').UTF8;
    NuboCache = require('./nubocache.js').NuboCache;
}

new function($) {
  $.fn.setCursorPosition = function(pos) {
    if (this.setSelectionRange) {
      this.setSelectionRange(pos, pos);
    } else if (this.createTextRange) {
      var range = this.createTextRange();
      range.collapse(true);
      if(pos < 0) {
        pos = $(this).val().length + pos;
      }
      range.moveEnd('character', pos);
      range.moveStart('character', pos);
      range.select();
    }
  };
}(jQuery);
/*
 Res_png_9patch

 struct Res_png_9patch
 {
 Res_png_9patch() : wasDeserialized(false), xDivs(NULL),
 yDivs(NULL), colors(NULL) { }

 int8_t wasDeserialized;
 int8_t numXDivs;
 int8_t numYDivs;
 int8_t numColors;

 // These tell where the next section of a patch starts.
 // For example, the first patch includes the pixels from
 // 0 to xDivs[0]-1 and the second patch includes the pixels
 // from xDivs[0] to xDivs[1]-1.
 // Note: allocation/free of these pointers is left to the caller.
 int32_t* xDivs;
 int32_t* yDivs;

 int32_t paddingLeft, paddingRight;
 int32_t paddingTop, paddingBottom;

 enum {
 // The 9 patch segment is not a solid color.
 NO_COLOR = 0x00000001,

 // The 9 patch segment is completely transparent.
 TRANSPARENT_COLOR = 0x00000000
 };
 // Note: allocation/free of this pointer is left to the caller.
 uint32_t* colors;

 // Convert data from device representation to PNG file representation.
 void deviceToFile();
 // Convert data from PNG file representation to device representation.
 void fileToDevice();
 // Serialize/Marshall the patch data into a newly malloc-ed block
 void* serialize();
 // Serialize/Marshall the patch data
 void serialize(void* outData);
 // Deserialize/Unmarshall the patch data
 static Res_png_9patch* deserialize(const void* data);
 // Compute the size of the serialized data structure
 size_t serializedSize();
 };

 */

