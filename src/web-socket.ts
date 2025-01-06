import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from './helpers/logger.js';
import { Player } from './models/player.js';
import { createClientData } from './create-client-data.js';
import { TicketName } from './middlewares/ticket-parser.js';
import { Database, Ticket } from './database/database.js';
import { $array, $null, $number, $object, $objectStrict, $record, $string, $union } from './helpers/purity.js';
import { Track } from './models/track.js';


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


class InteractiveClientMessage implements ClientMessage {
	
	public readonly socket: Socket;
	public readonly eventName: string;
	public readonly data: string | null;
	public readonly exchangeId: string | null;
	public completed: boolean = false;

	public constructor(socket: Socket, clientMessage: ClientMessage)
	{
		this.socket = socket;
		this.eventName = clientMessage.eventName;
		this.data = clientMessage.data;
		this.exchangeId = clientMessage.exchangeId;
	}

	public respond(data: any = null)
	{
		if (this.completed)
			logger.log(`Attempted to resolve an already resolved ClientMessage with event name '${this.eventName}'`);
		else
			this.socket.respondMessage(this, data);
	}

	public reject(error: string | null = null)
	{
		if (this.completed)
			logger.log(`Attempted to resolve an already resolved ClientMessage with event name '${this.eventName}'`);
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
			eventName: clientMessage.eventName,
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
			eventName: clientMessage.eventName,
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



const logger = new Logger('WebSocket');
const wss = new WebSocketServer({ port: 4201 });
const sockets: Map<string, Socket> = new Map();


function get(playerId: Player['id'])
{
	return sockets.get(playerId) || null;
}

function isConnected(playerId: Player['id'])
{
	return sockets.has(playerId);
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
	const data = message.data && JSON.parse(message.data);

	switch (message.eventName)
	{
		case 'Track': {
			const trackId = data;
			if (!trackId)
				return message.reject('id is required');
			const track: Track = await Database.getTrack(trackId);
			message.respond(track);
			break;
		}

		case 'Track_Create': {
			const upload = $trackCreateCheck.assert(data);
			const track = await Database.createTrack({
				name: upload.name,
				playerId: message.socket.playerId,
				tileCoords: upload.tileCoords
			});
			message.respond(track);
			break;
		}

		case 'Track_Update': {
			const upload = $trackUpdateCheck.assert(data);
			const track = await Database.updateTrack({
				id: upload.id,
				name: upload.name,
				playerId: message.socket.playerId,
				tileCoords: upload.tileCoords
			});
			message.respond(track);
			break;
		}

		case 'Track_Delete': {
			const trackId = data;
			if (!trackId)
				return message.reject('id is required');
			await Database.deleteTrack(message.socket.playerId, trackId);
			message.respond();
			break;
		}

		case 'Track_Play': {
			const trackId = data;
			if (!trackId)
				return message.reject('id is required');
			const track: Track = await Database.getTrack(trackId);
			Database.incrementTrackPlays(trackId)
				.catch(error => console.log('Error incrementing track plays:', error));
			message.respond(track);
			break;
		}

		default:
			logger.log('Unhandled event name:', message.eventName);
			break;
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
		const clientData = await createClientData(player);
		socket.playerId = player.id;
		sockets.set(player.id, socket);
		socket.send('Client_Data', clientData);
	}
	catch (error)
	{
		logger.log('Error loading client data:', error);
		socket.send('Client_Data_Error');
		socket.close();
	}

	ws.on('message', message =>
	{
		try
		{
			const unknown = JSON.parse(message.toString());
			const clientMessage = $clientMessageChecker.assert(unknown);
			const interactiveClientMessage = new InteractiveClientMessage(socket, clientMessage);
			gotMessage(interactiveClientMessage);
		}
		catch (error)
		{
			logger.log('Error processing message:', error);
			// socket.send('Error', 'Bad Message');
			socket.close();
		}
	});

	ws.on('close', () => {
		// logger.log('Disconnection');
	});
});

wss.addListener('listening', () => logger.log('Listening'));


export const SocketManager = {
	get,
};