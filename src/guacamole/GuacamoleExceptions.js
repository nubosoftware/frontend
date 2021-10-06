const GuacamoleStatus = require('./GuacamoleStatus');

/**
 * A generic exception thrown when parts of the Guacamole API encounter
 * errors.
 */
class GuacamoleException extends Error {

    /**
     * Creates a new GuacamoleException with the given message and cause.
     *
     * @param message A human readable description of the exception that
     *                occurred.
     * @param cause The cause of this exception.
     */
    constructor(message, cause) {
        super(message);
        if (cause) {
            this.stack = cause.stack;
        }
    }



    /**
     * Returns the Guacamole status associated with this exception. This status
     * can then be easily translated into an HTTP error code or Guacamole
     * protocol error code.
     *
     * @return The corresponding Guacamole status.
     */
    getStatus() {
        return GuacamoleStatus.SERVER_ERROR;
    }

    /**
     * Returns the most applicable HTTP status code that can be associated
     * with this exception.
     *
     * @return
     *     An integer representing the most applicable HTTP status code
     *     associated with this exception.
     */
    getHttpStatusCode() {
        return getStatus().getHttpStatusCode();
    }

    /**
     * Returns the most applicable WebSocket status code that can be
     * associated with this exception.
     *
     * @return
     *     An integer representing the most applicable WebSocket status
     *     code associated with this exception.
     */
    getWebSocketCode() {
        return getStatus().getWebSocketCode();
    }

}

/**
 * A generic exception thrown when part of the Guacamole API encounters
 * an error in the client's request. Such an error, if correctable, usually
 * requires correction on the client side, not the server.
 */
class GuacamoleClientException extends GuacamoleException {
    getStatus() {
        return GuacamoleStatus.CLIENT_BAD_REQUEST;
    }
}

/**
 * An exception which is thrown when data has been submitted with an unsupported
 * mimetype.
 */
class GuacamoleClientBadTypeException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.CLIENT_BAD_TYPE;
    }
}

/**
 * An exception which is thrown when the client has sent too much data. This
 * usually indicates that a server-side buffer is not large enough to
 * accommodate the data, or protocol specifications prohibit data of the size
 * received.
 */
class GuacamoleClientOverrunException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.CLIENT_OVERRUN;
    }
}

/**
 * An exception which is thrown when the client is taking too long to respond.
 */
class GuacamoleClientTimeoutException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.CLIENT_TIMEOUT;
    }
}

/**
 * An exception which is thrown when too many requests have been received
 * by the current client, and further requests are being rejected, either
 * temporarily or permanently.
 */
class GuacamoleClientTooManyException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.CLIENT_TOO_MANY;
    }
}

/**
 * An exception which is thrown when a resource is no longer available because
 * it is closed.
 */
class GuacamoleResourceClosedException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.RESOURCE_CLOSED;
    }
}

/**
 * An exception which is thrown when a resource has been requested, but that
 * resource is locked or currently in use, and cannot be accessed by the
 * current user.
 */
class GuacamoleResourceConflictException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.RESOURCE_CONFLICT;
    }
}

/**
 * A generic exception thrown when part of the Guacamole API fails to find
 * a requested resource, such as a configuration or tunnel.
 */
class GuacamoleResourceNotFoundException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.RESOURCE_NOT_FOUND;
    }
}

/**
 * A security-related exception thrown when parts of the Guacamole API is
 * denying access to a resource.
 */
class GuacamoleSecurityException extends GuacamoleClientException {
    getStatus() {
        return GuacamoleStatus.CLIENT_FORBIDDEN;
    }
}

/**
 * A generic exception thrown when part of the Guacamole API encounters
 * an unexpected, internal error. An internal error, if correctable, would
 * require correction on the server side, not the client.
 */
class GuacamoleServerException extends GuacamoleException {
    getStatus() {
        return GuacamoleStatus.SERVER_ERROR;
    }
}

/**
 * An exception which is thrown when the server is too busy to service the
 * request.
 */
