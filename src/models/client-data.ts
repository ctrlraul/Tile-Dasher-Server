import type { Player } from './player.js';
import { RacesQueueEntry } from './races-queue-entry.js';
import { Tile } from './tile.js';
import { TrackInfo } from './track-info.js';
import { Track } from './track.js';

export interface ClientData
{
	tiles: Tile[];
	player: Player;
	latestTracks: TrackInfo[];
	racesQueue: Record<Track['id'], RacesQueueEntry>;
}