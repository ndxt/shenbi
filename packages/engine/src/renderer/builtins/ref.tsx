import type { ReactElement } from 'react';

export interface RefProps {
  __templateId?: string;
  children?: any;
}

/**
 * __ref 内置组件：模板引用占位。
 * 在完整集成时由 compiler 将 page.templates[id] 编译后替换为实际节点。
 * 阶段 1 仅渲染 children 或空。
 */
export function RefComponent({ children }: RefProps): ReactElement | null {
  return children ?? null;
}
