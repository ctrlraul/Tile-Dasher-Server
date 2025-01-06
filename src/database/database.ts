import pg from 'pg';
import * as Schema from './schema.js';
import { Kysely, PostgresDialect, Insertable, Transaction, Selectable, CamelCasePlugin } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { Player } from '../models/player.js';
import { Tile } from '../models/tile.js';
import { Track } from '../models/track.js';
import { uuidv7 } from 'uuidv7';
import { env } from '../helpers/env.js';
import { tiles } from './tiles.js';


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

async function createTicket(data: Insertable<Schema.Tickets>)
{
	console.log(data);

	const ticket = await kysely
		.insertInto('tickets')
		.values(data)
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
		trackInfos: result.tracks,
	};
	
	return player;
}

async function createPlayer(data: Insertable<Schema.Players>, trx: OptionalTrx = null)
{
	const client = trx ?? kysely;
	return await client
		.insertInto('players')
		.values(data)
		.returningAll()
		.executeTakeFirstOrThrow();
}



// Auths with Google

async function getAuthWithGoogle(id: string)
{
	return await kysely
		.selectFrom('authWithGoogle')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();
}

async function createAuthWithGoogle(data: Insertable<Schema.AuthWithGoogle>, trx: OptionalTrx = null): Promise<void>
{
	const client = trx ?? kysely;
	await client
		.insertInto('authWithGoogle')
		.values(data)
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
	
	return {
		...result,
		tileCoords: JSON.parse(result.tileCoords),
		customTiles: {}
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

	return {
		...result,
		tileCoords: JSON.parse(result.tileCoords),
		customTiles: {}
	};
}

async function getTrack(id: Track['id'], trx: OptionalTrx = null): Promise<Track>
{
	const client = trx ?? kysely;
	const result = await client
		.selectFrom('tracks')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirstOrThrow();

	return {
		...result,
		tileCoords: JSON.parse(result.tileCoords),
		customTiles: {}
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
}



// Other utility methods

function transaction<T>(fn: (trx: Transaction<Schema.DB>) => Promise<T>, trx: OptionalTrx = null): Promise<T> {
	return trx ? fn(trx) : kysely.transaction().execute(fn);
}


export const Database = {
	kysely,
	
	getTicket,
	getTicketForPlayerId,
	createTicket,
	deleteTicket,
	
	getFullPlayer,
	createPlayer,
	
	getAuthWithGoogle,
	createAuthWithGoogle,

	getTiles,

	createTrack,
	updateTrack,
	getTrack,
	deleteTrack,
	incrementTrackPlays,

	transaction,
};
