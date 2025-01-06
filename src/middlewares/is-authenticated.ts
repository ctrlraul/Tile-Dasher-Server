import type { Request, Response, NextFunction } from 'express';

export async function authenticatedMiddleware(req: Request, res: Response, next: NextFunction)
{
	if (!req.ticket)
	{
		res.status(401).send('Unauthorized');
		return;
	}

	next();
}
