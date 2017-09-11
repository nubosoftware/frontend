function WindowManager(parentNodePrm, widthPrm, heightPrm, uxip, session, mgmtURL) {
    "use strict";

    // private variables
    var parentNode, mWidth, mHeight, mUxip, currLocationHash;

    var wm = this;

    var mMaxZIndex = 0,
        TAG = 'wm';

    //private funcs
    var fFindWndByWndId, fFindWndByNuboWndId, fRemoveWindowStack, fSetCSS;

    var mWindowsStackManager = {};
    var taskManager = new TaskManager(uxip);

    var surfaceManager = {};
    var mediaManager = {};
    var mediaCurrHash = null;


    fFindWndByWndId = function(ws, wndId) {
        // console.log("**** fFindWndByWndId. wndId: " + wndId + ", ws.length: " + ws.length);
        for (var i = ws.length - 1; i >= 0; i--) {
            if (ws[i].wndId == wndId || ws[i].nuboWndId == wndId || wndId == 0)
                return i;
        }
        return -1;
    };

    fFindWndByNuboWndId = function(ws, nuboWndId) {
        for (var i = ws.length - 1; i >= 0; i--) {
            if (ws[i].nuboWndId == nuboWndId)
                return i;
        }
        return -1;
    };

    this.clearPopupCanvas = function(processId, wndId, x, y, width, height) {
        var sn = this.getWindow(processId, wndId);
        if (sn.ctx == null) {
            Log.e(TAG, "clearPopupCanvas: no popup window");
            return;
        }
        if (sn.popup_x == null) {
            sn.popup_x = x;
            sn.popup_y = y;
            sn.popup_w = width;
            sn.popup_h = height;
            return;
        }
        // clean popup's canvas only if popup is on different position onscreen.
        if (sn.popup_x != x || sn.popup_y != y || sn.popup_w != width || sn.popup_h != height) {
            sn.popup_x = x;
            sn.popup_y = y;
            sn.popup_w = width;
            sn.popup_h = height;
            sn.ctx.clearRect(0, 0, sn.canvas.width, sn.canvas.height);
        }
    };

    this.getWindow = function(processId, wndId) {
        var processIDHash = processId.toString(16);
        var ws = mWindowsStackManager[processIDHash];
        if (ws == null) { //  process not found
            Log.e(TAG, "Process not found in window manager: " + processId);
            return null;
        }
        var idx = fFindWndByWndId(ws, wndId);
        if (idx < 0) {
            Log.e(TAG, "Wnd not found in window manager: " + wndId);
            return null;
        }
        return ws[idx];
    };

    this.hideWindow = function(processId, wndId) {
        var sn = this.getWindow(processId, wndId);
        if (sn != null) {
            sn.visible = false;
            fSetCSS(sn);
        }

    };

    this.showWindow = function(processId, wndId) {
        var sn = this.getWindow(processId, wndId);
        if (sn != null) {
            sn.visible = true;
            // AsiM new window management TODO: track if change is good
            // mMaxZIndex++;
            // sn.zindex = mMaxZIndex;
            fSetCSS(sn);
        }

    };

    this.updateWndId = function(processId, wndId, nuboWndId) {
        var processIDHash = processId.toString(16);
        var ws = mWindowsStackManager[processIDHash];
        if (ws == null) { //  process not found
            Log.e(TAG, "Process not found in window manager: " + processId);
            return;
        }
        var idx = fFindWndByNuboWndId(ws, nuboWndId);
        if (idx < 0) {
            Log.e(TAG, "Wnd not found in window manager: " + nuboWndId);
            return;
        }
        ws[idx].wndId = wndId;
    };

    this.removeWindowFromStack = function(processId, nuboWndId) {
        var processIDHash = processId.toString(16);

        var ws = mWindowsStackManager[processIDHash];
        if (ws == null) { //  process not found
            Log.e(TAG, "Process not found in window manager: " + processId);
            return;
        }
        var idx = fFindWndByNuboWndId(ws, nuboWndId);
        if (idx < 0) {
            Log.e(TAG, "Wnd not found in window manager: " + nuboWndId);
            return;
        }
        var sn = ws[idx];
        sn.visible = false;
        fSetCSS(sn);
        //remove the node from the stack
        ws.splice(idx, 1);
        // remove node from task list
        taskManager.removeWndFromTask(sn);

        parentNode.removeChild(sn.panel);

        // return if window stack is empty
        return ws.length == 0;
    };

    this.writeTransaction = function(processId, wndId) {
        var sn = this.getWindow(processId, wndId);
        if (sn != null) {
            if (sn.dirtyCanvas == null) {
                Log.e("writeTransaction: Missing dirtyCanvas");
                return;
            }
            var dirtyW = sn.dirtyRect.right - sn.dirtyRect.left;
            var dirtyH = sn.dirtyRect.bottom - sn.dirtyRect.top;
            // copy dirty canvas to real canvas
            var imgData = sn.dirtyCtx.getImageData(sn.dirtyRect.left, sn.dirtyRect.top, dirtyW, dirtyH);
            sn.ctx.putImageData(imgData, sn.dirtyRect.left, sn.dirtyRect.top);
            fSetCSS(sn);
        } else {
            Log.e("writeTransaction: Window not found: " + processId + "," + wndId);
        }
    };

    this.setDirtyRect = function(processId, wndId, rect) {
        var sn = this.getWindow(processId, wndId);
        if (sn != null) {
            // create a new dirty canvas to buffer the draws
            sn.dirtyCanvas = document.createElement('canvas');
            sn.dirtyCanvas.setAttribute('width', mWidth);
            sn.dirtyCanvas.setAttribute('height', mHeight);
            sn.dirtyCtx = sn.dirtyCanvas.getContext("2d");
            sn.saveLayers = new Array();

            // copy original canvas to dirty canvas
            var imgData = sn.ctx.getImageData(0, 0, mWidth, mHeight);
            sn.dirtyCtx.putImageData(imgData, 0, 0);
            // AsiM - not sure if i need a save here
            // sn.dirtyCtx.save();

            //remeber dirty rect for future write transactoin
            sn.dirtyRect = rect;

        } else {
            Log.e("setDirtyRect: Window not found: " + processId + "," + wndId);
        }
    };

    this.saveLayerAlpha = function(processId, wndId, alpha) {
        var sn = this.getWindow(processId, wndId);
        if (sn != null) {

            var newCanvas = document.createElement('canvas');
            newCanvas.setAttribute('width', mWidth);
            newCanvas.setAttribute('height', mHeight);
            var newCtx = newCanvas.getContext("2d");

            sn.saveLayers.push(sn.dirtyCanvas);
            sn.dirtyCanvas = newCanvas;
            sn.dirtyCtx = newCtx;
            //sn.dirtyCtx.globalAlpha=(alpha/255);
            // AsiM - not sure if i need a save here
            // sn.dirtyCtx.save();
            sn.dirtyCanvas.savedAlpha = (alpha / 255);

        } else {
            Log.e("saveLayerAlpha: Window not found: " + processId + "," + wndId);
        }
    };

    this.restoreLayer = function(processId, wndId) {
        var sn = this.getWindow(processId, wndId);
        if (sn != null) {
            if (sn.saveLayers.length < 1) {
                Log.e("restoreLayer: saved layers not found.");
                return;
            }

            var oldCanvas = sn.saveLayers.pop();
            var oldCtx = oldCanvas.getContext("2d");
            var saveAlpha = oldCtx.globalAlpha;
            oldCtx.globalAlpha = sn.dirtyCanvas.savedAlpha;
            // oldCtx.restore();
            oldCtx.drawImage(sn.dirtyCanvas, 0, 0);
            oldCtx.globalAlpha = saveAlpha;

            sn.dirtyCanvas = oldCanvas;
            sn.dirtyCtx = oldCtx;
            // AsiM - creating a third canvas with both images
            // var newCanvas = document.createElement('canvas');
            // newCanvas.setAttribute('width', mWidth);
            // newCanvas.setAttribute('height', mHeight);
            // var newCtx = newCanvas.getContext("2d");
            // newCtx.drawImage(sn.dirtyCanvas, 0, 0);
            // newCtx.drawImage(oldCanvas, 0, 0);
            // sn.dirtyCanvas = newCanvas;
            // sn.dirtyCtx = newCtx;
            // oldCtx.save();

            // Canvas2Image.saveAsPNG(newCanvas);
        } else {
            Log.e("restoreLayer: Window not found: " + processId + "," + wndId);
        }
    };

    this.hideProcess = function(processId) {
        if (processId == null)
            return;
        var processIDHash = processId.toString(16);
        var ws = mWindowsStackManager[processIDHash];
        if (ws != null) {
            for (var i = 0; i < ws.length; i++) {
                var sn = ws[i];
                $("#" + sn.panel.id).hide();
                ("#" + sn.panel.id).hide();
            }
        }
    };

    this.updateWinLocation = function(processId, wndId, onScreenX, onScreenY, decorWidth, decorHeight) {
        var sn = this.getWindow(processId, wndId);
        if (sn != null) {
            sn.x = onScreenX;
            sn.y = onScreenY;
            sn.width = decorWidth;
            sn.height = decorHeight;
            sn.panel.setAttribute('width', sn.width);
            sn.panel.setAttribute('height', sn.height);
            sn.canvas.setAttribute('width', sn.width);
            sn.canvas.setAttribute('height', sn.height);
            fSetCSS(sn);
        }
    };

    fSetCSS = function(sn) {
        var cssObj = {
            'position': 'absolute',
            'visibility': (sn.visible ? 'visible' : 'hidden'),
            'left': sn.x + 'px',
            'top': sn.y + 'px',
            'width': sn.width + 'px',
            'height': sn.height + 'px',
            'z-index': sn.zindex
        };

        $("#" + sn.panel.id).css(cssObj);
    };

    this.moveTaskToTop = function(taskId) {
        taskManager.setLastTopTaskId(taskId);
        var task = taskManager.moveTaskToTop(taskId);
        if (task == null) {
            return;
        }
        for (var j = 0; j < task.length; j++) {
            mMaxZIndex++;
            task[j].zindex = mMaxZIndex;
            fSetCSS(task[j]);
        }
    };

    this.updateWndTaskPos = function(processId, wndId, taskAndPos) {
        var sn = this.getWindow(processId, wndId);
        sn.taskId = taskManager.getTaskId(taskAndPos);
        sn.posInTask = taskManager.getPosInTask(taskAndPos);
    };

    this.pushWndOnStack = function(processId, wndId, nuboWndId, containerType, gravity, x, y, onTopOfKeyboard, orientation, inputMethodMode, taskIdAndPos, parentWndId) {
        var processIDHash = processId.toString(16);
        var wndIdIDHash = wndId.toString(16);
        var ws = mWindowsStackManager[processIDHash];
        if (ws == null) { // new process
            ws = new Array();
            mWindowsStackManager[processIDHash] = ws;
        }
        var sn = {};
        sn.panel = document.createElement('span');

        sn.canvas = document.createElement('canvas');
        sn.x = 0;
        sn.y = 0;
        sn.width = mWidth;
        sn.height = mHeight;
        sn.visible = false;

        sn.panel.setAttribute('width', sn.width);
        sn.panel.setAttribute('height', sn.height);
        sn.panel.id = "p_" + processIDHash + '_' + wndIdIDHash;

        sn.canvas.setAttribute('width', sn.width);
        sn.canvas.setAttribute('height', sn.height);
        sn.canvas.id = "c_" + processIDHash + '_' + wndIdIDHash;
        sn.ctx = sn.canvas.getContext("2d");
        // AsiM - not sure that I need the save() here
        // sn.ctx.save();
        sn.wndId = wndId;
        sn.nuboWndId = nuboWndId;
        sn.processId = processId;
        console.log("**** pushWndOnStack. sn.processId: " + sn.processId);

        sn.gravity = gravity;
        sn.containerType = containerType;
        sn.onTopOfKeyboard = onTopOfKeyboard;
        sn.orientation = orientation;
        sn.inputMethodMode = inputMethodMode;

        var lastMouseDownTouchTime = null;

        sn.mouseEvent = function(e) {
            // trigger mouse up / down event
            var evtobj = e || event;
            evtobj.name = "MouseEvent";
            evtobj.src = this;

            if (evtobj.type == "mouseup") {
                lastMouseDownTouchTime = null;
            } else if (evtobj.type == "mousedown") {
                lastMouseDownTouchTime = new Date().getTime();
            }

            evtobj.lastMouseDownTouchTime = lastMouseDownTouchTime;
            NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.touchEvent), sn.processId, sn.wndId, evtobj);
        };
        sn.mousemove = function(e) {
            // trigger mouse move event
            var evtobj = e || event;
            evtobj.name = "MouseEvent";
            evtobj.src = this;
            evtobj.preventDefault();

            if (lastMouseDownTouchTime) {
                evtobj.lastMouseDownTouchTime = lastMouseDownTouchTime;
                NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.touchEvent), sn.processId, sn.wndId, evtobj);
            }
        };

        sn.keyEvent = function(e) {
            var evtobj = e || event;
            var msgstr = "key event evtobj.type: " + evtobj.type + ", keyCode: " + evtobj.keyCode;
            console.log(msgstr);
            // new Android_Toast({
            //     content: '<em>' + msgstr + '</em>',
            //     duration: 3500
            // });
            mUxip.keyEvent(evtobj, sn.processId, sn.wndId, this);
        };

        var wheeling;
        var lastEvtobj;

        sn.mouseWheelEvent = function(e) {
            var evtobj = e || event;
            if (evtobj.type == "mousewheel" || evtobj.type == "DOMMouseScroll") {
                var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

                // up: delta > 0; down: delta < 0
                if (delta == 0) {
                    return;
                }
                lastEvtobj = evtobj;
                evtobj.action = 2;
                if (!wheeling) { // start wheeling
                    evtobj.action = 0;
                }

                clearTimeout(wheeling);
                wheeling = setTimeout(function() { // stop wheeling
                    wheeling = undefined;
                    evtobj.action = 2;
                    NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.touchEvent), sn.processId, sn.wndId, evtobj);

                    lastEvtobj.name = "MouseWheel";   //lastEvtobj.type == "mousewheel"
                    lastEvtobj.action = 1;
                    NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.touchEvent), sn.processId, sn.wndId, lastEvtobj);
                    lastEvtobj = null;
                }, 250);

                evtobj.name = "MouseWheel";
                evtobj.src = this;
                evtobj.preventDefault();
                evtobj.delta = delta;
                NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.touchEvent), sn.processId, sn.wndId, evtobj);
                return;
            }
        }

        sn.touchEvent = function(e) {
            var evtobj = e || event;

            evtobj.name = "TouchEvent";
            evtobj.src = this;
            evtobj.preventDefault();

            if (evtobj.type != "mousemove") {

                if (evtobj.type == "touchend" || evtobj.type == "touchcancel") {
                    lastMouseDownTouchTime = null;
                } else if (evtobj.type == "touchstart") {
                    lastMouseDownTouchTime = new Date().getTime();
                } else {
                    lastMouseDownTouchTime = null;
                }
            }
            evtobj.lastMouseDownTouchTime = lastMouseDownTouchTime;
            NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.touchEvent), sn.processId, sn.wndId, evtobj);
        };

        sn.canvas.onmouseup = sn.mouseEvent;
        sn.canvas.onmousedown = sn.mouseEvent;
        sn.canvas.onmousemove = sn.mousemove;
        //sn.canvas.onkeypress = sn.keyEvent;
        // sn.canvas.onkeydown = sn.keyEvent; ////
        // sn.canvas.onkeyup = sn.keyEvent; ////
        //sn.panel.onkeypress = sn.keyEvent;
        // sn.panel.onkeydown = sn.keyEvent; ////
        // sn.panel.onkeyup = sn.keyEvent;   ////
        // document.onkeypress = sn.keyEvent;  ////
        document.onkeydown = sn.keyEvent;
        document.onkeyup = sn.keyEvent;
        document.onkeypress = sn.keyEvent;

        sn.canvas.addEventListener("touchstart", sn.touchEvent, false);
        sn.canvas.addEventListener("touchend", sn.touchEvent, false);
        sn.canvas.addEventListener("touchcancel", sn.touchEvent, false);
        sn.canvas.addEventListener("touchleave", sn.touchEvent, false);
        sn.canvas.addEventListener("touchmove", sn.touchEvent, false);
        sn.canvas.addEventListener("mousewheel", sn.mouseWheelEvent, false); // IE9, Chrome, Safari, Opera
        sn.canvas.addEventListener("DOMMouseScroll", sn.mouseWheelEvent, false); // Firefox


        sn.dirtyCanvas = null;
        sn.matrix = {
            isNull: true
        };
        sn.bounds = {
            isNull: true
        };
        mMaxZIndex++;
        sn.zindex = mMaxZIndex;
        sn.panel.setAttribute('tabindex', mMaxZIndex);
        sn.taskId = taskManager.getTaskId(taskIdAndPos);
        sn.posInTask = taskManager.getPosInTask(taskIdAndPos);
        sn.parentWndId = parentWndId;
        taskManager.updateTask(sn);
        ws.push(sn);

        // update zorder of the windows above the new window
        var taskList = taskManager.getTaskList();
        var taskHash;
        var task;
        var passedCurrentSN;
        for (var i = 0; i < Object.keys(taskList).length; i++) {
            taskHash = Object.keys(taskList)[i];
            task = taskList[taskHash];
            for (var j = 0; j < task.length; j++) {
                if (task[j] == sn) {
                    passedCurrentSN = true;
                } else {
                    if (passedCurrentSN) {
                        mMaxZIndex++;
                        task[j].zindex = mMaxZIndex;
                        fSetCSS(task[j]);
                    }
                }
            }
        }

        if (parentNode.childNodes.length == 0)
            parentNode.appendChild(sn.panel);
        else
            parentNode.insertBefore(sn.panel, parentNode.childNodes[0]);
        sn.panel.appendChild(sn.canvas);


        fSetCSS(sn);

        window.location.hash = "ppage/" + mMaxZIndex;
        currLocationHash = window.location.hash;
        sn.canvas.focus();

        return sn;
    };

    fRemoveWindowStack = function(ws) {
        while (true) {
            var sn = ws.pop();
            if (sn == null)
                break;
            taskManager.removeWndFromTask(sn);
            Log.v(TAG, "Remove canvas " + sn.canvas.id);
            parentNode.removeChild(sn.panel);
        }
    };

    this.prepareCanvasForPaint = function(processId, wndId, bm) {
        var sn = this.getWindow(processId, wndId);
        if (sn == null)
            return null;
        //if (sn!=null)
        //  $("#"+sn.canvas.id).hide();

        var ctx = sn.dirtyCtx;
        if (ctx == null) {
            return null;
        }
        ctx.save();

        if (!bm.matrix.isNull)
            sn.matrix = bm.matrix;
        if (!bm.bounds.isNull)
            sn.bounds = bm.bounds;

        if (!sn.matrix.isNull || !sn.bounds.isNull) {
            // ctx.save();
            if (!sn.matrix.isNull) {
                //Log.v(TAG, "set matrix: " + JSON.stringify(sn.matrix));
                ctx.setTransform(sn.matrix.arr[0], sn.matrix.arr[3], sn.matrix.arr[1], sn.matrix.arr[4], sn.matrix.arr[2], sn.matrix.arr[5]);
            }
            if (!sn.bounds.isNull) {
                // Log.v(TAG, "set bounds: " + JSON.stringify(sn.bounds));
                ctx.rect(sn.bounds.left, sn.bounds.top, (sn.bounds.right - sn.bounds.left), (sn.bounds.bottom - sn.bounds.top));
                ctx.clip();
            }
        }
        ctx.beginPath();
        return ctx;
    };

    this.removeProcess = function(processId) {
        var processIDHash = processId.toString(16);
        var ws = mWindowsStackManager[processIDHash];
        if (ws == null) { // new process
            Log.e(TAG, "Process not found in window manager: " + processId);
            return;
        }
        fRemoveWindowStack(ws);
        delete mWindowsStackManager[processIDHash];
        console.log("removeProcess. processId: " + processId);
    };

    this.killAll = function() {
        for (var key in mWindowsStackManager) {
            var ws = mWindowsStackManager[key];
            fRemoveWindowStack(ws);
        }
    };

    this.getLastProcessIdOnStack = function() {
        /*		// DEBUG
         var l = Object.keys(mWindowsStackManager).length;
         var processIdStr = Object.keys(mWindowsStackManager)[Object.keys(mWindowsStackManager).length - 1];
         var processId =  parseInt(processIdStr, 16);
         return processId;*/

        return parseInt(Object.keys(mWindowsStackManager)[Object.keys(mWindowsStackManager).length - 1], 16);
    };

    // returns the last process that is not keyboard
    this.getLastNotKeyboardProcessIdOnStack = function(keyboardProcId) {
        var stackSize = Object.keys(mWindowsStackManager).length;
        for (var i = stackSize - 1; i >= 0; i--) {
            var procId = parseInt(Object.keys(mWindowsStackManager)[i], 16);
            console.log("getLastNotKeyboardProcessIdOnStack.1 procId: " + procId);
            if (procId != keyboardProcId) {
                return procId;
            }
            // if (procId == keyboardProcId) {
            //     console.log("getLastNotKeyboardProcessIdOnStack. keyboardProcId: " + procId);
            //     continue;
            // }
            // console.log("getLastNotKeyboardProcessIdOnStack.2");
            // var ws = mWindowsStackManager[i]; //mWindowsStackManager[procId.toString(16)];            
            // if (ws != null) {
            //     console.log("getLastNotKeyboardProcessIdOnStack.3 ws.length: ", ws.length)
            //     for (var j = 0; j < ws.length; l++) {
            //         console.log("getLastNotKeyboardProcessIdOnStack. ws[" + j + "].wndId: " + ws[j].wndId +
            //                     ", visible: " + ws[j].visible);
            //         if (ws[j].visible) {
            //            console.log("getLastNotKeyboardProcessIdOnStack. LAST PROCESS: " + procId);
            //            return procId;
            //         }
            //     }
            // } else {
            //     console.log("getLastNotKeyboardProcessIdOnStack.4");    
            // }
            // console.log("getLastNotKeyboardProcessIdOnStack.5");
        }
        return 0;
    };

    // video functions
    this.createNewSurfaceView = function(processId, surfaceHashInt, data) {
        var sn = this.getWindow(processId, data.parentWndId);
        if (sn == null) {
            Log.e(TAG, "createNewSurfaceView: wndId not found: " + wndId);
            return;
        }
        var surfaceHash = surfaceHashInt.toString(16);
        surfaceManager[surfaceHash] = data;
        // hack to make the backgound black and not the wallpaper
        sn.panel.style.backgroundColor = '#000000';

        if (data.visible && mediaCurrHash) {
            var mediaPlayer = mediaManager[mediaCurrHash];
            if (!mediaPlayer) {
                Log.e(TAG, "Not found mediaCurrHash..");
                return;
            }
            if (mediaPlayer.videoObj && mediaPlayer.surfaceHash == surfaceHash) {
                this.mediaUpdateSurface(mediaPlayer, data);
            } else {
                Log.e(TAG, "Error mediaPlayer.surfaceHash not match surfaceHash");
            }
        }
    };

    this.newMediaPlayer = function(processId, objectType, objectHashInt) {
        Log.e(TAG, "newMediaPlayer: " + objectHashInt);
        var mediaPlayer = {
            processId: processId,
            objectType: objectType,
            objectHash: objectHashInt.toString(16),
            objectHashInt: objectHashInt,
            videoObj: document.createElement('video')
        };

        mediaManager[mediaPlayer.objectHash] = mediaPlayer;
    };

    this.attachSurfaceToMediaPlayer = function(processId, mediaPlayerHashInt, surfaceHashInt) {
        var mediaPlayerHash = mediaPlayerHashInt.toString(16);
        var mediaPlayer = mediaManager[mediaPlayerHash];
        if (!mediaPlayer) {
            Log.e(TAG, "Error attachSurfaceToMediaPlayer mediaPlayerHash not found");
            return;
        };
        var surfaceHash = surfaceHashInt.toString(16);
        mediaPlayer.surfaceHash = surfaceHash;


        Log.e(TAG, "attachSurfaceToMediaPlayer: " + mediaPlayer.objectHash + ", surfaceHash: " + surfaceHash);
    };
    this.prepareMediaPlayer = function(processId, mediaPlayerHashInt, streamName, totalDuration) {
        var mediaPlayerHash = mediaPlayerHashInt.toString(16);
        var mediaPlayer = mediaManager[mediaPlayerHash];
        if (!mediaPlayer) {
            Log.e(TAG, "Error prepareMediaPlayer mediaPlayerHash not found");
            return;
        };
        var data = surfaceManager[mediaPlayer.surfaceHash];
        if (!data) {
            Log.e(TAG, "Error prepareMediaPlayer surfaceHash not found");
            return;
        }
        var sn = this.getWindow(mediaPlayer.processId, data.parentWndId);
        if (sn == null) {
            Log.e(TAG, "prepareMediaPlayer: parentWndId not found: " + data.parentWndId);
            return;
        }

        if (mediaCurrHash && mediaCurrHash != mediaPlayerHash) {
            // remove current player

        }
        // mPackageNameList
        console.log("****prepareMediaPlayer. send videoDuration... mediaPlayer.objectHashInt: " + mediaPlayer.objectHashInt + 
                      ", videoDuration: " + totalDuration);
        mediaPlayer.totalDuration = totalDuration;
        NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.VideoDuration),
                            mediaPlayer.processId, mediaPlayer.objectHashInt, totalDuration);

        var isLive = "true";
        if (mediaPlayer.totalDuration > 0) {
            isLive = "false";
        } else {
            streamName += "_req.m3u8";
        }
        mediaCurrHash = mediaPlayerHash;
        //https://nubo02.nubosoftware.com
        var url = "/getStreamsFile?loginToken=" + encodeURIComponent(window.loginToken) + "&streamName=" + encodeURIComponent(streamName) + "&isLive=" + isLive;
        mediaPlayer.url = mediaPlayer;
        Log.e(TAG, "getStreamsFile. URL: " + url);
        mediaPlayer.videoObj.id = "v_" + mediaPlayerHash;
        mediaPlayer.videoObj.setAttribute('width', data.width);
        mediaPlayer.videoObj.setAttribute('height', data.height);

        var source = document.createElement('source');
        source.setAttribute('src', url);
        source.setAttribute('type', "application/x-mpegURL");
        source.id = "source_" + mediaPlayer.videoObj.id;
        mediaPlayer.videoObj.appendChild(source);
        //mediaPlayer.videoObj.setAttribute('src', url);
        //mediaPlayer.videoObj.setAttribute('type', "application/x-mpegURL");
        //type="application/x-mpegURL"
        if (mediaPlayer.autoplay) {
            mediaPlayer.videoObj.setAttribute('autoplay', '');
            mediaPlayer.autoplay = null;
        }
        mediaPlayer.videoObj.onprogress = function() {
            //alert("Downloading video");
            Log.e(TAG, "onprogress. Current Time: " + mediaPlayer.videoObj.currentTime + 
                       ", duration: " + mediaPlayer.videoObj.duration);
            var progressInt = Math.floor(mediaPlayer.videoObj.currentTime * 1000);
            NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.VideoProgress), 
                                mediaPlayer.processId, mediaPlayer.objectHashInt, progressInt);
        };

        mediaPlayer.videoObj.onended = function() {
            Log.e(TAG, "Video ended!");
            NuboOutputStreamMgr.getInstance().sendCmd(mUxip.nuboByte(PlayerCmd.VideoCompleteEvent), mediaPlayer.processId, mediaPlayer.objectHashInt);
        };

        sn.panel.insertBefore(mediaPlayer.videoObj, sn.canvas);
        this.mediaUpdateSurface(mediaPlayer, data);

        mediaPlayer.videojs = videojs(mediaPlayer.videoObj.id);

        mediaPlayer.videojs.ready(function() {
            //this.addClass('my-example');
            wm.mediaUpdateSurface(mediaPlayer, data);
            $("video#" + mediaPlayer.videoObj.id).css({
                left: 0,
                top: 0
            });

            Log.e(TAG, "*****prepareMediaPlayer: ready ****");
            mediaPlayer.videoObj.play();
        });
    };

    this.mediaUpdateSurface = function(mediaPlayer, data) {
        Log.e(TAG, "Update mediaUpdateSurface position and size");
        var cssObj = {
            'position': 'absolute',
            'visibility': (data.visible ? 'visible' : 'hidden'),
            'left': data.x + 'px',
            'top': data.y + 'px',
            'width': data.width + 'px',
            'height': data.height + 'px',
            'z-index': '-1'
        };

        $("#" + mediaPlayer.videoObj.id).css(cssObj);
    };

    this.startMediaPlayer = function(processId, mediaPlayerHashInt) {  //, totalDuration
        var mediaPlayerHash = mediaPlayerHashInt.toString(16);
        var mediaPlayer = mediaManager[mediaPlayerHash];
        if (!mediaPlayer) {
            Log.e(TAG, "Error prepareMediaPlayer mediaPlayerHash not found");
            return;
        };
        // mediaPlayer.totalDuration = totalDuration;
        console.log("***startMediaPlayer. mediaPlayerHash: " + mediaPlayerHash);
        if (mediaPlayer.url) {
            // start it
            mediaPlayer.videoObj.play();
        } else {
            mediaPlayer.autoplay = true;
        }
    };

    this.releaseMediaPlayer = function(processId, mediaPlayerHashInt) {
        var mediaPlayerHash = mediaPlayerHashInt.toString(16);
        var mediaPlayer = mediaManager[mediaPlayerHash];
        if (!mediaPlayer) {
            Log.e(TAG, "Error prepareMediaPlayer mediaPlayerHash not found");
            return;
        };
        if (mediaCurrHash == mediaPlayerHash) {
            mediaCurrHash = null;
        }
        mediaPlayer.videoObj.pause();
        var data = surfaceManager[mediaPlayer.surfaceHash];
        if (!data) {
            Log.e(TAG, "Error releaseMediaPlayer surfaceHash not found");
            return;
        }
        var sn = this.getWindow(mediaPlayer.processId, data.parentWndId);
        if (sn == null) {
            Log.e(TAG, "releaseMediaPlayer: parentWndId not found: " + data.parentWndId);
            return;
        }
        mediaPlayer.videojs.dispose();
        //sn.panel.removeChild(mediaPlayer.videoObj);
    };
    this.pauseVideo = function(processId, mediaPlayerHashInt) {
        var mediaPlayerHash = mediaPlayerHashInt.toString(16);
        var mediaPlayer = mediaManager[mediaPlayerHash];
        if (!mediaPlayer) {
            Log.e(TAG, "Error prepareMediaPlayer mediaPlayerHash not found");
            return;
        };
        mediaPlayer.videoObj.pause();
    };

    this.seekToVideo = function(processId, mediaPlayerHashInt, msec) {
        var mediaPlayerHash = mediaPlayerHashInt.toString(16);
        var mediaPlayer = mediaManager[mediaPlayerHash];
        if (!mediaPlayer) {
            Log.e(TAG, "Error prepareMediaPlayer mediaPlayerHash not found");
            return;
        };
        mediaPlayer.videoObj.currentTime = msec / 1000;

    };


    //constructor
    parentNode = parentNodePrm;
    mWidth = widthPrm;
    mHeight = heightPrm;
    mUxip = uxip;

    var dropcanvas = document.createElement('img');
    dropcanvas.setAttribute('src', mgmtURL + '/html/player/images/dragdrop.png');
    dropcanvas.setAttribute('width', mWidth);
    dropcanvas.setAttribute('height', mHeight);
    dropcanvas.id = "dropcanvas";
    parentNode.appendChild(dropcanvas);
    var dropcanvasCssObj = {
        'position': 'absolute',
        'visibility': 'hidden',
        'left': '0px',
        'top': '0px',
        'width': mWidth + 'px',
        'height': mHeight + 'px',
        'z-index': '10000'
    };

    $("#dropcanvas").css(dropcanvasCssObj);
    $("#dropcanvas").dropzone({
        url: mgmtURL + "/file/uploadToSession?session=" + session,
        accept: function(file, done) {
            console.log("file: ", file);
            done();
        }
    });

    //var dropbox = document.getElementById("maindiv");
    // init event handlers
    parentNode.addEventListener("dragenter", dragEnter, false);
    parentNode.addEventListener("dragleave", dragExit, false);
    parentNode.addEventListener("dragover", dragOver, false);
    //parentNode.addEventListener("drop", drop, false);

    window.addEventListener("dragover", function(e) {
        e = e || event;
        e.preventDefault();
    }, false);
    window.addEventListener("drop", function(e) {
        e = e || event;
        e.preventDefault();
    }, false);

    function dragEnter(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        $("#dropcanvas").css('visibility', 'visible');
        console.dir(evt);

    }

    function dragExit(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        console.dir(evt);
        if (evt.target == parentNode || evt.target == dropcanvas) {
            $("#dropcanvas").css('visibility', 'hidden');
            console.log("hide drop");
        }
    }

    function dragOver(evt) {
        evt.stopPropagation();
        evt.preventDefault();
    }

    var myDropzone = Dropzone.forElement("#dropcanvas");

    var filecnt = 0;

    myDropzone.on("success", function(file, res) {
        if (res.status == 0) {
            console.log("ERROR. file.name: " + file.name + ", status " + res.status + ", message: " + res.message);
            console.log("ERROR. file.fileid: " + file.fileid);
            $("#" + file.fileid).css('display', 'none');
            $("#icon_" + file.fileid).css('display', 'none');
            $("#name_" + file.fileid).css('display', 'none');
            $("#uploadErrorMsg").css('visibility', 'visible');
        }
    });

    myDropzone.on("complete", function(file) {
        $("#dropcanvas").css('visibility', 'hidden');
        console.log("Uploaded");
        $("#progress_" + file.fileid).hide();
        $("#icon_" + file.fileid).css('opacity', '1');

    });
    myDropzone.on("drop", function(evt) {
        $("#dropcanvas").css('visibility', 'hidden');

        console.log("dropped");
    });

    myDropzone.on("addedfile", function(file) {
        console.log("addedfile");

        if (!file.fileid) {
            filecnt++;
            file.fileid = "file_" + filecnt;
        }
        // $("#uploadContent").prepend('<div class="fileItem" id="' + file.fileid + '"><div class="fileIcon" id="icon_' + file.fileid + '"></div><div class="fileName">' + file.name + '</div><progress id="progress_' + file.fileid + '" max="100" value="0"></progress></div>');
        $("#uploadContent").prepend('<div class="fileItem" id="' + file.fileid + '"><div class="fileIcon" id="icon_' + file.fileid + '"></div><div class="fileName" id="name_' + file.fileid + '">' + file.name + '</div><progress id="progress_' + file.fileid + '" max="100" value="0"></progress></div>');
        if (filecnt == 5) {
            $("#uploadContent").css('overflow-y', 'scroll');
        }
        $("#uploadFiles").css('visibility', 'visible');
        $("#uploadErrorMsg").css('visibility', 'hidden');
    });
    myDropzone.on("uploadprogress", function(file, progress, bytes) {
        console.log("uploadprogress");

        // console.log(file.name + " " + progress + "%, id: " + file.fileid);
        var fileitem = $("#" + file.fileid);
        if (!fileitem.length) {

        } else {
            $("#progress_" + file.fileid).attr("value", progress);
        }

    });

    $("#uploadX").click(function() {
        $("#uploadFiles").css('visibility', 'hidden');
    });

    $("#btnErrorMsg").click(function() {
        $("#uploadErrorMsg").css('visibility', 'hidden');

        console.log("btnErrorMsg.click filecnt: " + filecnt);
        if (filecnt == 0) {
            $("#uploadFiles").css('visibility', 'hidden');
        }
    });

    var uploadDrag = false;
    var offsetx = 0;
    var offsety = 0;
    var nowX = 0;
    var nowY = 0;
    var uploadElem = document.getElementById("uploadFiles");

    $("#uploadTitle").mousedown(function(e) {
        offsetx = e.clientX;
        offsety = e.clientY;
        nowX = parseInt(uploadElem.style.left);
        nowY = parseInt(uploadElem.style.top);
        uploadDrag = true;
    });

    $("#uploadTitle").mouseup(function() {
        uploadDrag = false;
    });
    $("#uploadTitle").mousemove(function(e) {
        if (!uploadDrag)
            return;
        uploadElem.style.left = nowX + e.clientX - offsetx;
        uploadElem.style.top = nowY + e.clientY - offsety;
        return false;
    });

    window.onhashchange = function() {
        if (window.location.hash != currLocationHash) {
            //alert("back. currLocationHash:"+currLocationHash+", window.location.hash:"+window.location.hash);
            window.history.forward();
            mUxip.clickBack();
        }
    };

}

