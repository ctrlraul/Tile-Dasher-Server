import path from 'path';
import { Request } from 'express';

export function getRequestPath(req: Request): string
{
	return path.join(req.baseUrl, req.path);
}

export function getRequestUrl(req: Request): URL
{
	return new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
}

export function getRequestIp(req: Request): string
{	
	const forwarded = req.headers['x-forwarded-for'];

	if (forwarded && forwarded.length)
		return forwarded[0];

	if (req.ip)
		return req.ip;

	return '';
}
