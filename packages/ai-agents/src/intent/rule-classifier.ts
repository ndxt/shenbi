import type { AgentRuntimeContext, IntentClassification } from '../types';

const CREATE_KEYWORDS = [
  '做一个', '生成一个', '创建一个', '新建', '帮我做', '帮我生成',
  '重新生成', '重新做', '再做一个', '再生成',
  'build', 'create', 'generate',
];

const MODIFY_KEYWORDS = [
  // Structural edits
  '改', '修改', '调整', '换', '加上', '删除', '去掉', '移除', '添加', '增加',
  '变成', '设为', '更新', '替换', '移动', '隐藏', '显示',
  // Style / layout operations
  '撑满', '填满', '铺满', '居中', '对齐', '变大', '变小', '加粗', '加宽',
  '缩小', '放大', '拉伸', '靠左', '靠右', '置顶', '置底', '变色',
  '高亮', '加边框', '去边框', '圆角', '阴影', '透明', '加间距', '减间距',
  // English equivalents
  'update', 'change', 'remove', 'delete', 'insert', 'add', 'replace',
  'move', 'hide', 'show', 'resize', 'align', 'center', 'stretch', 'fill',
];

export function classifyIntentByRules(context: AgentRuntimeContext): IntentClassification {
  const prompt = context.prompt.toLowerCase();
  const hasDocument = context.document.exists;
  const hasSelectedNode = Boolean(context.selectedNodeId);
  const hasTurnHistory = context.conversation.turnCount > 0;

  // No document at all → create
  if (!hasDocument) {
    if (CREATE_KEYWORDS.some((k) => prompt.includes(k))) {
      return { intent: 'schema.create', confidence: 0.95 };
    }
    return { intent: 'schema.create', confidence: 0.8 };
  }

  // Explicit create keywords override everything
  if (CREATE_KEYWORDS.some((k) => prompt.includes(k))) {
    return { intent: 'schema.create', confidence: 0.85 };
  }

  // Selected node is the strongest modify signal:
  // user is focused on a specific node and gave an instruction → modify
  if (hasSelectedNode) {
    return { intent: 'schema.modify', confidence: 0.9 };
  }

  // Explicit modify keywords
  if (MODIFY_KEYWORDS.some((k) => prompt.includes(k))) {
    return { intent: 'schema.modify', confidence: 0.85 };
  }

  // Conversation continuity (follow-up turn likely refers to prior modify)
  if (hasTurnHistory) {
    return { intent: 'schema.modify', confidence: 0.6 };
  }

  // Ambiguous — low confidence so LLM classifier can override
  return { intent: 'chat', confidence: 0.4 };
}
