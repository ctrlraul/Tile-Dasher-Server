import { Player } from './player.js';
import { Track } from './track.js';

export interface RaceQueueReady {
	trackId: Track['id'];
	playerId: Player['id'];
}