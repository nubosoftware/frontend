const WebSocketRequest = require("websocket").request;
const WebSocketConnection = require("websocket").connection;
const GuacamoleLoggerFactory = require('./GuacamoleLoggerFactory');
const GuacamoleTunnel = require('./GuacamoleTunnel');
const { GuacamoleException, GuacamoleClientException, GuacamoleConnectionClosedException } = require('./GuacamoleExceptions');
const GuacamoleStatus = require('./GuacamoleStatus');
const GuacamoleInstruction = require('./GuacamoleInstruction');
const FilteredGuacamoleWriter = require('./FilteredGuacamoleWriter');


class GuacamoleWebSocketTunnelHandler {


    /**
     * The guac tunnel to the remote server
     * @type {GuacamoleTunnel}
     */
    tunnel = null;

    /**
     * The web socket connection
     * @type {WebSocketConnection}
     */
    connection = null;


    /**
     * The default, minimum buffer size for instructions.
     */
    static BUFFER_SIZE = 8192;

    /**
     * The opcode of the instruction used to indicate a connection stability
     * test ping request or response. Note that this instruction is
     * encapsulated within an internal tunnel instruction (with the opcode
     * being the empty string), thus this will actually be the value of the
     * first element of the received instruction.
     */
    static PING_OPCODE = "ping";

    constructor() {
        this.logger = GuacamoleLoggerFactory.getLogger();
        GuacamoleLoggerFactory.getLogger();
    }

    connectionClosed = false;

    /**
     * Sends the given numeric Guacamole and WebSocket status
     * on the given WebSocket connection and closes the
     * connection.
     *
     * @param {WebSocketConnection} connection
     *     The WebSocket connection to close.
     *
     * @param guacamoleStatusCode
     *     The numeric Guacamole Status code to send.
     *
     * @param webSocketCode
     *     The numeric WebSocket status code to send.
     */
    closeConnectionImp(connection, guacamoleStatusCode, webSocketCode) {
        if (!this.connectionClosed) {
            this.connectionClosed = true;
            connection.close(webSocketCode, '' + guacamoleStatusCode);
        }
    }

    /**
     * Sends the given status on the given WebSocket connection
     * and closes the connection.
     *
     * @param {WebSocketConnection} connection
     *     The WebSocket connection to close.
     *
     * @param {GuacamoleStatus} guacStatus
     *     The status to send.
     */
    closeConnection(connection, guacStatus) {

        this.closeConnectionImp(connection, guacStatus.getGuacamoleStatusCode(),
            guacStatus.getWebSocketCode());

    }


    async onMessage(msg) {
        let handler = this;
        let writer = await this.tunnel.acquireWriter();
        /**
         * 
         * @param {GuacamoleInstruction} instruction 
         */
        const filterFunc = (instruction) => {
            // Filter out all tunnel-internal instructions

            //handler.logger.info(`filterFunc. instruction.opcode: "${instruction.opcode}"`);
            if (instruction.opcode == GuacamoleTunnel.INTERNAL_DATA_OPCODE) {
                //handler.logger.info(`filterFunc. send ping`);
                // Respond to ping requests
                let args = instruction.args;
                if (args.length >= 2 && args[0] == GuacamoleWebSocketTunnelHandler.PING_OPCODE) {

                    try {
                        const pingArgs = [GuacamoleWebSocketTunnelHandler.PING_OPCODE, args[1]];
                        handler.sendInstruction(new GuacamoleInstruction(
                            GuacamoleTunnel.INTERNAL_DATA_OPCODE,
                            pingArgs
                        ));
                    }
                    catch (e) {
                        logger.debug("Unable to send \"ping\" response for WebSocket tunnel.", e);
                    }

                }

                return null;

            }

            // Pass through all non-internal instructions untouched
            return instruction;
        }
        let filteredWriter = new FilteredGuacamoleWriter(writer, filterFunc);
        filteredWriter.writeChunk(msg);
        this.tunnel.releaseWriter();
    }

