import { ErrorRequestHandler } from 'express';

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {

	console.error(`[${req.path}] Error: ${err.message}`);

	if (res.statusCode == 200)
		res.statusCode = 500;

	res.send(err.message);
	next();

};