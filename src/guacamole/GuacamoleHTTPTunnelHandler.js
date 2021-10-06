"use strict"

const GuacamoleLoggerFactory = require('./GuacamoleLoggerFactory');
const GuacamoleTunnel = require('./GuacamoleTunnel');
const GuacamoleExceptions = require('./GuacamoleExceptions');
const GuacamoleStatus = require('./GuacamoleStatus');
const http = require('http');
const URL = require('url').URL;
const GuacamoleHTTPTunnel = require('./GuacamoleHTTPTunnel');

class GuacamoleHTTPTunnelHandler {

    constructor() {
        this.logger = GuacamoleLoggerFactory.getLogger();
        const handler = this;
        setInterval(() => {
            handler.timeoutTask();
        },GuacamoleHTTPTunnelHandler.TUNNEL_TIMEOUT);
    }

    /**
     * Map of absolutely all active tunnels using HTTP, indexed by tunnel UUID.
     */
    tunnels = {};

    /**
     * The prefix of the query string which denotes a tunnel read operation.
     */
    static READ_PREFIX = "read:";

    /**
     * The prefix of the query string which denotes a tunnel write operation.
     */
    static WRITE_PREFIX = "write:";

    /**
     * The length of the read prefix, in characters.
     */
    static READ_PREFIX_LENGTH = GuacamoleHTTPTunnelHandler.READ_PREFIX.length;

    /**
     * The length of the write prefix, in characters.
     */
    static WRITE_PREFIX_LENGTH = GuacamoleHTTPTunnelHandler.WRITE_PREFIX.length;

    /**
     * The length of every tunnel UUID, in characters.
     */
    static UUID_LENGTH = 36;

    /**
     * Registers the given tunnel such that future read/write requests to that
     * tunnel will be properly directed.
     *
     * @param {GuacamoleTunnel} tunnel
     *     The tunnel to register.
     */
    registerTunnel(tunnel) {
        this.tunnels[tunnel.getUUID()] = new GuacamoleHTTPTunnel(tunnel);
        this.logger.debug(`Registered tunnel \"${tunnel.getUUID()}\".` );
    }

    /**
     * Deregisters the given tunnel such that future read/write requests to
     * that tunnel will be rejected.
     *
     * @param {GuacamoleTunnel} tunnel
     *     The tunnel to deregister.
     */
    deregisterTunnel(tunnel) {
        delete this.tunnels[tunnel.getUUID()];
        this.logger.debug(`Deregistered tunnel \"${tunnel.getUUID()}\".`, );
    }

    /**
     * The number of seconds to wait between tunnel accesses before timing out
     * Note that this will be enforced only within a factor of 2. If a tunnel
     * is unused, it will take between TUNNEL_TIMEOUT and TUNNEL_TIMEOUT*2
     * seconds before that tunnel is closed and removed.
     */
    static TUNNEL_TIMEOUT = 15000;

    /**
    * A task which automatically closes and removes tunnels
    * which have not been accessed for at least the given number of
    * milliseconds.
    */
    timeoutTask() {
        //this.logger.info('Timeout task start..');
        const now = Date.now();
        for (const uuid in this.tunnels) {
            if (this.tunnels.hasOwnProperty(uuid)) {
                const httpTunnel = this.tunnels[uuid];
                if (now - httpTunnel.lastAccessedTime > GuacamoleHTTPTunnelHandler.TUNNEL_TIMEOUT) {
                    this.logger.info(`Found timeout tunnel: ${uuid}`);
                    this.deregisterTunnel(httpTunnel.tunnel);
                }
            }
        }
    }

    /**
     * Returns the tunnel with the given UUID, if it has been registered with
     * registerTunnel() and not yet deregistered with deregisterTunnel().
     *
     * @param {String} tunnelUUID
     *     The UUID of registered tunnel.
     *
     * @return {GuacamoleTunnel}
     *     The tunnel corresponding to the given UUID.
     *
     * @throws GuacamoleException
     *     If the requested tunnel does not exist because it has not yet been
     *     registered or it has been deregistered.
     */
    getTunnel(tunnelUUID) {

        // Pull tunnel from map
        let httpTunnel = this.tunnels[tunnelUUID];
        if (httpTunnel == null)
            throw new GuacamoleExceptions.GuacamoleResourceNotFoundException("No such tunnel.");
        httpTunnel.access();
        return httpTunnel.tunnel;

    }


