import { Database } from '../database/database.js';
import { TicketName, ticketParserMiddleware } from '../middlewares/ticket-parser.js';
import { TokenHelper } from '../helpers/token-helper.js';
// import { EventSender } from '../event-sender.js';
import type { Player } from '../models/player.js';
import * as oauth from 'oauth4webapi'
import { uuidv7 } from 'uuidv7';
import { env } from '../helpers/env.js';
import { Router, Request, Response } from 'express';
import { getRequestIp, getRequestUrl } from '../helpers/request.js';
import { readFileSync } from 'fs';


interface AuthState {
	date: number;
	ip: string;
	ua: string;
	codeVerifier: string;
	clientPort: string;
}

interface GoogleAccountInfo
{
	sub: string;         // '000000000000000000000' (Account id)
	name: string;        // 'Raul Ctrl'
	given_name: string;  // 'Raul'
	family_name: string; // 'Ctrl',
	picture: string;
	email: string;
	email_verified: boolean;
}


// Oauth is simple
const client: oauth.Client = { client_id: env('GOOGLE_CLIENT_ID') };
const clientAuth = oauth.ClientSecretPost(env('GOOGLE_CLIENT_SECRET'));
const code_challenge_method = 'S256';
const AuthStateLifespan = 60 * 5 * 1000; // 5 minutes
const issuer = new URL(env('GOOGLE_CLIENT_DISCOVERY_URL'));
let authServer: oauth.AuthorizationServer;

// Ass
(async () => {
	authServer = await oauth
		.discoveryRequest(issuer, { algorithm: 'oidc' })
		.then(response => oauth.processDiscoveryResponse(issuer, response));
})();

const allowImpersonation = env('ALLOW_INSECURE_IMPERSONATION', '0') === '1';

export const authRouter = Router();

authRouter.get('/auth/google', async (req: Request, res: Response) =>
{
	const codeVerifier = oauth.generateRandomCodeVerifier();
	const code_challenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
	const clientPort = String(req.query['port']);

	if (clientPort == null)
		throw new Error('Expected client to provide local server port');

	const authState: AuthState = {
		date: Date.now(),
		ip: getRequestIp(req),
		ua: req.header('User-Agent') || '',
		codeVerifier,
		clientPort,
	};
	const state = TokenHelper.createSecretToken<AuthState>(authState);
	
	const requestUrl = getRequestUrl(req);
	const url = new URL(authServer.authorization_endpoint!);
	const params = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: requestUrl.origin + '/auth/google/callback',
		response_type: 'code',
		scope: 'openid email profile',
		code_challenge,
		code_challenge_method,
		state
	});

	url.search = params.toString();

	res.redirect(url.toString());
});

authRouter.get('/auth/google/callback', async (req: Request, res: Response) =>
{
	const state = String(req.query['state']);

	if (state == undefined)
		throw new Error('Auth state missing');

	const stateData = TokenHelper.readSecretToken<AuthState>(state);

	if (Date.now() - stateData.date > AuthStateLifespan)
		throw new Error('Auth state expired');

	if (stateData.ip !== getRequestIp(req))
		throw new Error('IP mismatch');
	
	if (stateData.ua !== (req.header('User-Agent') || ''))
		throw new Error('User Agent mismatch');

	const url = new URL(getRequestUrl(req));
	const validateParams = oauth.validateAuthResponse(authServer, client, url, state);
	const redirect_uri = url.origin + '/auth/google/callback';
	const response = await oauth.authorizationCodeGrantRequest(
		authServer,
		client,
		clientAuth,
		validateParams,
		redirect_uri,
		stateData.codeVerifier,
	);

	const result = await oauth.processAuthorizationCodeResponse(authServer, client, response);
	const accountInfo = await getGoogleAccountInfo(result.access_token);
	const playerId = await getOrCreatePlayerIdForGoogle(accountInfo);
	const ticket = await Database.createTicket({
		id: TokenHelper.generateSessionToken(),
		playerId: playerId
	});

	res.redirect(`http://localhost:${stateData.clientPort}/?${TicketName}=${ticket.id}`);

	console.log('Google login:', playerId);
});

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
	if (!allowImpersonation)
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
