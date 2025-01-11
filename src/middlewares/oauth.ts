import { NextFunction, Request, Response } from 'express';
import { getRequestIp, getRequestUrl } from '../helpers/request.js';
import { TokenHelper } from '../helpers/token-helper.js';
import * as oauth from 'oauth4webapi';
import { Logger } from '../helpers/logger.js';
import chalk from 'chalk';


export interface AuthState {
	date: number;
	ip: string;
	ua: string;
	codeVerifier: string;
	clientPort: string;
}

export interface OauthConfig {
	clientId: string;
	clientSecret: string;
	issuer: string;
	codeChallengeMethod: string;
	scope: string;
	onTokensReceived: (req: Request, res: Response, state: AuthState, tokens: oauth.TokenEndpointResponse) => any;
}


const logger: Logger = new Logger('Oauth');
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
	
	
	const entry = async (req: Request, res: Response) =>
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
			redirect_uri: requestUrl.origin + req.path + '/callback',
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
		const stateToken = String(req.query['state']);

		if (!stateToken)
		{
			logger.info('Auth Error: State missing');
			res.status(400).send('State missing');
			return;
		}
	
		const state = TokenHelper.readSecretToken<AuthState>(stateToken);
		const ip = getRequestIp(req);
		const ua = req.header('User-Agent') || '';
	
		if (Date.now() - state.date > AuthStateLifespan)
		{
			logger.info('Auth Error: State expired');
			res.status(400).send('State expired');
			return;
		}
	
		if (state.ip !== ip)
		{
			logger.info(`Auth Error: IP mismatch (${chalk.green(state.ip)} != ${chalk.red(ip)})`);
			res.status(400).send('IP mismatch');
			return;
		}
	
		if (state.ua !== ua)
		{
			logger.info(`Auth Error: User Agent mismatch (${chalk.green(state.ua)} != ${chalk.red(ua)})`);
			res.status(400).send('User Agent mismatch');
			return;
		}
	
		const url = new URL(getRequestUrl(req));
		const validateParams = oauth.validateAuthResponse(authServer, client, url, stateToken);
		const redirect_uri = url.origin + req.path;
		const response = await oauth.authorizationCodeGrantRequest(
			authServer,
			client,
			clientAuth,
			validateParams,
			redirect_uri,
			state.codeVerifier,
		);
	
		const result = await oauth.processAuthorizationCodeResponse(authServer, client, response);

		await config.onTokensReceived(req, res, state, result);
	};


	// const middleware = (req: Request, res: Response, next: NextFunction) =>
	// {
	// 	try
	// 	{
	// 		switch (req.path)
	// 		{
	// 			case config.route:
	// 				entry(req, res);
	// 				return;
				
	// 			case config.route + '/callback':
	// 				callback(req, res);
	// 				return;
	// 		}
	// 	}
	// 	catch (error)
	// 	{
	// 		next(error);
	// 		return;
	// 	}

	// 	next();
	// };


	return { entry, callback };
}
