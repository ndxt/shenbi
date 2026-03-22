import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const defaultScanRoots = ['apps', 'packages', 'scripts'];
export const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export const ignoredPathParts = new Set(['.git', 'node_modules', 'dist', 'coverage']);
export const ignoredFileMatchers = [
  /(?:^|\/)\.turbo(?:\/|$)/,
  /(?:^|\/)docs(?:\/|$)/,
  /^packages\/editor-plugins\/api\/src\/context\.ts$/,
  /^packages\/editor-plugins\/api\/src\/context\.test\.ts$/,
  /^scripts\/check-plugin-context-boundaries\.mjs$/,
  /.*\.test\.[^.]+$/,
  /.*\.spec\.[^.]+$/,
];

export function createContextAliasPattern(propertyName) {
  return new RegExp(
    String.raw`\b(?:[A-Za-z_$][\w$]*\.)*(?:context|pluginContext)(?:\?\.|\.)${propertyName}\b`,
    'g',
  );
}

export const aliasRules = [
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

export const helperRules = [
  { name: 'getPluginSchema', pattern: /\bgetPluginSchema\b/g },
  { name: 'getPluginDocumentPatchService', pattern: /\bgetPluginDocumentPatchService\b/g },
  { name: 'replacePluginSchema', pattern: /\breplacePluginSchema\b/g },
  { name: 'getPluginSelectedNode', pattern: /\bgetPluginSelectedNode\b/g },
  { name: 'getPluginSelectedNodeId', pattern: /\bgetPluginSelectedNodeId\b/g },
  { name: 'getPluginNotifications', pattern: /\bgetPluginNotifications\b/g },
  { name: 'getPluginWorkspaceId', pattern: /\bgetPluginWorkspaceId\b/g },
  { name: 'getPluginPersistence', pattern: /\bgetPluginPersistence\b/g },
];

export const directBridgeServiceRules = [
  { name: 'pluginContext.filesystem', pattern: /\b(?:[A-Za-z_$][\w$]*\.)*pluginContext(?:\?\.|\.)filesystem\b/g },
  { name: 'pluginContext.persistence', pattern: /\b(?:[A-Za-z_$][\w$]*\.)*pluginContext(?:\?\.|\.)persistence\b/g },
  { name: 'pluginContext.workspace', pattern: /\b(?:[A-Za-z_$][\w$]*\.)*pluginContext(?:\?\.|\.)workspace\b/g },
];

export function isValidWhenExpression(expression) {
  if (expression.includes('||') || expression.includes('(') || expression.includes(')')) {
    return false;
  }
  const rawTokens = expression.split('&&').map((token) => token.trim());
  if (rawTokens.some((token) => token.length === 0)) {
    return false;
  }
  const tokens = rawTokens.filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => /^!?[A-Za-z_$][\w$]*$/.test(token));
}

export function shouldIgnoreFile(relativePath) {
  const normalizedPath = relativePath.replaceAll('\\', '/');
  return ignoredFileMatchers.some((matcher) => matcher.test(normalizedPath));
}

export function collectFiles(rootDir, directory, files) {
  for (const entry of readdirSync(directory)) {
    if (ignoredPathParts.has(entry)) {
      continue;
    }
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectFiles(rootDir, fullPath, files);
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

export function getLineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
}

export function collectMatches(source, rule) {
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

export function collectInvalidWhenExpressions(source) {
  const matches = [];
  const whenLiteralPattern = /\b(when|enabledWhen)\s*:\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g;

  for (const match of source.matchAll(whenLiteralPattern)) {
    if (typeof match.index !== 'number') {
      continue;
    }
    const expression = match[3];
    const quote = match[2];
    if (quote === '`' && expression.includes('${')) {
      matches.push({
        symbol: `${match[1]} template literal`,
        line: getLineNumber(source, match.index),
      });
      continue;
    }
    if (!isValidWhenExpression(expression)) {
      matches.push({
        symbol: `${match[1]} expression "${expression}"`,
        line: getLineNumber(source, match.index),
      });
    }
  }

  return matches;
}

export function collectSourceViolations(source, relativePath = '<inline>') {
  const violations = [];
  for (const rule of [...aliasRules, ...helperRules, ...directBridgeServiceRules]) {
    for (const match of collectMatches(source, rule)) {
      violations.push({
        file: relativePath,
        line: match.line,
        symbol: match.symbol,
      });
    }
  }
  for (const match of collectInvalidWhenExpressions(source)) {
    violations.push({
      file: relativePath,
      line: match.line,
      symbol: match.symbol,
    });
  }
  return violations;
}

export function collectWorkspaceViolations(rootDir, scanRoots = defaultScanRoots) {
  const files = [];
  for (const scanRoot of scanRoots) {
    const fullPath = path.join(rootDir, scanRoot);
    collectFiles(rootDir, fullPath, files);
  }

  const violations = [];
  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath);
    const source = readFileSync(filePath, 'utf8');
    violations.push(...collectSourceViolations(source, relativePath));
  }
  return violations;
}

export function formatViolations(violations) {
  return violations.map((violation) => `- ${violation.file}:${violation.line} uses ${violation.symbol}`);
}

export function runPluginContextBoundaryCheck(rootDir = process.cwd(), scanRoots = defaultScanRoots) {
  const violations = collectWorkspaceViolations(rootDir, scanRoots);
  if (violations.length > 0) {
    console.error('Plugin boundary violations detected:');
    for (const line of formatViolations(violations)) {
      console.error(line);
    }
    console.error('Use grouped PluginContext accessors and supported when/enabledWhen expressions instead.');
    return 1;
  }

  console.log('PluginContext boundary check passed.');
  return 0;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  process.exit(runPluginContextBoundaryCheck());
}
