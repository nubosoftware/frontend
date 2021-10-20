"use strict";



const GuacamoleConfiguration = require('./GuacamoleConfiguration');
const GuacamoleClientInformation = require('./GuacamoleClientInformation');
const GuacamoleReader = require('./GuacamoleReader');
const GuacamoleWriter = require('./GuacamoleWriter');
const GuacamoleInstruction = require('./GuacamoleInstruction');
const GuacamoleProtocolVersion = require('./GuacamoleProtocolVersion');
const net = require('net');
const EventEmitter = require('events');
const GuacamoleLoggerFactory = require('./GuacamoleLoggerFactory');
const GuacamoleSocket = require('./GuacamoleSocket');

const SOCKET_TIMEOUT = 5000;



class ConfiguredGuacamoleSocket extends GuacamoleSocket {


    hostname;
    port;
    /**
     * {GuacamoleConfiguration} config
     */
    config;

    /**
     * {GuacamoleClientInformation} info
     */
    info;

    /**
     * {net.Socket}
     */
    socket;

    reader;
    writer;

    /**
     * The unique identifier associated with this connection, as determined
     * by the "ready" instruction received from the Guacamole proxy.
     */
     id;

     /**
      * The protocol version that will be used to communicate with guacd.  The
      * default is 1.0.0, and, if the server does not provide a specific version
      * it will be assumed that it operates at this version and certain features
      * may be unavailable.
      */
      protocolVersion =
             GuacamoleProtocolVersion.VERSION_1_0_0;


    /**
     *
     * @param {string} hostname
     * @param {number} port
     * @param {GuacamoleConfiguration} config
     * @param {GuacamoleClientInformation} info
     */
    constructor(hostname, port, config, info) {
        super();
        this.hostname = hostname;
        this.port = port;
        this.config = config;
        this.info = info;
        this.logger = GuacamoleLoggerFactory.getLogger();
    }

    async init() {
        this.socket = await this.connect({ port: this.port, host: this.hostname });
        this._open = true;
        this.socket.setNoDelay(true);
        this.logger.info("Connected...")
        const errorHandler = (err) => {
            this.logger.error(`error on soccket`, err);
            this._err = err;
            this._open = false;
            this.emit('error', err);
        };

        const closeHandler = () => {
            this.logger.info(`socket closed`);
            this._open = false;
            this.socket.removeListener("error", errorHandler);
            this.socket.removeListener("close", closeHandler)
            this.emit('close');
        }
        const timeoutHandler = () => {
            this.logger.info(`socket timeout`);
            try {
                this._err = new Error("Socket timeout");
                this._open = false;
                this.socket.destroy(new Error("Socket timeout"));
            } catch (err) {

            }
        }

        this.socket.on("error", errorHandler);
        this.socket.on("close", closeHandler)
        this.socket.on('timeout', timeoutHandler);

        this.reader = new GuacamoleReader(this.socket);
        this.writer = new GuacamoleWriter(this.socket);

        // Get protocol / connection ID
        let select_arg = this.config.connectionID;
        if (select_arg == null)
            select_arg = this.config.protocol;

        // Send requested protocol or connection ID
        this.writer.writeInstruction(new GuacamoleInstruction("select", [select_arg]));

        // Wait for server args
        let args = await this.expect(this.reader, "args");

        //this.logger.info(`Read args: ${JSON.stringify(args.args,null,2)}`);


        // Build args list off provided names and config
        let arg_names = args.args;
        let arg_values = Array(arg_names.length);
        for (let i=0; i<arg_names.length; i++) {

            // Retrieve argument name
            let arg_name = arg_names[i];

            // Check for valid protocol version as first argument
            if (i == 0) {
                let version = GuacamoleProtocolVersion.parseVersion(arg_name);
                this.logger.info(`Parsed version: ${version.toString()}, arg_name: ${arg_name}`);
                if (version != null) {

                    // Use the lowest common version supported
                    if (version.atLeast(GuacamoleProtocolVersion.LATEST))
                        version = GuacamoleProtocolVersion.LATEST;

                    // Respond with the version selected
                    this.logger.info(`Selected version: ${version.toString()}`);
                    arg_values[i] = version.toString();
                    this.protocolVersion = version;
                    continue;

                } else {

                }
            }

            // Get defined value for name
            let value = this.config.parameters[arg_name];

            // If value defined, set that value
            if (value != null) arg_values[i] = value;

            // Otherwise, leave value blank
            else arg_values[i] = "";

        }


        // Send size
        this.writer.writeInstruction(
            new GuacamoleInstruction(
                "size",[
                ''+this.info.optimalScreenWidth,
                ''+this.info.optimalScreenHeight,
                ''+this.info.optimalResolution
                ]
            )
        );

        // Send supported audio formats
        this.writer.writeInstruction(
                new GuacamoleInstruction(
                    "audio",
                    this.info.audioMimetypes
                ));

        // Send supported video formats
        /*await this.writer.writeInstruction(
                new GuacamoleInstruction(
                    "video",
                    this.info.videoMimetypes
                ));*/

        // Send supported image formats
        this.writer.writeInstruction(
                new GuacamoleInstruction(
                    "image",
                    this.info.imageMimetypes
                ));

        // Send client timezone, if supported and available
        /*
        if (GuacamoleProtocolCapability.TIMEZONE_HANDSHAKE.isSupported(protocolVersion)) {
            String timezone = info.getTimezone();
            if (timezone != null)
                writer.writeInstruction(new GuacamoleInstruction("timezone", info.getTimezone()));
        }*/

        this.writer.writeInstruction(new GuacamoleInstruction("timezone", [this.info.timezone]));

        // Send args
        this.writer.writeInstruction(new GuacamoleInstruction("connect", arg_values));

        // Wait for ready, store ID
        let ready = await this.expect(this.reader, "ready");

        let ready_args = ready.args;
        if (ready_args.length == 0)
            throw new Error("No connection ID received");

        this.id = ready.args[0];
        this.logger.info(`Recieved connection id: ${this.id}`);

    }


