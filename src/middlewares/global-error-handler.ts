import { ErrorRequestHandler } from 'express';
import { Logger } from '../helpers/logger.js';
import chalk from 'chalk';

export const globalErrorHandler: ErrorRequestHandler = (error, req, res, next) =>
{
	if (res.statusCode == 200)
		res.status(500);

	res.contentType('text/plain');

	if (error instanceof Error)
	{
		Logger.error(`In route ${chalk.red(req.path)}:`, error);
		res.send(`Error: ${error.message}`);
	}
	else
	{
		Logger.error(`In route ${chalk.red(req.path)}:`, error);
		res.send('Something went wrong!');
	}
};