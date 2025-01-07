import { uuidv7 } from 'uuidv7';
import { Database } from '../database/database.js';
import { TokenHelper } from '../helpers/token-helper.js';
import { Request, Response } from 'express';
import { AuthState, Oauth } from '../middlewares/oauth.js';
import { TicketName } from '../middlewares/ticket-parser.js';
import * as oauth from 'oauth4webapi';
import { Player } from '../models/player.js';
import { env } from '../helpers/env.js';


interface DiscordAccountInfo {
	id: string;                  // '000000000000000000'
	username: string;            // 'ctraul'
	avatar: string;              // 'e8694ce525e0a0c2a9e9d6e9243bb2b8'
	discriminator: string;
	public_flags: number;
	flags: number;
	banner: any;
	accent_color: number;        // Idk if this is hex code or what, mine was 262173
	global_name: string;         // 'Raul'
	avatar_decoration_data: any;
	banner_color: string;        // '#000000';
	clan: any;
	primary_guild: any;
	mfa_enabled: boolean;
	locale: string;              // 'en-US'
	premium_type: number;
	email: string;
	verified: boolean;
}


async function getDiscordAccountInfo(accessToken: string): Promise<DiscordAccountInfo>
{
	const response = await fetch('https://discord.com/api/users/@me', {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok)
		throw new Error('Failed to fetch Discord user info');

	const accountInfo = await response.json() as DiscordAccountInfo;

	return accountInfo; 
}

async function getOrCreatePlayerIdForDiscord(accountInfo: DiscordAccountInfo): Promise<Player['id']>
{
	const auth = await Database.getAuthWithDiscord(accountInfo.id);

	if (auth != undefined)
		return auth.playerId;

	const playerId = uuidv7();

	// Create full player
	await Database.transaction(async trx =>
	{
		// Insert player
		const player = await Database.createPlayer({
			id: playerId,
			name: accountInfo.global_name,
			email: accountInfo.email,
		}, trx);

		// Insert auth method
		await Database.createAuthWithDiscord({
			id: accountInfo.id,
			playerId: player.id,
		}, trx);

		return player.id;
	});

	return playerId;
}

async function onTokensReceived(_req: Request, res: Response, state: AuthState, tokens: oauth.TokenEndpointResponse)
{
	const accountInfo = await getDiscordAccountInfo(tokens.access_token);
	const playerId = await getOrCreatePlayerIdForDiscord(accountInfo);
	const ticket = await Database.createTicket({
		id: TokenHelper.generateSessionToken(),
		playerId: playerId,
	});

	res.redirect(`http://localhost:${state.clientPort}/?${TicketName}=${ticket.id}`);
}

export const middleware = Oauth({
	route: '/auth/discord',
	clientId: env('DISCORD_CLIENT_ID'),
	clientSecret: env('DISCORD_CLIENT_SECRET'),
	issuer: 'https://discord.com',
	codeChallengeMethod: 'S256',
	scope: 'identify email',
	onTokensReceived,
});
