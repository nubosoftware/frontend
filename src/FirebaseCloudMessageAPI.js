"use strict";

const Common = require('./common.js');
const logger = Common.logger;
const admin = require('firebase-admin');
const fsp = require('fs').promises;


/**
 * Helper class to send Firebase Cloud Messages using the Firebase Admin SDK
 */
class FirebaseCloudMessageAPI {
    constructor() {
        this.initImp ();
    }

    initialized = false;
    initError = null;
    initPromises = [];

    /*
        * Initialize the Firebase Cloud Messaging API
        * Service Account File is expected to be set in the FCMServiceAccountFile property in Settings.json
    */
    async initImp () {
        try {
            logger.info('FirebaseCloudMessageAPI. Initializing...');

            const serviceAccountFile = Common.FCMServiceAccountFile;
            if (!serviceAccountFile) {
                throw new Error('FCM Service Account File is not set');
            }

            const serviceAccountJSON = await fsp.readFile(serviceAccountFile);
            const serviceAccount = JSON.parse(serviceAccountJSON);

            logger.info(`FirebaseCloudMessageAPI. Service Account: ${serviceAccount.client_email}`);
            // Initialize the Firebase Admin SDK
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });

            this.initialized = true;

            this.initPromises.forEach(p => p.resolve(this));
        } catch (err) {
            if (err instanceof Error) {
                this.initError = err;
                this.initPromises.forEach(p => p.reject(err));
            } else {
                this.initError = new Error(err);
                this.initPromises.forEach(p => p.reject(new Error(err)));
            }
        }
    }

    /*
    *  Wait for the initialization of the Firebase Cloud Messaging API
    */
    waitForInit() {
        return new Promise((resolve, reject) => {
            if (this.initialized) {
                resolve(this);
                return;
            }
            if (this.initError) {
                reject(this.initError);
                return;
            }
            this.initPromises.push({ resolve, reject });
        });
    }


    /*
    * Send a Firebase Cloud Message
    * @param message - The message to send
    * @returns The response from the Firebase Cloud Messaging API
    * @throws Error if the Firebase Cloud Messaging API is not initialized or if there is an error sending the message
    * */
    async sendMessage(message) {
        await this.waitForInit();
        // logger.info(`FirebaseCloudMessageAPI. Sending message: ${JSON.stringify(message)}`);
        const response = await admin.messaging().send(message);
        return response;

    }


}

module.exports = FirebaseCloudMessageAPI;