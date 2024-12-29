import type { Next, Context } from '@oak/oak';

type Ctx = Context<ContextState, ContextState>;

export async function authenticatedMiddleware(ctx: Ctx, next: Next)
{
	if (ctx.state.ticket === undefined)
	{
		ctx.response.status = 401;
		ctx.response.body = 'Unauthorized';
		return;
	}

	await next();
}
