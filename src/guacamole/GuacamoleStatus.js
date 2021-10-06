const GuacamoleExceptions = require('./GuacamoleExceptions');

/**
 * All possible statuses returned by various Guacamole instructions, each having
 * a corresponding code.
 */
class GuacamoleStatus {

    /**
     * The operation succeeded.
     */
    static SUCCESS = new GuacamoleStatus(200, 1000, 0x0000 )

    /**
     * The requested operation is unsupported.
     */
     static UNSUPPORTED = new GuacamoleStatus(501, 1011, 0x0100,(message) => { throw new GuacamoleExceptions.GuacamoleUnsupportedException(message)})

    /**
     * The operation could not be performed due to an internal failure.
     */
    static SERVER_ERROR = new GuacamoleStatus(500, 1011, 0x0200,(message) => { throw new GuacamoleExceptions.GuacamoleServerException(message)})

    /**
     * The operation could not be performed as the server is busy.
     */
    static SERVER_BUSY = new GuacamoleStatus(503, 1008, 0x0201,(message) => { throw new GuacamoleExceptions.GuacamoleServerBusyException(message)})

    /**
     * The operation could not be performed because the upstream server is not
     * responding.
     */
    static UPSTREAM_TIMEOUT = new GuacamoleStatus(504, 1011, 0x0202,(message) => { throw new GuacamoleExceptions.GuacamoleUpstreamTimeoutException(message)})

    /**
     * The operation was unsuccessful due to an error or otherwise unexpected
     * condition of the upstream server.
     */
    static UPSTREAM_ERROR  = new GuacamoleStatus(502, 1011, 0x0203,(message) => { throw new GuacamoleExceptions.GuacamoleUpstreamException(message)})

    /**
     * The operation could not be performed as the requested resource does not
     * exist.
     */
    static RESOURCE_NOT_FOUND = new GuacamoleStatus(404, 1002, 0x0204,(message) => { throw new GuacamoleExceptions.GuacamoleResourceNotFoundException(message)})

    /**
     * The operation could not be performed as the requested resource is already
     * in use.
     */
    static RESOURCE_CONFLICT = new GuacamoleStatus(409, 1008, 0x0205,(message) => { throw new GuacamoleExceptions.GuacamoleResourceConflictException(message)})

    /**
     * The operation could not be performed as the requested resource is now
     * closed.
     */
    static RESOURCE_CLOSED = new GuacamoleStatus(404, 1002, 0x0206,(message) => { throw new GuacamoleExceptions.GuacamoleResourceClosedException(message)})

    /**
     * The operation could not be performed because the upstream server does
     * not appear to exist.
     */
    static UPSTREAM_NOT_FOUND = new GuacamoleStatus (502, 1011, 0x0207,(message) => { throw new GuacamoleExceptions.GuacamoleUpstreamNotFoundException(message)})

    /**
     * The operation could not be performed because the upstream server is not
     * available to service the request.
     */
    static UPSTREAM_UNAVAILABLE  = new GuacamoleStatus(502, 1011, 0x0208,(message) => { throw new GuacamoleExceptions.GuacamoleUpstreamUnavailableException(message)})

    /**
     * The session within the upstream server has ended because it conflicted
     * with another session.
     */
    static SESSION_CONFLICT  = new GuacamoleStatus(409, 1008, 0x0209,(message) => { throw new GuacamoleExceptions.GuacamoleSessionConflictException(message)})

    /**
     * The session within the upstream server has ended because it appeared to
     * be inactive.
     */
    static SESSION_TIMEOUT = new GuacamoleStatus(408, 1002, 0x020A,(message) => { throw new GuacamoleExceptions.GuacamoleSessionTimeoutException(message)})

    /**
     * The session within the upstream server has been forcibly terminated.
     */
    static SESSION_CLOSED = new GuacamoleStatus(404, 1002, 0x020B,(message) => { throw new GuacamoleExceptions.GuacamoleSessionClosedException(message)})

    /**
     * The operation could not be performed because bad parameters were given.
     */
    static CLIENT_BAD_REQUEST = new GuacamoleStatus(400, 1002, 0x0300,(message) => { throw new GuacamoleExceptions.GuacamoleClientException(message)})

    /**
     * Permission was denied to perform the operation, as the user is not yet
     * authorized (not yet logged in, for example). As HTTP 401 has implications
     * for HTTP-specific authorization schemes, this status continues to map to
     * HTTP 403 ("Forbidden"). To do otherwise would risk unintended effects.
     */
    static CLIENT_UNAUTHORIZED = new GuacamoleStatus(403, 1008, 0x0301,(message) => { throw new GuacamoleExceptions.GuacamoleUnauthorizedException(message)})

    /**
     * Permission was denied to perform the operation, and this operation will
     * not be granted even if the user is authorized.
     */
    static CLIENT_FORBIDDEN = new GuacamoleStatus(403, 1008, 0x0303,(message) => { throw new GuacamoleExceptions.GuacamoleSecurityException(message)})

