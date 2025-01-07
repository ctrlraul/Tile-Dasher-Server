import { Player } from './player.js';

export interface PlayerProfile {
	id: Player['id'];
	name: Player['name'];
	level: Player['level'];
	lastSeen: Player['lastSeen'];
}