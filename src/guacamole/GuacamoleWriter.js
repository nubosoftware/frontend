"use strict";

const GuacamoleInstruction = require( './GuacamoleInstruction');

class GuacamoleWriter {
    /**
     *
     * @param { stream.Readable } stream
     */
    constructor(stream) {
        this.output = stream;
    }
    /**
     *
     * @param {GuacamoleInstruction} instruction
     */
    async writeInstructionAsync(instruction) {
        //console.log(`writeInstruction: ${instruction.toString()}`);
        await this.write(instruction.toString());
        //console.log(`written`);
    }

    writeInstruction(instruction) {
        const chunk = instruction.toString();
        try {
            this.output.write(chunk);
        } catch (err) {
            console.error(`Error write`,err);
        }
    }

    write(chunk) {
        return new Promise((resolve, reject) => {
            if (this._err) {
                reject(this._err);
                return;
            }

            let haveListeners = true;

            const writeHandler = () => {
                if (haveListeners) {
                    removeListeners();
                    resolve();
                }
            };

            const closeHandler = () => {
                if (haveListeners) {
                    removeListeners()
                    reject(new Error("GuacamoleWriter: Connection closed"))
                }
            };

            const endHandler = () => {
                if (haveListeners) {
                    removeListeners()
                    reject(new Error("GuacamoleWriter: Connection ended"))
                }
            };

            const errorHandler = (err) => {
                if (haveListeners) {
                    removeListeners()
                    reject(err)
                }
            };

            const removeListeners = () => {
                haveListeners = false;
                this.output.removeListener("close", closeHandler);
                this.output.removeListener("error", errorHandler);
                this.output.removeListener("end", endHandler);
            }
            this.output.on("close", closeHandler);
            this.output.on("end", endHandler);
            this.output.on("error", errorHandler);
            try {
                this.output.write(chunk, writeHandler);
            } catch (err) {
                //nc.log(`write error: ${err}`);
                errorHandler(err);
            }
        });
    }
}

module.exports = GuacamoleWriter;