class GuacamoleServerBusyException extends GuacamoleServerException {
    getStatus() {
        return GuacamoleStatus.SERVER_BUSY;
    }
}

/**
 * An exception which indicates than an upstream server (such as the remote
 * desktop) is returning an error or is otherwise unreachable.
 */
class GuacamoleUpstreamException extends GuacamoleException {
    getStatus() {
        return GuacamoleStatus.UPSTREAM_ERROR;
    }
}

/**
 * An exception which indicates that a session within an upstream server (such
 * as the remote desktop) has been forcibly terminated.
 */
class GuacamoleSessionClosedException extends GuacamoleUpstreamException {
    getStatus() {
        return GuacamoleStatus.SESSION_CLOSED;
    }
}

/**
 * An exception which indicates that a session within an upstream server (such
 * as the remote desktop) has ended because it conflicted with another session.
 */
class GuacamoleSessionConflictException extends GuacamoleUpstreamException {
    getStatus() {
        return GuacamoleStatus.SESSION_CONFLICT;
    }
}

/**
 * An exception which indicates that a session within an upstream server (such
 * as the remote desktop) has ended because it appeared to be inactive.
 */
class GuacamoleSessionTimeoutException extends GuacamoleUpstreamException {
    getStatus() {
        return GuacamoleStatus.SESSION_TIMEOUT;
    }
}

/**
 * A security-related exception thrown when parts of the Guacamole API is
 * denying access to a resource, but access MAY be granted were the user
 * authorized (logged in).
 */
class GuacamoleUnauthorizedException extends GuacamoleSecurityException {
    getStatus() {
        return GuacamoleStatus.CLIENT_UNAUTHORIZED;
    }
}

/**
 * An exception which is thrown when the requested operation is unsupported
 * or unimplemented.
 */
class GuacamoleUnsupportedException extends GuacamoleServerException {
    getStatus() {
        return GuacamoleStatus.UNSUPPORTED;
    }
}

/**
 * An exception which indicates that an upstream server (such as the remote
 * desktop) does not appear to exist.
 */
class GuacamoleUpstreamNotFoundException extends GuacamoleUpstreamException {
    getStatus() {
        return GuacamoleStatus.UPSTREAM_NOT_FOUND;
    }
}

/**
 * An exception which indicates than an upstream server (such as the remote
 * desktop) is taking too long to respond.
 */
class GuacamoleUpstreamTimeoutException extends GuacamoleUpstreamException {
    getStatus() {
        return GuacamoleStatus.UPSTREAM_TIMEOUT;
    }
}

/**
 * An exception which indicates that an upstream server (such as the remote
 * desktop) is not available to service the request.
 */
class GuacamoleUpstreamUnavailableException extends GuacamoleUpstreamException {
    getStatus() {
        return GuacamoleStatus.UPSTREAM_UNAVAILABLE;
    }
}

/**
 * An exception which is thrown when an operation cannot be performed because
 * its corresponding connection is closed.
 */
class GuacamoleConnectionClosedException extends GuacamoleServerException {
    getStatus() {
        return GuacamoleStatus.SERVER_ERROR;
    }
}

module.exports = {
    GuacamoleException,
    GuacamoleClientBadTypeException,
    GuacamoleClientException,
    GuacamoleClientOverrunException,
    GuacamoleClientTimeoutException,
    GuacamoleClientTooManyException,
    GuacamoleResourceClosedException,
    GuacamoleResourceConflictException,
    GuacamoleResourceNotFoundException,
    GuacamoleSecurityException,
    GuacamoleServerBusyException,
    GuacamoleServerException,
    GuacamoleSessionClosedException,
    GuacamoleSessionConflictException,
    GuacamoleSessionTimeoutException,
    GuacamoleUnauthorizedException,
    GuacamoleUnsupportedException,
    GuacamoleUpstreamException,
    GuacamoleUpstreamTimeoutException,
    GuacamoleUpstreamUnavailableException,
    GuacamoleConnectionClosedException
}