    /**
     * Sends an error on the given HTTP response using the information within
     * the given GuacamoleStatus.
     *
     * @param {http.ServerResponse} response
     *     The HTTP response to use to send the error.
     *
     * @param guacamoleStatusCode
     *     The GuacamoleStatus code to send.
     *
     * @param guacamoleHttpCode
     *     The numeric HTTP code to send.
     *
     * @param message
     *     The human-readable error message to send.
     *
     * @throws ServletException
     *     If an error prevents sending of the error code.
     */
    sendError(response, guacamoleStatusCode, guacamoleHttpCode, message) {

        // If response not committed, send error code and message
        if (!response.headersSent) {
            response.writeHead(guacamoleHttpCode, "Error", {
                "Guacamole-Status-Code": '' + guacamoleStatusCode,
                "Guacamole-Error-Message": message
            });
            response.end();
        }
    }

    /**
     * Dispatches every HTTP GET and POST request to the appropriate handler
     * function based on the query string.
     *
     * @param {http.IncomingMessage} request
     *     The HttpServletRequest associated with the GET or POST request
     *     received.
     *
     * @param {http.ServerResponse} response
     *     The HttpServletResponse associated with the GET or POST request
     *     received.
     *
     */
    async handleTunnelRequest(request, response) {

        try {

            //console.log(`In handleTunnelRequest..`);
            //this.logger.info("Start handleTunnelRequest...");
            let url = new URL(request.url,"http://localhost/");
            if (!url.search)
                throw new Error("No query string provided.")
            let query = url.search.substring(1);

            // If connect operation, call doConnect() and return tunnel UUID
            // in response.
            if (query == "connect" ) {

                let tunnel = await this.doConnect(request);
                if (tunnel != null) {

                    // Register newly-created tunnel
                    this.registerTunnel(tunnel);


                    // Ensure buggy browsers do not cache response
                    response.setHeader("Cache-Control", "no-cache");
                    // Send UUID to client
                    response.write(tunnel.getUUID());
                    response.end();

                }

                // Failed to connect
                else
                    throw new Error("No tunnel created.");

            }

            // If read operation, call doRead() with tunnel UUID, ignoring any
            // characters following the tunnel UUID.
            else if (query.startsWith(GuacamoleHTTPTunnelHandler.READ_PREFIX))
                await this.doRead(request, response, query.substring(
                    GuacamoleHTTPTunnelHandler.READ_PREFIX_LENGTH,
                    GuacamoleHTTPTunnelHandler.READ_PREFIX_LENGTH + GuacamoleHTTPTunnelHandler.UUID_LENGTH));

            // If write operation, call doWrite() with tunnel UUID, ignoring any
            // characters following the tunnel UUID.
            else if (query.startsWith(GuacamoleHTTPTunnelHandler.WRITE_PREFIX))
                await this.doWrite(request, response, query.substring(
                    GuacamoleHTTPTunnelHandler.WRITE_PREFIX_LENGTH,
                    GuacamoleHTTPTunnelHandler.WRITE_PREFIX_LENGTH + GuacamoleHTTPTunnelHandler.UUID_LENGTH));

            // Otherwise, invalid operation
            else
                throw new Error("Invalid tunnel operation: " + query);
        }

        // Catch any thrown guacamole exception and attempt to pass within the
        // HTTP response, logging each error appropriately.
        catch (e) {
            console.error(e);
            if (e instanceof GuacamoleExceptions.GuacamoleClientException) {

                this.logger.warn("HTTP tunnel request rejected: {}", e.getMessage());
                this.sendError(response, e.getStatus().getGuacamoleStatusCode(),
                    e.getStatus().getHttpStatusCode(), e.message);
            } else if (e instanceof GuacamoleExceptions.GuacamoleException) {
                this.logger.error(`HTTP tunnel request failed: ${e.message}`);
                this.logger.debug("Internal error in HTTP tunnel.", e);
                this.sendError(response, e.getStatus().getGuacamoleStatusCode(),
                    e.getStatus().getHttpStatusCode(), "Internal server error.");
            } else {
                this.logger.error(`HTTP tunnel request failed: ${e.message}`);
                this.logger.debug("Internal error in HTTP tunnel.", e);
                let errstatus = GuacamoleStatus.SERVER_ERROR;
                this.sendError(response, errstatus.getGuacamoleStatusCode(),
                    errstatus.getHttpStatusCode(), "Internal server error.");
            }
        }

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
        throw new GuacamoleExceptions.GuacamoleException("Not implemented")
    }

