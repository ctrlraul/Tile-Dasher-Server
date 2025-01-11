import express from 'express';
import { AuthManager } from './auth/auth-manager.js';
import { env } from './helpers/env.js';
import './socket-manager.js';
import { globalErrorHandler } from './middlewares/global-error-handler.js';
import chalk from 'chalk';
import { Logger } from './helpers/logger.js';


const port = env('PORT', '4200');
const app = express();


app.set('trust proxy', true);

app.use(express.json());
app.use(AuthManager.router);


app.get('/error', () => {
	throw new Error('Test error');
});

app.get('/error/async', async () => {
	throw new Error('Test error async');
});


app.get('/privacy', (req, res) => {
	throw new Error('Not implemented');
});

app.get('/tos', (req, res) => {
	throw new Error('Not implemented');
});


// Error handler should come after all app.use and routes
app.use(globalErrorHandler);


app.listen(port, () => Logger.info(`[${chalk.blue('WebServer')}] Listening on port ${chalk.yellow(port)}`));