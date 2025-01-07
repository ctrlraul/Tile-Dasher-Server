import { NextFunction, Request, Response } from 'express';
import { getRequestIp, getRequestUrl } from '../helpers/request.js';
import { TokenHelper } from '../helpers/token-helper.js';
import * as oauth from 'oauth4webapi';


export interface AuthState {
	date: number;
	ip: string;
	ua: string;
	codeVerifier: string;
	clientPort: string;
}

export interface OauthConfig {
	route: string;
	clientId: string;
	clientSecret: string;
	issuer: string;
	codeChallengeMethod: string;
	scope: string;
	onTokensReceived: (req: Request, res: Response, state: AuthState, tokens: oauth.TokenEndpointResponse) => any;
}


const AuthStateLifespan = 60 * 5 * 1000; // 5 minutes


async function getAuthServer(issuer: URL): Promise<oauth.AuthorizationServer>
{
	return await oauth
		.discoveryRequest(issuer, { algorithm: 'oidc' })
		.then(response => oauth.processDiscoveryResponse(issuer, response));
}


export function Oauth(config: OauthConfig)
{
	const client: oauth.Client = { client_id: config.clientId };
	const clientAuth = oauth.ClientSecretPost(config.clientSecret);
	const issuer = new URL(config.issuer);
	let authServer: oauth.AuthorizationServer;
	
	
	const start = async (req: Request, res: Response) =>
	{
		authServer ??= await getAuthServer(issuer);

		const codeVerifier = oauth.generateRandomCodeVerifier();
		const code_challenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
		const clientPort = String(req.query['port']);
	
		if (!clientPort)
			throw new Error('Expected client to provide local server port');
	
		const authState: AuthState = {
			date: Date.now(),
			ip: getRequestIp(req),
			ua: req.header('User-Agent') || '',
			codeVerifier,
			clientPort,
		};
		const state = TokenHelper.createSecretToken(authState);

		const requestUrl = getRequestUrl(req);
		const authUrl = new URL(authServer.authorization_endpoint!);
		const params = new URLSearchParams({
			client_id: client.client_id,
			redirect_uri: requestUrl.origin + config.route + '/callback',
			response_type: 'code',
			scope: config.scope,
			code_challenge,
			code_challenge_method: config.codeChallengeMethod,
			state,
		});
	
		authUrl.search = params.toString();
		res.redirect(authUrl.toString());
	};
	
	const callback = async (req: Request, res: Response) =>
	{
		try
		{
			const stateToken = String(req.query['state']);
	
			if (!stateToken)
				throw new Error('State missing');
		
			const state = TokenHelper.readSecretToken<AuthState>(stateToken);
		
			if (Date.now() - state.date > AuthStateLifespan)
				throw new Error('State expired');
		
			if (state.ip !== getRequestIp(req))
				throw new Error('IP mismatch');
		
			if (state.ua !== (req.header('User-Agent') || ''))
				throw new Error('User Agent mismatch');
		
			const url = new URL(getRequestUrl(req));
			const validateParams = oauth.validateAuthResponse(authServer, client, url, stateToken);
			const redirect_uri = `${url.origin}/auth/discord/callback`;
			const response = await oauth.authorizationCodeGrantRequest(
				authServer,
				client,
				clientAuth,
				validateParams,
				redirect_uri,
				state.codeVerifier,
			);
		
			const result = await oauth.processAuthorizationCodeResponse(authServer, client, response);

			config.onTokensReceived(req, res, state, result);
		}
		catch (error)
		{
			res.status(400);
			res.send(error instanceof Error ? error.message : error);
		}
	};


	const middleware = (req: Request, res: Response, next: NextFunction) =>
	{
		switch (req.path)
		{
			case config.route:
				start(req, res);
				break;
			
			case config.route + '/callback':
				callback(req, res);
				break;
		
			default:
				next();
				break;
		}
	};


	return middleware;
}
