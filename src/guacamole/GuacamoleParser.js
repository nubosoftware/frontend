
const { GuacamoleServerException } = require("./GuacamoleExceptions");
const GuacamoleInstruction = require("./GuacamoleInstruction");


/**
 * Parser for the Guacamole protocol. Arbitrary instruction data is appended,
 * and instructions are returned as a result. Invalid instructions result in
 * exceptions.
 */
class GuacamoleParser {

    /**
     * The maximum number of characters per instruction.
     */
    static INSTRUCTION_MAX_LENGTH = 8192;

    /**
     * The maximum number of digits to allow per length prefix.
     */
    static INSTRUCTION_MAX_DIGITS = 5;

    /**
     * The maximum number of elements per instruction, including the opcode.
     */
    static INSTRUCTION_MAX_ELEMENTS = 64;


    /**
     * The parser is currently waiting for data to complete the length prefix
     * of the current element of the instruction.
     */
    static STATE_PARSING_LENGTH = 0;

    /**
     * The parser has finished reading the length prefix and is currently
     * waiting for data to complete the content of the instruction.
     */
    static STATE_PARSING_CONTENT = 1;

    /**
     * The instruction has been fully parsed.
     */
    static STATE_COMPLETE = 2;

    /**
     * The instruction cannot be parsed because of a protocol error.
     */
    static STATE_ERROR = 3;



    /**
     * The latest parsed instruction, if any.
     * @type {GuacamoleInstruction}
     */
    parsedInstruction = null;

    /**
     * The parse state of the instruction.
     */
    state = GuacamoleParser.STATE_PARSING_LENGTH;

    /**
     * The length of the current element, if known.
     */
    elementLength = 0;

    /**
     * The number of elements currently parsed.
     */
    elementCount = 0;

    /**
     * All currently parsed elements.
     */
    elements = [];

    /**
     * Appends data from the given buffer to the current instruction.
     * 
     * @param {String} chunk The buffer containing the data to append.
     * @param offset The offset within the buffer where the data begins.
     * @param length The length of the data to append.
     * @return The number of characters appended, or 0 if complete instructions
     *         have already been parsed and must be read via next() before
     *         more data can be appended.
     * @throws GuacamoleException If an error occurs while parsing the new data.
     */
    append(chunk, offset, length) {

        let charsParsed = 0;

        // Do not exceed maximum number of elements
        if (this.elementCount == GuacamoleParser.INSTRUCTION_MAX_ELEMENTS && this.state != GuacamoleParser.STATE_COMPLETE) {
            this.state = GuacamoleParser.STATE_ERROR;
            throw new GuacamoleServerException("Instruction contains too many elements.");
        }

        // Parse element length
        if (this.state == GuacamoleParser.STATE_PARSING_LENGTH) {

            let parsedLength = this.elementLength;
            while (charsParsed < length) {

                // Pull next character
                let c = chunk[offset + charsParsed++];

                // If digit, add to length
                if (c >= '0' && c <= '9') {
                    let n = parseInt(c);
                    parsedLength = parsedLength * 10 + n;
                }

                // If period, switch to parsing content
                else if (c == '.') {
                    this.state = GuacamoleParser.STATE_PARSING_CONTENT;
                    break;
                }

                // If not digit, parse error
                else {
                    this.state = GuacamoleParser.STATE_ERROR;
                    throw new GuacamoleServerException("Non-numeric character in element length.");
                }

            }

            // If too long, parse error
            if (parsedLength > GuacamoleParser.INSTRUCTION_MAX_LENGTH) {
                this.state = GuacamoleParser.STATE_ERROR;
                throw new GuacamoleServerException("Instruction exceeds maximum length.");
            }

            // Save length
            this.elementLength = parsedLength;

        } // end parse length

        // Parse element content, if available
        if (this.state == GuacamoleParser.STATE_PARSING_CONTENT && charsParsed + this.elementLength + 1 <= length) {

            // Read element
            let element = chunk.substr(offset + charsParsed, this.elementLength); //new String(chunk, offset + charsParsed, elementLength);
            charsParsed += this.elementLength;
            this.elementLength = 0;

            // Read terminator char following element
            let terminator = chunk[offset + charsParsed++];

            // Add element to currently parsed elements
            this.elements[this.elementCount++] = element;

            // If semicolon, store end-of-instruction
            if (terminator == ';') {
                this.state = GuacamoleParser.STATE_COMPLETE;
                const opcode = this.elements.shift();
                //console.log(`STATE_COMPLETE. opcode: ${opcode}`);
                this.parsedInstruction = new GuacamoleInstruction(opcode, this.elements);
                //console.log(`STATE_COMPLETE. parsedInstruction: ${this.parsedInstruction}`);
            }

            // If comma, move on to next element
            else if (terminator == ',')
                this.state = GuacamoleParser.STATE_PARSING_LENGTH;

            // Otherwise, parse error
            else {
                this.state = GuacamoleParser.STATE_ERROR;
                throw new GuacamoleServerException("Element terminator of instruction was not ';' nor ','");
            }

        } // end parse content

        return charsParsed;

    }

    /**
     * Appends data from the given buffer to the current instruction.
     * 
     * @param {String} chunk The data to append.
     * @return The number of characters appended, or 0 if complete instructions
     *         have already been parsed and must be read via next() before
     *         more data can be appended.
     * @throws GuacamoleException If an error occurs while parsing the new data.
     */
    appendChunk(chunk) {
        return this.append(chunk, 0, chunk.length);
    }

    hasNext() {
        return (this.state == GuacamoleParser.STATE_COMPLETE);
    }

    next() {

        //console.log(`next() this.state: ${this.state}`);
        // No instruction to return if not yet complete
        if (this.state != GuacamoleParser.STATE_COMPLETE)
            return null;

        // Reset for next instruction.
        this.state = GuacamoleParser.STATE_PARSING_LENGTH;
        this.elementCount = 0;
        this.elementLength = 0;
        //console.log(`next() parsedInstruction: ${this.parsedInstruction}`);
        return this.parsedInstruction;

    }

}

module.exports = GuacamoleParser;