    /**
     * Called whenever the JavaScript Guacamole client makes a read request.
     * This function should in general not be overridden, as it already
     * contains a proper implementation of the read operation.
     *
     * @param {http.IncomingMessage} request
     *     The HttpServletRequest associated with the read request received.
     *
     * @param {http.ServerResponse} response
     *     The HttpServletResponse associated with the write request received.
     *     Any data to be sent to the client in response to the write request
     *     should be written to the response body of this HttpServletResponse.
     *
     * @param {String} tunnelUUID
     *     The UUID of the tunnel to read from, as specified in the write
     *     request. This tunnel must have been created by a previous call to
     *     doConnect().
     *
     * @throws GuacamoleException
     *     If an error occurs while handling the read request.
     */
    async doRead(request, response, tunnelUUID) {

        // Get tunnel, ensure tunnel exists
        let tunnel = this.getTunnel(tunnelUUID);

        // Ensure tunnel is open
        if (!tunnel.isOpen())
            throw new GuacamoleExceptions.GuacamoleResourceNotFoundException("Tunnel is closed.");

        // Obtain exclusive read access
        //this.logger.info(`doRead`);
        let reader = await tunnel.acquireReader();

        try {

            // Note that although we are sending text, Webkit browsers will
            // buffer 1024 bytes before starting a normal stream if we use
            // anything but application/octet-stream.
            response.setHeader('Content-Type', 'application/octet-stream');
            response.setHeader("Cache-Control", "no-cache");

            let isClosed = false;
            let handler = this;
            const closeHandler = () => {
                handler.logger.info(`doRead. Request closed..`);
                isClosed = true;
            }
            response.on('close',closeHandler);


            // Stream data to response, ensuring output stream is closed
            try {
                // Deregister tunnel and throw error if we reach EOF without
                // having ever sent any data
                let message = await reader.read();
                if (message == null)
                    throw new GuacamoleExceptions.GuacamoleConnectionClosedException("Tunnel reached end of stream.");


                // For all messages, until another stream is ready (we send at least one message)
                do {

                    if (response.writableCorked == 0 && reader.available()) {
                        response.cork();
                        this.logger.info(`writableCorked: ${response.writableCorked}`);
                    }
                    // Get message output bytes
                    response.write(message);

                    // Flush if we expect to wait
                    if (!reader.available() && response.writableCorked > 0) {
                        //out.flush();
                        //response.flushBuffer();
                        response.uncork();
                        //this.logger.info(`flush. writableCorked: ${response.writableCorked}`)
                    }

                    // No more messages another stream can take over
                    if (tunnel.hasQueuedReaderThreads())
                        break;

                } while (!isClosed && tunnel.isOpen() && (message = await reader.read()) != null);

                // Close tunnel immediately upon EOF
                if (message == null) {
                    this.deregisterTunnel(tunnel);
                    tunnel.close();
                }

                // End-of-instructions marker
                response.write("0.;");
                if (response.writableCorked > 0) {
                    response.uncork();
                }
                response.removeListener("close",closeHandler);
                response.end();
            }
            catch (e) {

                console.error(e);
                // Send end-of-stream marker and close tunnel if connection is closed
                if (e instanceof GuacamoleExceptions.GuacamoleConnectionClosedException) {

                    // Deregister and close
                    this.deregisterTunnel(tunnel);
                    tunnel.close();

                    // End-of-instructions marker
                    response.write("0.;");
                    if (response.writableCorked > 0) {
                        response.uncork();
                    }
                    response.end();

                }

                else {

                    // Deregister and close
                    this.deregisterTunnel(tunnel);
                    tunnel.close();

                    throw e;
                }
            }


        }
        catch (e) {

            // Log typically frequent I/O error if desired
            console.error(e);
            this.logger.error("Error writing to servlet output stream", e);

            // Deregister and close
            this.deregisterTunnel(tunnel);
            tunnel.close();

        }
        finally {
            tunnel.releaseReader();
        }

    }


