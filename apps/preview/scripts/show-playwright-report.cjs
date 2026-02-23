const fs = require('fs');
const cp = require('child_process');

const reportDir = 'playwright-report';

if (!fs.existsSync(reportDir)) {
  console.log('No report found. Run `pnpm --filter @shenbi/preview test:e2e:html` first.');
  process.exit(0);
}

const result = cp.spawnSync('playwright', ['show-report'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
