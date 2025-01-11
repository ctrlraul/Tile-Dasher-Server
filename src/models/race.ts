import { PlayerProfile } from "./player-profile.js";
import { Track } from "./track.js";

export interface Race {
	id: string;
	startTime: number;
	players: PlayerProfile[];
	track: Track;
	type: string;
}