var NuboOutputStreamMgr = (function(window, undefined) {

    // this are consts values copied from uxip.js file..
    var psConnected = 2, psInit = 1;
    var instance = null;
    var mUxip = null;
    var isPlayerLoginCmd = false;

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
            writer.startNuboCmd();
            for (var i = 0; i < arguments.length; i++) {

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

        return {
            sendCmd : sendCmd,
            createSocket : createSocket,
            getIsPlayerLogin : getIsPlayerLogin,
            setIsPlayerLogin : setIsPlayerLogin
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

