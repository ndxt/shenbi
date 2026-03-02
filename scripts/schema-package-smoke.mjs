import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function fail(message) {
  console.error(`[schema-smoke] FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  const consumerDir = path.resolve(process.argv[2] ?? process.cwd());
  const consumerPkgJson = path.join(consumerDir, 'package.json');
  if (!fs.existsSync(consumerPkgJson)) {
    fail(`consumer package.json not found: ${consumerPkgJson}`);
  }

  const req = createRequire(consumerPkgJson);
  const resolvedEntry = req.resolve('@shenbi/schema');
  const mod = await import(pathToFileURL(resolvedEntry).href);

  const contracts = mod.builtinContracts;
  const getBuiltinContract = mod.getBuiltinContract;

  if (!Array.isArray(contracts) || contracts.length === 0) {
    fail('builtinContracts is empty or invalid');
  }

  const required = ['Button', 'Form.Item', 'Table', 'Layout', 'Tree.DirectoryTree'];
  const missing = required.filter((name) => !getBuiltinContract?.(name));
  if (missing.length > 0) {
    fail(`missing required contracts: ${missing.join(', ')}`);
  }

  console.log('[schema-smoke] PASS');
  console.log(`[schema-smoke] resolved entry: ${resolvedEntry}`);
  console.log(`[schema-smoke] builtinContracts: ${contracts.length}`);
  console.log(`[schema-smoke] sample: ${required.join(', ')}`);
}

main().catch((error) => {
  console.error('[schema-smoke] ERROR:', error);
  process.exit(1);
});
