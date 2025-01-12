import express from 'express';
import { AuthManager } from './auth/auth-manager.js';
import { globalErrorHandler } from './middlewares/global-error-handler.js';


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


export const WebServer = {
	app,
};