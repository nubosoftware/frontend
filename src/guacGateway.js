"use strict"

const GuacamoleLoggerFactory = require('./guacamole/GuacamoleLoggerFactory');
const GuacamoleTunnel = require('./guacamole/GuacamoleTunnel');
const GuacamoleExceptions = require('./guacamole/GuacamoleExceptions');
const GuacamoleStatus = require('./guacamole/GuacamoleStatus');
const http = require('http');
const URL = require('url').URL;
const GuacamoleHTTPTunnelHandler = require('./guacamole/GuacamoleHTTPTunnelHandler');
const Common = require('./common.js');
const GuacamoleConfiguration = require('./guacamole/GuacamoleConfiguration');
const GuacamoleClientInformation = require('./guacamole/GuacamoleClientInformation');
const ConfiguredGuacamoleSocket = require('./guacamole/ConfiguredGuacamoleSocket');


class GuacGateway extends GuacamoleHTTPTunnelHandler {

    constructor() {
        GuacamoleLoggerFactory.setGlobalLogger(Common.logger);
        super();
    }
    /**
     * Called whenever the JavaScript Guacamole client makes a connection
     * request via HTTP. It it up to the implementor of this function to define
     * what conditions must be met for a tunnel to be configured and returned
     * as a result of this connection request (whether some sort of credentials
     * must be specified, for example).
     *
     * @param {http.IncomingMessage} request
     *     The HttpServletRequest associated with the connection request
     *     received. Any parameters specified along with the connection request
     *     can be read from this object.
     *
     * @return {GuacamoleTunnel}
     *     A newly constructed GuacamoleTunnel if successful, null otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while constructing the GuacamoleTunnel, or if the
     *     conditions required for connection are not met.
     */
     async doConnect(request) {
        let conf = new GuacamoleConfiguration();
        let info = new GuacamoleClientInformation();
        conf.protocol = "rdp";
        /*
        config.setProtocol("rdp");
            config.setParameter("hostname", rdphostname);
            config.setParameter("port", rdpport);
            config.setParameter("password", password);
            config.setParameter("username", username);
            config.setParameter("ignore-cert","true");
            config.setParameter("width", width);
            config.setParameter("height", height);
            config.setParameter("enable-audio","true");
            config.setParameter("disable-audio","false");
        */
       let width = request.headers['width'];
       if (!width) {
           width  = "1024";
       }
       let height = request.headers['height'];
       if (!height) {
        height  = "768";
       }
        conf.parameters = {
            hostname: "172.21.0.4",
            port: "3389",
            username: "test",
            password: "k5yGCe0PHGkMx0Nn",
            "ignore-cert": "true",
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
        return tunnel;
    }
}


module.exports = GuacGateway;