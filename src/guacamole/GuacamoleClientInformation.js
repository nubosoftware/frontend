"use strict";


/**
 * An abstract representation of Guacamole client information, including all
 * information required by the Guacamole protocol during the preamble.
 */
class GuacamoleClientInformation {

    /**
     * The optimal screen width requested by the client, in pixels.
     */
    optimalScreenWidth  = 1024;

    /**
     * The optimal screen height requested by the client, in pixels.
     */
    optimalScreenHeight = 768;

    /**
     * The resolution of the optimal dimensions given, in DPI.
     */
    optimalResolution = 96;

    /**
     * The list of audio mimetypes reported by the client to be supported.
     */
    audioMimetypes = []; //['audio/L8','audio/L16'];

    /**
     * The list of video mimetypes reported by the client to be supported.
     */
    videoMimetypes = [];

    /**
     * The list of image mimetypes reported by the client to be supported.
     */
    imageMimetypes = ['image/jpeg','image/png','image/webp'];
    
    /**
     * The timezone reported by the client.
     */
    timezone = 'Asia/Jerusalem';
 }

 module.exports = GuacamoleClientInformation;