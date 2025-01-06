import { Selectable } from 'kysely';
import { Tickets } from '../database/schema.js';

declare global {
	namespace Express {
		interface Request {
			ticket?: Selectable<Tickets>;
		}
	}
}