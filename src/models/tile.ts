import { $array, $boolean, $literal, $number, $object, $objectStrict, $string, CheckerType } from '../helpers/purity.js';

export const $tile = $object({
	id: $number,
	name: $string,
	atlasX: $number,
	atlasY: $number,
	matter: $number,
	safe: $boolean,
	friction: $number,
	listed: $boolean,
	effects: $array($objectStrict({
		trigger: $literal('Init', 'Any', 'Bump', 'Stand', 'PushLeft', 'PushRight'),
		effect: $string,
	})),
});

export type Tile = CheckerType<typeof $tile>;
