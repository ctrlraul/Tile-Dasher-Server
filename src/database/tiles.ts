import { Matter } from '../enums/matter.js';
import { Tile } from '../models/tile.js';

export const tiles: Tile[] = [{
	id: 0,
	name: 'Air',
	atlasX: 0,
	atlasY: 0,
	matter: Matter.Air,
	safe: false,
	friction: 1,
	listed: true,
	effects: [],
}, {
	id: 1,
	name: 'Stone',
	atlasX: 1,
	atlasY: 0,
	matter: Matter.Stone,
	safe: true,
	friction: 1,
	listed: true,
	effects: [],
}, {
	id: 2,
	name: 'Bad Stone',
	atlasX: 2,
	atlasY: 0,
	matter: Matter.Stone,
	safe: false,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Bump', effect: 'break' }
	],
}, {
	id: 3,
	name: 'Spawn',
	atlasX: 3,
	atlasY: 0,
	matter: Matter.Air,
	safe: false,
	friction: 1,
	listed: true,
	effects: [],
}, {
	id: 4,
	name: 'Vanish',
	atlasX: 4,
	atlasY: 0,
	matter: Matter.Stone,
	safe: false,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'vanish' }
	],
}, {
	id: 5,
	name: 'Finish',
	atlasX: 5,
	atlasY: 0,
	matter: Matter.Stone,
	safe: true,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Bump', effect: 'finish' }
	],
}, {
	id: 6,
	name: 'Ice',
	atlasX: 0,
	atlasY: 1,
	matter: Matter.Stone,
	safe: true,
	friction: 0.1,
	listed: true,
	effects: [],
}, {
	id: 7,
	name: 'Chocolate',
	atlasX: 1,
	atlasY: 1,
	matter: Matter.Stone,
	safe: true,
	friction: 3,
	listed: true,
	effects: [],
}, {
	id: 8,
	name: 'Left',
	atlasX: 2,
	atlasY: 1,
	matter: Matter.Stone,
	safe: true,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'boost_left' }
	],
}, {
	id: 9,
	name: 'Right',
	atlasX: 3,
	atlasY: 1,
	matter: Matter.Stone,
	safe: true,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'boost_right' }
	],
}, {
	id: 10,
	name: 'Up',
	atlasX: 4,
	atlasY: 1,
	matter: Matter.Stone,
	safe: true,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'boost_up' }
	],
}, {
	id: 11,
	name: 'Down',
	atlasX: 5,
	atlasY: 1,
	matter: Matter.Stone,
	safe: true,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'boost_down' }
	],
}, {
	id: 12,
	name: 'Teleport',
	atlasX: 0,
	atlasY: 2,
	matter: Matter.Stone,
	safe: false,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'teleport' }
	],
}, {
	id: 13,
	name: 'Crumble',
	atlasX: 1,
	atlasY: 2,
	matter: Matter.Stone,
	safe: false,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'crumble' }
	],
}, {
	id: 14,
	name: 'Push',
	atlasX: 2,
	atlasY: 2,
	matter: Matter.Stone,
	safe: false,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'push' }
	],
}, {
	id: 15,
	name: 'Net',
	atlasX: 3,
	atlasY: 2,
	matter: Matter.Stone,
	safe: false,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'respawn' }
	],
}, {
	id: 16,
	name: 'Mine',
	atlasX: 4,
	atlasY: 2,
	matter: Matter.Stone,
	safe: false,
	friction: 1,
	listed: true,
	effects: [
		{ trigger: 'Any', effect: 'break' },
		{ trigger: 'Any', effect: 'launch' },
		{ trigger: 'Any', effect: 'stun' },
	],
}, {
	id: 17,
	name: 'Move',
	atlasX: 5,
	atlasY: 2,
	matter: Matter.Stone,
	safe: false,
	friction: 2,
	listed: true,
	effects: [
		{ trigger: 'Init', effect: 'wander' }
	],
}];