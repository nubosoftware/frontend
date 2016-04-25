/**
 * @author
 */

var zlibnode;

function ZlibReader() {
	"use strict";
	var buffArr = [], bufIdx = 0, offset = 0, currentDataView = null, MINOFFSETCOMPACT = 1024;

	var reader = this;

	if (PRINT_NETWORK_COMMANDS == null) {
		var PRINT_NETWORK_COMMANDS = false;
	}

	this.addBuffer = function(newBuff) {
		buffArr.push(newBuff);
		if ((bufIdx + 1) == buffArr.length) {// check if we should start from this buffer and create data view
			currentDataView = new DataView(buffArr[bufIdx], 0);
		}
	};

	this.inProcessData = false;

	this.handle_message = function() {
		// console.log("in ZlibReader.handle_message");
		if (reader.inProcessData) {
			// console.log("inProcessData!!");
			return false;
		}
		reader.inProcessData = true;
		if (!reader.canReadBytes(5)) {
			// console.log("Compressed header is not available yet...");
			reader.inProcessData = false;
			return false;
		}
		var deflate = reader.readBoolean();
		var inLength = reader.readUInt32();
		if (!reader.canReadBytes(inLength)) {
			//console.log("Full block is not available yet...");
			reader.rollback(5);
			reader.inProcessData = false;
			return false;
		}
		if (PRINT_NETWORK_COMMANDS) {
			Log.d(DEBUG_PROTOCOL_NETWORK_STR, "Compress header. deflate: " + deflate + ", inLength: " + inLength);
		}
		// console.log("Compress header. deflate: "+deflate+", inLength: "+inLength);

		var outbuff;

		if (deflate) {

			var compressed = new Uint8Array(buffArr[bufIdx], offset, inLength);

			if (!zlibnode) {

				var options = {
					'index' : 0, // start position in input buffer
					'bufferSize' : 1024, // initial output buffer size
					'bufferType' : 0/*Zlib.RawInflate.BufferType.BLOCK*/, // buffer expantion type
					'resize' : true, // resize buffer(ArrayBuffer) when end of decompression (default: false)
					'verify' : true // verify decompression result (default: false)
				};

				var inflate = new Zlib.Inflate(compressed, options);
				var plain = inflate.decompress();
				if (PRINT_NETWORK_COMMANDS) {
					Log.d(DEBUG_PROTOCOL_NETWORK_STR, "plain array length: " + plain.length);
				}
				// console.log("plain array length: " + plain.length);
				outbuff = new ArrayBuffer(plain.length);
				var tmparr = new Uint8Array(outbuff);
				tmparr.set(plain, 0);
			} else {
				var compressed = new Uint8Array(buffArr[bufIdx], offset, inLength);
				var buf = new Buffer(compressed);
				zlibnode.inflate(buf, function(err, result) {
					if (PRINT_NETWORK_COMMANDS) {
						Log.d(DEBUG_PROTOCOL_NETWORK_STR, "plain array length: " + result.length);
					}
					// console.log("plain array length: " + result.length);
					// console.log("After zlibnode.inflate. err: "+err/*+", result: "+JSON.stringify(result,null,2)*/);
					outbuff = new ArrayBuffer(result.length);
					var view = new Uint8Array(outbuff);
					for (var i = 0; i < result.length; ++i) {
						view[i] = result[i];
					}
					reader.ondata(outbuff);
					reader.inProcessData = false;
					process.nextTick(reader.handle_message);
				});
			}

		} else {
			//console.log("Not need to uncompress");
			outbuff = new ArrayBuffer(inLength);
			var tmparr = new Uint8Array(outbuff);
			var srcarr = new Uint8Array(buffArr[bufIdx], offset, inLength);
			tmparr.set(srcarr, 0);
		}

		reader.incrementOffsetAfterRead(inLength);
		reader.compact();
		if (outbuff) {
			reader.ondata(outbuff);
			reader.inProcessData = false;
			if (zlibnode) {
				process.nextTick(reader.handle_message);
			}
			return true;
		} else {
			return false;
		}

	};
	// delete old buffers. Call this function only after you sure you do not need to go back
	this.compact = function() {
		if (offset >= MINOFFSETCOMPACT) {
			//console.log("Compact current buffer! remove "+offset+" bytes.");
			var currBuff = buffArr[bufIdx];
			buffArr[bufIdx] = new ArrayBuffer(currBuff.byteLength - offset);
			var tmparr = new Uint8Array(buffArr[bufIdx]);
			tmparr.set(new Uint8Array(currBuff).subarray(offset), 0);
			offset = 0;
			// re-create dataview
			currentDataView = new DataView(buffArr[bufIdx], 0);

		} else {
			//console.log("Will not compact current buffer. Offset ("+offset+") < "+MINOFFSETCOMPACT);
		}

		if (bufIdx == 0)
			return;
		// no buffer to recycle
		//console.log("--- Compact buffer array! remove "+bufIdx+" buffers.");
		//console.log("--- before buffArr.length:"+buffArr.length);
		buffArr.splice(0, bufIdx);
		// remove all buffers until this one
		bufIdx = 0;
		//console.log("--- after buffArr.length:"+buffArr.length);
	};

	this.canReadBytes = function(numBytes) {
		// 1. check if we have a buffer to read
		if (buffArr.length <= bufIdx)
			return false;
		// 2. check if current buffer is sufficient
		if (buffArr[bufIdx].byteLength >= (offset + numBytes))
			return true;
		// 4. check if we have more buffers to merge
		if (buffArr.length > (bufIdx + 1)) {

			var nextBuff = buffArr[bufIdx + 1];
			// remember next buffer
			var currBuff = buffArr[bufIdx];
			// remember also current buffer
			//console.log("MERGE BUFFERS! bufIdx:"+bufIdx+", currSize:"+currBuff.byteLength+", nextSize:"+nextBuff.byteLength);
			//console.log("--- first int next buff:"+new DataView(nextBuff, 0).getInt32(0));
			//console.log("--- offset:"+offset);
			//console.log("--- numBytes:"+numBytes);

			//console.log("--- before buffArr.length:"+buffArr.length);
			// remove next buffer for the buffer array
			buffArr.splice(bufIdx + 1, 1);
			//console.log("--- after buffArr.length:"+buffArr.length);

			//create a merged buffer and replace the current buffer with it
			buffArr[bufIdx] = new ArrayBuffer(currBuff.byteLength + nextBuff.byteLength);
			var tmparr = new Uint8Array(buffArr[bufIdx]);
			tmparr.set(new Uint8Array(currBuff), 0);
			tmparr.set(new Uint8Array(nextBuff), currBuff.byteLength);

			// re-create dataview
			currentDataView = new DataView(buffArr[bufIdx], 0);

			//console.log("--- first int new merged buff:"+currentDataView.getInt32(currBuff.byteLength));

			return this.canReadBytes(numBytes);
			//recursive call to find out if do not need to merge more buffers

		} else {// do not have next buffer to merge
			if (PRINT_NETWORK_COMMANDS) {
				Log.d(DEBUG_PROTOCOL_NETWORK_STR, "Required bytes: " + numBytes + " but have only: " + (buffArr[bufIdx].byteLength - offset));
			}
			// console.log("Required bytes: " + numBytes + " but have only: " + (buffArr[bufIdx].byteLength - offset));
		}

		return false;
	};

	this.incrementOffsetAfterRead = function(numBytes) {
		offset += numBytes;
		if (offset >= buffArr[bufIdx].byteLength) {
			//console.log("Moved to new buffer");
			bufIdx++;
			offset = 0;
			if (buffArr.length > bufIdx) {// check if we have next buffer so we can set the dataview
				currentDataView = new DataView(buffArr[bufIdx], 0);
			}
		}
	};

	this.rollback = function(numbytes) {
		//Log.v(TAG, "rollback " + numbytes + " bytes.");
		offset -= numbytes;
		while (offset < 0 && bufIdx > 0) {// move back to previous buffer
			if (PRINT_NETWORK_COMMANDS) {
				Log.d(DEBUG_PROTOCOL_NETWORK_STR, "zlibReader:: Moved to previous buffer!");
			}
			// console.log("Moved to previous buffer!");
			bufIdx--;
			offset += buffArr[bufIdx].byteLength;
			currentDataView = new DataView(buffArr[bufIdx], 0);
		}
	};

	this.readUInt32 = function() {
		var ret = currentDataView.getUint32(offset);
		this.incrementOffsetAfterRead(4);
		return ret;
	};

	this.readByte = function() {
		var ret = currentDataView.getUint8(offset);
		this.incrementOffsetAfterRead(1);
		return ret;
	};

	this.readBoolean = function() {
		var ch = this.readByte();
		return (ch != 0);
	};

};

if ( typeof module != 'undefined') {
	module.exports = {
		ZlibReader : ZlibReader
	};

	zlibnode = require('zlib');

}