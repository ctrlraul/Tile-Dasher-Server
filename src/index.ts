import { Application } from '@oak/oak';
import { globalErrorHandling } from './middlewares/global-error-handling.ts';
import { authRouter } from './routers/auth-router.ts';
import { generalRouter } from './routers/general-router.ts';
import { EventSender } from './event-sender.ts';

const app = new Application<ContextState>();

app.use(globalErrorHandling);
app.use(authRouter.routes());
app.use(generalRouter.routes());
app.use(EventSender.router.routes());

app.addEventListener('listen', appListenEvent => console.log('Listening on port', appListenEvent.port))

await app.listen({ port: 3000 });