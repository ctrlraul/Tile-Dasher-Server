import { Router } from '@oak/oak';
import { Database } from '../database/database.ts';
import { TICKET_HEADER_NAME, ticketParserMiddleware } from '../middlewares/ticket-parser.ts';
import { TokenHelper } from '../helpers/token-helper.ts';
import { env } from '@raul/env';
import { EventSender } from '../event-sender.ts';
import type { Player } from '../models/player.ts';
import * as oauth from 'oauth4webapi'
import { uuidv7 } from 'uuidv7';


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
const authServer = await oauth
	.discoveryRequest(issuer, { algorithm: 'oidc' })
	.then(response => oauth.processDiscoveryResponse(issuer, response));

const allowImpersonation = env('ALLOW_INSECURE_IMPERSONATION', '0') === '1';

export const authRouter = new Router<ContextState>();

authRouter.get('/auth/google', async ctx =>
{
	const codeVerifier = oauth.generateRandomCodeVerifier();
	const code_challenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
	const clientPort = ctx.request.url.searchParams.get('port');

	if (clientPort == null)
		throw new Error('Expected client to provide local server port');

	const authState: AuthState = {
		date: Date.now(),
		ip: ctx.request.ip,
		ua: ctx.request.userAgent.ua,
		codeVerifier,
		clientPort,
	};
	const state = TokenHelper.createSecretToken<AuthState>(authState);
	
	const url = new URL(authServer.authorization_endpoint!);
	const params = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: ctx.request.url.origin + '/auth/google/callback',
		response_type: 'code',
		scope: 'openid email profile',
		code_challenge,
		code_challenge_method,
		state
	});

	url.search = params.toString();

	ctx.response.redirect(url.toString());
});

authRouter.get('/auth/google/callback', async ctx =>
{
	const state = ctx.request.url.searchParams.get('state');

	if (state == undefined)
		throw new Error('Auth state missing');

	const stateData = TokenHelper.readSecretToken<AuthState>(state);

	if (Date.now() - stateData.date > AuthStateLifespan)
		throw new Error('Auth state expired');

	if (stateData.ip !== ctx.request.ip)
		throw new Error('IP mismatch');
	
	if (stateData.ua !== ctx.request.userAgent.ua)
		throw new Error('User Agent mismatch');

	const validateParams = oauth.validateAuthResponse(authServer, client, ctx.request.url, state);
	const redirect_uri = ctx.request.url.origin + '/auth/google/callback';
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

	ctx.response.redirect(`http://localhost:${stateData.clientPort}/?${TICKET_HEADER_NAME}=${ticket.id}`);

	console.log('Google login:', playerId);
});

authRouter.get('/auth/success', async ctx =>
{
	const text = await Deno.readTextFile('static/auth-success.html');
    ctx.response.headers.set('Content-Type', 'text/html')
    ctx.response.body = text;
});

authRouter.get('/auth/clear', async ctx =>
{
	const ticketId = ctx.request.headers.get(TICKET_HEADER_NAME);

	if (ticketId == null)
		return;

	const ticket = await Database.getTicket(ticketId);

	EventSender.disconnect(ticket!.playerId);

	await Database.deleteTicket(ticketId);
});

authRouter.get('/auth/state', ticketParserMiddleware, ctx =>
{
	ctx.response.body = ctx.state.ticket == undefined ? '0' : '1';
});

authRouter.post('/auth/impersonate', async ctx =>
{
	if (!allowImpersonation)
	{
		ctx.response.status = 401;
		ctx.response.body = 'Nuh uh';
		return;
	}

	const playerId = String(await ctx.request.body.json());
	const ticket = await Database.getTicketForPlayerId(playerId) ?? await Database.createTicket({
		id: TokenHelper.generateSessionToken(),
		playerId: playerId,
	});

	ctx.response.body = JSON.stringify(ticket.id);
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

	return await response.json();
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
