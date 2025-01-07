import { Player } from './player.js';
import { Track } from './track.js';

export interface RaceQueueLeave {
	trackId: Track['id'];
	playerId: Player['id'];
}