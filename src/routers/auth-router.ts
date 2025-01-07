import { Database } from '../database/database.js';
import { TicketName, ticketParserMiddleware } from '../middlewares/ticket-parser.js';
import { TokenHelper } from '../helpers/token-helper.js';
import type { Player } from '../models/player.js';
import * as oauth from 'oauth4webapi'
import { uuidv7 } from 'uuidv7';
import { env } from '../helpers/env.js';
import { Router, Request, Response } from 'express';
import { getRequestIp, getRequestUrl } from '../helpers/request.js';
import { readFileSync } from 'fs';
import { Oauth } from '../middlewares/oauth.js';


interface AuthState {
	date: number;
	ip: string;
	ua: string;
	codeVerifier: string;
	clientPort: string;
}

const AllowImpersonation = env('ALLOW_INSECURE_IMPERSONATION', '0') === '1';
const AuthStateLifespan = 60 * 5 * 1000; // 5 minutes

export const authRouter = Router();


// Google Auth


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

// const google_client: oauth.Client = { client_id: env('GOOGLE_CLIENT_ID') };
// const google_clientAuth = oauth.ClientSecretPost(env('GOOGLE_CLIENT_SECRET'));
// const google_code_challenge_method = 'S256';
// const google_issuer = new URL(env('GOOGLE_CLIENT_DISCOVERY_URL'));
// const google_authServer = await oauth
// 	.discoveryRequest(google_issuer, { algorithm: 'oidc' })
// 	.then(response => oauth.processDiscoveryResponse(google_issuer, response));

// authRouter.get('/auth/google', async (req: Request, res: Response) =>
// {
// 	const codeVerifier = oauth.generateRandomCodeVerifier();
// 	const code_challenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
// 	const clientPort = String(req.query['port']);

// 	if (clientPort == null)
// 		throw new Error('Expected client to provide local server port');

// 	const authState: AuthState = {
// 		date: Date.now(),
// 		ip: getRequestIp(req),
// 		ua: req.header('User-Agent') || '',
// 		codeVerifier,
// 		clientPort,
// 	};
// 	const state = TokenHelper.createSecretToken<AuthState>(authState);
	
// 	const requestUrl = getRequestUrl(req);
// 	const url = new URL(google_authServer.authorization_endpoint!);
// 	const params = new URLSearchParams({
// 		client_id: google_client.client_id,
// 		redirect_uri: requestUrl.origin + '/auth/google/callback',
// 		response_type: 'code',
// 		scope: 'openid email profile',
// 		code_challenge,
// 		code_challenge_method: google_code_challenge_method,
// 		state
// 	});

// 	url.search = params.toString();

// 	res.redirect(url.toString());
// });

// authRouter.get('/auth/google/callback', async (req: Request, res: Response) =>
// {
// 	const state = String(req.query['state']);

// 	if (state == undefined)
// 		throw new Error('Auth state missing');

// 	const stateData = TokenHelper.readSecretToken<AuthState>(state);

// 	if (Date.now() - stateData.date > AuthStateLifespan)
// 		throw new Error('Auth state expired');

// 	if (stateData.ip !== getRequestIp(req))
// 		throw new Error('IP mismatch');
	
// 	if (stateData.ua !== (req.header('User-Agent') || ''))
// 		throw new Error('User Agent mismatch');

// 	const url = new URL(getRequestUrl(req));
// 	const validateParams = oauth.validateAuthResponse(google_authServer, google_client, url, state);
// 	const redirect_uri = url.origin + '/auth/google/callback';
// 	const response = await oauth.authorizationCodeGrantRequest(
// 		google_authServer,
// 		google_client,
// 		google_clientAuth,
// 		validateParams,
// 		redirect_uri,
// 		stateData.codeVerifier,
// 	);

// 	const result = await oauth.processAuthorizationCodeResponse(google_authServer, google_client, response);
// 	const accountInfo = await getGoogleAccountInfo(result.access_token);
// 	const playerId = await getOrCreatePlayerIdForGoogle(accountInfo);
// 	const ticket = await Database.createTicket({
// 		id: TokenHelper.generateSessionToken(),
// 		playerId: playerId
// 	});

