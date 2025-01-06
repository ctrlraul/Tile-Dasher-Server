import { config } from 'dotenv';

config();

/**
 * Get an environment variable
 * @param {string} name Name of the env var
 * @param {string} defaultValue Value to use if the env var isn't present
 * @throws Throws Error if env var is not present and defaultValue is not provided
 */
export function env(name: string, defaultValue?: string): string
{
	const value = process.env[name];

	if (typeof value === 'string')
		return value;

	if (typeof defaultValue === 'string')
		return defaultValue;

	throw new Error(`Missing required environment variable '${name}'`);
}