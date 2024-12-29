import type { Selectable } from 'kysely';
import type { Tickets } from './database/schema.ts';

declare global
{
	interface ContextState
	{
		ticket?: Selectable<Tickets>;
	}
}