    /**
     * 
     * @param {http.IncomingMessage} readable 
     * @returns 
     */
    readWait(readable) {
        return new Promise((resolve, reject) => {
            try {
                //this.logger.info(`readWait. ${readable.headers['content-length']}`);
                let chunk = readable.read();
                if (chunk) {
                    resolve(chunk);
                    return;
                }
            } catch (err) {
                reject(err);
            }
            const readableHandler = () => {
                try {
                    const chunk = readable.read();
                    readable.removeListener("readable", readableHandler);
                    resolve(chunk);
                } catch (err) {
                    reject(err);
                }
            };
            readable.on('readable', readableHandler);
        });
    }

    /**
     * Called whenever the JavaScript Guacamole client makes a write request.
     * This function should in general not be overridden, as it already
     * contains a proper implementation of the write operation.
     *
     * @param {http.IncomingMessage} request
     *     The HttpServletRequest associated with the write request received.
     *     Any data to be written will be specified within the body of this
     *     request.
     *
     * @param {http.ServerResponse} response
     *     The HttpServletResponse associated with the write request received.
     *
     * @param {String} tunnelUUID
     *     The UUID of the tunnel to write to, as specified in the write
     *     request. This tunnel must have been created by a previous call to
     *     doConnect().
     *
     * @throws GuacamoleException
     *     If an error occurs while handling the write request.
     */
    async doWrite(request, response, tunnelUUID) {

        console.log(`doWrite: tunnel: ${tunnelUUID}`);
;        let tunnel = this.getTunnel(tunnelUUID);

        // We still need to set the content type to avoid the default of
        // text/html, as such a content type would cause some browsers to
        // attempt to parse the result, even though the JavaScript client
        // does not explicitly request such parsing.
        response.setHeader('Content-Type', 'application/octet-stream');
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader('Content-Length','0');

        // Send data
        try {

            // Get writer from tunnel
            let writer = await tunnel.acquireWriter();
            //this.logger.info(`doWrite. acquired writer`);

            request.setEncoding("utf8");

            // Transfer data from input stream to tunnel output, ensuring
            // input is always closed

                let chunk;
                const contentLength = request.headers['content-length'];
                if (!contentLength || contentLength == 0) {
                    contentLength = -1;
                }
                let charCnt = 0;

                // Transfer data using buffer
                while (tunnel.isOpen() && (charCnt < contentLength  || contentLength < 0 ) && (chunk = await this.readWait(request)) ) {
                    charCnt += chunk.length;
                    //this.logger.info(`Read from http ${chunk.length} chars. total: ${charCnt}, contentLength: ${contentLength}`);
                    writer.write(chunk);
                }
                //this.logger.info(`doWrite. Finish on end of stream`);
                response.end();




        } catch (e) {
            console.error(e);
            if (e instanceof GuacamoleExceptions.GuacamoleConnectionClosedException) {
                logger.debug("Connection to guacd closed.", e);
            } else {

                // Deregister and close
                this.deregisterTunnel(tunnel);
                tunnel.close();

                throw new GuacamoleExceptions.GuacamoleServerException("I/O Error sending data to server: " + e.message, e);
            }
        }
        finally {
            tunnel.releaseWriter();
        }

    }
}

module.exports = GuacamoleHTTPTunnelHandler;

