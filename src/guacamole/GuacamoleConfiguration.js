"use strict";



class GuacamoleConfiguration {

    /**
     * The ID of the connection being joined. If this value is present,
     * the protocol need not be specified.
     */
     connectionID;
    
     /**
      * The name of the protocol associated with this configuration.
      */
     protocol;
 
     /**
      * Map of all associated parameter values, indexed by parameter name.
      */
     parameters = {};
 

 
     /**
      * Copies the given GuacamoleConfiguration, creating a new, indepedent
      * GuacamoleConfiguration containing the same protocol, connection ID,
      * and parameter values, if any.
      *
      * @param {GuacamoleConfiguration} config The GuacamoleConfiguration to copy.
      */
      constructor (config) {
 
        if (config) {
            this.protocol = config.protocol;
            this.connectionID = config.connectionID;
 
            this.parameters = Object.assign({}, config.parameters);
       
        }
     }
}

module.exports = GuacamoleConfiguration;

