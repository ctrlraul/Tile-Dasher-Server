import { Tile } from './tile.js';

export interface Track {
	id: string;
	createdAt: Date;
	name: string;
	plays: number;
	customTiles: Record<string, Tile>;
	tileCoords: Record<string, number[]>;
	author: string;
}