    async doWebSocketConnect(request) {
        this.logger.info("websocket request: " + JSON.stringify(request.resourceURL, null, 2));
        /*if (!request.serverConfig) {
            request.serverConfig = {};
        }
        request.serverConfig.disableNagleAlgorithm = true;*/
        //this.logger.info("serverConfig: " + JSON.stringify(request.serverConfig, null, 2));
        this.connection = request.accept("guacamole", request.origin);
        

        let handler = this;
        this.connection.on('message', function (msg) {

            if (!handler.tunnel) {
                return;
            }
            if (msg.type != "utf8") {
                handler.logger.info(`Websocket message is not utf8!`);
                return;
            }
            //handler.logger.info(`Websocket message is utf8Data: ${msg.utf8Data}`);
            handler.onMessage(msg.utf8Data);

        });
        this.connection.on('close', function (code, reason) {
            handler.logger.info('WebSocket client disconnected: ' + code + ' [' + reason + ']');
            if (handler.tunnel) {
                try {
                    handler.tunnel.close();
                } catch (err) {
                    handler.logger.info(`Tunnel close error: ${err}`);
                }
            }
            handler.onDisconnect();
        });
        this.connection.on('error', function (a) {
            handler.logger.info('WebSocket client error: ' + a);
            if (handler.tunnel) {
                try {
                    handler.tunnel.close();
                } catch (err) {
                    handler.logger.info(`Tunnel close error: ${err}`);
                }
            }
        });



        try {
            this.tunnel = await this.doConnect(request);
        }
        catch (e) {
            let status;
            if (e instanceof GuacamoleException) {
                status = e.getStatus();
            } else {
                status = GuacamoleStatus.UPSTREAM_UNAVAILABLE;

            }
            this.logger.error(`Creation of WebSocket tunnel to guacd failed: ${e}`,);
            this.logger.debug(`Error connecting WebSocket tunnel.`, e);
            this.closeConnection(this.connection, status);
            return;
        }
        if (this.tunnel == null) {
            this.closeConnection(this.connection, GuacamoleStatus.RESOURCE_NOT_FOUND);
            return;
        }

        this.tunnel.on('error', function(err) {
            handler.logger.info('target error: ' + err);
            handler.closeConnection(handler.connection, GuacamoleStatus.UPSTREAM_ERROR);
        });
        this.tunnel.on('close', function(err) {
            handler.logger.info('target closed');
            handler.closeConnection(handler.connection, GuacamoleStatus.SERVER_ERROR);
        });

        //this.logger.info("acquireReader");
        let reader = await this.tunnel.acquireReader();
        let readMessage;
        let buffer = "";




        try {

            //this.logger.info("Send tunnel UUID");
            // Send tunnel UUID
            this.sendInstruction(new GuacamoleInstruction(
                GuacamoleTunnel.INTERNAL_DATA_OPCODE,
                [this.tunnel.getUUID()]
            ));
            // Attempt to read
            //this.logger.info("Attempt to read");
            while ((readMessage = await reader.read()) != null) {

                //this.logger.info("Read: "+readMessage);
                // Buffer message
                buffer += readMessage;

                // Flush if we expect to wait or buffer is getting full
                if (!reader.available() || buffer.length >= GuacamoleWebSocketTunnelHandler.BUFFER_SIZE) {
                    this.sendInstructionStr(buffer);
                    buffer = "";
                }

            }

            // No more data
            this.closeConnection(this.connection, GuacamoleStatus.SUCCESS);

        }

        // Catch any thrown guacamole exception and attempt
        // to pass within the WebSocket connection, logging
        // each error appropriately.
        catch (e) {
            if (e instanceof GuacamoleClientException) {
                this.logger.info(`WebSocket connection terminated: ${e}`);
                this.logger.debug(`WebSocket connection terminated due to client error.`, e);
                this.closeConnection(this.connection, e.getStatus());
            } else if (e instanceof GuacamoleConnectionClosedException) {
                logger.debug("Connection to guacd closed.", e);
                this.closeConnection(this.connection, GuacamoleStatus.SUCCESS);
            } else if (e instanceof GuacamoleException) {
                this.logger.error(`Connection to guacd terminated abnormally: ${e}`);
                this.logger.debug("Internal error during connection to guacd.", e);
                this.closeConnection(this.connection, e.getStatus());
            } else {
                console.error(e);
                this.logger.error(`WebSocket tunnel read failed due to I/O error.: ${e}`, e);
                this.closeConnection(this.connection, GuacamoleStatus.SERVER_ERROR);
            }
        }


        //new_client(connection, request.origin, request.resourceURL);


    }

    /**
     * Sends a Guacamole instruction along the outbound WebSocket
     * connection to the connected Guacamole client. If an instruction
     * is already in the process of being sent by another thread, this
     * function will block until in-progress instructions are complete.
     *
     * @param {String} buffer
     *     The instruction to send.
     *
     * @throws IOException
     *     If an I/O error occurs preventing the given instruction from
     *     being sent.
     */
    sendInstructionStr(buffer) {
        //this.logger.info("sendInstructionStr: "+buffer);
        this.connection.sendUTF(buffer);
    }

    /**
    * Sends a Guacamole instruction along the outbound WebSocket
    * connection to the connected Guacamole client. If an instruction
    * is already in the process of being sent by another thread, this
    * function will block until in-progress instructions are complete.
    *
    * @param {GuacamoleInstruction} instruction
    *     The instruction to send.
    *
    * @throws IOException
    *     If an I/O error occurs preventing the given instruction from being
    *     sent.
    */
    sendInstruction(instruction) {
        this.sendInstructionStr(instruction.toString());
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
        throw new GuacamoleException('Not implemented');
    }

    /**
     * Notify the handler that websocket disconnected
     */
    async onDisconnect(){
        // not implemented
    }


}

module.exports = GuacamoleWebSocketTunnelHandler;