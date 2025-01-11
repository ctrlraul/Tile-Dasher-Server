import { Player } from "./player.js";

export interface RaceCharacterFinish {
	playerId: Player['id'];
	time: number;
}