function Log() {}

Log.v = function(tag, msg) {
    console.log("[" + tag + "] " + msg);
};
Log.e = function(tag, msg) {
    console.error("[" + tag + "] " + msg);
};

// TaskManager:: manages tasks. each task is a group of windows identified by stack nodes.
function TaskManager(uxip) {
    "use strict";
    var ACTIVITIES_IN_TASK_SHIFT = 9;
    var POS_IN_TASK_MASK = 511;
    var mUxip = uxip;
    // list of all nubo windows ordered by z order
    // var nuboWindowList = [];
    // task with its windows list
    var taskList = {};
    // is set by set top task
    var lastTopTaskId;

    // moves task to top and returns the task
    this.moveTaskToTop = function(taskId) {
        var taskIdHash = getTaskIdHash(taskId);
        if (Object.keys(taskList)[Object.keys(taskList).length - 1] == taskIdHash) {
            return null;
        }
        var task = taskList[taskIdHash];
        delete taskList[taskIdHash];
        taskList[taskIdHash] = task;
        return task;
    };

    this.updateTask = function(stackNode) {
        var popUp = ContainerType.POPUPWINDOW;
        var activity = ContainerType.ACTIVITY;
        var dialog = ContainerType.DIALOG;
        if (stackNode.containerType == popUp) {
            this.addPopupWindow(stackNode);
            return;
        }
        var taskIdHash = getTaskIdHash(stackNode.taskId);
        var task = taskList[taskIdHash];
        if (task == null) {
            task = [];
        }
        if (task.length == 0) {
            // adding a new task. only value is the current stack node.
            if (Object.keys(taskList).length == 0 || lastTopTaskId == stackNode.taskId) {
                // only task in the list or top task
                taskList[taskIdHash] = task;
            } else {
                // adding a task that will not be top task
                // remove the last task, add this task and add last task back
                var lastTaskHash = Object.keys(taskList)[Object.keys(taskList).length - 1];
                var lastTask = taskList[lastTaskHash];
                delete taskList[lastTaskHash];
                taskList[taskIdHash] = task;
                taskList[lastTaskHash] = lastTask;
            }
            task.push(stackNode);
            return;
        } else if (task.length > 0) {
            // existing task with windows
            var sn;
            for (var i = 0; i < task.length; i++) {
                sn = task[i];
                if (sn.containerType == popUp) {
                    continue;
                }
                if (stackNode.posInTask < sn.posInTask || (sn.posInTask == stackNode.posInTask && sn.containerType == dialog && stackNode.containerType == activity)) {
                    task.splice(i, 0, stackNode);
                    return;
                }
                // if at the same position there is a popup. advance popup's index
                if (sn.posInTask == stackNode.posInTask && sn.containerType == popUp && stackNode.containerType != popUp) {
                    task.splice(i, 0, stackNode);
                    stackNode.posInTask++;
                    return;
                }
            }
            // add the new window to the end
            task.push(stackNode);
            return;
        } else {
            Log.e(TAG, "updateTask::task.length = " + task.length);
        }
    };

    this.addPopupWindow = function(stackNode) {
        // popup do not get taskId from platform
        // we will find taskId from parentWndId
        // parentWndId most probably will on the top task
        var taskIdHash;
        var task;
        for (var i = 0; i < Object.keys(taskList).length; i++) {
            taskIdHash = Object.keys(taskList)[i];
            task = taskList[taskIdHash];
            for (var j = 0; j < task.length; j++) {
                var sn = task[j];
                if (sn.wndId == stackNode.parentWndId || sn.nuboWndId == stackNode.parentWndId) {
                    task.push(stackNode);
                    var taskId = parseInt(taskIdHash.substring(0, taskIdHash.length - 1), 16);
                    stackNode.taskId = taskId;
                    stackNode.posInTask = task.length - 1;
                    return;
                }
            }
        }
        Log.e(TAG, "TaskManager::addPopupWindow: can not find parent of popup");
    };

    this.removeWndFromTask = function(stackNode) {
        var taskIdHash = getTaskIdHash(stackNode.taskId);
        var task = taskList[taskIdHash];
        var index = task.indexOf(stackNode);
        if (index > -1) {
            task.splice(index, 1);
        } else {
            Log.e(TAG, "TaskManager::removeWndFromTask: can not find window in task");
        }
    };

    this.setLastTopTaskId = function(taskId) {
        lastTopTaskId = taskId;
    };

    this.getTaskList = function() {
        return taskList;
    };

    this.getTaskId = function(taskAndPos) {
        return taskAndPos >> ACTIVITIES_IN_TASK_SHIFT;
    };

    this.getPosInTask = function(taskAndPos) {
        return taskAndPos & POS_IN_TASK_MASK;
    };



    getTaskIdHash = function(taskId) {
        return taskId.toString(16) + "_";
    };

    // public functions
    var getPosInTask, getTaskId, getTaskList, setLastTopTaskId, addPopupWindow, updateTask, moveTaskToTop;
    //private funcs
    var getTaskIdHash;
}