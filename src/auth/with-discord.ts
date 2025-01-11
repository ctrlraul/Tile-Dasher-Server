import { Database } from '../database/database.js';
import { Request, Response } from 'express';
import { AuthState, Oauth } from '../middlewares/oauth.js';
import { TicketName } from '../middlewares/ticket-parser.js';
import * as oauth from 'oauth4webapi';
import { env } from '../helpers/env.js';
import { AuthManager, RegisterInfo } from './auth-manager.js';


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


async function getRegisterInfoForDiscordAccount(accessToken: string): Promise<RegisterInfo>
{
	const response = await fetch('https://discord.com/api/users/@me', {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok)
		throw new Error('Failed to fetch Discord user info');

	const accountInfo = await response.json() as DiscordAccountInfo;

	return {
		id: accountInfo.id,
		name: accountInfo.global_name,
		email: accountInfo.email,
	}; 
}

async function onTokensReceived(_req: Request, res: Response, state: AuthState, tokens: oauth.TokenEndpointResponse)
{
	const registerInfo = await getRegisterInfoForDiscordAccount(tokens.access_token);
	const playerId = await AuthManager.findOrRegisterPlayer(Database.AuthMethod.Discord, registerInfo);
	const ticket = await Database.createTicket(playerId);
	res.redirect(`http://localhost:${state.clientPort}/?${TicketName}=${ticket.id}`);
}


export const discordAuth = Oauth({
	clientId: env('DISCORD_CLIENT_ID'),
	clientSecret: env('DISCORD_CLIENT_SECRET'),
	issuer: 'https://discord.com',
	codeChallengeMethod: 'S256',
	scope: 'identify email',
	onTokensReceived,
});
