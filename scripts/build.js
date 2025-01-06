import esbuild from 'esbuild';
import path from 'path';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import { fileURLToPath } from 'url';


const fromCli = fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);


export async function build()
{
	await esbuild.build({
		entryPoints: ['src/main.ts'],
		bundle: true,
		outfile: 'build/main.js',
		loader: {
			'.tsx': 'tsx',
			'.css': 'text'
		},
		legalComments: 'none',
		platform: 'node',
		format: 'esm',
		sourcemap: true,
		plugins: [
			nodeExternalsPlugin(),
		],
	});
	
	if (fromCli)
		console.log('Build completed successfully!');
}


if (fromCli)
	build();
