import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(currentDir, '..');
const rootDir = path.resolve(appDir, '../..');
const distDir = path.join(appDir, 'dist');

function resolveEsbuild() {
  const pnpmDir = path.join(rootDir, 'node_modules', '.pnpm');
  const candidates = fs.readdirSync(pnpmDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('esbuild@'))
    .map((entry) => path.join(pnpmDir, entry.name, 'node_modules', 'esbuild'))
    .filter((entry) => fs.existsSync(entry))
    .sort()
    .reverse();

  const selected = candidates[0];
  if (!selected) {
    throw new Error('Unable to locate esbuild in workspace node_modules/.pnpm');
  }

  return require(selected);
}

const esbuild = resolveEsbuild();

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(appDir, 'src', 'server.ts')],
  outfile: path.join(distDir, 'server.cjs'),
  bundle: true,
  packages: 'bundle',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  tsconfig: path.join(appDir, 'tsconfig.json'),
  logLevel: 'info',
});

const envCandidates = [
  path.join(rootDir, '.env.production'),
  path.join(rootDir, '.env.local'),
];
const envSource = envCandidates.find((candidate) => fs.existsSync(candidate));
if (!envSource) {
  throw new Error('Missing .env.production or .env.local in workspace root');
}
const envDest = path.join(distDir, '.env.production');
fs.copyFileSync(envSource, envDest);
