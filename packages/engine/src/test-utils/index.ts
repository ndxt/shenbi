import { createElement } from 'react';
import { render } from '@testing-library/react';
import type { CompiledNode } from '../types/contracts';
import { ShenbiContext, NodeRenderer } from '../renderer/node-renderer';
import { createMockRuntime } from '../__mocks__/runtime';
import { createMockResolver } from '../__mocks__/resolver';

// Re-export expr from utils for test convenience
export { createCompiledExpr as expr } from '../utils/create-compiled-expr';

/**
 * 在 ShenbiContext 中渲染 CompiledNode 的测试辅助函数。
 * 返回 runtime / resolver 引用 + testing-library 的 render 结果。
 */
export function renderWithContext(
  node: CompiledNode,
  state: Record<string, any> = {},
  extraContext?: Record<string, any>,
  components: Record<string, any> = {},
) {
  const runtime = createMockRuntime(state);
  const resolver = createMockResolver(components);
  return {
    runtime,
    resolver,
    ...render(
      createElement(ShenbiContext, { value: { runtime, resolver } },
        createElement(NodeRenderer, { node, extraContext }),
      ),
    ),
  };
}
