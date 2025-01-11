import pg from 'pg';
import * as Schema from './schema.js';
import { Kysely, PostgresDialect, Insertable, Transaction, Selectable, CamelCasePlugin } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { Player } from '../models/player.js';
import { Tile } from '../models/tile.js';
import { Track } from '../models/track.js';
import { uuidv7 } from 'uuidv7';
import { env } from '../helpers/env.js';
import { tiles } from './tiles.js';
import { PlayerProfile } from '../models/player-profile.js';
import { TrackInfo } from '../models/track-info.js';
import { TokenHelper } from '../helpers/token-helper.js';
import { ClientDataManager } from '../client-data-manager.js';


type OptionalTrx = Transaction<Schema.DB> | null;


const ticketsCache: Map<string, Selectable<Schema.Tickets>> = new Map();

const kysely: Kysely<Schema.DB> = new Kysely<Schema.DB>({
	dialect: new PostgresDialect({
		pool: new pg.Pool({
			connectionString: env('DATABASE_URL')
		})
	}),
	plugins: [
		new CamelCasePlugin()
	]
});

const AuthMethod = {
	Google: 'google',
	Discord: 'discord',
};

const PlayerRoles = {
	Guest: 'guest',
	Regular: 'regular',
	Admin: 'admin',
};



// Tickets

export type Ticket = Selectable<Schema.Tickets>;

async function getTicket(id: Selectable<Schema.Tickets>['id'])
{
	if (ticketsCache.has(id))
		return ticketsCache.get(id);

	const ticket = await kysely
		.selectFrom('tickets')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();
	
	if (ticket != undefined)
		ticketsCache.set(ticket.id, ticket);

	return ticket;
}

async function getTicketForPlayerId(playerId: Selectable<Schema.Players>['id'])
{
	for (const ticket of Array.from(ticketsCache.values()))
	{
		if (ticket.playerId == playerId)
			return ticket;
	}

	const ticket = await kysely
		.selectFrom('tickets')
		.selectAll()
		.where('playerId', '=', playerId)
		.executeTakeFirst();
	
	if (ticket != undefined)
		ticketsCache.set(ticket.id, ticket);

	return ticket;
}