    /**
     * The client took too long to respond.
     */
    static CLIENT_TIMEOUT = new GuacamoleStatus(408, 1002, 0x0308,(message) => { throw new GuacamoleExceptions.GuacamoleClientTimeoutException(message)})

    /**
     * The client sent too much data.
     */
    static CLIENT_OVERRUN = new GuacamoleStatus(413, 1009, 0x030D,(message) => { throw new GuacamoleExceptions.GuacamoleClientOverrunException(message)})

    /**
     * The client sent data of an unsupported or unexpected type.
     */
    static CLIENT_BAD_TYPE = new GuacamoleStatus(415, 1003, 0x030F,(message) => { throw new GuacamoleExceptions.GuacamoleClientBadTypeException(message)})

    /**
     * The operation failed because the current client is already using too
     * many resources.
     */
    static CLIENT_TOO_MANY = new GuacamoleStatus(429, 1008, 0x031D,(message) => { throw new GuacamoleExceptions.GuacamoleClientTooManyException(message)})

    static values = [GuacamoleStatus.CLIENT_TOO_MANY,GuacamoleStatus.CLIENT_BAD_TYPE,GuacamoleStatus.CLIENT_OVERRUN,GuacamoleStatus.CLIENT_TIMEOUT,GuacamoleStatus.CLIENT_FORBIDDEN,
        GuacamoleStatus.CLIENT_UNAUTHORIZED,GuacamoleStatus.CLIENT_BAD_REQUEST,
        GuacamoleStatus.SESSION_CLOSED,GuacamoleStatus.SESSION_CONFLICT,GuacamoleStatus.SESSION_TIMEOUT,
        GuacamoleStatus.UPSTREAM_ERROR,GuacamoleStatus.UPSTREAM_NOT_FOUND,GuacamoleStatus.UPSTREAM_TIMEOUT,GuacamoleStatus.UPSTREAM_UNAVAILABLE,
        GuacamoleStatus.RESOURCE_CLOSED,GuacamoleStatus.RESOURCE_CONFLICT,GuacamoleStatus.RESOURCE_NOT_FOUND,
        GuacamoleStatus.SERVER_BUSY,GuacamoleStatus.SERVER_ERROR,GuacamoleStatus.SUCCESS,GuacamoleStatus.UNSUPPORTED
    ];

    /**
     * The most applicable HTTP error code.
     */
    http_code;

    /**
     * The most applicable WebSocket error code.
     */
    websocket_code;

    /**
     * The Guacamole protocol status code.
     */
    guac_code;

    exception_builder;

    /**
     * Initializes a GuacamoleStatusCode with the given HTTP and Guacamole
     * status/error code values.
     *
     * @param http_code The most applicable HTTP error code.
     * @param websocket_code The most applicable WebSocket error code.
     * @param guac_code The Guacamole protocol status code.
     */
    constructor(http_code, websocket_code, guac_code, exception_builder) {
        this.http_code = http_code;
        this.websocket_code = websocket_code;
        this.guac_code = guac_code;
        this.exception_builder = exception_builder;
    }

    /**
     * Returns the most applicable HTTP error code.
     *
     * @return The most applicable HTTP error code.
     */
    getHttpStatusCode() {
        return this.http_code;
    }

    /**
     * Returns the most applicable HTTP error code.
     *
     * @return The most applicable HTTP error code.
     */
    getWebSocketCode() {
        return this.websocket_code;
    }

    /**
     * Returns the corresponding Guacamole protocol status code.
     *
     * @return The corresponding Guacamole protocol status code.
     */
    getGuacamoleStatusCode() {
        return this.guac_code;
    }

    /**
     * Returns the GuacamoleStatus corresponding to the given Guacamole
     * protocol status code. If no such GuacamoleStatus is defined, null is
     * returned.
     *
     * @param code
     *     The Guacamole protocol status code to translate into a
     *     GuacamoleStatus.
     *
     * @return {GuacamoleStatus}
     *     The GuacamoleStatus corresponding to the given Guacamole protocol
     *     status code, or null if no such GuacamoleStatus is defined.
     */
    static fromGuacamoleStatusCode(code) {

        // Search for a GuacamoleStatus having the given status code
        for (const status of this.values) {
            if (status.getGuacamoleStatusCode() == code)
                return status;
        }

        // No such status found
        return null;

    }



    /**
     * Returns an instance of the {@link GuacamoleException} subclass
     * corresponding to this Guacamole protocol status code. All status codes
     * have a corresponding GuacamoleException except for {@link SUCCESS}. The
     * returned GuacamoleException will have the provided human-readable
     * message.
     *
     * @param message
     *     A human readable description of the error that occurred.
     *
     * @return {GuacamoleException}
     *     An instance of the {@link GuacamoleException} subclass that
     *     corresponds to this status code and has the provided human-readable
     *     message.
     *
     * @throws IllegalStateException
     *    If invoked on {@link SUCCESS}, which has no corresponding
     *    GuacamoleException.
     */
     toException(message) {
         if (this.exception_builder) {
             return this.exception_builder(message)
         } else {
             return new GuacamoleException(message);
         }
     }

}

module.exports = GuacamoleStatus;