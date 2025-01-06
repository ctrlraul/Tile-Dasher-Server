import express from 'express';
import { globalErrorHandler } from './middlewares/global-error-handler.js';
import { authRouter } from './routers/auth-router.js';
import { generalRouter } from './routers/general-router.js';
import { env } from './helpers/env.js';
import { EventSender } from './event-sender.js';
import './web-socket.js';

const port = env('PORT', '4200');
const app = express();

app.set('trust proxy', true);

app.use(authRouter);
app.use(generalRouter);
app.use(EventSender.router);
app.use(globalErrorHandler); // Should come after all other app.use calls

app.listen(port, () => console.log('Listening on port', port));