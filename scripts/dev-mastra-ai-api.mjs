import { spawn } from 'node:child_process';

const child = spawn(
  'pnpm',
  ['--filter', '@shenbi/ai-api', 'dev'],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      AI_RUNTIME: 'mastra',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

