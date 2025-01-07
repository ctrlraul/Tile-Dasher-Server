import express from 'express';
import { Auth } from './auth/auth.js';
import { globalErrorHandler } from './middlewares/global-error-handler.js';
import { env } from './helpers/env.js';
import './socket-manager.js';

const port = env('PORT', '4200');
const app = express();

app.set('trust proxy', true);

app.use(express.json());
app.use(Auth.router);
app.use(globalErrorHandler); // Should come after all other app.use calls

app.listen(port, () => console.log('Listening on port', port));