import { Database } from '../database/database.js';
import { Request, Response } from 'express';
import { AuthState, Oauth } from '../middlewares/oauth.js';
import { TicketName } from '../middlewares/ticket-parser.js';
import * as oauth from 'oauth4webapi';
import { env } from '../helpers/env.js';
import { AuthManager, RegisterInfo } from './auth-manager.js';


interface GoogleAccountInfo
{
	sub: string;         // '000000000000000000000' (Account id)
	name: string;        // 'Raul Ctrl'
	given_name: string;  // 'Raul'
	family_name: string; // 'Ctrl'
	picture: string;
	email: string;
	email_verified: boolean;
}


async function getRegisterInfoForGoogleAccount(accessToken: string): Promise<RegisterInfo>
{
	const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${accessToken}`,
		},
	});

	if (!response.ok)
		throw new Error('Failed to fetch user info');

	const accountInfo = await response.json() as GoogleAccountInfo;

	// Chances are the account uses their real name, so use a random name instead.
	return {
		id: accountInfo.sub,
		name: AuthManager.generateRandomName(),
		// name: accountInfo.given_name,
		email: accountInfo.email
	};
}

async function onTokensReceived(_req: Request, res: Response, state: AuthState, tokens: oauth.TokenEndpointResponse)
{
	const registerInfo = await getRegisterInfoForGoogleAccount(tokens.access_token);
	const playerId = await AuthManager.findOrRegisterPlayer(Database.AuthMethod.Google, registerInfo);
	const ticket = await Database.createTicket(playerId);
	res.redirect(`http://localhost:${state.clientPort}/?${TicketName}=${ticket.id}`);
}


export const googleAuth = Oauth({
	clientId: env('GOOGLE_CLIENT_ID'),
	clientSecret: env('GOOGLE_CLIENT_SECRET'),
	issuer: 'https://accounts.google.com',
	codeChallengeMethod: 'S256',
	scope: 'openid email profile',
	onTokensReceived,
});