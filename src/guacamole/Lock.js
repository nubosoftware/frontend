const { GuacamoleException } = require("./GuacamoleExceptions");

/**
 * Simple class for locking the reader and writer
 */
class Lock {
    

    /**
     * {Array} The waiting promises
     */
    waitQ = [];

    /**
     * Indicate if this lock is currently locked
     */
    lockObj = null;
    

    /**
     * Lock this lock if the lock is already locked the promize will wait for other to unlock it
     */
    lock() {
        return new Promise((resolve, reject) => {

            if (this.lockObj == null) {
                this.lockObj = new Object();
                resolve(this.lockObj);
            } else {
                this.waitQ.push({
                    resolve,
                    reject
                })
            }
        });
        

    }

    /**
     * Unlock this lock. If another "thread" is waiting then call its promise
     */
    unlock() {
        let waitObj = this.waitQ.shift();
        if (!waitObj) {
            // no other threads are waiting
            this.lockObj = null;
        } else {
            this.lockObj = new Object();
            waitObj.resolve(this.lockObj);
        }
    }

    hasQueuedThreads() {
        return (this.waitQ.length > 0);
    }
}

module.exports = Lock;