   /**
     * Returns a GuacamoleReader which can be used to read from the
     * Guacamole instruction stream associated with the connection
     * represented by this GuacamoleSocket.
     *
     * @return {GuacamoleReader} A GuacamoleReader which can be used to read from the
     *         Guacamole instruction stream.
     */
    getReader() { 
        return this.reader;
    }

    /**
     * Returns a GuacamoleWriter which can be used to write to the
     * Guacamole instruction stream associated with the connection
     * represented by this GuacamoleSocket.
     *
     * @return {GuacamoleWriter} A GuacamoleWriter which can be used to write to the
     *         Guacamole instruction stream.
     */
    getWriter(){
        return this.writer;
    }


    /**
     * Releases all resources in use by the connection represented by this
     * GuacamoleSocket.
     *
     * @throws GuacamoleException If an error occurs while releasing resources.
     */
    close() { 
        this.logger.info(`Closing socket...`);
        this.socket.destroy();
    }

    /**
     * Returns whether this GuacamoleSocket is open and can be used for reading
     * and writing.
     *
     * @return true if this GuacamoleSocket is open, false otherwise.
     */
    isOpen() {
        return (!this.socket.destroyed &&  this.socket.readyState == "open");
    }


    /**
     * connect to the remote port and return the net.Socket connection
     * @param {} options 
     * @returns {net.Socket}
     */
    connect(options) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            socket.setTimeout(SOCKET_TIMEOUT);
            // TBD add connection tinmeout
            const connectHandler = () => {
                socket.removeListener("error", errorHandler);
                resolve(socket);
            };
            const errorHandler = (err) => {
                socket.removeListener("connect", connectHandler);
                reject(err)
            };
            socket.once("error", errorHandler);
            socket.connect(options, connectHandler);
        });
    }


    /**
     * Parses the given "error" instruction, throwing a GuacamoleException that
     * corresponds to its status code and message.
     *
     * @param {GuacamoleInstruction} instruction
     *     The "error" instruction to parse.
     *
     * @throws GuacamoleException
     *     A GuacamoleException that corresponds to the status code and message
     *     present within the given "error" instruction.
     */
    handleReceivedError(instruction) {

        // Provide reasonable default error message for invalid "error"
        // instructions that fail to provide one
        let message = "Internal error within guacd / protocol handling.";

        // Consider all error instructions without a corresponding status code
        // to be server errors
        //GuacamoleStatus status = GuacamoleStatus.SERVER_ERROR;
        let statusCode = 500;
        // Parse human-readable message from "error" instruction, warning if no
        // message was given
        const args = instruction.args;
        if (args.length >= 1)
            message = args[0];
        else
            this.logger.info("Received \"error\" instruction with no corresponding message.");

        // Parse the status code from the received error instruction, warning
        // if the status code is missing or invalid
        if (args.length >= 2) {
            try {

                // Translate numeric status code into a GuacamoleStatus
                let statusCode = parseInt(args[1]);


            }
            catch (err) {
                this.logger.info("Received \"error\" instruction with non-numeric status code.", e);
            }
        }
        else
            this.logger.info("Received \"error\" instruction without status code.");

        // Convert parsed status code and message to a GuacamoleException
        throw new Error(`Error message: ${message}, Status code: ${statusCode}`);

    }

    /**
     * Waits for the instruction having the given opcode, returning that
     * instruction once it has been read. If the instruction is never read,
     * an exception is thrown.
     *
     * Respects server control instructions that are allowed during the handshake
     * phase, namely {@code error} and {@code disconnect}.
     *
     * @param {GuacamoleReader} reader
     *     The reader to read instructions from.
     *
     * @param opcode
     *     The opcode of the instruction we are expecting.
     *
     * @return {GuacamoleInstruction}
     *     The instruction having the given opcode.
     *
     * @throws GuacamoleException
     *     If an error occurs while reading, or if the expected instruction is
     *     not read.
     */
    async expect(reader, opcode) {

        this.logger.info(`expect. opcode: ${opcode}`);
        // Wait for an instruction
        let instruction = await reader.readInstruction();
        if (instruction == null)
            throw new Error("End of stream while waiting for \"" + opcode + "\".");

        // Report connection closure if server explicitly disconnects
        if ("disconnect" == instruction.opcode)
            throw new Error("Server disconnected while waiting for \"" + opcode + "\".");

        // Pass through any received errors as GuacamoleExceptions
        if ("error" == instruction.opcode)
            handleReceivedError(instruction);

        // Ensure instruction has expected opcode
        if (opcode != instruction.opcode)
            throw new Error("Expected \"" + opcode + "\" instruction but instead received \"" + instruction.opcode + "\".");


        //this.logger.info(`expect. got instruction for opcode ${opcode}: ${instruction.print()}`);
        return instruction;

    }
}


module.exports = ConfiguredGuacamoleSocket;


