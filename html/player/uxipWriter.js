var BUFFSIZE = 1024;
var COMPRESSION_HEADER_SIZE = 5;

function UXIPWriter(callback) {
    "use strict";
    var sendfunc = callback;
    var isPlayerLoginCmd = false;

    var buffer = new ArrayBuffer(BUFFSIZE);
    var dv = new DataView(buffer, 0);
    var offset = 0;

    if (PRINT_NETWORK_COMMANDS == null) {
        var PRINT_NETWORK_COMMANDS = false;
    }

    this.flush = function() {
        var sendBuffer = buffer.slice(0, offset);
        if (PRINT_NETWORK_COMMANDS) {
            Log.d(DEBUG_PROTOCOL_NETWORK_STR, "uxipwriter:: Flush " + offset + " bytes");
        }
        /////////////////////
        if (Common.withService || !isPlayerLoginCmd) {
            var zLibBuffer = new ArrayBuffer(offset+COMPRESSION_HEADER_SIZE);
            var zLibDv = new DataView(zLibBuffer, 0);
            zLibDv.setInt8(0, 0);
            zLibDv.setInt32(1, offset);
            for (var i=0; i<offset ; i++) {
                zLibDv.setInt8(i+COMPRESSION_HEADER_SIZE, dv.getInt8(i));
            }
            sendfunc(zLibBuffer);
        } else {
            sendfunc(sendBuffer);
        }
        ///////////////////
        offset = 0;

        if (buffer.byteLength > 1024) {
            BUFFSIZE = 1024;
            buffer = new ArrayBuffer(BUFFSIZE);
            dv = new DataView(buffer, 0);
        }
    };

    this.checkBufferSpace = function(numBytes) {
        if ((offset + numBytes) > buffer.byteLength) { // resize buffer
            var newBuffer = new ArrayBuffer(offset + numBytes);
            var newArr = new Uint8Array(newBuffer);
            newArr.set(new Uint8Array(buffer), 0);

            buffer = newBuffer;
            dv = new DataView(newBuffer, 0);
        }
    };

    this.writeInt = function(val) {
        this.checkBufferSpace(4);
        dv.setInt32(offset, val);
        offset += 4;
    };

    this.writeInt16 = function(val) {
        this.checkBufferSpace(2);
        dv.setInt16(offset, val);
        offset += 2;
    };

    this.writeFloat = function(val) {
        this.checkBufferSpace(4);
        dv.setFloat32(offset, val);
        offset += 4;
    };

    this.writeByte = function(val) {
        this.checkBufferSpace(1);
        dv.setInt8(offset, val);
        offset += 1;
    };

    this.writeBoolean = function(val) {
        var ch = ( val ? 1 : 0);
        this.writeByte(ch);
    };

    this.writeLong = function(val) {
        this.checkBufferSpace(8);
        dv.setUint32(offset, val.hi);
        offset += 4;
        dv.setUint32(offset, val.lo);
        offset += 4;
    };

    // can be used to write long typed numbers to network.
    // i.e. numbers that will be interpreted as long type in java side
    this.writeLongAsFloat = function(val) {
        this.checkBufferSpace(8);
        dv.setFloat64(offset, val);
        offset += 8;
    };

    this.writeString = function(val) {
        if (val == null) {
            this.writeByte(1);
            return;
        }
        var strBuff = UTF8.encode(val);
        var byteLength = strBuff.byteLength;
        this.writeByte(0);
        this.writeInt16(byteLength);
        var dvStr = byteLength ? new DataView(strBuff, 0): null;
        this.checkBufferSpace(byteLength);
        for (var i = 0; i < byteLength; i++) {
            var b = dvStr.getUint8(i);
            //console.log("b="+b);
            dv.setUint8(offset, b);
            offset++;
        }
    };

    this.writeKeyEvent = function(e) {
        //long downTime, long eventTime, int action, float x, float y, int metaState
        if (e != null) {
            this.writeBoolean(false);
            //not null
            var nullTime = {
                hi : 0,
                lo : 0
            };
            this.writeLong(nullTime);
            this.writeLong(nullTime);
            this.writeInt(e.action);
            this.writeInt(e.keyCode);
            this.writeInt(0);
            this.writeInt(0);
            this.writeInt(-1);
            this.writeInt(0);
            this.writeInt(0);
            this.writeInt(0);
            var chars = e.characters;
            if (chars == "undefined")
                chars = null;
            //Log.e("characters="+chars);
            this.writeString(chars);
        } else {
            this.writeBoolean(true);
        }
    };

    this.writeArrayBuffer = function(buf) {
        var len = buf.byteLength;
        this.checkBufferSpace(len);
        var dst = new Uint8Array(buffer);
        dst.set(new Uint8Array(buf), offset);
        offset += len;
    };

    this.writeMouseEvent = function(uxip, eventt) {
        var lastMouseDownTouchTime = eventt.lastMouseDownTouchTime;

        var src = eventt.src;
        var rect = src.getBoundingClientRect();

        var left = eventt.clientX - rect.left - src.clientLeft + src.scrollLeft;
        var top = eventt.clientY - rect.top - src.clientTop + src.scrollTop;

        this.writeBoolean(false);
        //not null

        var timevar = {
            hi: 0,
            lo: 0
        };

        this.writeLong(timevar);
        this.writeLong(timevar);
        this.writeInt(1);
        var action;

        if (eventt.type == "mouseup") {
            uxip.setLastTouch(null, null);
            action = 1;
        } else if (eventt.type == "mousedown") {
            uxip.setLastTouch(left, top);
            action = 0;
        } else if (eventt.type == "mousemove") {
            action = 2;
        }
        this.writeInt(action);

        this.writeInt(0);
        //properties.id
        this.writeInt(1);
        //properties.toolType

        if (action != 2) {
            this.writeFloat(0);
            // coords.orientation
            this.writeFloat(90);
            // coords.toolMajor);
            this.writeFloat(90);
            // coords.toolMinor);
            this.writeFloat(90);
            // coords.touchMajor);
            this.writeFloat(90);
            // coords.touchMinor);
        }

        this.writeFloat(0.73);
        //coords.pressure);
        this.writeFloat(0.26);
        //coords.size);
        this.writeFloat(left);
        //coords.x
        this.writeFloat(top);
        //coords.y
        this.writeFloat(2);
        //e.getXPrecision());
        this.writeFloat(2);
        //e.getYPrecision());

        if (action != 2) {
            this.writeInt(0);
            // e.getMetaState());
            this.writeInt(0);
            // e.getButtonState());
            this.writeInt(0);
            // e.getEdgeFlags());
            this.writeInt(4098);
            // touchscreen... //e.getSource());
            this.writeInt(0);
            // e.getFlags());
        } else {
            var now = new Date().getTime();
            var interval = now - lastMouseDownTouchTime;
            var lastTouch = uxip.getLastTouch();
            var velocityX = (left - lastTouch.left) / interval;
            var velocityY = (top - lastTouch.top) / interval;
            this.writeFloat(velocityX);
            this.writeFloat(velocityY);
        }
        uxip.updateInputIgnoreSelection(false);
    };

    this.writeTouchEvent = function(uxip, eventt) {
        var lastMouseDownTouchTime = eventt.lastMouseDownTouchTime;

        var src = eventt.src;
        var rect = src.getBoundingClientRect();

        this.writeBoolean(false);
        var timevar = {
            hi: 0,
            lo: 0
        };
        this.writeLong(timevar);
        this.writeLong(timevar);

        this.writeInt(eventt.changedTouches.length); // number of touches
        var action;

        if (eventt.type == "touchend" || eventt.type == "touchcancel") {
            lastTouchX = null;
            lastTouchY = null;
            uxip.setLastTouch(null, null);
            action = 1;
        } else if (eventt.type == "touchstart") {
            action = 0;
        } else if (eventt.type == "touchmove") {
            action = 2;
        }

        this.writeInt(action);

        for (var i = 0; i < eventt.changedTouches.length; i++) {
            var touch = eventt.changedTouches[i];
            this.writeInt(i); // id
            this.writeInt(1); // toolType
        }

        for (var i = 0; i < eventt.changedTouches.length; i++) {
            var touch = eventt.changedTouches[i];
            var left = touch.clientX - rect.left - src.clientLeft + src.scrollLeft;
            var top = touch.clientY - rect.top - src.clientTop + src.scrollTop;
            if (eventt.type == "touchstart" && i == 0) {
                // get last X and Y for velocity calculation later
                uxip.setLastTouch(left, top);
            }

            if (action != 2) {
                this.writeFloat(0); // orientation
                this.writeFloat(90); // toolMajor
                this.writeFloat(90); // toolMinor
                this.writeFloat(90); // touchMajor
                this.writeFloat(90); // touchMinor
            }

            this.writeFloat(touch.force ? touch.force : 0.73); // pressure;
            this.writeFloat(0.26); // size
            this.writeFloat(left); // coords.x
            this.writeFloat(top); // coords.y
        }

        this.writeFloat(2); // XPrecision
        this.writeFloat(2); // YPrecision

        if (action != 2) {
            this.writeInt(0); // MetaState
            this.writeInt(0); // ButtonState
            this.writeInt(0); // EdgeFlags
            this.writeInt(4098); // touchscreen
            this.writeInt(0); // Flags
        }

        if (action == 2) { // move event
            var now = new Date().getTime();
            var interval = now - lastMouseDownTouchTime;
            lastMouseDownTouchTime = now;
            var lastTouch = uxip.getLastTouch();
            var velocityX = (left - lastTouch.left) / interval;
            var velocityY = (top - lastTouch.top) / interval;

            this.writeFloat(velocityX);
            this.writeFloat(velocityY);
        }
        uxip.updateInputIgnoreSelection(false);
    };

    this.writeMousewheel = function(uxip, eventt) {
        //      up: delta > 0, down: delta < 0
        //      Log.e(TAG, "mousewheel. eventt.type: " + eventt.type + ", eventt.action: " + eventt.action + ", eventt.delta: " + eventt.delta);

        if (eventt.type != "mousewheel" && eventt.type != "DOMMouseScroll" && eventt.type != "wheel") {
            this.writeBoolean(true);
            return true;
        }

        var src = eventt.src;
        var rect = src.getBoundingClientRect();

        var action = eventt.action; // 0-ACTION_DWON; 1-ACTION_UP; 2-ACTION_MOVE
        if (action == 0) {
            uxip.setWheeldelta(eventt.clientX - rect.left, eventt.clientY - rect.top);

            uxip.setLastTouch(0, 0);
            uxip.setLastMouseDownTouchTime(0);
        } else if (action == 2) {
            if (eventt.delta < 0) {
                uxip.scrollWheeldelta(-15);
            } else {
                uxip.scrollWheeldelta(15);
            }
        }

        this.writeBoolean(false); // 1
        var timevar = {
            hi: 0,
            lo: 0
        };

        this.writeLong(timevar); // 2 down time
        this.writeLong(timevar); // 3 event time
        this.writeInt(1); // 4 number of touches
        this.writeInt(action); // 5 action
        this.writeInt(0); // 6 id
        this.writeInt(1); // 7 tool type

        if (action != 2) {
            this.writeFloat(0); // orientation
            this.writeFloat(90); // toolMajor
            this.writeFloat(90); // toolMinor
            this.writeFloat(90); // touchMajor
            this.writeFloat(90); // touchMinor
        }

        this.writeFloat(0.73); // pressure
        this.writeFloat(0.26); // size

        var wheeldelta = uxip.getWheeldelta();
        var left = wheeldelta.x; // + rect.left;
        var top = wheeldelta.y; // + rect.top;

        this.writeFloat(left); // coords.x
        this.writeFloat(top); // coords.y
        this.writeFloat(2); // XPrecision
        this.writeFloat(2); // YPrecision

        if (action != 2) {
            this.writeInt(0); // MetaState
            this.writeInt(0); // ButtonState
            this.writeInt(0); // EdgeFlags
            this.writeInt(4098); // touchscreen
            this.writeInt(0); // flags
        }

        if (action == 2) {
            var lastTouch = uxip.getLastTouch();
            var interval = eventt.timeStamp - uxip.getLastMouseDownTouchTime();
            var velocityX = (left - lastTouch.left) / interval;
            var velocityY = (top - lastTouch.top) / interval;

            this.writeFloat(velocityX);
            this.writeFloat(velocityY);
        }

        // save data
        uxip.setLastMouseDownTouchTime(eventt.timeStamp);
        uxip.setLastTouch(left, top);
    }

    this.startNuboCmd = function() {
        offset = 0;
        if (Common.withService || !isPlayerLoginCmd) {
            this.writeInt(0); //save place for command size
        }
    };

    this.endNuboCmd = function() {
        if (Common.withService || !isPlayerLoginCmd) {
            dv.setInt32(0, offset);
        }
    };

    this.getIsPlayerLogin = function() {
        return isPlayerLoginCmd;
    }

    this.setIsPlayerLogin = function(isPlayerLogin) {
        isPlayerLoginCmd = isPlayerLogin;
    }
}

function getNuboByte(nuboByte) {
    var nuboB = {
            name : "nuboByte",
            val : nuboByte
    };
    return nuboB;
}

function testWriter() {

    var writer = new UXIPWriter(function(buffer) {
        console.log("send byteLength=" + buffer.byteLength);
    });

    writer.writeInt(5);
    writer.writeInt(50);
    writer.writeFloat(50.5);
    for (var i = 0; i < 2000; i++) {
        writer.writeByte(i);
    }
    writer.writeString("TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST" + "TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST");
    writer.flush();
    for (var i = 0; i < 2000; i++) {
        writer.writeByte(i);
    }

    writer.flush();

}

if ( typeof module != 'undefined') {
    module.exports = {
        UXIPWriter : UXIPWriter,
        testWriter : testWriter
    };
    UTF8 = require('./utf8.js').UTF8;
}
