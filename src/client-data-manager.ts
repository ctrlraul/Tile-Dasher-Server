import type { ClientData } from './models/client-data.js';
import type { Player } from './models/player.js';
import { Database } from './database/database.js';
import { Tile } from './models/tile.js';
import { Track } from './models/track.js';
import { TrackInfo } from './models/track-info.js';
import { RacesQueuer } from './races-queuer.js';


const latestTracks: TrackInfo[] = await Database.getLatestTracks(12);
const tiles: Tile[] = [];


async function createForPlayer(player: Player): Promise<ClientData>
{
	if (tiles.length === 0)
		tiles.push(...await Database.getTiles());

	return {
		tiles,
		player,
		latestTracks,
		racesQueue: RacesQueuer.queue,
	};
}

function notifyTrackPublished(track: Track)
{
	const index = latestTracks.findIndex(trackB => trackB.id == track.id);

	if (index != -1)
		latestTracks.splice(index, 1);
	else
		latestTracks.pop();

	latestTracks.unshift(track);
}

function notifyTrackDeleted(trackId: string)
{

}


export const ClientDataManager = {
	createForPlayer,
	notifyTrackPublished,
	notifyTrackDeleted,
};