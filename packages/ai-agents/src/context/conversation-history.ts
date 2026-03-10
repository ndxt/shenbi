import type { AgentMemoryMessage, AgentOperation } from '../types';

export interface FormatHistoryOptions {
  maxTurns?: number;
  maxCharsPerTurn?: number;
  includeOperations?: boolean;
}

interface ConversationTurn {
  user?: AgentMemoryMessage;
  assistantMessages: AgentMemoryMessage[];
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

function summarizeOperation(operation: AgentOperation): string {
  switch (operation.op) {
    case 'schema.patchProps':
    case 'schema.patchStyle':
    case 'schema.patchEvents':
    case 'schema.patchLogic':
    case 'schema.patchColumns':
      return `${operation.op}(${operation.nodeId})`;
    case 'schema.insertNode':
      return `${operation.op}(${operation.parentId})`;
    case 'schema.removeNode':
      return `${operation.op}(${operation.nodeId})`;
    case 'schema.replace':
      return 'schema.replace -> full page';
  }
}

function summarizeOperations(operations: AgentOperation[]): string {
  return operations.map((operation) => summarizeOperation(operation)).join(', ');
}

export function formatConversationHistory(
  messages: AgentMemoryMessage[],
  options: FormatHistoryOptions = {},
): string {
  const maxTurns = options.maxTurns ?? 6;
  const maxCharsPerTurn = options.maxCharsPerTurn ?? 500;
  const includeOperations = options.includeOperations ?? true;
  const turns = groupConversationTurns(messages).slice(-maxTurns);

  if (turns.length === 0) {
    return '[对话历史 - 共 0 轮]';
  }

  const lines: string[] = [`[对话历史 - 共 ${turns.length} 轮]`];
  for (const turn of turns) {
    lines.push('---');
    if (turn.user) {
      lines.push(`用户: ${truncateText(turn.user.text, maxCharsPerTurn)}`);
    }
    for (const assistantMessage of turn.assistantMessages) {
      lines.push(`助手: ${truncateText(assistantMessage.text, maxCharsPerTurn)}`);
      if (
        includeOperations
        && assistantMessage.meta?.operations
        && assistantMessage.meta.operations.length > 0
      ) {
        lines.push(`      [执行: ${summarizeOperations(assistantMessage.meta.operations)}]`);
      }
    }
  }

  return lines.join('\n');
}
