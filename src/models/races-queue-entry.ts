import { PlayerProfile } from './player-profile.js';
import { Player } from './player.js';
import { Track } from './track.js';

export interface RacesQueueEntry {
	trackId: Track['id'];
	players: Record<Player['id'], PlayerProfile>;
	playersReady: Player['id'][];
}