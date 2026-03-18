import type { AgentMemoryAttachment, AgentMemoryMessage, AgentOperation } from '../types';

export interface FormatHistoryOptions {
  maxTurns?: number;
  maxCharsPerTurn?: number;
  includeOperations?: boolean;
  schemaDigest?: string;
}

interface ConversationTurn {
  user?: AgentMemoryMessage;
  assistantMessages: AgentMemoryMessage[];
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 4).map((item) => stringifyValue(item));
    return `[${items.join(', ')}${value.length > 4 ? ', ...' : ''}]`;
  }
  if (value && typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 80 ? `${json.slice(0, 77)}...` : json;
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function summarizePatchEntries(patch: Record<string, unknown> | undefined): string {
  if (!patch) {
    return '无明确变更内容';
  }
  const entries = Object.entries(patch)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${stringifyValue(value)}`);
  if (entries.length === 0) {
    return '无明确变更内容';
  }
  return entries.join(', ');
}

function summarizeColumns(columns: unknown): string {
  if (!Array.isArray(columns) || columns.length === 0) {
    return '空列配置';
  }
  const titles = columns
    .slice(0, 6)
    .map((column) => {
      if (!column || typeof column !== 'object') {
        return '';
      }
      const title = (column as { title?: unknown }).title;
      return typeof title === 'string' || typeof title === 'number' ? String(title).trim() : '';
    })
    .filter(Boolean);
  if (titles.length === 0) {
    return `共 ${columns.length} 列`;
  }
  return `[${titles.join(', ')}${columns.length > titles.length ? ', ...' : ''}]`;
}

function summarizeInsertedNode(operation: Extract<AgentOperation, { op: 'schema.insertNode' }>): string {
  const nodeId = typeof operation.node.id === 'string' && operation.node.id.trim() ? `#${operation.node.id}` : '';
  const target = operation.parentId ? `节点 ${operation.parentId}` : operation.container === 'dialogs' ? 'dialogs 容器' : 'body 容器';
  return `在 ${target} 下插入 ${operation.node.component}${nodeId}`;
}

function truncateText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function groupConversationTurns(messages: AgentMemoryMessage[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      turns.push({ user: message, assistantMessages: [] });
      continue;
    }

    const lastTurn = turns.at(-1);
    if (!lastTurn) {
      turns.push({ assistantMessages: [message] });
      continue;
    }
    lastTurn.assistantMessages.push(message);
  }
  return turns;
}

export function summarizeOperation(operation: AgentOperation): string {
  const prefix = operation.label ? `${operation.label}: ` : '';
  switch (operation.op) {
    case 'schema.patchProps':
      return `${prefix}修改节点 ${operation.nodeId} 的属性 ${summarizePatchEntries(operation.patch)}`;
    case 'schema.patchStyle':
      return `${prefix}调整节点 ${operation.nodeId} 的样式 ${summarizePatchEntries(operation.patch)}`;
    case 'schema.patchEvents':
      return `${prefix}更新节点 ${operation.nodeId} 的事件 ${summarizePatchEntries(operation.patch)}`;
    case 'schema.patchLogic':
      return `${prefix}更新节点 ${operation.nodeId} 的逻辑 ${summarizePatchEntries(operation.patch)}`;
    case 'schema.patchColumns':
      return `${prefix}更新节点 ${operation.nodeId} 的表格列 ${summarizeColumns(operation.columns)}`;
    case 'schema.insertNode':
      return `${prefix}${summarizeInsertedNode(operation)}`;
    case 'schema.removeNode':
      return `${prefix}删除节点 ${operation.nodeId}`;
    case 'schema.replace':
      return `${prefix}替换整页 schema`;
  }
}

export function summarizeOperations(operations: AgentOperation[]): string {
  return operations.map((operation) => summarizeOperation(operation)).join('；');
}

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }
  return `${sizeBytes} B`;
}

function summarizeAttachment(attachment: AgentMemoryAttachment): string {
  const kindLabel = attachment.kind === 'image' ? '图片' : '文档';
  return `${kindLabel}: ${attachment.name} (${attachment.mimeType}, ${formatAttachmentSize(attachment.sizeBytes)})`;
}

function shouldIncludeOperations(
  message: AgentMemoryMessage,
  schemaDigest: string | undefined,
): boolean {
  if (!message.meta?.operations || message.meta.operations.length === 0 || message.meta.failed === true) {
    return false;
  }
  if (!schemaDigest || !message.meta.schemaDigest) {
    return true;
  }
  return message.meta.schemaDigest === schemaDigest;
}

export function formatConversationHistory(
  messages: AgentMemoryMessage[],
  options: FormatHistoryOptions = {},
): string {
  const maxTurns = options.maxTurns ?? 6;
  const maxCharsPerTurn = options.maxCharsPerTurn ?? 500;
  const includeOperations = options.includeOperations ?? true;
  const schemaDigest = options.schemaDigest;
  const turns = groupConversationTurns(messages).slice(-maxTurns);

  if (turns.length === 0) {
    return '[对话历史 - 共 0 轮]';
  }

  const lines: string[] = [`[对话历史 - 共 ${turns.length} 轮]`];
  for (const turn of turns) {
    lines.push('---');
    if (turn.user) {
      lines.push(`用户: ${truncateText(turn.user.text, maxCharsPerTurn)}`);
      if (turn.user.attachments) {
        for (const attachment of turn.user.attachments) {
          lines.push(`      [附件: ${summarizeAttachment(attachment)}]`);
          if (attachment.kind === 'document' && attachment.extractedTextPreview) {
            lines.push(`      [文档摘要: ${truncateText(attachment.extractedTextPreview, maxCharsPerTurn)}]`);
          }
        }
      }
    }
    for (const assistantMessage of turn.assistantMessages) {
      lines.push(`助手: ${truncateText(assistantMessage.text, maxCharsPerTurn)}`);
      const operations = assistantMessage.meta?.operations;
      if (
        includeOperations
        && operations
        && shouldIncludeOperations(assistantMessage, schemaDigest)
      ) {
        lines.push(`      [执行: ${summarizeOperations(operations)}]`);
      }
    }
  }

  return lines.join('\n');
}
