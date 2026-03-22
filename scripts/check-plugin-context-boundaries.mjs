import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const scanRoots = ['apps', 'packages', 'scripts'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignoredPathParts = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const ignoredFileMatchers = [
  /(?:^|\/)\.turbo(?:\/|$)/,
  /(?:^|\/)docs(?:\/|$)/,
  /^packages\/editor-plugins\/api\/src\/context\.ts$/,
  /^packages\/editor-plugins\/api\/src\/context\.test\.ts$/,
  /^scripts\/check-plugin-context-boundaries\.mjs$/,
  /.*\.test\.[^.]+$/,
  /.*\.spec\.[^.]+$/,
];

function createContextAliasPattern(propertyName) {
  return new RegExp(
    String.raw`\b(?:[A-Za-z_$][\w$]*\.)*(?:context|pluginContext)(?:\?\.|\.)${propertyName}\b`,
    'g',
  );
}

const aliasRules = [
  { name: 'getSchema', pattern: createContextAliasPattern('getSchema') },
  { name: 'replaceSchema', pattern: createContextAliasPattern('replaceSchema') },
  { name: 'getSelectedNode', pattern: createContextAliasPattern('getSelectedNode') },
  { name: 'patchNodeProps', pattern: createContextAliasPattern('patchNodeProps') },
  { name: 'patchNodeColumns', pattern: createContextAliasPattern('patchNodeColumns') },
  { name: 'patchNodeStyle', pattern: createContextAliasPattern('patchNodeStyle') },
  { name: 'patchNodeEvents', pattern: createContextAliasPattern('patchNodeEvents') },
  { name: 'patchNodeLogic', pattern: createContextAliasPattern('patchNodeLogic') },
  { name: 'executeCommand', pattern: createContextAliasPattern('executeCommand') },
  { name: 'notify', pattern: createContextAliasPattern('notify') },
];

const helperRules = [
  { name: 'getPluginSchema', pattern: /\bgetPluginSchema\b/g },
  { name: 'getPluginDocumentPatchService', pattern: /\bgetPluginDocumentPatchService\b/g },
  { name: 'replacePluginSchema', pattern: /\breplacePluginSchema\b/g },
  { name: 'getPluginSelectedNode', pattern: /\bgetPluginSelectedNode\b/g },
  { name: 'getPluginSelectedNodeId', pattern: /\bgetPluginSelectedNodeId\b/g },
  { name: 'getPluginNotifications', pattern: /\bgetPluginNotifications\b/g },
  { name: 'getPluginWorkspaceId', pattern: /\bgetPluginWorkspaceId\b/g },
  { name: 'getPluginPersistence', pattern: /\bgetPluginPersistence\b/g },
];

function shouldIgnoreFile(relativePath) {
  const normalizedPath = relativePath.replaceAll('\\', '/');
  return ignoredFileMatchers.some((matcher) => matcher.test(normalizedPath));
}

function collectFiles(directory, files) {
  for (const entry of readdirSync(directory)) {
    if (ignoredPathParts.has(entry)) {
      continue;
    }
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }
    if (!stats.isFile()) {
      continue;
    }
    if (!allowedExtensions.has(path.extname(entry))) {
      continue;
    }
    const relativePath = path.relative(rootDir, fullPath);
    if (shouldIgnoreFile(relativePath)) {
      continue;
    }
    files.push(fullPath);
  }
}

function getLineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
}

function collectMatches(source, rule) {
  const matches = [];
  for (const match of source.matchAll(rule.pattern)) {
    if (typeof match.index !== 'number') {
      continue;
    }
    matches.push({
      symbol: rule.name,
      index: match.index,
      line: getLineNumber(source, match.index),
    });
  }
  return matches;
}

const files = [];
for (const scanRoot of scanRoots) {
  const fullPath = path.join(rootDir, scanRoot);
  collectFiles(fullPath, files);
}

const violations = [];
for (const filePath of files) {
  const relativePath = path.relative(rootDir, filePath);
  const source = readFileSync(filePath, 'utf8');
  for (const rule of [...aliasRules, ...helperRules]) {
    for (const match of collectMatches(source, rule)) {
      violations.push({
        file: relativePath,
        line: match.line,
        symbol: match.symbol,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('Deprecated PluginContext aliases or field-level helpers detected:');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} uses ${violation.symbol}`);
  }
  console.error('Use grouped PluginContext accessors instead.');
  process.exit(1);
}

console.log('PluginContext boundary check passed.');
