var NuboOutputStreamMgr = (function(window, undefined) {

    // this are consts values copied from uxip.js file..
    var psConnected = 2, psInit = 1;
    var instance = null;
    var mUxip = null;
    var isPlayerLoginCmd = false;
    var mSessionId;

    var lastMouseDownTouchTime;
    var lastTouchX;
    var lastTouchY;
    var writer;
    // revealing module pattern that handles initialization of our new module
    function initialize() {

        function createSocket(parentNode, width, height, uxip, writer_) {
            mUxip = uxip;
            writer = writer_;
        }

        function sendCmd() {
            // return if the socket is not connected
            if (mUxip.protocolState() != psConnected && mUxip.protocolState() != psInit) {
                console.log('NuboOutStreamMgr, socket is not connected');
                return;
            }

            if (arguments.length <= 0) {
                console.log('NuboOutStreamMgr, Illegal number of arguments: '+arguments.length);
                return;
            }

            writer.startNuboCmd();

            //write cmdCode
            var cmdCode = arguments[0];
            var cmdCodeNum = 0;
            if ( typeof cmdCode === 'number') {
                writer.writeInt(cmdCode);
                cmdCodeNum = cmdCode;
            } else if (typeof cmdCode === 'object' &&
                        cmdCode.name === 'nuboByte') {
                writer.writeByte(cmdCode.val);
                cmdCodeNum = cmdCode.val;
            } else {
                console.log('NuboOutStreamMgr, Illegal type of cmdCode (not a number or nuboByte). Aborting command: '+cmdCode);
                writer.endNuboCmd();
                return;
            }

            if (cmdCodeNum != PlayerCmd.roundTripData ) {
                mUxip.resetLastInteraction();
            }

            //write sessionId
            if (Common.withService || cmdCode != PlayerCmd.playerLogin) {
                if (typeof mSessionId === 'string') {
                    writer.writeString(mSessionId);
                } else {
                    console.log('NuboOutStreamMgr, Illegal type of mSessionId (not a string). Aborting command: '+cmdCode);
                    writer.endNuboCmd();
                    return;
                }
            }

            for (var i = 1; i < arguments.length; i++) {

                var arg = arguments[i];

                if ( typeof arg === 'number') {
                    writer.writeInt(arg);
                } else if ( typeof arg === 'string') {
                    writer.writeString(arg);
                } else if ( typeof arg === 'boolean') {
                    writer.writeBoolean(arg);
                } else if ( typeof arg === 'object') {
                    if (arg.name === 'KeyEvent') {
                        writer.writeKeyEvent(arg);
                    } else if (arg.name === 'MouseEvent') {
                        mUxip.mouseEvent(arg);
                    } else if (arg.name === 'TouchEvent') {
                        mUxip.touchEvent(arg);
                    } else if (arg.name === 'nuboFloat') {
                        writer.writeFloat(arg.val);
                    } else if (arg.name === 'nuboLongAsFloat') {
                        writer.writeLongAsFloat(arg.val);
                    } else if (arg.name === 'nuboByte') {
                        writer.writeByte(arg.val);
                    } else if (arg.name === 'MouseWheel') {
                        mUxip.mousewheel(arg);
                    }
                }

            }
            writer.endNuboCmd();
            writer.flush();
        }

        function getIsPlayerLogin() {
            return isPlayerLoginCmd;
        }

        function setIsPlayerLogin(isPlayerLogin) {
            isPlayerLoginCmd = isPlayerLogin;
        }

        function setSessionId(sessionId) {
            mSessionId = sessionId;
        }

        return {
            sendCmd : sendCmd,
            createSocket : createSocket,
            getIsPlayerLogin : getIsPlayerLogin,
            setIsPlayerLogin : setIsPlayerLogin,
            setSessionId : setSessionId
        };
    }

    // handles the prevention of additional instantiations
    function getInstance() {
        if (!instance) {
            instance = new initialize();
        }
        return instance;
    }

    return {
        getInstance : getInstance
    };

})();

