import { Router, Status } from '@oak/oak';
import { ticketParserMiddleware } from '../middlewares/ticket-parser.ts';
import { authenticatedMiddleware } from '../middlewares/is-authenticated.ts';
import { Track } from '../models/track.ts';
import { Database } from '../database/database.ts';
import { $array, $number, $object, $record, $string } from '@purity/purity';


const $trackCreateCheck = $object({
	name: $string,
	tileCoords: $record($array($number)),
});

const $trackUpdateCheck = $object({
	id: $string,
	name: $string,
	tileCoords: $record($array($number)),
});


const router = new Router<ContextState>();

router.use(ticketParserMiddleware);
router.use(authenticatedMiddleware);


router.post('/player/update', ctx =>
{
	ctx.response.status = 200;
});

router.post('/track/create', async ctx =>
{
	const upload = $trackCreateCheck.assert(await ctx.request.body.json());
	const track = await Database.createTrack({
		name: upload.name,
		playerId: ctx.state.ticket!.playerId,
		tileCoords: upload.tileCoords
	});

	ctx.response.body = JSON.stringify(track);
});

router.post('/track/update', async ctx =>
{
	const upload = $trackUpdateCheck.assert(await ctx.request.body.json());
	const track = await Database.updateTrack({
		id: upload.id,
		name: upload.name,
		playerId: ctx.state.ticket!.playerId,
		tileCoords: upload.tileCoords
	});

	ctx.response.body = JSON.stringify(track);
});

router.get('/track', async ctx =>
{
	const id = ctx.request.url.searchParams.get('id');

	if (id === null)
	{
		ctx.response.status = Status.BadRequest;
		ctx.response.body = 'id is required';
		return;
	}

	const track: Track = await Database.getTrack(id);

	ctx.response.body = JSON.stringify(track);
});

router.get('/track/play', async ctx =>
{
	const id = ctx.request.url.searchParams.get('id');

	if (id === null)
	{
		ctx.response.status = Status.BadRequest;
		ctx.response.body = 'id is required';
		return;
	}

	const track: Track = await Database.getTrack(id);

	Database.incrementTrackPlays(id)
		.catch(error => console.log('Error incrementing track plays:', error));

	ctx.response.body = JSON.stringify(track);
});


export {
	router as generalRouter,
}