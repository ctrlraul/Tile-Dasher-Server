import { Database } from './database/database.js';
import { Logger } from './helpers/logger.js';
import { ObjectUtils } from './helpers/object-utils.js';
import { Player } from './models/player.js';
import { RaceQueueReady } from './models/race-queue-ready.js';
import { Race } from './models/race.js';
import { RaceQueueEnter } from './models/race-queue-enter.js';
import { RaceQueueLeave } from './models/race-queue-leave.js';
import { Track } from './models/track.js';
import { SocketManager } from './socket-manager.js';
import { RacesQueueEntry } from './models/races-queue-entry.js';
import { RaceCharacterUpdate } from './models/race-character-update.js';
import { uuidv7 } from 'uuidv7';
import { RaceCharacterFinish } from './models/race-character-finish.js';
import { RaceType } from './enums/race-type.js';


const logger: Logger = new Logger('RaceQueuer');
const queue: Record<Track['id'], RacesQueueEntry> = Object.create(null);
const queuedPlayers: Map<Player['id'], Track['id']> = new Map();
const races: Record<Race['id'], Race> = Object.create(null);
const racingPlayers: Map<Player['id'], Race['id']> = new Map();


async function enqueue(playerId: string, trackId: string): Promise<void>
{
	if (queuedPlayers.has(playerId))
	{
		// Player is already queued for this track but doesn't know?
		if (queuedPlayers.get(playerId) === trackId)
		{
			const player = await Database.getPlayerProfile(playerId);
			const raceQueueEnter: RaceQueueEnter = { trackId, player };
			SocketManager.get(playerId)?.send('Race_Queue_Enter', raceQueueEnter);
			return;
		}
		
		dequeue(playerId);
	}

	const entry = await getOrCreateEntry(trackId);
	const player = await Database.getPlayerProfile(playerId);

	entry.players[player.id] = player;
	queuedPlayers.set(player.id, trackId);
	
	// TODO: Not do a send global for this
	const raceQueueEnter: RaceQueueEnter = { trackId, player };
	SocketManager.sendGlobal('Race_Queue_Enter', raceQueueEnter);
}

function dequeue(playerId: Player['id']): void
{
	if (!queuedPlayers.has(playerId))
		return;

	const trackId = queuedPlayers.get(playerId)!;
	const entry = queue[trackId];

	queuedPlayers.delete(playerId);
	entry.playersReady = entry.playersReady.filter(id => id !== playerId);
	delete entry.players[playerId];

	if (ObjectUtils.count(entry.players) === 0)
		delete queue[trackId];
	
	// TODO: Not do a send global for this
	const trackQueueLeave: RaceQueueLeave = { trackId, playerId };
	SocketManager.sendGlobal('Race_Queue_Leave', trackQueueLeave);
}

function setReady(playerId: Player['id']): void
{
	if (!queuedPlayers.has(playerId))
		return;

	const trackId = queuedPlayers.get(playerId)!;
	const entry = queue[trackId];
	const raceQueueReady: RaceQueueReady = { trackId, playerId };

	if (!entry.playersReady.includes(playerId))
		entry.playersReady.push(playerId);

	if (entry.playersReady.length === ObjectUtils.count(entry.players))
	{
		startRace(trackId);
	}
	else
	{
		// TODO: Not do a send global for this
		SocketManager.sendGlobal('Race_Queue_Ready', raceQueueReady);
	}
}

function characterUpdate(update: RaceCharacterUpdate): void
{
	const raceId = racingPlayers.get(update.id);

	if (!raceId)
		return;

	const race = races[raceId];

	for (const player of race.players)
		SocketManager.get(player.id)?.send('Race_Character_Update', update);
}

function characterFinished(playerId: Player['id']): void
{
	const raceId = racingPlayers.get(playerId);

	if (!raceId)
		return;

	const race = races[raceId];
	const data: RaceCharacterFinish = {
		playerId,
		time: Date.now() - race.startTime,
	};

	for (const player of race.players)
	{
		if (player.id != playerId)
			SocketManager.get(player.id)?.send('Race_Character_Finish', data);
	}
}


async function getOrCreateEntry(trackId: string): Promise<RacesQueueEntry>
{
	if (trackId in queue)
		return queue[trackId];

	const trackExists = await Database.trackExists(trackId);
	if (!trackExists)
		throw new Error('Track not found');

	const entry: RacesQueueEntry = {
		trackId,
		players: {},
		playersReady: []
	};

	queue[trackId] = entry;

	return entry;
}

async function startRace(trackId: string)
{
	// TODO: Not do a send global for this
	SocketManager.sendGlobal('Race_Queue_Clear', trackId);

	try
	{
		const entry = queue[trackId];
		const players = Object.values(entry.players);
		const track = await Database.getTrack(trackId);
		const race: Race = {
			id: uuidv7(),
			players,
			startTime: Date.now(),
			track,
			type: RaceType.Online,
		};


		delete queue[trackId];
		races[race.id] = race;

		for (const playerId of entry.playersReady)
		{
			queuedPlayers.delete(playerId);
			racingPlayers.set(playerId, race.id);
			SocketManager.get(playerId)?.send('Race_Start', race);
		}

		Database.incrementTrackPlays(trackId, players.length)
			.catch(error => logger.error('Failed to increment track plays:', error));
	}
	catch (error)
	{
		logger.info('Error starting race:', error);
	}
}


export const RacesQueuer = {
	queue,
	enqueue,
	dequeue,
	setReady,
	characterUpdate,
	characterFinished,
};