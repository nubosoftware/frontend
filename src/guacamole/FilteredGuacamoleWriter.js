const { GuacamoleServerException } = require("./GuacamoleExceptions");
const GuacamoleParser = require("./GuacamoleParser");
const GuacamoleWriter = require("./GuacamoleWriter");
const GuacamoleLoggerFactory = require('./GuacamoleLoggerFactory');

/**
 * GuacamoleWriter which applies a given GuacamoleFilter to observe or alter
 * all written instructions. Instructions may also be dropped or denied by
 * the filter.
 */
class FilteredGuacamoleWriter {

    /**
     * The wrapped GuacamoleWriter.
     * @type {GuacamoleWriter}
     */
    writer;

    /**
     * The filter function to apply when writing instructions.
     */
    filter;

    /**
     * Parser for reading instructions prior to writing, such that they can be
     * passed on to the filter.
     * @type {GuacamoleParser}
     */
    parser = new GuacamoleParser();
    
    /**
     * Wraps the given GuacamoleWriter, applying the given filter to all written 
     * instructions. Future writes will only write instructions which pass
     * the filter.
     *
     * @param {GuacamoleWriter} writer The GuacamoleWriter to wrap.
     * @param filter The filter which dictates which instructions are written,
     *               and how.
     */
    constructor(writer, filter) {
        this.logger = GuacamoleLoggerFactory.getLogger();
        this.writer = writer;
        this.filter = filter;
    }
 
    /**
     * Parse chunk and send to the filter function
     * @param {String} chunk 
     * @param {Number} offset 
     * @param {Number} length 
     */
    write(chunk, offset, length)  {

        // Write all data in chunk
        while (length > 0) {

            // Pass as much data through the parser as possible
            let parsed;
            while ((parsed = this.parser.append(chunk, offset, length)) != 0) {
                offset += parsed;
                length -= parsed;
            }

            // If no instruction is available, it must be incomplete
            if (!this.parser.hasNext())
                throw new GuacamoleServerException("Filtered write() contained an incomplete instruction.");

            // Write single instruction through filter
            this.writeInstruction(this.parser.next());

        }
        
    }

    /**
     * Parse chunk and send to the filter function
     * @param {String} chunk 
     */
    writeChunk(chunk)  {
        this.write(chunk, 0, chunk.length);
    }

    /**
     * Check if instruction dropped by filter and send it to the writer if it not dropped
     * @param {GuacamoleInstruction} instruction 
     */
    writeInstruction(instruction) {
        //console.log(`filtered writeInstruction: ${instruction}`);
        // Write instruction only if not dropped
        let filteredInstruction = this.filter(instruction);
        if (filteredInstruction != null) {
            //console.log(`FilteredGuacamoleWriter. writeInstruction: ${filteredInstruction.toString()}`);
            this.writer.writeInstruction(filteredInstruction);
        }
    }

}

module.exports = FilteredGuacamoleWriter;