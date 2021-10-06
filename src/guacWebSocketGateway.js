"use strict"

const GuacamoleLoggerFactory = require('./guacamole/GuacamoleLoggerFactory');
const GuacamoleTunnel = require('./guacamole/GuacamoleTunnel');
const GuacamoleExceptions = require('./guacamole/GuacamoleExceptions');
const GuacamoleStatus = require('./guacamole/GuacamoleStatus');
const http = require('http');
const URL = require('url').URL;
const GuacamoleHTTPTunnelHandler = require('./guacamole/GuacamoleHTTPTunnelHandler');
const Common = require('./common.js');
const logger = Common.logger;
const GuacamoleConfiguration = require('./guacamole/GuacamoleConfiguration');
const GuacamoleClientInformation = require('./guacamole/GuacamoleClientInformation');
const ConfiguredGuacamoleSocket = require('./guacamole/ConfiguredGuacamoleSocket');
const GuacamoleWebSocketTunnelHandler = require('./guacamole/GuacamoleWebSocketTunnelHandler');
const WebSocketRequest = require("websocket").request;
const { validateUpdSession } = require('./internalRequests');


class guacWebSocketGateway extends GuacamoleWebSocketTunnelHandler {

    constructor() {
        GuacamoleLoggerFactory.setGlobalLogger(logger);
        super();
    }
    /**
     * Called whenever the JavaScript Guacamole client makes a connection
     * request. It it up to the implementor of this function to define what
     * conditions must be met for a tunnel to be configured and returned as a
     * result of this connection request (whether some sort of credentials must
     * be specified, for example).
     *
     * @param {WebSocketRequest} request
     *     The TunnelRequest associated with the connection request received.
     *     Any parameters specified along with the connection request can be
     *     read from this object.
     *
     * @return {GuacamoleTunnel}
     *     A newly constructed GuacamoleTunnel if successful, null otherwise.
     *
     * @async
     * @throws GuacamoleException
     *     If an error occurs while constructing the GuacamoleTunnel, or if the
     *     conditions required for connection are not met.
     */
     async doConnect(request) {
        let sessID = request.resourceURL.query['sessID']; 
        if (!sessID) {
            throw new GuacamoleExceptions.GuacamoleUnauthorizedException("Missing seesion id");
        }
        this.sessID = sessID;

        let sessionParams;
        try {
            sessionParams = await validateUpdSession(sessID,2);
        } catch (err) {
            throw new GuacamoleExceptions.GuacamoleUnauthorizedException(`Cannot validate session: ${err}`);
        }
        //logger.info(`Found valid session. sessionParams: ${JSON.stringify(sessionParams,null,2)}`);
        let conf = new GuacamoleConfiguration();
        let info = new GuacamoleClientInformation();
        
        conf.protocol = "rdp";
       let width = request.resourceURL.query['width'];
       if (!width) {
           width  = "1024";
       }
       let height = request.resourceURL.query['height'];
       if (!height) {
        height  = "768";
       }
       info.optimalScreenWidth = width;
       info.optimalScreenHeight = height;
        conf.parameters = {
            hostname: sessionParams.session.containerIpAddress,
            port: "3389",
            username: sessionParams.session.containerUserName,
            password: sessionParams.session.containerUserPass,
            "ignore-cert": "true",
            "security": "tls",
            //"color-depth": "8",
            "width": width,
            "height": height
        };

        let gsocket = new ConfiguredGuacamoleSocket("labil.nubosoftware.com", 4822, conf, info);
        console.log(`Before init. Headers: ${JSON.stringify(request.headers,null,2)}`);
        gsocket.on("error", (err) => {
            console.error("ConfiguredGuacamoleSocket error",err);
        });
        await gsocket.init();
        
        console.log("After init..");

        // Create tunnel from now-configured socket
        let tunnel = new GuacamoleTunnel(gsocket);

        // notifi mgmt the session connected
        await validateUpdSession(sessID,0);
        return tunnel;
    }

    

     /**
     * Notify the handler that websocket disconnected
     */
      async onDisconnect(){
          
        if (!this.sessID) {
            return;
        }
        try {
            await validateUpdSession(sessID,1); // send discconnect to the management
        } catch (err) {
            logger.info(`onDisconnect error: ${err}`);
        }
    }

}


module.exports = guacWebSocketGateway;