"use strict";


class GuacamoleInstruction {
    /**
     *
     * @param { string } opcode
     * @param { Array } args
     */
    constructor(opcode, args) {
        /**
        * The opcode of this instruction.
        */
        this.opcode = opcode;

        /**
        * All arguments of this instruction, in order.
        */
        this.args = args;

        /**
        * The cached result of converting this GuacamoleInstruction to the format
        * used by the Guacamole protocol.
        */
        this.protocolForm = null;
    }

    print() {
        return `opcode: ${this.opcode}, args: ${this.args}`;
    }

    /**
     * Returns this GuacamoleInstruction in the form it would be sent over the
     * Guacamole protocol.
     * @returns { string }
     */
    toString() {

        // Avoid rebuilding Guacamole protocol form of instruction if already
        // known
        if (this.protocolForm == null) {

            let buff = [];

            // Write opcode
            buff.push(this.opcode.length);
            buff.push('.');
            buff.push(this.opcode);

            // Write argument values
            for (const value of this.args) {
                if (value) {
                    //console.log(`value.length: ${value.length}`);
                    buff.push(',');
                    buff.push(value.length);
                    buff.push('.');
                    buff.push(value);
                } else {
                    //console.log(`empty value`);
                    buff.push(',0.');
                }
            }

            // Write terminator
            buff.push(';');

            // Cache result for future calls
            this.protocolForm = buff.join('');

        }

        return this.protocolForm;

    }
}

module.exports = GuacamoleInstruction;