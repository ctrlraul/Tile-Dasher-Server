import { Database } from '../database/database.js';
import { TicketName, ticketParserMiddleware } from '../middlewares/ticket-parser.js';
import { env } from '../helpers/env.js';
import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { googleAuth } from './with-google.js';
import { discordAuth } from './with-discord.js';
import { SocketManager } from '../socket-manager.js';
import { uuidv7 } from 'uuidv7';
import { Player } from '../models/player.js';
import { Insertable } from 'kysely';
import * as Schema from '../database/schema.js';
import { Logger } from '../helpers/logger.js';
import { adjectives, animals, uniqueNamesGenerator } from 'unique-names-generator';


export interface RegisterInfo {
	id: string;
	name: string;
	email: string;
}


const AllowImpersonation = env('ENVIRONMENT') === 'development' && env('ALLOW_INSECURE_IMPERSONATION', '0') === '1';
const logger: Logger = new Logger('AuthManager');
const router = Router();


async function findOrRegisterPlayer(authMethod: string, registerInfo: RegisterInfo): Promise<Player['id']>
{
	// First check if this auth method is already registered

	const auth = await Database.getAuthMethod(authMethod, registerInfo.id);

	if (auth)
	{
		logger.info(`Player '${auth.playerId}' logged in with auth method '${authMethod}'`);
		return auth.playerId;
	}


	// Then check if the email is already registered

	const player = await Database.kysely
		.selectFrom('players')
		.where('email', '=', registerInfo.email)
		.select('id')
		.executeTakeFirst();

	if (player)
	{
		await Database.createAuthMethod(authMethod, registerInfo.id, player.id);
		logger.info(`Added '${authMethod}' auth method for player '${player.id}'`);
		return player.id;
	}


	// Register new player

	return await Database.transaction(async trx =>
	{
		const player: Insertable<Schema.Players> = {
			id: uuidv7(),
			name: registerInfo.name,
			email: registerInfo.email,
		};

		await Database.createPlayer(player, trx);
		await Database.createAuthMethod(authMethod, registerInfo.id, player.id, trx);

		logger.info(`Registered player '${player.id}' with auth method '${authMethod}'`);

		return player.id;
	});
}

function generateRandomName(): string {
	return uniqueNamesGenerator({
		dictionaries: [adjectives, animals],
		separator: ' ',
		style: 'capital'
	});
}


router.get('/auth/google', googleAuth.entry);
router.get('/auth/google/callback', googleAuth.callback);

router.get('/auth/discord', discordAuth.entry);
router.get('/auth/discord/callback', discordAuth.callback);


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

	if (!ticket)
	{
		res.send();
		return;
	}

	SocketManager.disconnect(ticket.playerId);

	await Database.deleteTicket(ticketId);

	if (ticket.isGuest)
	{
		Database.deletePlayer(ticket.playerId)
			.catch(error => logger.error('Failed to delete guest account:', error));
	}
	
	logger.info(`Player '${ticket.playerId}' logged out`);

	res.send();
});

router.get('/auth/state', ticketParserMiddleware, (req: Request, res: Response) =>
{
	res.send(req.ticket ? '1' : '0');
});

router.get('/auth/guest', async (req: Request, res: Response) =>
{
	const ticket = await Database.transaction(async trx =>
	{
		const player: Insertable<Schema.Players> = {
			id: uuidv7(),
			name: generateRandomName(),
			email: null,
			role: 'guest'
		};

		await Database.createPlayer(player, trx);
		return await Database.createTicket(player.id, true, trx);
	});

	logger.info(`Registered guest '${ticket.playerId}'`);

	res.json(ticket.id);
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

	const ticket = await Database.getTicketForPlayerId(playerId) ?? await Database.createTicket(playerId);

	logger.warn(`Impersonating player '${ticket.playerId}'`);

	res.json(ticket.id);
});


export const AuthManager = {
	router,
	findOrRegisterPlayer,
	generateRandomName,
};