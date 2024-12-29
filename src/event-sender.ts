import { Router, type ServerSentEventTarget } from '@oak/oak';
import { createInitialData } from './create-initial-data.ts';
import { Logger } from './helpers/logger.ts';
import { Database } from './database/database.ts';
import { ticketParserMiddleware } from './middlewares/ticket-parser.ts';
import { authenticatedMiddleware } from './middlewares/is-authenticated.ts';
import type { Player } from './models/player.ts';
import type { InitialData } from './models/initial-data.ts';


const logger: Logger = new Logger('EventSender');
const clients: Map<Player['id'], ServerSentEventTarget> = new Map();
const router = new Router<ContextState>();

router.use(ticketParserMiddleware);
router.use(authenticatedMiddleware);

router.get('/sse', async ctx => 
{
	logger.log('SEE connection');

	let player: Player | null = await Database.getFullPlayer(ctx.state.ticket!.playerId)!;
	let initialData: InitialData | null = await createInitialData(player);
	let client: ServerSentEventTarget | null = await ctx.sendEvents();

	// const playerId = player!.id;

	client.addEventListener('close', _event =>
	{
		logger.log('SEE disconnection');
		// MatchMaker.notifyPlayerDisconnected(playerId);
	});

	clients.set(player.id, client);

	send(player.id, 'initial_data', initialData);

	player = null;
	initialData = null;
	client = null;
});


function send(playerId: Player['id'], eventName: string, data: object | null = null): void
{
	// logger.log(`* --> [${eventName}]`);
	clients.get(playerId)?.dispatchMessage({
		name: eventName,
		json: JSON.stringify(data)
	});
}

function disconnect(playerId: Player['id']): void
{
	const client = clients.get(playerId);
	
	if (client != undefined && !client.closed)
		client.close();
}

function isConnected(playerId: Player['id']): boolean
{
	return clients.has(playerId);
}


export const EventSender = 
{
	router,
	send,
	disconnect,
	isConnected,
};