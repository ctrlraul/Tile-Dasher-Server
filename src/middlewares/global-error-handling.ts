import { Context, isHttpError, type Next } from '@oak/oak';
import { env } from '@raul/env';

type Ctx = Context<ContextState, ContextState>;

const detailed = env('DETAILED_GLOBAL_ERRORS', '1');

export async function globalErrorHandling(ctx: Ctx, next: Next)
{
	try
	{
		await next();
	}
	catch (error)
	{
		const message = error instanceof Error ? error.message : String(error);
		const messageDetailed = detailed ? error : message;
		
		console.log(`Error in route [${ctx.request.url.pathname}]:`, messageDetailed);

		ctx.response.status = isHttpError(error) ? error.status : 500;
		// ctx.response.body = String(message);
	}
}
