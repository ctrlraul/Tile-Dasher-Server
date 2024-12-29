import type { Context, Next } from '@oak/oak';
import { Database } from '../database/database.ts';

type Ctx = Context<ContextState, ContextState>;

export const TICKET_HEADER_NAME: string = 'x-ticket';

export async function ticketParserMiddleware(ctx: Ctx, next: Next)
{
	const ticketId = ctx.request.headers.get(TICKET_HEADER_NAME);

	if (ticketId != null)
	{
		try
		{
			ctx.state.ticket = await Database.getTicket(ticketId);
		}
		catch (error)
		{
			console.error('Error getting request ticket: ', error);
		}
	}
	
	await next();
}
