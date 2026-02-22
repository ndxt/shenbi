// @vitest-environment node

import { performance } from 'node:perf_hooks';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SchemaNode } from '@shenbi/schema';
import { createMockRuntime } from '../__mocks__/runtime';
import { compileSchema } from '../compiler/schema';
import { NodeRenderer, ShenbiContext } from '../renderer/node-renderer';
import { createResolver } from '../resolver';
import type { CompiledNode } from '../types/contracts';

function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function runBenchmark(run: () => void, runs: number, warmups: number): number[] {
  for (let i = 0; i < warmups; i += 1) {
    run();
  }

  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  return samples;
}

function buildSchemaNodeCount(nodeCount: number): SchemaNode {
  const children: SchemaNode[] = Array.from({ length: nodeCount }, (_unused, index) => ({
    id: `node_${index}`,
    component: 'PerfLeaf',
    props: {
      'data-idx': index,
      className: `item-${index}`,
      title: `{{state.labels[${index}]}}`,
    },
    children: `{{state.values[${index}]}}`,
  }));

  return {
    id: 'root',
    component: 'PerfContainer',
    props: {
      className: 'perf-root',
    },
    children,
  };
}

const PerfContainer = (props: Record<string, any>) => createElement('div', props, props.children);
const PerfLeaf = (props: Record<string, any>) => createElement('span', props, props.children);

describe('perf baseline gate', () => {
  const nodeCount = readPositiveNumber('SHENBI_PERF_NODE_COUNT', 200);
  const runs = readPositiveNumber('SHENBI_PERF_RUNS', 25);
  const warmups = readPositiveNumber('SHENBI_PERF_WARMUPS', 5);
  const compileAvgThresholdMs = readPositiveNumber('SHENBI_PERF_COMPILE_MS', 50);
  const renderAvgThresholdMs = readPositiveNumber('SHENBI_PERF_RENDER_MS', 70);

  const schema = buildSchemaNodeCount(nodeCount);
  const resolver = createResolver({
    PerfContainer,
    PerfLeaf,
  });

  it(`compile ${nodeCount} nodes avg <= ${compileAvgThresholdMs}ms`, () => {
    const samples = runBenchmark(() => {
      compileSchema(schema, resolver);
    }, runs, warmups);

    const avgMs = average(samples);
    const p95Ms = percentile(samples, 0.95);
    const maxMs = Math.max(...samples);

    console.info(
      `[perf][compile] nodes=${nodeCount} runs=${runs} avg=${avgMs.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms max=${maxMs.toFixed(2)}ms threshold=${compileAvgThresholdMs}ms`,
    );

    expect(avgMs).toBeLessThanOrEqual(compileAvgThresholdMs);
  });

  it(`render ${nodeCount} compiled nodes avg <= ${renderAvgThresholdMs}ms`, () => {
    const compiled = compileSchema(schema, resolver) as CompiledNode;
    const runtime = createMockRuntime({
      values: Array.from({ length: nodeCount }, (_unused, index) => `value-${index}`),
      labels: Array.from({ length: nodeCount }, (_unused, index) => `label-${index}`),
    });

    const renderTree = () =>
      renderToStaticMarkup(
        createElement(
          ShenbiContext,
          { value: { runtime, resolver } },
          createElement(NodeRenderer, { node: compiled }),
        ),
      );

    const samples = runBenchmark(() => {
      const html = renderTree();
      if (!html.includes('value-0')) {
        throw new Error('render output validation failed');
      }
    }, runs, warmups);

    const avgMs = average(samples);
    const p95Ms = percentile(samples, 0.95);
    const maxMs = Math.max(...samples);

    console.info(
      `[perf][render] nodes=${nodeCount} runs=${runs} avg=${avgMs.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms max=${maxMs.toFixed(2)}ms threshold=${renderAvgThresholdMs}ms`,
    );

    expect(avgMs).toBeLessThanOrEqual(renderAvgThresholdMs);
  });
});
