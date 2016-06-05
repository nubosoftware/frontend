function UXIPReader(nubocache) {
    "use strict";

    var buffArr = [], bufIdx = 0, offset = 0, currentDataView = null, MINOFFSETCOMPACT = 1024, saveOffset = 0, mWindowCache = {};
    //empty cache
    var nuboCache = nubocache;

    if (PRINT_NETWORK_COMMANDS == null) {
        var PRINT_NETWORK_COMMANDS = false;
    }

    this.getBuffArr = function() {
        return buffArr;
    };

    this.getBuffIdx = function() {
        return bufIdx;
    };

    this.getOffset = function() {
        return offset;
    };

    this.beginTransaction = function() {
        saveOffset = 0;
    };

    this.rollbackTransaction = function() {
        this.rollback(saveOffset);
        saveOffset = 0;
    };

    this.getTransactionSize = function() {
        return saveOffset;
    };

    this.addBuffer = function(newBuff) {
        buffArr.push(newBuff);
        //console.log("--- addBuffer, newBuff.byteLength:"+newBuff.byteLength);
        //console.log("--- addBuffer, buffArr.length:"+buffArr.length);
        if ((bufIdx + 1) == buffArr.length) {// check if we should start from this buffer and create data view
            currentDataView = new DataView(buffArr[bufIdx], 0);
        }
    };

    this.printState = function(codePosition) {
        Log.v("Reader", codePosition + " reader state: buffArr.length:" + buffArr.length + ", bufIdx:" + bufIdx + ". offset:" + offset);
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
            // Log.e(TAG, "Required bytes: " + numBytes + " but have only: " + (buffArr[bufIdx].byteLength - offset));
        }
        return false;
    };

    this.incrementOffsetAfterRead = function(numBytes) {
        offset += numBytes;
        saveOffset += numBytes;
        if (offset >= buffArr[bufIdx].byteLength) {
            //console.log("Moved to new buffer");
            bufIdx++;
            offset = 0;
            if (buffArr.length > bufIdx) {// check if we have next buffer so we can set the dataview
                currentDataView = new DataView(buffArr[bufIdx], 0);
            }
        }
    };

    // read functions
    // you must check that you can read with  canReadBytes BEFORE call those functions
    this.readChar = function() {
        var ret = currentDataView.getUint16(offset);
        this.incrementOffsetAfterRead(2);
        return String.fromCharCode(ret);
    };

    this.readInt = function() {
        var ret = currentDataView.getInt32(offset);
        this.incrementOffsetAfterRead(4);
        return ret;
    };

    this.readUInt32 = function() {
        var ret = currentDataView.getUint32(offset);
        this.incrementOffsetAfterRead(4);
        return ret;
    };

    this.readLong = function() {
        var ret = {};
        ret.hi = currentDataView.getUint32(offset);
        ret.lo = currentDataView.getUint32(offset + 4);
        this.incrementOffsetAfterRead(8);
        return ret;
    };

    // can be used to read long typed numbers from network.
    // i.e. numbers that were written as long type in java side (sent as long from platform)
    this.readLongAsFloat = function() {
        var ret = currentDataView.getFloat64(offset);
        this.incrementOffsetAfterRead(8);
        return ret;
    };

    this.readInt16 = function() {
        var ret = currentDataView.getInt16(offset);
        this.incrementOffsetAfterRead(2);
        return ret;
    };

    this.readFloat = function() {
        var ret = currentDataView.getFloat32(offset);
        this.incrementOffsetAfterRead(4);
        return ret;
    };

    this.readByte = function() {
        //console.log("offset="+offset);
        var ret = currentDataView.getUint8(offset);
        this.incrementOffsetAfterRead(1);
        return ret;
    };

    this.readByteArr = function() {
        var result = {
            canRead : false,
            data : null
        };
        var len = this.readInt();
        result.canRead = true;
        result.data = new ArrayBuffer(len);
        var tmparr = new Uint8Array(result.data);
        var currBuff = buffArr[bufIdx];
        tmparr.set(new Uint8Array(currBuff).subarray(offset, offset + len), 0);
        this.incrementOffsetAfterRead(len);
        result.dataLen = len;
        return result;
    };

    this.readBoolean = function() {
        var ch = this.readByte();
        return (ch != 0);
    };

    this.readMatrix = function() {
        var m = {
            canRead : false,
            isNull : true,
            arr : [1.0, 0, 0, 0, 1.0, 0, 0, 0, 1.0]
        };
        m.canRead = true;
        m.isNull = this.readBoolean();
        if (m.isNull) {
            return m;
        }
        // check if it is identity matrix
        var matrixBits = this.readByte();
        if (matrixBits == 0) {
            return m;
        }
        // if it is not an identity matrix, read the diffs
        var rollBackCounter = 2;

        for (var i = 0; i < 7; i++) {
            if (((matrixBits >> i) & 0x01) == 0x01) {
                if (i != 6) {
                    m.arr[i] = this.readFloat();
                    rollBackCounter += 4;
                } else {
                    m.arr[8] = this.readFloat();
                    rollBackCounter += 4;
                }
            } else {
                if (i == 0 || i == 4) {//matrix diagonal
                    m.arr[i] = 1.0;
                } else if (i == 6) {//matrix diagonal
                    m.arr[8] = 1.0;
                }
            }
        }
        return m;
    };

    this.readRect = function() {
        var r = {
            canRead : false,
            isNull : true,
            left : 0,
            top : 0,
            right : 0,
            bottom : 0
        };
        r.canRead = true;
        r.isNull = this.readBoolean();
        if (r.isNull) {
            return r;
        }
        r.left = this.readInt();
        r.top = this.readInt();
        r.right = this.readInt();
        r.bottom = this.readInt();
        return r;
    };

    this.readRectF = function() {
        var r = {
            canRead : false,
            isNull : true,
            left : 0,
            top : 0,
            right : 0,
            bottom : 0
        };
        r.canRead = true;
        r.isNull = this.readBoolean();
        if (r.isNull) {
            return r;
        }
        r.left = this.readFloat();
        r.top = this.readFloat();
        r.right = this.readFloat();
        r.bottom = this.readFloat();
        return r;
    };

    this.readBoundsAndMatrix = function() {
        var r = {
            canRead : false,
            bounds : null,
            matrix : null
        };
        r.bounds = this.readRect();
        if (!r.bounds.canRead)
            return r;
        r.matrix = this.readMatrix();
        if (!r.matrix.canRead)
            return r;
        r.canRead = true;
        return r;
    };

    this.readIntArr = function() {
        var result = {
            canRead : false,
            arr : []
        };
        var len = this.readInt();
        for (var i = 0; i < len; i++) {
            result.arr[i] = this.readInt();
        }
        result.canRead = true;
        return result;
    };

    this.readUInt32Arr = function() {
        var result = {
            canRead : false,
            arr : []
        };
        var len = this.readInt();
        for (var i = 0; i < len; i++) {
            result.arr[i] = this.readUInt32();
        }
        result.canRead = true;
        return result;
    };

    this.readCharArr = function() {
        var result = {
            canRead : false,
            arr : []
        };
        var len = this.readInt();
        for (var i = 0; i < len; i++) {
            result.arr.push(this.readChar());
        }
        result.canRead = true;
        return result;
    };

    this.readFloatArr = function() {
        var result = {
            canRead : false,
            arr : []
        };
        var len = this.readInt();
        for (var i = 0; i < len; i++) {
            result.arr[i] = this.readFloat();
        }
        result.canRead = true;
        return result;
    };

    this.readShader = function(p, processId, compressedData) {
        var shader = {
            canRead : false
        };
        var shaderType = ((compressedData.lo >> 24) & 0x00000003);
        if (shaderType == ShaderType.LinearGradient) {
            var x0 = this.readFloat();
            var y0 = this.readFloat();
            var x1 = this.readFloat();
            var y1 = this.readFloat();

            var colorsRes = this.readUInt32Arr();
            if (!colorsRes.canRead) {
                shader.canRead = false;
                return shader;
            }
            var colors = colorsRes.arr;
            var positions = null;
            if (!this.readBoolean()) {
                var positionsRes = this.readFloatArr();
                if (!positionsRes.canRead) {
                    shader.canRead = false;
                    return shader;
                }
                positions = positionsRes.arr;
            }

            var tile = ((compressedData.lo >> 20) & 0x00000003);
            var m = this.readMatrix();
            if (!m.canRead) {
                shader.canRead = false;
                return shader;
            }
            shader = {
                canRead : true,
                stype : ShaderType.LinearGradient,
                x0 : x0,
                y0 : y0,
                x1 : x1,
                y1 : y1,
                colors : colors,
                positions : positions,
                tile : tile,
                localMatrix : m
            };
            return shader;

        } else if (shaderType == ShaderType.BitmapShader) {
            var noBitmap = this.readBoolean();
            if (!noBitmap) {
                //Bitmap[] bitmap = new Bitmap[1];
                //int status = readBitmapCache(bitmap, wndId);
                var bitmapRet = this.readBitmapCache(processId);
                if (!bitmapRet.canRead) {
                    shader.canRead = false;
                    return shader;
                }
                var bitmap = bitmapRet.bitmap;
                var bitmapStatus = bitmapRet.retVal;
                var m = this.readMatrix();
                if (!m.canRead) {
                    shader.canRead = false;
                    return shader;
                }

                var tileX = ((compressedData.lo >> 20) & 0x00000003);
                var tileY = ((compressedData.lo >> 22) & 0x00000003);

                if (bitmapStatus == NuboStatus.FAIL) {
                    //should never get here!!!
                    Log.e(TAG, "readShader: bitmap could not be retrieved");
                    return {
                        canRead : true,
                        stype : null
                    };
                } else {
                    return {
                        canRead : true,
                        stype : ShaderType.BitmapShader,
                        bitmap : bitmap,
                        tileX : tileX,
                        tileY : tileY,
                        localMatrix : m
                    };
                }
            } else {
                //should never get here!!!
                Log.e(TAG, "could not read bitmap of paint shader");
                return {
                    canRead : true,
                    stype : null
                };
            }
        } else if (shaderType == ShaderType.RadialGradient) {
            var x = this.readFloat();
            var y = this.readFloat();
            var radius = this.readFloat();

            var colorsRes = this.readUInt32Arr();
            if (!colorsRes.canRead) {
                shader.canRead = false;
                return shader;
            }
            var colors = colorsRes.arr;
            var positions = null;
            var positionsRes = null;
            if (!this.readBoolean()) {
                positionsRes = this.readFloatArr();
                if (!positionsRes.canRead) {
                    shader.canRead = false;
                    return shader;
                }
                positions = positionsRes.arr;
            }
            var tile = ((compressedData.lo >> 20) & 0x00000003);

            return {
                canRead : true,
                stype : ShaderType.RadialGradient,
                x : x,
                y : y,
                radius : radius,
                colors : colors,
                positions : positions,
                tile : tile,
            };
        } else {
            //should never get here!!!
            Log.e(TAG, "Illegal shader type");
            return {
                canRead : true,
                stype : null
            };
        }
    };

    this.handleCompressedData = function(p, compressedData) {
        p.flags = (compressedData.lo & 0x01FF);

        p.antiAlias = ((compressedData.lo & UXIPExport.Paint.ANTI_ALIAS_FLAG) != 0);
        p.filterBitmap = ((compressedData.lo & UXIPExport.Paint.FILTER_BITMAP_FLAG) != 0);
        p.dither = ((compressedData.lo & UXIPExport.Paint.DITHER_FLAG) != 0);
        p.underlineText = ((compressedData.lo & UXIPExport.Paint.UNDERLINE_TEXT_FLAG) != 0);
        p.strikeThruText = ((compressedData.lo & UXIPExport.Paint.STRIKE_THRU_TEXT_FLAG) != 0);
        p.fakeBoldText = ((compressedData.lo & UXIPExport.Paint.FAKE_BOLD_TEXT_FLAG) != 0);
        p.linearText = ((compressedData.lo & UXIPExport.Paint.LINEAR_TEXT_FLAG) != 0);
        p.subpixelText = ((compressedData.lo & UXIPExport.Paint.SUBPIXEL_TEXT_FLAG) != 0);
        //text style
        var style = ((compressedData.lo >> 12) & 0x03);
        switch(style) {
        case 0:
            p.style = UXIPExport.Style.FILL;
            break;
        case 1:
            p.style = UXIPExport.Style.STROKE;
            break;
        case 2:
            p.style = UXIPExport.Style.FILL_AND_STROKE;
            break;
        }

        //text stroke cap
        var strokeCap = ((compressedData.lo >> 14) & 0x03);
        switch(strokeCap) {
        case 0:
            p.strokeCap = UXIPExport.Cap.BUTT;
            break;
        case 1:
            p.strokeCap = UXIPExport.Cap.ROUND;
            break;
        case 2:
            p.strokeCap = UXIPExport.Cap.SQUARE;
            break;
        }

        //text stroke join
        var strokeJoin = ((compressedData.lo >> 16) & 0x03);
        switch(strokeJoin) {
        case 0:
            p.strokeJoin = UXIPExport.Join.MITER;
            break;
        case 1:
            p.strokeJoin = UXIPExport.Join.ROUND;
            break;
        case 2:
            p.strokeJoin = UXIPExport.Join.BEVEL;
            break;
        }

        //text align
        var align = ((compressedData.lo >> 18) & 0x03);
        switch(align) {
        case 0:
            p.textAlign = UXIPExport.Align.LEFT;
            break;
        case 1:
            p.textAlign = UXIPExport.Align.CENTER;
            break;
        case 2:
            p.textAlign = UXIPExport.Align.RIGHT;
            break;
        }
        //Log.e(TAG,"align="+align);

        //hinting

        p.hinting = ((compressedData.lo >> 26) & 0x01);

        //PorterDuff.Mode
        p.pdMode = ((compressedData.lo >> 27) & 0x1F);

        p.textSize = (compressedData.hi & 0xFFF) - 0.6;

        p.strokeWidth = ((compressedData.hi >> 12) & 0xFF);
    };

    this.readPaint = function(processId) {
        var result = {
            canRead : false,
            p : null
        };
        var isNull = this.readBoolean();
        if (!isNull) {
            result.p = {};
            var compressedData = this.readLong();
            this.handleCompressedData(result.p, compressedData);
            if (((compressedData.hi >> 24) & 0x01) == 1) {
                var color = this.readUInt32();
                result.p.color = (color & 0xFFFFFF );
                result.p.alpha = color >>> 24;
            } else {
                //result.p.color=0xFF000000;
                result.p.color = 0x000000;
                result.p.alpha = 0xFF;
            }
            if (((compressedData.hi >> 20) & 0x01) == 1)//(compressedData.shiftRight(48).and(0x01).getLowBits() == 1)
            {
                result.p.textScaleX = this.readFloat();
            } else {
                result.p.textScaleX = 1;
            }

            if (((compressedData.hi >> 21) & 0x01) == 1) {
                result.p.textSkewX = this.readFloat();
            } else {
                result.p.textSkewX = 0;
            }

            var nullShader = ((compressedData.lo >> 20) & 0x3F);
            if (nullShader != 0x3F) {
                var s = this.readShader(result.p, processId, compressedData);
                if (!s.canRead) {
                    return result;
                }
                result.p.shader = s;
            }

            var typefaceStyle = ((compressedData.lo >> 9) & 0x07);
            //compressedData.shiftRight(9).and(0x07).getLowBits();
            if (typefaceStyle >= UXIPExport.Typeface.NORMAL && typefaceStyle <= UXIPExport.Typeface.BOLD_ITALIC) {
                var fontPath = "";
                if (((compressedData.hi >> 22) & 0x01) == 1) {
                    var rsRet = this.readString();
                    if (!rsRet.canRead)
                        return result;
                    fontPath = rsRet.value;
                }
                var fontFamilyName = "";
                if (((compressedData.hi >> 23) & 0x01) == 1) {
                    var rsRet = this.readString();
                    if (!rsRet.canRead)
                        return result;
                    fontFamilyName = rsRet.value;
                }
                var setTypeface = false;
                if (fontPath != null && !fontPath == "") {
                    result.p.fontPath = fontPath;
                }
                if (!setTypeface) {
                    if (fontFamilyName != null && fontFamilyName.equals != "") {
                        result.p.fontFamilyName = fontFamilyName;
                        result.p.typefaceStyle = typefaceStyle;
                    } else {
                        result.p.typefaceStyle = typefaceStyle;
                    }
                }
            }
        }
        result.canRead = true;
        return result;
    };

    this.readNinePatchChunkCache = function(processId) {
        var result = {
            canRead : false,
            isNull : true,
            data : null
        };
        result.isNull = this.readBoolean();
        if (!result.isNull) {
            var bExistInCache = this.readBoolean();
            var addlerValue = this.readLong();
            var addlerValueStr = addlerValue.hi.toString(16) + "_" + addlerValue.lo.toString(16);
            result.isNull = false;
            result.hash = addlerValueStr;
            if (!bExistInCache) {
                var readByteArrResult = this.readByteArr();
                if (!readByteArrResult.canRead)
                    return result;

                var noOfRemovedItems = this.readInt();

                result.data = readByteArrResult.data;
                result.canRead = true;
                if (noOfRemovedItems != 0) {
                    nuboCache.removeCacheItems(noOfRemovedItems);
                }
                nuboCache.addCacheItem(processId, result.hash, result.data);
            } else {
                var cachedObj = nuboCache.getCacheItem(processId, result.hash);
                if (cachedObj != null) {
                    result.canRead = true;
                    result.data = cachedObj;
                }
            }
        } else {// null
            result.canRead = true;
        }
        return result;
    };

    this.readBitmapCache = function(processId) {
        var result = {
            canRead : false,
            retVal : NuboStatus.FAIL,
            bitmap : null
        };
        var isNull = this.readBoolean();
        if (!isNull) {
            var sendRcvType = this.readByte();

            switch(sendRcvType) {
            case BitmapSendRcvType.fullBitmap:
                result = this.readFullBitmap(processId);
                break;
            case BitmapSendRcvType.cachedBitmap:
                result = this.readCachedBitmap(processId);
                break;
            case BitmapSendRcvType.resourceBitmap:
                result = this.readResourceBitmap();
                break;
            case BitmapSendRcvType.assetBitmap:
                result = this.readAssetBitmap();
                break;
            default:
                Log.v(TAG, "VWEInputStream::readBitmapCache. undefined BitmapSendRcvType=" + sendRcvType);
                result.canRead = true;
            }
        } else {
            result.canRead = true;
        }

        return result;
    };

    this.readCachedBitmap = function(processId) {
        var result = {
            canRead : false,
            retVal : NuboStatus.FAIL,
            bitmap : null
        };
        var hashCode = this.readLong();
        result.canRead = true;
        result.hash = hashCode.hi.toString(16) + "_" + hashCode.lo.toString(16);
        var cachedObj = nuboCache.getCacheItem(processId, result.hash);
        if (cachedObj != null) {
            result.retVal = NuboStatus.OK;
            result.bitmap = cachedObj;
            return result;
        }
        return result;
    };

    this.readFullBitmap = function(processId) {
        var result = {
            canRead : false,
            retVal : NuboStatus.FAIL,
            bitmap : null
        };
        var hashCode = this.readLong();
        result.byteCnt = this.readInt();
        // check if buffer has the bitmap and the removed items count
        result.bitmap = {
            bitmapType : "platform",
            data : null
        };
        result.bitmap.data = new ArrayBuffer(result.byteCnt);
        var tmparr = new Uint8Array(result.bitmap.data);
        var currBuff = buffArr[bufIdx];
        tmparr.set(new Uint8Array(currBuff).subarray(offset, offset + result.byteCnt), 0);
        this.incrementOffsetAfterRead(result.byteCnt);

        var noOfRemovedItems = this.readInt();

        result.canRead = true;
        result.retVal = NuboStatus.OK;

        result.hash = hashCode.hi.toString(16) + "_" + hashCode.lo.toString(16);
        if (result.hash != "ffffffff_ffffffff") {
            if (noOfRemovedItems != 0) {
                nuboCache.removeCacheItems(noOfRemovedItems);
            }
            nuboCache.addCacheItem(processId, result.hash, result.bitmap);
        }
        return result;
    };

    this.readResourceBitmap = function() {
        var result = {
            canRead : false,
            retVal : NuboStatus.FAIL,
            bitmap : null
        };
        var resId = this.readInt();
        var rsRet = this.readString();
        if (!rsRet.canRead)
            return result;
        var resPath = rsRet.value;
        result.canRead = true;
        if (resPath == null || resPath == "") {
            Log.e(TAG, "readBitmapFromExtRes. Illegal input. resPath=" + resPath);
            return result;
        }
        //var assetResName = "extres/" + resPath + "?deviceName=web&resolution=1024x768";
        var assetResName =  "../../getResource?";
        try {
            var bitmapPackage = resPath.substr(0,resPath.indexOf("/"));
            var bitmapName = resPath.substr(resPath.indexOf("/res/")+1);
            assetResName = assetResName + "packageName=" + bitmapPackage + "&deviceName=web&resolution=1024x768&fileName=" + bitmapName;
            // console.log("bitmap.path: " + assetResName);
        } catch (e) {
                console.log("hanan: " + e.message);
        }

        result.bitmap = {
            bitmapType : "res",
            data : null,
            path : assetResName
        };
        result.retVal = NuboStatus.OK;
        return result;
    };

    this.readAssetBitmap = function() {
        // AsiM TODO:
        var result = {
            canRead : false,
            retVal : NuboStatus.FAIL,
            bitmap : null
        };
        var rsRet = this.readString();
        if (!rsRet.canRead)
            return result;
        result.canRead = true;
        result.retVal = NuboStatus.OK;
        return result;
    };

    this.rollback = function(numbytes) {
        if (PRINT_NETWORK_COMMANDS) {
            Log.d(DEBUG_PROTOCOL_NETWORK_STR, "zlibReader:: rollback " + numbytes + " bytes.");
        }
        // Log.v(TAG, "rollback " + numbytes + " bytes.");

        offset -= numbytes;
        saveOffset -= numbytes;
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

    this.readString = function() {
        var result = {
            canRead : false,
            value : null
        };
        result.canRead = true;
        var isNull = this.readByte();
        if (isNull != 0) {
            return result;
        }
        var strlen = this.readInt16();
        // read string length in bytes
        if (strlen == 0) {
            result.value = '';
            return result;
        }
        var byteArr = new Uint8Array(buffArr[bufIdx], offset, strlen);
        result.value = UTF8.decode(byteArr);

        this.incrementOffsetAfterRead(strlen);
        return result;
    };

    this.readCachedString = function(processId) {
        var result = {
            canRead : false,
            value : null
        };
        var isNull = this.readBoolean();
        if (isNull != 0) {
            result.canRead = true;
            return result;
        }
        var sendRcvType = this.readByte();
        var hashCode = this.readLong();

        result.hash = hashCode.hi.toString(16) + "_" + hashCode.lo.toString(16);

        if (sendRcvType == StringSendRcvType.fullString) {
            var strlen = this.readInt16();
            // read string length in bytes
            if (strlen == 0) {
                result.value = '';
                result.canRead = true;
                return result;
            }
            var byteArr = new Uint8Array(buffArr[bufIdx], offset, strlen);
            result.value = UTF8.decode(byteArr);
            this.incrementOffsetAfterRead(strlen);
            if (result.hash != "ffffffff_ffffffff") {
                var noOfRemovedItems = this.readInt();
                if (noOfRemovedItems != 0) {
                    nuboCache.removeCacheItems(noOfRemovedItems);
                }
                nuboCache.addCacheItem(processId, result.hash, result.value);
            }
        } else if (sendRcvType == StringSendRcvType.cachedString) {
            result.value = nuboCache.getCacheItem(processId, result.hash);
            if (result.value == null) {
                Log.e(TAG, "readCachedString. could not find string hash in cache. hashCode=" + hashCode);
            }
        }
        result.canRead = true;
        return result;
    };

    var StringSendRcvType = {
        fullString : 1,
        cachedString : 2
    };

    this.readCachedPath = function(processId) {
        var result = {
            canRead : false,
            path : null
        };
        var isNull = this.readBoolean();
        if (isNull != 0) {
            result.canRead = true;
            return result;
        }
        var sendRcvType = this.readByte();
        var hashCode = this.readLong();
        result.hash = hashCode.hi.toString(16) + "_" + hashCode.lo.toString(16);
        if (sendRcvType == PathSendRcvType.fullPath) {
            var pathResult = this.readFullPath();
            if (!pathResult.canRead) {
                return result;
            }
            result.path = pathResult.path;
            var pathSize = this.readInt();
            var noOfRemovedItems = this.readInt();

            if (result.hash != "ffffffff_ffffffff") {
                if (noOfRemovedItems != 0) {
                    nuboCache.removeCacheItems(noOfRemovedItems);
                }
                nuboCache.addCacheItem(processId, result.hash, result.path);
            }
        } else if (sendRcvType == PathSendRcvType.cachedPath) {
            result.path = nuboCache.getCacheItem(processId, result.hash);
            if (result.path == null) {
                Log.e(TAG, "readCachedPath. could not find string hash in cache. hashCode=" + hashCode);
            }
        }
        result.canRead = true;
        return result;
    };

    this.readFullPath = function() {
        var result = {
            canRead : false,
            path : null
        };
        var readByteArrResult = this.readByteArr();
        if (!readByteArrResult.canRead)
            return result;
        result.canRead = true;
        var dataView = new DataView(readByteArrResult.data, 0);
        var offset = 0;

        var pointsSize = dataView.getInt32(offset, true);
        offset += 4;
        var verbsSize = dataView.getInt32(offset, true);
        offset += 4;
        var flags = dataView.getInt32(offset, true);
        offset += 4;

        var points = [];
        for (var i = 0; i < 2 * pointsSize; i++) {
            points[i] = dataView.getFloat32(offset, true);
            offset += 4;
        }

        var verbs = [];
        for (var i = 0; i < verbsSize; i++) {
            verbs[i] = dataView.getInt8(offset, true);
            offset++;
        }
        result.path = {};
        result.path.verbs = verbs;
        result.path.points = points;

        if (readByteArrResult.dataLen - offset > 3) {
            Log.e(TAG, "Error: mismatch sizes len = " + buf.length + "; padding = " + (buf.length - padding));
            return result;
        }

        var fillType = flags >> 8;
        var segmentMask = flags & 0x000000ff;
        result.path.segmentMask = segmentMask;
        switch(fillType) {
        case 0:
            result.path.FillType = Path.FillType.WINDING;
            break;
        case 1:
            result.path.FillType = Path.FillType.EVEN_ODD;
            break;
        case 2:
            result.path.FillType = Path.FillType.INVERSE_WINDING;
            Log.e(TAG, "readFullPath:: unimplemented fillType " + fillType);
            break;
        case 3:
            result.path.FillType = Path.FillType.INVERSE_EVEN_ODD;
            Log.e(TAG, "readFullPath:: unimplemented fillType " + fillType);
            break;
        default:
            Log.e(TAG, "readFullPath:: Wrong fillType " + fillType);
            result.path = null;
        }
        return result;
    };

    this.readCachedFloatArray = function(processId) {
        var result = {
            canRead : false,
            floatArr : null
        };
        var sendRcvType = this.readByte();
        // notice that hashCode is int here instead of long
        var hashCode = this.readInt();
        var floatArray = null;
        if (sendRcvType == UXIPExport.FloatArrSendRcvType.fullArray) {
            var floatArrayRet = this.readFloatArr();
            if (!floatArrayRet.canRead) {
                return result;
            }
            var noOfRemovedItems = this.readInt();
            floatArray = floatArrayRet.arr;
            if (hashCode != -1) {
                if (noOfRemovedItems != 0) {
                    nuboCache.removeCacheItems(processId, noOfRemovedItems);
                }
                nuboCache.addCacheItem(processId, hashCode.toString(), floatArray);
            }
        } else if (sendRcvType == UXIPExport.FloatArrSendRcvType.cachedArray) {
            floatArray = nuboCache.getCacheItem(processId, hashCode.toString());
            if (floatArray == null) {
                Log.e(TAG, "readCachedFloatArr. could not find string hash in cache. hashCode=" + hashCode);
            }
        }
        result.canRead = true;
        result.floatArr = floatArray;

        return result;
    };

};

