import type {
  AgentMemoryEntry,
  AgentMemoryMessage,
  AgentMemoryStore,
  RunMetadata,
} from '../types';

function createEmptyEntry(): AgentMemoryEntry {
  return {
    conversation: [],
    lastBlockIds: [],
  };
}

export class InMemoryAgentMemoryStore implements AgentMemoryStore {
  private readonly entries = new Map<string, AgentMemoryEntry>();

  async getConversation(conversationId: string): Promise<AgentMemoryMessage[]> {
    return [...this.getEntry(conversationId).conversation];
  }

  async appendConversationMessage(
    conversationId: string,
    message: AgentMemoryMessage,
  ): Promise<void> {
    const entry = this.getEntry(conversationId);
    entry.conversation.push(message);
  }

  async patchAssistantMessage(
    conversationId: string,
    sessionId: string,
    patch: {
      text?: string;
      meta?: Partial<NonNullable<AgentMemoryMessage['meta']>>;
      clearOperations?: boolean;
    },
  ): Promise<void> {
    const entry = this.getEntry(conversationId);
    const target = [...entry.conversation]
      .reverse()
      .find((message) => message.role === 'assistant' && message.meta?.sessionId === sessionId);
    if (!target) {
      return;
    }

    if (patch.text !== undefined) {
      target.text = patch.text;
    }
    if (patch.meta !== undefined) {
      target.meta = {
        ...(target.meta ?? {}),
        ...patch.meta,
      };
    }
    if (patch.clearOperations) {
      if (!target.meta) {
        target.meta = {};
      }
      delete target.meta.operations;
    }
  }

  async getLastRunMetadata(conversationId: string): Promise<RunMetadata | undefined> {
    return this.getEntry(conversationId).lastRunMetadata;
  }

  async setLastRunMetadata(conversationId: string, metadata: RunMetadata): Promise<void> {
    this.getEntry(conversationId).lastRunMetadata = metadata;
  }

  async getLastBlockIds(conversationId: string): Promise<string[]> {
    return [...this.getEntry(conversationId).lastBlockIds];
  }

  async setLastBlockIds(conversationId: string, blockIds: string[]): Promise<void> {
    this.getEntry(conversationId).lastBlockIds = [...blockIds];
  }

  private getEntry(conversationId: string): AgentMemoryEntry {
    const existing = this.entries.get(conversationId);
    if (existing) {
      return existing;
    }
    const created = createEmptyEntry();
    this.entries.set(conversationId, created);
    return created;
  }
}

export function createInMemoryAgentMemoryStore(): AgentMemoryStore {
  return new InMemoryAgentMemoryStore();
}
