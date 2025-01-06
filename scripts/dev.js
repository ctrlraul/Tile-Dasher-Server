import { spawn } from 'child_process';
import chokidar from 'chokidar';
import packageJson from '../package.json' with { type: 'json' };

let appProcess = null;

function buildAndRestart()
{
	console.log('Building...');

	const buildProcess = runFromPackageJson('build');

	buildProcess.on('close', code => {
		if (code !== 0) {
			console.error('Build failed with code:', code);
			return;
		}

		console.log('Build completed.');

		if (appProcess) {
			appProcess.kill();
			console.log('Restarting app...');
		}

		console.clear();

		appProcess = runFromPackageJson('start');

		appProcess.on('close', code => {
			if (code !== null && code !== 0)
				console.error('App exited with code:', code);
		});
	});
}

function runFromPackageJson(scriptName)
{
	const startCmd = packageJson.scripts[scriptName].split(' ');
	return spawn(startCmd.shift(), startCmd, { stdio: 'inherit' });
}


chokidar.watch('src', { ignoreInitial: true, awaitWriteFinish: true }).on('all', buildAndRestart);

buildAndRestart();
