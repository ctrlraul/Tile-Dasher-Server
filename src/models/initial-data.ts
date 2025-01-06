import type { Player } from './player.js';
import { Tile } from './tile.js';

export interface InitialData
{
	tiles: Tile[];
	player: Player;
}