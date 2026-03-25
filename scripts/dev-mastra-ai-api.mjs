import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const logDir = path.join(workspaceRoot, 'apps', 'ai-api', '.ai-debug', 'runtime');

fs.mkdirSync(logDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const sessionLogPath = path.join(logDir, `${timestamp}-dev-mastra.log`);
const latestLogPath = path.join(logDir, 'dev-mastra.latest.log');

const sessionLogStream = fs.createWriteStream(sessionLogPath, { flags: 'a' });
const latestLogStream = fs.createWriteStream(latestLogPath, { flags: 'w' });

const writeLogChunk = (chunk) => {
  sessionLogStream.write(chunk);
  latestLogStream.write(chunk);
};

const writeBanner = (line) => {
  const text = `${line}\n`;
  process.stdout.write(text);
  writeLogChunk(text);
};

writeBanner(`[dev:mastra] log file: ${sessionLogPath}`);
writeBanner(`[dev:mastra] latest log: ${latestLogPath}`);

const child = process.platform === 'win32'
  ? spawn(
    process.env.ComSpec ?? 'cmd.exe',
    ['/d', '/s', '/c', 'pnpm --filter @shenbi/ai-api dev'],
    {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AI_RUNTIME: 'mastra',
      },
    },
  )
  : spawn(
    'pnpm',
    ['--filter', '@shenbi/ai-api', 'dev'],
    {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AI_RUNTIME: 'mastra',
      },
    },
  );

child.stdout?.on('data', (chunk) => {
  process.stdout.write(chunk);
  writeLogChunk(chunk);
});

child.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk);
  writeLogChunk(chunk);
});

const closeLogs = () => {
  sessionLogStream.end();
  latestLogStream.end();
};

child.on('error', (error) => {
  const text = `[dev:mastra] spawn error: ${error instanceof Error ? error.message : String(error)}\n`;
  process.stderr.write(text);
  writeLogChunk(text);
  closeLogs();
  process.exit(1);
});

child.on('exit', (code, signal) => {
  closeLogs();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
