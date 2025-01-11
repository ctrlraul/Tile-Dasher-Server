import { Player } from './player.js';

export interface RaceCharacterUpdate {
	id: Player['id'];

	x: number;
	y: number;
	vx: number;
	vy: number;

	ih: number;
	iv: number;
}