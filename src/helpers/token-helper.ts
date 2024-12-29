import tnacl from 'tweetnacl';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

const secret = randomBytes(32);

function createSecretToken<T>(data: T): string {
	const nonce = tnacl.randomBytes(tnacl.secretbox.nonceLength);
	const payload = Buffer.from(JSON.stringify(data));
	const box = tnacl.secretbox(payload, nonce, secret);
	const token = Buffer.concat([ nonce, box ]);
	return token.toString('base64');
}

function readSecretToken<T>(token: string): T {
	const buf = Buffer.from(token, 'base64');
	const nonce = buf.slice(0, tnacl.secretbox.nonceLength);
	const box = buf.slice(tnacl.secretbox.nonceLength);
	const payload = Buffer.from(tnacl.secretbox.open(box, nonce, secret)!);
	const obj = JSON.parse(payload.toString());
	return obj;
}

function generateSessionToken(byteLength: number = 128): string
{
	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	const base64 = btoa(String.fromCharCode(...bytes));
	const urlSafeToken = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return urlSafeToken;
}

export const TokenHelper = {
	createSecretToken,
	readSecretToken,
	generateSessionToken,
};