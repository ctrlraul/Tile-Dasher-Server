import { Router, Request, Response } from 'express';
import { Logger } from './helpers/logger.js';
import { Database } from './database/database.js';
import { ticketParserMiddleware } from './middlewares/ticket-parser.js';
import { authenticatedMiddleware } from './middlewares/is-authenticated.js';
import { createClientData } from './create-client-data.js';
import type { Player } from './models/player.js';
import type { InitialData } from './models/initial-data.js';

const logger: Logger = new Logger('EventSender');
const clients: Map<Player['id'], Response> = new Map();
const router = Router();

router.use(ticketParserMiddleware);
router.use(authenticatedMiddleware);

router.get('/sse', async (req: Request, res: Response) => {
	logger.log('SSE connection');

	// Set headers for SSE
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders();

	let player: Player | null = await Database.getFullPlayer(req.ticket!.playerId)!;
	let initialData: InitialData | null = await createClientData(player);
	const client = res;

	req.on('close', () => {
		logger.log('SSE disconnection');
		// MatchMaker.notifyPlayerDisconnected(player.id);
	});

	clients.set(player.id, client);

	send(player.id, 'Client_Data', initialData);

	player = null;
	initialData = null;
});

function send(playerId: Player['id'], eventName: string, data: object | null = null): void {
	const json = JSON.stringify(data);
	clients.get(playerId)?.write(`data:${JSON.stringify({ name: eventName, json })}\n\n`);
}

function disconnect(playerId: Player['id']): void {
	const client = clients.get(playerId);
	if (client) {
		client.end();
	}
}

function isConnected(playerId: Player['id']): boolean {
	return clients.has(playerId);
}

export const EventSender = {
	router,
	send,
	disconnect,
	isConnected,
};