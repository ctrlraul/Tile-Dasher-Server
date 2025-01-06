import { Router, Request, Response } from 'express';
import { ticketParserMiddleware } from '../middlewares/ticket-parser.js';
import { authenticatedMiddleware } from '../middlewares/is-authenticated.js';
import { Track } from '../models/track.js';
import { Database } from '../database/database.js';
import { $array, $number, $object, $record, $string } from '../helpers/purity.js';


const $trackCreateCheck = $object({
	name: $string,
	tileCoords: $record($array($number)),
});

const $trackUpdateCheck = $object({
	id: $string,
	name: $string,
	tileCoords: $record($array($number)),
});


const router = Router();

router.use(ticketParserMiddleware);
router.use(authenticatedMiddleware);


router.post('/track', async (req: Request, res: Response) => {
	
	const upload = $trackCreateCheck.assert(req.body);

	const track = await Database.createTrack({
		name: upload.name,
		playerId: req.ticket!.playerId,
		tileCoords: upload.tileCoords
	});

	res.json(track);
});


router.put('/track', async (req: Request, res: Response) =>
{
	const upload = $trackUpdateCheck.assert(req.body);
	const track = await Database.updateTrack({
		id: upload.id,
		name: upload.name,
		playerId: req.ticket!.playerId,
		tileCoords: upload.tileCoords
	});

	res.json(track);
});

router.get('/track', async (req: Request, res: Response) =>
{
	const id = String(req.query['id']);

	if (id === null)
	{
		res.status(401).send('id is required');
		return;
	}

	const track: Track = await Database.getTrack(id);

	res.json(track);
});

router.delete('/track', async (req: Request, res: Response) =>
{
	const id = String(req.query['id']);

	if (id === null)
	{
		res.status(401).send('id is required');
		return;
	}

	await Database.deleteTrack(req.ticket!.playerId, id);

	res.send();
});

router.get('/track/play', async (req: Request, res: Response) =>
{
	const id = String(req.query['id']);

	if (id === null)
	{
		res.status(401).send('id is required');
		return;
	}

	const track: Track = await Database.getTrack(id);

	Database.incrementTrackPlays(id)
		.catch((error: unknown) => console.log('Error incrementing track plays:', error));

	res.json(track);
});


export {
	router as generalRouter,
}