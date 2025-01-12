import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from './helpers/logger.js';
import { Player } from './models/player.js';
import { ClientDataManager } from './client-data-manager.js';
import { TicketName } from './middlewares/ticket-parser.js';
import { Database, Ticket } from './database/database.js';
import { $array, $null, $number, $object, $objectStrict, $record, $string, $union } from './helpers/purity.js';
import { Track } from './models/track.js';
import { RacesQueuer } from './races-queuer.js';
import { RaceCharacterUpdate } from './models/race-character-update.js';
import { MathHelper } from './helpers/math-helper.js';
import chalk from 'chalk';
import { env } from './helpers/env.js';


interface ClientMessage {
	eventName: string;
	data: string | null;
	exchangeId: string | null;
}

interface ServerMessage {
	eventName: string;
	data: string | null;
	error: string | null;
	exchangeId: string | null;
}


const dev = env('ENVIRONMENT') == 'development';


class InteractiveClientMessage implements ClientMessage {
	
	public readonly socket: Socket;
	public readonly eventName: string;
	public readonly data: string | null;
	public readonly parsedData: any;
	public readonly exchangeId: string | null;
	public completed: boolean = false;

	public constructor(socket: Socket, clientMessage: ClientMessage)
	{
		this.socket = socket;
		this.eventName = clientMessage.eventName;
		this.data = clientMessage.data;
		this.parsedData = clientMessage.data && JSON.parse(clientMessage.data);
		this.exchangeId = clientMessage.exchangeId;
	}

	public respond(data: any = null)
	{
		// Don't log since a manipulated message might cause this anyway
		if (this.exchangeId === null)
			return;

		if (this.completed)
			logger.info(`Attempted to resolve an already resolved ClientMessage with event name '${this.eventName}'`);
		else
			this.socket.respondMessage(this, data);
	}

	public reject(error: string | null = null)
	{
		// Don't log since a manipulated message might cause this anyway
		if (this.exchangeId === null)
			return;

		if (this.completed)
			logger.info(`Attempted to resolve an already resolved ClientMessage with event name '${this.eventName}'`);
		else
			this.socket.rejectMessage(this, error);
	}
}

class Socket
{
	public ws: WebSocket;
	public playerId: Player['id'] = '';


	constructor(ws: WebSocket)
	{
		this.ws = ws;
	}


	public send(eventName: string, data: unknown = null): void
	{
		const message: ServerMessage = {
			eventName,
			data: JSON.stringify(data),
			error: null,
			exchangeId: null
		};
	
		const json = JSON.stringify(message);
	
		this.ws.send(json);
	}

	public respondMessage(clientMessage: ClientMessage, data: unknown = null)
	{
		const serverMessage: ServerMessage = {
			eventName: clientMessage.eventName + '_Success',
			data: JSON.stringify(data),
			error: null,
			exchangeId: clientMessage.exchangeId
		};
	
		const json = JSON.stringify(serverMessage);
	
		this.ws.send(json);
	}

	public rejectMessage(clientMessage: ClientMessage, error: string | null = null)
	{
		const serverMessage: ServerMessage = {
			eventName: clientMessage.eventName + '_Error',
			data: null,
			error: error,
			exchangeId: clientMessage.exchangeId
		};
	
		const json = JSON.stringify(serverMessage);
	
		this.ws.send(json);
	}

	public close(): void
	{
		this.ws.close();
	}
}


// Checkers

const $clientMessageChecker = $objectStrict({
	eventName: $string,
	data: $union($string, $null),
	exchangeId: $union($string, $null),
});

const $trackCreateCheck = $object({
	name: $string,
	tileCoords: $record($array($number)),
});

const $trackUpdateCheck = $object({
	id: $string,
	name: $string,
	tileCoords: $record($array($number)),
});



const port = env('ENVIRONMENT') === 'development' ? 4201 : 443;
const logger = new Logger('SocketManager');
const wss = new WebSocketServer({ port });
const sockets: Map<string, Socket> = new Map();


function get(playerId: Player['id'])
{
	return sockets.get(playerId) || null;
}

function sendGlobal(eventName: string, data: unknown): void
{
	for (const socket of sockets.values())
		socket.send(eventName, data);
}

function isConnected(playerId: Player['id'])
{
	return sockets.has(playerId);
}

function disconnect(playerId: Player['id'])
{
	sockets.get(playerId)?.close();
}

async function getTicket(request: any): Promise<Ticket | null>
{
	const ticketId = request.headers[TicketName];
	
	if (typeof ticketId !== 'string')
		return null;

	const ticket = await Database.getTicket(ticketId);

	if (!ticket)
		return null;

	return ticket;
}

