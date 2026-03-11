import type { AgentIntent, AgentRuntimeContext } from '../types';

export interface IntentClassification {
  intent: AgentIntent;
  confidence: number;
}

const CREATE_KEYWORDS = ['做一个', '生成一个', '创建一个', '新建', '帮我做', '帮我生成', '重新生成', '重新做', '再做一个', '再生成', 'build', 'create', 'generate'];
const MODIFY_KEYWORDS = ['改', '修改', '调整', '换', '加上', '删除', '去掉', '移除', '添加', '增加', '变成', '设为', '更新', '替换', '移动', '隐藏', '显示', 'update', 'change', 'remove', 'delete', 'insert', 'add', 'replace', 'move', 'hide', 'show'];

export function classifyIntentByRules(context: AgentRuntimeContext): IntentClassification {
  const normalizedPrompt = context.prompt.toLowerCase();

  if (!context.document.exists) {
    return { intent: 'schema.create', confidence: 0.9 };
  }

  if (CREATE_KEYWORDS.some((keyword) => normalizedPrompt.includes(keyword))) {
    return { intent: 'schema.create', confidence: 0.85 };
  }

  if (
    MODIFY_KEYWORDS.some((keyword) => normalizedPrompt.includes(keyword))
    || Boolean(context.selectedNodeId)
  ) {
    return { intent: 'schema.modify', confidence: 0.85 };
  }

  if (context.conversation.turnCount > 0) {
    return { intent: 'schema.modify', confidence: 0.6 };
  }

  return { intent: 'chat', confidence: 0.5 };
}
