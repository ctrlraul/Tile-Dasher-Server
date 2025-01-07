import { PlayerProfile } from "./player-profile.js";
import { Track } from "./track.js";

export interface Race {
	startTime: Date;
	players: PlayerProfile[];
	track: Track;
}