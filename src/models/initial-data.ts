import type { Player } from './player.ts';
import { Tile } from './tile.ts';

export interface InitialData
{
	tiles: Tile[];
	player: Player;
}