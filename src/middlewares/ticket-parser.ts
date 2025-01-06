import type { Request, Response, NextFunction } from 'express';
import { Database } from '../database/database.js';

export const TicketName: string = 'x-ticket';

export async function ticketParserMiddleware(req: Request, _res: Response, next: NextFunction)
{
	const ticketId = req.headers[TicketName] as string;

	if (ticketId != null)
	{
		try
		{
			req.ticket = await Database.getTicket(ticketId);
		}
		catch (error)
		{
			console.error('Error getting request ticket: ', error);
		}
	}
	
	next();
}
