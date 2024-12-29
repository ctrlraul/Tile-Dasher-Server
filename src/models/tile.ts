import { $array, $boolean, $number, $object, $record, $string, CheckerType } from '@purity/purity';

export const $tile = $object({
	id: $number,
	name: $string,
	atlasX: $number,
	atlasY: $number,
	matter: $number,
	safe: $boolean,
	effects: $record($array($string)),
});

export type Tile = CheckerType<typeof $tile>;
