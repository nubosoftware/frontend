const GuacamoleTunnel = require("./GuacamoleTunnel");


/**
 * Tracks the last time a particular GuacamoleTunnel was accessed. This
 * information is not necessary for tunnels associated with WebSocket
 * connections, as each WebSocket connection has its own read thread which
 * continuously checks the state of the tunnel and which will automatically
 * timeout when the underlying socket times out, but the HTTP tunnel has no
 * such thread. Because the HTTP tunnel requires the stream to be split across
 * multiple requests, tracking of activity on the tunnel must be performed
 * independently of the HTTP requests.
 */
 class GuacamoleHTTPTunnel  {

    /**
     * The last time this tunnel was accessed.
     */
    lastAccessedTime;

    /**
     * 
     * {GuacamoleTunnel} 
     */
    tunnel;

    /**
     * Creates a new GuacamoleHTTPTunnel which wraps the given tunnel.
     * Absolutely all function calls on this new GuacamoleHTTPTunnel will be
     * delegated to the underlying GuacamoleTunnel.
     *
     * @param {GuacamoleTunnel} tunnel
     *     The GuacamoleTunnel to wrap within this GuacamoleHTTPTunnel.
     */
    constructor(tunnel) {
        this.tunnel = tunnel;
    }

    /**
     * Updates this tunnel, marking it as recently accessed.
     */
    access() {
        this.lastAccessedTime = Date.now();
    }

    /**
     * Returns the time this tunnel was last accessed, as the number of
     * milliseconds since midnight January 1, 1970 GMT. Tunnel access must
     * be explicitly marked through calls to the access() function.
     *
     * @return
     *     The time this tunnel was last accessed.
     */
    getLastAccessedTime() {
        return this.lastAccessedTime;
    }

}

module.exports = GuacamoleHTTPTunnel;