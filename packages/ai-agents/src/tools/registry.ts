import type { AgentTool, AgentToolRegistry } from '../types';

export function createToolRegistry(tools: AgentTool[]): AgentToolRegistry {
  const toolMap = new Map<string, AgentTool>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  return {
    get(name: string): AgentTool | undefined {
      return toolMap.get(name);
    },
    list(): AgentTool[] {
      return Array.from(toolMap.values());
    },
  };
}
