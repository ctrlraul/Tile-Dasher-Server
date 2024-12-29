import type { InitialData } from './models/initial-data.ts';
import type { Player } from './models/player.ts';
import { Database } from './database/database.ts';
import { Tile } from './models/tile.ts';

let tiles: Tile[];

export async function createInitialData(player: Player): Promise<InitialData>
{
	tiles ??= await Database.getTiles();

	return {
		tiles,
		player,
	};
}