// 	res.redirect(`http://localhost:${stateData.clientPort}/?${TicketName}=${ticket.id}`);

// 	console.log('Google login:', playerId);
// });

authRouter.use(
	Oauth({
		route: '/auth/google',
		clientId: env('GOOGLE_CLIENT_ID'),
		clientSecret: env('GOOGLE_CLIENT_SECRET'),
		issuer: 'https://accounts.google.com',
		codeChallengeMethod: 'S256',
		scope: 'openid email profile',
		async onTokensReceived(_req, res, state, tokens)
		{
			const accountInfo = await getGoogleAccountInfo(tokens.access_token);
			const playerId = await getOrCreatePlayerIdForGoogle(accountInfo);
			const ticket = await Database.createTicket({
				id: TokenHelper.generateSessionToken(),
				playerId: playerId,
			});
		
			res.redirect(`http://localhost:${state.clientPort}/?${TicketName}=${ticket.id}`);
		
			console.log('Google login:', playerId);
		}
	})
);

async function getGoogleAccountInfo(accessToken: string): Promise<GoogleAccountInfo>
{
	const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${accessToken}`,
		},
	});

	if (!response.ok)
		throw new Error('Failed to fetch user info');

	return await response.json() as GoogleAccountInfo;
}

async function getOrCreatePlayerIdForGoogle(accountInfo: GoogleAccountInfo): Promise<Player['id']>
{
	const auth = await Database.getAuthWithGoogle(accountInfo.sub);

	if (auth != undefined)
		return auth.playerId;

	const playerId = uuidv7();

	// Create full player
	await Database.transaction(async trx =>
	{
		// Insert player
		const player = await Database.createPlayer({
			id: playerId,
			name: 'Newbie',
			email: accountInfo.email,
		}, trx);

		// Insert auth method
		await Database.createAuthWithGoogle({
			id: accountInfo.sub,
			playerId: player.id,
		}, trx);

		return player.id;
	});

	return playerId;
}


// End of Google auth


// Discord auth


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

authRouter.use(
	Oauth({
		route: '/auth/discord',
		clientId: env('DISCORD_CLIENT_ID'),
		clientSecret: env('DISCORD_CLIENT_SECRET'),
		issuer: 'https://discord.com',
		codeChallengeMethod: 'S256',
		scope: 'identify email',
		async onTokensReceived(_req, res, state, tokens)
		{
			console.log({ tokens });

			const accountInfo = await getDiscordAccountInfo(tokens.access_token);
			const playerId = await getOrCreatePlayerIdForDiscord(accountInfo);
			const ticket = await Database.createTicket({
				id: TokenHelper.generateSessionToken(),
				playerId: playerId,
			});
		
			res.redirect(`http://localhost:${state.clientPort}/?${TicketName}=${ticket.id}`);
		
			console.log('Discord login:', playerId);
		}
	})
);

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

async function getOrCreatePlayerIdForDiscord(accountInfo: DiscordAccountInfo): Promise<string>
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


// End of Discord auth



authRouter.get('/auth/success', async (req: Request, res: Response) =>
{
	const html = readFileSync('static/auth-success.html', 'utf-8');
	res.setHeader('Content-Type', 'text/html');
	res.send(html);
});

authRouter.get('/auth/clear', async (req: Request, res: Response) =>
{
	const ticketId = String(req.headers[TicketName]);
	const ticket = await Database.getTicket(ticketId);

	// EventSender.disconnect(ticket!.playerId); TODO

	await Database.deleteTicket(ticketId);
});

authRouter.get('/auth/state', ticketParserMiddleware, (req: Request, res: Response) =>
{
	res.send(req.ticket ? '1' : '0');
});

authRouter.post('/auth/impersonate', async (req: Request, res: Response) =>
{
	if (!AllowImpersonation)
	{
		res.status(401).send('Nuh uh');
		return;
	}

	const playerId = String(req.body);
	const ticket = await Database.getTicketForPlayerId(playerId) ?? await Database.createTicket({
		id: TokenHelper.generateSessionToken(),
		playerId: playerId,
	});

	res.json(ticket.id);
});
