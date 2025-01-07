import { PlayerProfile } from './player-profile.js';
import { Track } from './track.js';

export interface RaceQueueEnter {
	trackId: Track['id'];
	player: PlayerProfile;
}