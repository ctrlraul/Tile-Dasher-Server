import './socket-manager.js';
import http from 'http';
import { WebServer } from './web-server.js';
import { env } from './helpers/env.js';
import { SocketManager } from './socket-manager.js';
import { Logger } from './helpers/logger.js';
import chalk from 'chalk';

const port = env('PORT', '4200');
const server = http.createServer(WebServer.app);

SocketManager.init(server);

server.listen(port, () => {
	Logger.info(`Listening on port ${chalk.yellow(port)}`);
});