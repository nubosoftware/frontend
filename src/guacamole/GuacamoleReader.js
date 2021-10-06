"use strict";

const { GuacamoleException, GuacamoleConnectionClosedException, GuacamoleServerException } = require('./GuacamoleExceptions');
const GuacamoleInstruction = require( './GuacamoleInstruction');
const GuacamoleLoggerFactory = require('./GuacamoleLoggerFactory');


class GuacamoleReader {
    /**
     *
     * @param { stream.Readable } stream
     */
    constructor(stream) {
        this.stream = stream;
        this.chunks = [];
        //this.instructions = [];
        this.open = true;
        this.parseStart = 0;
        this.waitQ = [];
        this.logger = GuacamoleLoggerFactory.getLogger();

        this.stream.setEncoding('utf8');
        /*this.stream.on('data', (chunk) => {
            //this.logger.info(`Got ${chunk.length} characters of string data: ${chunk}`, );
            this.addChunk(chunk,false);
        });*/

        // 'end' will be triggered once when there is no more data available
        this.stream.on('end', () => {
            this.logger.info('Reached end of stream.');
            this.open = false;
        });
    }

    available() {
        return (this.chunks.length > 0 || this.stream.readableLength > 0);
    }


    addChunk(chunk,addToStart) {
        if (this.waitQ.length > 0) {
            const { resolve } = this.waitQ.shift();
            resolve(chunk);
        } else if (addToStart) {
            this.chunks.unshift(chunk);
        } else {
            this.chunks.push(chunk);
        }
    }

    /**
     * Read instruction from stream
     */
    async read() {
        let chunk = this.chunks.shift();
        if (!chunk) {
            chunk = await this.waitForNextChunk();
        }
        while (true) {
            let elementLength = 0;
            let usedLength = (chunk ? chunk.length : 0);

            // Resume where we left off
            let i = this.parseStart;
            //this.logger.info(`parse chunk: ${chunk}`);
            //this.logger.info(`usedLength: ${usedLength}`);

            // Parse instruction in buffer
            while (i < usedLength) {
                // Read character
                //this.logger.info(`i: ${i}`);
                let readChar = chunk[i++];
                //this.logger.info(`readChar: ${readChar}`);
                if (readChar >= '0' && readChar <= '9') {
                    let n = parseInt(readChar);
                    elementLength = elementLength * 10 + n;
                } // If not digit, check for end-of-length character
                else if (readChar == '.') {
                    //this.logger.info(`readChar == '.',  elementLength: ${elementLength}`);
                    // Check if element present in buffer
                    if (i + elementLength < usedLength) {
                        // Get terminator
                        let terminator = chunk[i + elementLength];

                        // Move to character after terminator
                        i += elementLength + 1;

                        // Reset length
                        elementLength = 0;

                        // Continue here if necessary
                        this.parseStart = i;

                        // If terminator is semicolon, we have a full
                        // instruction.fread()
                        if (terminator == ';') {

                            // Copy instruction data
                            let instruction = chunk.substr(0,i);
                            //char[] instruction = new char[i];
                            //System.arraycopy(buffer, 0, instruction, 0, i);

                            // Update buffer
                            usedLength -= i;
                            this.parseStart = 0;
                            if (usedLength > 0) {
                                // return back the remain of the chunk
                                let remainchunk = chunk.substring(i);
                                this.addChunk(remainchunk,true);
                            }

                            return instruction;
                        }

                        // Handle invalid terminator characters
                        else if (terminator != ',') {
                            this.logger.info(`Element terminator of instruction was not ';' nor ','. terminator: ${terminator}`)
                            throw new GuacamoleServerException("Element terminator of instruction was not ';' nor ','");
                        }

                    }

                    // Otherwise, read more data
                    else
                        break;

                }

                // Otherwise, parse error
                else
                    throw new GuacamoleServerException("Non-numeric character in element length.");
            }

            let nextChunk = this.chunks.shift();
            if (!nextChunk) {
                // wait for new chunk
                nextChunk = await this.waitForNextChunk();
            }
            chunk = chunk + nextChunk;
        }
    }

    /*waitForNextChunk() {
        const r = this;
        const p = new Promise((resolve, reject) => {
            let nextChunk = this.chunks.shift();
            if (!nextChunk) {
                r.waitQ.push({ resolve, reject });
            } else {
                resolve(nextChunk);
            }
        });
        return p;

    }*/

    async waitForNextChunk() {
        try {
            if (this.chunks.length == 0) {
                let chunk = await this.readWait();
                return chunk;
            } else {
                return this.chunks.shift();
            }
        } catch (err) {
            this.logger.info(`Stream read error: ${err}`);
            throw new GuacamoleConnectionClosedException(`Stream read error: ${err}`,err);
        }
    }



    readWait() {
        return new Promise((resolve, reject) => {
            try {
                let chunk = this.stream.read();
                if (chunk) {
                    resolve(chunk);
                    return;
                }
            } catch (err) {
                reject(err);
            }
            const readableHandler = () => {
                try {
                    const chunk = this.stream.read();
                    this.stream.removeListener("readable", readableHandler);
                    resolve(chunk);
                } catch (err) {
                    reject(err);
                }
            };
            this.stream.on('readable', readableHandler);
        });
    }

    async readInstruction()  {

        // Get instruction
        let instructionBuffer = await this.read();

        // If EOF, return EOF
        if (instructionBuffer == null)
            return null;

        // Start of element
        let elementStart = 0;

        // Build list of elements
        //Deque<String> elements = new LinkedList<String>();
        let elements = [];
        while (elementStart < instructionBuffer.length) {

            // Find end of length
            let lengthEnd = -1;
            for (let i=elementStart; i<instructionBuffer.length; i++) {
                if (instructionBuffer[i] == '.') {
                    lengthEnd = i;
                    break;
                }
            }

            // read() is required to return a complete instruction. If it does
            // not, this is a severe internal error.
            if (lengthEnd == -1)
                throw new GuacamoleServerException("Read returned incomplete instruction.");

            // Parse length
            let length = parseInt(instructionBuffer.substr(elementStart,lengthEnd-elementStart));
            // let length = Integer.parseInt(new String(
            //         instructionBuffer,
            //         elementStart,
            //         lengthEnd - elementStart
            // ));

            // Parse element from just after period
            elementStart = lengthEnd + 1;
            let element = instructionBuffer.substr(elementStart,length);
            // String element = new String(
            //         instructionBuffer,
            //         elementStart,
            //         length
            // );

            // Append element to list of elements
            elements.push(element);

            // Read terminator after element
            elementStart += length;
            let terminator = instructionBuffer[elementStart];

            // Continue reading instructions after terminator
            elementStart++;

            // If we've reached the end of the instruction
            if (terminator == ';')
                break;

        }

        // Pull opcode off elements list
        let opcode = elements.shift();
        // Create instruction
        let instruction = new GuacamoleInstruction(opcode,elements);

        //this.logger.info(`Parsed instruction: ${instruction.print()}`);


        // Return parsed instruction
        return instruction;

    }

}

module.exports = GuacamoleReader;