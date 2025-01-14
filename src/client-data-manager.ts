import type { ClientData } from './models/client-data.js';
import type { Player } from './models/player.js';
import { Database } from './database/database.js';
import { Tile } from './models/tile.js';
import { Track } from './models/track.js';
import { TrackInfo } from './models/track-info.js';
import { RacesQueuer } from './races-queuer.js';


const LatestTracksLimit = 12;
const latestTracks: TrackInfo[] = [];
const tiles: Tile[] = [];

let loadPromise: Promise<void> | null = null;


async function createForPlayer(player: Player): Promise<ClientData>
{
	loadPromise ??= load();
	await loadPromise;

	return {
		tiles,
		player,
		latestTracks,
		racesQueue: RacesQueuer.queue,
	};
}

async function load()
{
	latestTracks.push(...await Database.getLatestTracks(LatestTracksLimit));
	tiles.push(...await Database.getTiles());
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
	const index = latestTracks.findIndex(track => track.id == trackId);

	if (index != -1)
		latestTracks.splice(index, 1);
}

function notifyTrackPlaysIncremented(trackId: string, amount: number)
{
	for (const track of latestTracks)
	{
		if (track.id === trackId)
			track.plays += amount;
	}
}


export const ClientDataManager = {
	createForPlayer,
	notifyTrackPublished,
	notifyTrackDeleted,
	notifyTrackPlaysIncremented,
};