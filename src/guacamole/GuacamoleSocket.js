const { EventEmitter } = require("events");
const { GuacamoleException } = require("./GuacamoleExceptions");
const GuacamoleReader = require("./GuacamoleReader");

/**
 * Provides abstract socket-like access to a Guacamole connection.
 */
 class GuacamoleSocket extends EventEmitter {

    /**
     * Returns the name of the protocol to be used. If the protocol is not
     * known or the implementation refuses to reveal the underlying protocol,
     * null is returned.
     *
     * <p>Implementations <strong>should</strong> aim to expose the name of the
     * underlying protocol, such that protocol-specific responses like the
     * "required" and "argv" instructions can be handled correctly by code
     * consuming the GuacamoleSocket.
     *
     * @return
     *     The name of the protocol to be used, or null if this information is
     *     not available.
     */
    getProtocol() {
        return null;
    }

    /**
     * Returns a GuacamoleReader which can be used to read from the
     * Guacamole instruction stream associated with the connection
     * represented by this GuacamoleSocket.
     *
     * @return {GuacamoleReader} A GuacamoleReader which can be used to read from the
     *         Guacamole instruction stream.
     */
    getReader() { throw new GuacamoleException("Not implemented")}

    /**
     * Returns a GuacamoleWriter which can be used to write to the
     * Guacamole instruction stream associated with the connection
     * represented by this GuacamoleSocket.
     *
     * @return {GuacamoleWriter} A GuacamoleWriter which can be used to write to the
     *         Guacamole instruction stream.
     */
    getWriter(){ throw new GuacamoleException("Not implemented")}


    /**
     * Releases all resources in use by the connection represented by this
     * GuacamoleSocket.
     *
     * @throws GuacamoleException If an error occurs while releasing resources.
     */
    close() { throw new GuacamoleException("Not implemented")}

    /**
     * Returns whether this GuacamoleSocket is open and can be used for reading
     * and writing.
     *
     * @return true if this GuacamoleSocket is open, false otherwise.
     */
    isOpen() { throw new GuacamoleException("Not implemented")}

}

module.exports = GuacamoleSocket;