async function createTicket(playerId: string, isGuest: boolean = false, trx: OptionalTrx = null)
{
	const client = trx ?? kysely;
	const ticket = await client
		.insertInto('tickets')
		.values({
			id: TokenHelper.generateSessionToken(),
			playerId,
			isGuest,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
	
	ticketsCache.set(ticket.id, ticket);

	return ticket;
}

async function deleteTicket(id: string)
{
	ticketsCache.delete(id);

	await kysely
		.deleteFrom('tickets')
		.where('id', '=', id)
		.execute();
}



// Players

async function getFullPlayer(id: Selectable<Schema.Players>['id']): Promise<Player>
{
	const result = await kysely
		.selectFrom('players')
		.where('id', '=', id)
		.selectAll()
		.select(eb => [
			jsonArrayFrom(
				eb.selectFrom('tracks')
				.select(['id', 'createdAt', 'name', 'plays'])
				.whereRef('tracks.playerId', '=', 'players.id')
			).as('tracks')
		])
		.executeTakeFirstOrThrow();
	
	const player: Player = {
		...result,
		trackInfos: result.tracks.map(track => ({ ...track, author: result.name })),
	};
	
	return player;
}

async function getPlayerProfile(id: Selectable<Schema.Players>['id']): Promise<PlayerProfile>
{
	return await kysely
		.selectFrom('players')
		.where('id', '=', id)
		.select(['id', 'name', 'level', 'lastSeen'])
		.executeTakeFirstOrThrow();
}

async function createPlayer(data: Insertable<Schema.Players>, trx: OptionalTrx = null)
{
	const client = trx ?? kysely;
	await client
		.insertInto('players')
		.values(data)
		.execute();
}

async function deletePlayer(playerId: Player['id'], trx: OptionalTrx = null)
{
	const client = trx ?? kysely;
	await client
		.deleteFrom('players')
		.where('id', '=', playerId)
		.execute();
}

async function updatePlayerLastSeen(playerId: Player['id'], trx: OptionalTrx = null)
{
	const client = trx ?? kysely;
	await client
		.updateTable('players')
		.where('id', '=', playerId)
		.set({ lastSeen: new Date() })
		.returningAll()
		.execute();
}



// Auth methods

async function getAuthMethod(method: string, methodAccountId: string)
{
	return await kysely
		.selectFrom('authMethods')
		.selectAll()
		.where('id', '=', method + ':' + methodAccountId)
		.executeTakeFirst();
}

async function createAuthMethod(method: string, methodAccountId: string, playerId: string, trx: OptionalTrx = null): Promise<void>
{
	const client = trx ?? kysely;
	await client
		.insertInto('authMethods')
		.values({
			id: method + ':' + methodAccountId,
			playerId,
		})
		.execute();
}



// Tiles

function getTiles(): Promise<Tile[]>
{
	return new Promise(resolve => resolve(tiles));
}



// Tracks

interface CreateTrackData {
	playerId: string;
	name: string;
	tileCoords: Track['tileCoords'];
}

async function createTrack(data: CreateTrackData, trx: OptionalTrx = null): Promise<Track>
{
	const client = trx ?? kysely;
	const result = await client
		.insertInto('tracks')
		.values({
			id: uuidv7(),
			playerId: data.playerId,
			name: data.name,
			tileCoords: JSON.stringify(data.tileCoords)
		})
		.returningAll()
		.executeTakeFirstOrThrow();
	
	const author = await client
		.selectFrom('players')
		.where('id', '=', result.playerId)
		.select('name')
		.executeTakeFirstOrThrow();
	
	return {
		...result,
		tileCoords: JSON.parse(result.tileCoords),
		customTiles: {},
		author: author.name
	};
}

interface UpdateTrackData {
	id: string;
	playerId: string;
	name: string;
	tileCoords: Track['tileCoords'];
}

async function updateTrack(data: UpdateTrackData, trx: OptionalTrx = null): Promise<Track>
{
	const client = trx ?? kysely;
	const result = await client
		.updateTable('tracks')
		.where('tracks.id', '=', data.id)
		.where('tracks.playerId', '=', data.playerId)
		.set({
			name: data.name,
			tileCoords: JSON.stringify(data.tileCoords),
			updatedAt: new Date()
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	const author = await client
		.selectFrom('players')
		.where('id', '=', result.playerId)
		.select('name')
		.executeTakeFirstOrThrow();
		
	return {
		...result,
		tileCoords: JSON.parse(result.tileCoords),
		customTiles: {},
		author: author.name
	};
}

async function getTrack(id: Track['id'], trx: OptionalTrx = null): Promise<Track>
{
	const client = trx ?? kysely;
	const result = await client
		.selectFrom('tracks')
		.selectAll()
		.select(eb => [
			jsonObjectFrom(
				eb.selectFrom('players')
				.select('name')
				.whereRef('tracks.playerId', '=', 'players.id')
			).as('author')
		])
		.where('id', '=', id)
		.executeTakeFirstOrThrow();

	return {
		...result,
		tileCoords: JSON.parse(result.tileCoords),
		customTiles: {},
		author: result.author!.name
	};
}

async function deleteTrack(playerId: Player['id'], id: Track['id'], trx: OptionalTrx = null): Promise<void>
{
	const client = trx ?? kysely;
	await client
		.deleteFrom('tracks')
		.where('id', '=', id)
		.where('playerId', '=', playerId)
		.executeTakeFirstOrThrow();
}

async function incrementTrackPlays(id: Track['id'], amount: number = 1, trx: OptionalTrx = null): Promise<void>
{
	const client = trx ?? kysely;
	await client
		.updateTable('tracks')
		.where('id', '=', id)
		.set(eb => ({
			plays: eb('plays', '+', amount)
		}))
		.execute();
	
	ClientDataManager.notifyTrackPlaysIncremented(id, amount);
}

async function trackExists(id: Track['id']): Promise<boolean>
{
	const result = await kysely
		.selectFrom('tracks')
		.where('id', '=', id)
		.select('id')
		.limit(1)
		.executeTakeFirst();

	return result !== undefined;
}

async function getLatestTracks(count: number): Promise<TrackInfo[]>
{
	const result = await kysely
		.selectFrom('tracks')
		.select([
			'id',
			'createdAt',
			'name',
			'plays'
		])
		.select(eb => [
			jsonObjectFrom(
				eb.selectFrom('players')
				.select('name')
				.whereRef('tracks.playerId', '=', 'players.id')
			).as('author')
		])
		.orderBy('id', 'desc')
		.limit(count)
		.execute();
	
	const tracksInfo: TrackInfo[] = result.map(raw => ({
		id: raw.id,
		name: raw.name,
		createdAt: raw.createdAt,
		plays: raw.plays,
		author: raw.author!.name
	}));

	return tracksInfo;
}



// Other utility methods

function transaction<T>(fn: (trx: Transaction<Schema.DB>) => Promise<T>, trx: OptionalTrx = null): Promise<T> {
	return trx ? fn(trx) : kysely.transaction().execute(fn);
}


export const Database = {
	kysely,
	AuthMethod,
	PlayerRoles,
	
	getTicket,
	getTicketForPlayerId,
	createTicket,
	deleteTicket,
	
	getFullPlayer,
	getPlayerProfile,
	createPlayer,
	deletePlayer,
	updatePlayerLastSeen,
	
	getAuthMethod,
	createAuthMethod,

	getTiles,

	createTrack,
	updateTrack,
	getTrack,
	deleteTrack,
	incrementTrackPlays,
	trackExists,
	getLatestTracks,

	transaction,
};
