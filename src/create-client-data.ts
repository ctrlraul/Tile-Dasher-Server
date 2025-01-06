import type { InitialData } from './models/initial-data.js';
import type { Player } from './models/player.js';
import { Database } from './database/database.js';
import { Tile } from './models/tile.js';

let tiles: Tile[];

export async function createClientData(player: Player): Promise<InitialData>
{
	tiles ??= await Database.getTiles();

	return {
		tiles,
		player,
	};
}