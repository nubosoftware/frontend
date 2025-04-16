const Common = require('./common.js');
const logger = Common.logger;
const path = require('path');
const { fork } = require('child_process');

function callPlugin(req, res, next) {

    const pluginId = req.params.pluginId;
    try {
        
        
        logger.info(`Received request for plugin endpoint: ${req.method}  pluginId: ${pluginId}`);

        var serverID = req.body.serverID || req.headers['x-server-id'];
        var serverAuthKey = req.body.serverAuthKey || req.headers['x-auth-token'];
        if (!serverID || !serverAuthKey) {
            logger.info(`Invalid server id or auth token: ${serverID} ${serverAuthKey}`);
            res.send(401, { error: 'Invalid server id or auth token' });
            return;
        }
        var confAuthKey = Common.RemoteServers?.[serverID];
        if (confAuthKey != serverAuthKey) {
            logger.info(`Invalid auth token`);
            res.send(401, { error: 'Invalid auth token' });
            return;
        }

        var scriptFullPath = Common.plugins[pluginId];
        if (!scriptFullPath) {
            res.send(404, { error: 'Plugin not found' });
            return;
        }

        // remove thr serverAuthKey from the params passed to request data
        const sendBody = {
            ...req.body,
            serverAuthKey: undefined
        };

        var scriptDir = path.dirname(scriptFullPath);

        // Data to pass to the child process
        const requestData = {
            method: req.method,           
            query: req.query,
            body: sendBody,
        };

        // logger.info(`Forking plugin script: ${scriptFullPath}, cwd: ${scriptDir}, requestData: ${JSON.stringify(requestData)}`);
        // Resolve script path to absolute path
        const absoluteScriptPath = path.resolve(scriptFullPath);
        // logger.info(`Absolute plugin script path: ${absoluteScriptPath}`);

        // Fork the script process
        const child = fork(absoluteScriptPath, [], {
            cwd: scriptDir, // Set working directory for the script
            // silent: false // Set to true to suppress child stdout/stderr in parent console
        });

        // Handle messages from child process
        child.on('message', (message) => {
            if (message.type === 'RESULT') {
                const { statusCode = 200, body = {}, headers = {} } = message.payload;
                // console.log(`Plugin ${pluginId} responded successfully. statusCode: ${statusCode}, body: ${JSON.stringify(body)}, headers: ${JSON.stringify(headers)}`);
                Object.entries(headers).forEach(([key, value]) => {
                    res.setHeader(key, value);
                });
                res.send(statusCode, body);
            } else if (message.type === 'ERROR') {
                const { statusCode = 500, body = { error: 'Plugin execution failed' } } = message.payload;
                logger.info(`Plugin ${pluginId} reported an error: ${JSON.stringify(body)}`);
                res.send(statusCode, body);
            }
            // Ensure we don't listen indefinitely if the child doesn't exit
            clearTimeout(timeout);
        });

        // Handle errors from child process (e.g., failed to spawn)
        child.on('error', (err) => {
            logger.info(`Failed to start or communicate with plugin script ${pluginId}: ${err}`);
            res.send(500, { error: 'Failed to execute plugin script.' });
            clearTimeout(timeout);
        });

        // Handle child process exit
        child.on('exit', (code, signal) => {
            if (code !== 0) {
                logger.info(`Plugin script ${pluginId} exited with code ${code} and signal ${signal}`);
            }
            // If the response hasn't been sent yet (e.g., script crashed before sending message)
            if (!res.headersSent) {
                logger.info(`Plugin script ${pluginId} exited unexpectedly before sending a response.`);
                res.send(500, { error: 'Plugin script exited unexpectedly.' });
            }
            clearTimeout(timeout);
        });

        // Send request data to the child process
        child.send(requestData);

        // Add a timeout for the plugin execution
        const timeout = setTimeout(() => {
            logger.info(`Plugin script ${pluginId} timed out.`);
            child.kill('SIGTERM'); // Attempt graceful shutdown
            if (!res.headersSent) {
                res.send(504, { error: 'Plugin execution timed out.' });
            }
        }, 30000); // 30 second timeout (adjust as needed)

    } catch (error) {
        logger.error(`Error calling plugin ${pluginId}: ${error}`);
        res.send(500, { error: 'Failed to call plugin.' });
    }
}

module.exports = { callPlugin };