/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const GuacamoleReader = require('./GuacamoleReader');
const GuacamoleWriter = require('./GuacamoleWriter');
const ConfiguredGuacamoleSocket = require('./ConfiguredGuacamoleSocket');
const Lock = require('./Lock');
const GuacamoleSocket = require('./GuacamoleSocket');
const { v4: uuidv4 } = require('uuid');

/**
 * Provides a unique identifier and synchronized access to the GuacamoleReader
 * and GuacamoleWriter associated with a GuacamoleSocket.
 */
class GuacamoleTunnel {


    uuid = uuidv4();
    

    /**
     * Creates a new GuacamoleTunnel which synchronizes access to the
     * Guacamole instruction stream associated with the given GuacamoleSocket.
     *
     * @param {GuacamoleSocket} socket The GuacamoleSocket to provide synchronized access for.
     */
    constructor(socket) {
        this.socket = socket;
    }

    socket

    /**
     * The Guacamole protocol instruction opcode reserved for arbitrary
     * internal use by tunnel implementations. The value of this opcode is
     * guaranteed to be the empty string (""). Tunnel implementations may use
     * this opcode for any purpose. It is currently used by the HTTP tunnel to
     * mark the end of the HTTP response, and by the WebSocket tunnel to
     * transmit the tunnel UUID.
     */
    static INTERNAL_DATA_OPCODE = "";


    readerLock = new Lock();
    writerLock = new Lock();
    /**
     * Acquires exclusive read access to the Guacamole instruction stream
     * and returns a GuacamoleReader for reading from that stream.
     *
     * @async
     * @return {GuacamoleReader} A GuacamoleReader for reading from the Guacamole instruction
     *         stream.
     */
    async acquireReader() {
        await this.readerLock.lock();
        return this.getSocket().getReader();
    }

    /**
     * Relinquishes exclusive read access to the Guacamole instruction
     * stream. This function should be called whenever a thread finishes using
     * a GuacamoleTunnel's GuacamoleReader.
     */
    releaseReader() {
        this.readerLock.unlock();
    }

    /**
     * Returns whether there are threads waiting for read access to the
     * Guacamole instruction stream.
     *
     * @return true if threads are waiting for read access the Guacamole
     *         instruction stream, false otherwise.
     */
    hasQueuedReaderThreads() {
        return this.readerLock.hasQueuedThreads();
    }

    /**
     * Acquires exclusive write access to the Guacamole instruction stream
     * and returns a GuacamoleWriter for writing to that stream.
     *
     * @return {GuacamoleWriter} A GuacamoleWriter for writing to the Guacamole instruction
     *         stream.
     */
    async acquireWriter() {
        await this.writerLock.lock();
        return this.getSocket().getWriter();
    }

    /**
     * Relinquishes exclusive write access to the Guacamole instruction
     * stream. This function should be called whenever a thread finishes using
     * a GuacamoleTunnel's GuacamoleWriter.
     */
    releaseWriter() { 
        this.writerLock.unlock();
     }

    /**
     * Returns whether there are threads waiting for write access to the
     * Guacamole instruction stream.
     *
     * @return {Boolean} true if threads are waiting for write access the Guacamole
     *         instruction stream, false otherwise.
     */
    hasQueuedWriterThreads() {
        return (this.writerLock.hasQueuedThreads());
    }

    /**
     * Returns the unique identifier associated with this GuacamoleTunnel.
     *
     * @return {String} The unique identifier associated with this GuacamoleTunnel.
     */
    getUUID() {
        return this.uuid;
    }

    /**
     * Returns the GuacamoleSocket used by this GuacamoleTunnel for reading
     * and writing.
     *
     * @return {GuacamoleSocket} The GuacamoleSocket used by this GuacamoleTunnel.
     */
    getSocket() {
        return this.socket;
    }

    /**
     * Release all resources allocated to this GuacamoleTunnel.
     *
     * @throws GuacamoleException if an error occurs while releasing
     *                            resources.
     */
    close() {
        this.getSocket().close();
    }

    /**
     * Returns whether this GuacamoleTunnel is open, or has been closed.
     *
     * @return true if this GuacamoleTunnel is open, false if it is closed.
     */
    isOpen() {
        return this.getSocket().isOpen();
    }

}

module.exports = GuacamoleTunnel;
