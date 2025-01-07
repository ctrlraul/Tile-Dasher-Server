import { Database } from '../database/database.js';
import { TicketName, ticketParserMiddleware } from '../middlewares/ticket-parser.js';
import { TokenHelper } from '../helpers/token-helper.js';
import { env } from '../helpers/env.js';
import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { middleware as googleAuthMiddleware } from './with-google.js';
import { middleware as discordAuthMiddleware } from './with-discord.js';
import { SocketManager } from '../socket-manager.js';


const AllowImpersonation = env('ALLOW_INSECURE_IMPERSONATION', '0') === '1';

export const router = Router();


router.use(googleAuthMiddleware);
router.use(discordAuthMiddleware);


router.get('/auth/success', async (_req: Request, res: Response) =>
{
	const html = readFileSync('static/auth-success.html', 'utf-8');
	res.setHeader('Content-Type', 'text/html');
	res.send(html);
});

router.get('/auth/clear', async (req: Request, res: Response) =>
{
	const ticketId = String(req.headers[TicketName]);
	const ticket = await Database.getTicket(ticketId);

	SocketManager.disconnect(ticket!.playerId);

	await Database.deleteTicket(ticketId);
	
	res.send();
});

router.get('/auth/state', ticketParserMiddleware, (req: Request, res: Response) =>
{
	res.send(req.ticket ? '1' : '0');
});

router.post('/auth/impersonate', async (req: Request, res: Response) =>
{
	if (!AllowImpersonation)
	{
		res.status(401).send('Nuh uh');
		return;
	}

	const { playerId } = req.body;

	if (!playerId)
	{
		res.status(401).send('Huh');
		return;
	}

	const ticket = await Database.getTicketForPlayerId(playerId) ?? await Database.createTicket({
		id: TokenHelper.generateSessionToken(),
		playerId: playerId,
	});

	res.json(ticket.id);
});


export const Auth = {
	router
};