async function gotMessage(message: InteractiveClientMessage)
{
	const { parsedData: data, eventName } = message;
	const { playerId } = message.socket;

	try
	{
		switch (eventName)
		{
			case 'Track':
			{
				const trackId = data;
			
				if (typeof trackId !== 'string' || trackId === '')
					throw new Error('Invalid track id');

				const track: Track = await Database.getTrack(trackId);
				message.respond(track);
				break;
			}

			case 'Track_Create':
			{
				const upload = $trackCreateCheck.assert(data);
				const track = await Database.createTrack({
					name: upload.name,
					playerId: playerId,
					tileCoords: upload.tileCoords
				});
				ClientDataManager.notifyTrackPublished(track);
				message.respond(track);
				break;
			}

			case 'Track_Update':
			{
				const upload = $trackUpdateCheck.assert(data);
				const track = await Database.updateTrack({
					id: upload.id,
					name: upload.name,
					playerId: playerId,
					tileCoords: upload.tileCoords
				});
				ClientDataManager.notifyTrackPublished(track);
				message.respond(track);
				break;
			}

			case 'Track_Delete':
			{
				const trackId = data;
			
				if (typeof trackId !== 'string' || trackId === '')
					throw new Error('Invalid track id');

				await Database.deleteTrack(playerId, trackId);

				ClientDataManager.notifyTrackDeleted(trackId);

				message.respond();

				break;
			}


			case 'Race_Solo':
			{
				RacesQueuer.dequeue(playerId);

				const trackId = data;
			
				if (typeof trackId !== 'string' || trackId === '')
					throw new Error('Invalid track id');

				const track: Track = await Database.getTrack(trackId);

				Database.incrementTrackPlays(trackId)
					.catch(error => logger.error('Failed to increment track plays:', error));

				message.respond(track);

				break;
			}


			case 'Race_Queue_Enter':
			{
				const trackId = data;
			
				if (typeof trackId !== 'string' || trackId === '')
					throw new Error('Invalid track id');

				await RacesQueuer.enqueue(playerId, trackId);
				message.respond();

				break;
			}

			case 'Race_Queue_Leave':
			{
				RacesQueuer.dequeue(playerId);
				break;
			}

			case 'Race_Queue_Ready':
			{
				RacesQueuer.setReady(playerId);
				break;
			}


			case 'Race_Character_Update':
			{
				const update: RaceCharacterUpdate = {
					id: playerId,

					x: Number(data.x) || 0,
					y: Number(data.y) || 0,
					vx: Number(data.vx) || 0,
					vy: Number(data.vy) || 0,

					ih: MathHelper.clamp(Number(data.ih) || 0, -1, 1),
					iv: MathHelper.clamp(Number(data.iv) || 0, -1, 1),
				};
				
				RacesQueuer.characterUpdate(update);
				
				break;
			}

			case 'Race_Character_Finish':
			{
				RacesQueuer.characterFinished(playerId);
				break;
			}


			default:
				if (dev)
					logger.error('Unhandled event name:', message.eventName);
				break;
		}
	}
	catch (error)
	{
		logger.error({ eventName, playerId, data, error });
		message.reject(error instanceof Error ? error.message : 'Something went wrong!');
	}
}


wss.on('connection', async (ws, req) =>
{
	const socket = new Socket(ws);
	const ticket = await getTicket(req);

	if (!ticket)
	{
		socket.close();
		return;
	}

	// logger.log('Connection');

	try
	{
		const player = await Database.getFullPlayer(ticket.playerId);
		const clientData = await ClientDataManager.createForPlayer(player);
		socket.playerId = player.id;
		sockets.set(player.id, socket);
		socket.send('Client_Data', clientData);
	}
	catch (error)
	{
		logger.info('Error loading client data:', error);
		socket.send('Client_Data_Error');
		socket.close();
	}

	ws.on('message', async message =>
	{
		try
		{
			const unknown = JSON.parse(message.toString());
			const clientMessage = $clientMessageChecker.assert(unknown);
			const interactiveClientMessage = new InteractiveClientMessage(socket, clientMessage);
			await gotMessage(interactiveClientMessage);
		}
		catch (error)
		{
			logger.info('Error processing message:', error);
			// socket.send('Error', 'Bad Message');
			socket.close();
		}
	});

	ws.on('close', () => {
		// logger.log('Disconnection');

		sockets.delete(socket.playerId);

		RacesQueuer.dequeue(socket.playerId);

		Database.updatePlayerLastSeen(socket.playerId)
			.catch(error => logger.error(`Failed to update player's last seen:`, error));
	});
});

wss.addListener('listening', () => logger.info(`Listening on port ${chalk.yellow(port)}`));


export const SocketManager = {
	get,
	isConnected,
	sendGlobal,
	disconnect,
};