function testReader() {
    var reader = new UXIPReader();
    var buff1 = new ArrayBuffer(50);
    var arr1 = new Uint8Array(buff1);
    for (var i = 0; i < arr1.length; i++) {
        arr1[i] = i;
    }
    var buff2 = new ArrayBuffer(50);
    var arr2 = new Uint8Array(buff2);
    for (var i = 0; i < arr2.length; i++) {
        arr2[i] = 49 - i;
    }

    reader.addBuffer(buff1);

    console.log("canReadBytes(10)=" + reader.canReadBytes(10));

    console.log("canReadBytes(50)=" + reader.canReadBytes(50));

    reader.compact();

    // read one int
    var ret = reader.readInt();
    console.log(ret);

    reader.compact();

    // read one int
    var ret = reader.readInt();
    console.log(ret);

    reader.compact();

    // read one int
    var ret = reader.readInt();
    console.log(ret);

    reader.compact();

    console.log("canReadBytes(60)=" + reader.canReadBytes(60));

    reader.addBuffer(buff2);

    console.log("buffArr.length=" + reader.getBuffArr().length);

    //console.log("canReadBytes(60)="+reader.canReadBytes(60));

    //console.log("buffArr.length="+reader.getBuffArr().length);

    // try to read 10 int 32 (40 bytes) and 20 8 bit int. sum of 50 bytes
    /*for (var i=0;i<10;i++) {
     var ret = reader.readInt();
     console.log(ret);
     }*/

    console.log("canReadBytes(10)=" + reader.canReadBytes(10));

    console.log("offset=" + reader.getOffset());

    for (var i = 0; i < 10; i++) {
        var ret = reader.readByte();
        console.log(ret);
    }

    console.log("offset=" + reader.getOffset());

    var reader2 = new UXIPReader();
    console.log("reader2.offset=" + reader2.getOffset());

    console.log("canReadBytes(10)=" + reader.canReadBytes(10));

    for (var i = 0; i < 10; i++) {
        var ret = reader.readByte();
        console.log(ret);
    }

    console.log("offset=" + reader.getOffset());
    console.log("reader2.offset=" + reader2.getOffset());

    //console.log("canReadBytes(60)="+reader.canReadBytes(60));

    //console.log("canReadBytes(30)="+reader.canReadBytes(30));

    //console.log("canReadBytes(40)="+reader.canReadBytes(40));

    console.log("reader.getBuffArr()[reader.getBuffIdx()].byteLength=" + reader.getBuffArr()[reader.getBuffIdx()].byteLength);

    reader.compact();

    console.log("reader.getBuffArr()[reader.getBuffIdx()].byteLength=" + reader.getBuffArr()[reader.getBuffIdx()].byteLength);

    for (var i = 0; i < 17; i++) {
        reader.canReadBytes(1);
        var ret = reader.readByte();
        console.log(ret);
    }
    reader.canReadBytes(4);
    var ret = reader.readInt();
    console.log(ret);

    console.log("reader.getBuffArr()[reader.getBuffIdx()].byteLength=" + reader.getBuffArr()[reader.getBuffIdx()].byteLength);
    console.log("offset=" + reader.getOffset());

    for (var i = 0; i < 47; i++) {
        reader.canReadBytes(1);
        var ret = reader.readByte();
        console.log(ret);
    }

    reader.compact();

    //console.log("reader.getBuffArr()[reader.getBuffIdx()].byteLength="+reader.getBuffArr()[reader.getBuffIdx()].byteLength);
    console.log("offset=" + reader.getOffset());

    /*for (var i=0;i<10;i++) {
     reader.canReadBytes(1);
     var ret = reader.readByte();
     console.log(ret);
     }*/

    var strBuff = UTF8.encode("TESTחורף? 30 מעלות בים המלח TEST");
    var byteLength = strBuff.byteLength;
    var buffer2 = new ArrayBuffer(3);
    var dv2 = new DataView(buffer2, 0);
    dv2.setInt8(0, 0);
    //false for null;
    dv2.setInt16(1, byteLength);
    // write string length in two bytes

    var readStr = reader.readString();
    if (!readStr.canRead) {
        console.log("Cannot read string yet");
    } else {
        console.log("Str=" + readStr.value);
    }

    reader.addBuffer(buffer2);
    var readStr = reader.readString();
    if (!readStr.canRead) {
        console.log("Cannot read string yet");
    } else {
        console.log("Str=" + readStr.value);
    }
    reader.addBuffer(strBuff);

    var readStr = reader.readString();
    if (!readStr.canRead) {
        console.log("Cannot read string yet");
    } else {
        console.log("Str=" + readStr.value);
    }

}

var TAG = "UXIP";

function Log() {
}

Log.v = function(tag, msg) {
    console.log("[" + tag + "] " + msg);
};
Log.e = function(tag, msg) {
    console.error("[" + tag + "] " + msg);
};
Log.d = function(tag, msg) {
    console.info("[" + tag + "] " + msg);
};

if ( typeof module != 'undefined') {
    module.exports = {
        UXIPReader : UXIPReader,
        testReader : testReader
    };
    UTF8 = require('./utf8.js').UTF8;
    NuboCache = require('./nubocache.js').NuboCache;
    UXIPExport = require('./uxip.js');
}