import { Tile } from './tile.ts';

export interface Track {
	id: string;
	createdAt: Date;
	name: string;
	plays: number;
	customTiles: Record<string, Tile>;
	tileCoords: Record<string, number[]>;
}
