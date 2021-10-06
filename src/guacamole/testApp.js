"use strict";


const ConfiguredGuacamoleSocket = require('./ConfiguredGuacamoleSocket');
const GuacamoleClientInformation = require('./GuacamoleClientInformation');
const GuacamoleConfiguration = require('./GuacamoleConfiguration');

async function main() {
    try {
        let conf = new GuacamoleConfiguration();
        let info = new GuacamoleClientInformation();
        conf.protocol = "rdp";
        /*
        config.setProtocol("rdp");
            config.setParameter("hostname", rdphostname);
            config.setParameter("port", rdpport);
            config.setParameter("password", password);
            config.setParameter("username", username);
            config.setParameter("ignore-cert","true");
            config.setParameter("width", width);
            config.setParameter("height", height);
            config.setParameter("enable-audio","true");
            config.setParameter("disable-audio","false");
        */
        conf.parameters = {
            hostname: "172.21.0.4",
            port: "3389",
            username: "test",
            password: "k5yGCe0PHGkMx0Nn",
            "ignore-cert": "true",
            "width": "1024",
            "height": "768"
        };

        let gsocket = new ConfiguredGuacamoleSocket("labil.nubosoftware.com", 4822, conf, info);
        console.log("Before init..");
        gsocket.on("error", (err) => {
            console.error("ConfiguredGuacamoleSocket error",err);
        });
        await gsocket.init();
        
        while (true) { 
            let instruction = await gsocket.reader.readInstruction() ;
            console.log(`instruction: ${instruction.print()}`);
        }
        console.log("After init..");

    } catch (err) {
        console.error(`testApp Error: ${err}`,err);
    }


}

main();