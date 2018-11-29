function NuboCache(callback) {
    "use strict";
    var TAG = "NuboCache";
    var NUMBER_OF_APPS_TO_CACHE = 11;
    var nuboCache = {};
    var nuboCacheProcessList = [];
    var lastCachedProcess;
    var clearProcessCache = callback;

    this.addCacheItem = function(processId, cacheItemHashCodeStr, cacheItem) {
        var cacheItemHolder = nuboCache[processId.toString()];
        if (cacheItemHolder == null) {
            cacheItemHolder = {};
            if (nuboCacheProcessList.length >= NUMBER_OF_APPS_TO_CACHE) {
                var firstProcessIdStr = nuboCacheProcessList.shift();
                clearProcessCache(firstProcessIdStr);
            }
            nuboCacheProcessList.push(processId.toString());
            nuboCache[processId.toString()] = cacheItemHolder;
            lastCachedProcess = processId;
        } else {
            if (lastCachedProcess != processId) {
                // move the position of process to end
                lastCachedProcess = processId;
                var i = nuboCacheProcessList.indexOf(processId.toString());
                nuboCacheProcessList.splice(i, 1);
                nuboCacheProcessList.push(processId.toString());
            }
        }

        cacheItemHolder[cacheItemHashCodeStr] = cacheItem;
    };

    this.removeCacheItems = function(processId, noOfItemsToRemove) {
        var cacheItemHolder = nuboCache[processId.toString()];
        if (cacheItemHolder) {
            cacheItemHolder.splice(0, noOfItemsToRemove);
        } else {
            console.error("removeCacheItems. cacheItemHolder not found for process: "+processId);
        }
    };

    this.getCacheItem = function(processId, cacheItemHashCodeStr) {
        var cacheItemHolder = nuboCache[processId.toString()] || {};
        var cacheItem = cacheItemHolder[cacheItemHashCodeStr];
        if (cacheItem == null) {
            if (isNodeJS) {
                console.error(TAG + " could not find cache item for process=" + processId + " cacheItemHashCodeStr=" + cacheItemHashCodeStr);
            } else {
                Log.e(TAG, "could not find cache item for process=" + processId + " cacheItemHashCodeStr=" + cacheItemHashCodeStr);
            }
        }
        return cacheItem;
    };

    this.clearAckedProcessCache = function(processId) {
        // received from platform delete permission
        console.error("Remove cache for process: "+processId);
        delete nuboCache[processId.toString()];
    };

}

var isNodeJS;
if ( typeof module != 'undefined') {
    module.exports = {
        NuboCache : NuboCache
    };
    isNodeJS = true;
}
