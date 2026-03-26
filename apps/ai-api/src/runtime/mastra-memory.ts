import { MastraMemory } from '@mastra/core/memory';

type StoredThread = {
  id: string;
  resourceId: string;
  title?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type StoredMessage = Record<string, unknown> & {
  id: string;
  threadId: string;
  resourceId?: string;
  createdAt: Date;
};

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

export class ShenbiMastraMemory extends MastraMemory {
  private readonly threads = new Map<string, StoredThread>();
  private readonly messagesByThread = new Map<string, StoredMessage[]>();
  private readonly workingMemoryByThread = new Map<string, string>();

  constructor() {
    super({
      id: 'shenbi-mastra-memory',
      name: 'Shenbi Mastra Memory',
      options: {
        lastMessages: 24,
        semanticRecall: false,
        generateTitle: false,
        workingMemory: {
          enabled: false,
          template: '',
        },
      },
    });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<any | null> {
    return this.threads.get(threadId) ?? null;
  }

  async listThreads(args: any): Promise<any> {
    const resourceId = args?.filter?.resourceId;
    const metadataFilter = args?.filter?.metadata as Record<string, unknown> | undefined;
    const threads = [...this.threads.values()].filter((thread) => {
      if (resourceId && thread.resourceId !== resourceId) {
        return false;
      }
      if (!metadataFilter) {
        return true;
      }
      return Object.entries(metadataFilter).every(([key, value]) => thread.metadata?.[key] === value);
    });

    return {
      threads,
      total: threads.length,
      page: args?.page ?? 0,
      perPage: args?.perPage ?? false,
      hasMore: false,
    };
  }

  async saveThread({ thread }: { thread: any; memoryConfig?: any }): Promise<any> {
    const stored: StoredThread = {
      id: String(thread.id),
      resourceId: String(thread.resourceId ?? thread.id),
      ...(thread.title ? { title: String(thread.title) } : {}),
      ...(thread.metadata ? { metadata: thread.metadata as Record<string, unknown> } : {}),
      createdAt: toDate(thread.createdAt),
      updatedAt: toDate(thread.updatedAt),
    };
    this.threads.set(stored.id, stored);
    return stored;
  }

  async saveMessages(args: { messages: any[]; memoryConfig?: any }): Promise<{ messages: any[]; usage?: { tokens: number } }> {
    const saved = args.messages.map((message) => {
      const threadId = String(message.threadId);
      const stored: StoredMessage = {
        ...message,
        id: String(message.id),
        threadId,
        ...(message.resourceId ? { resourceId: String(message.resourceId) } : {}),
        createdAt: toDate(message.createdAt),
      };
      const bucket = this.messagesByThread.get(threadId) ?? [];
      bucket.push(stored);
      this.messagesByThread.set(threadId, bucket);
      return stored;
    });

    return {
      messages: saved,
    };
  }

  async recall(args: any): Promise<any> {
    const bucket = [...(this.messagesByThread.get(String(args.threadId)) ?? [])];
    return {
      messages: bucket,
      total: bucket.length,
      page: 0,
      perPage: false,
      hasMore: false,
    };
  }

  async deleteThread(threadId: string): Promise<void> {
    this.threads.delete(threadId);
    this.messagesByThread.delete(threadId);
    this.workingMemoryByThread.delete(threadId);
  }

  async getWorkingMemory({ threadId }: { threadId: string }): Promise<string | null> {
    return this.workingMemoryByThread.get(threadId) ?? null;
  }

  async getWorkingMemoryTemplate(): Promise<any | null> {
    return null;
  }

  async updateWorkingMemory({ threadId, workingMemory }: { threadId: string; workingMemory: string }): Promise<void> {
    this.workingMemoryByThread.set(threadId, workingMemory);
  }

  async __experimental_updateWorkingMemoryVNext(
    { threadId, workingMemory }: { threadId: string; workingMemory: string },
  ): Promise<{ success: boolean; reason: string }> {
    this.workingMemoryByThread.set(threadId, workingMemory);
    return {
      success: true,
      reason: 'updated',
    };
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    const idSet = new Set(messageIds.map((value) => String(value)));
    for (const [threadId, bucket] of this.messagesByThread.entries()) {
      this.messagesByThread.set(
        threadId,
        bucket.filter((message) => !idSet.has(message.id)),
      );
    }
  }

  async cloneThread(args: any): Promise<{ thread: any; clonedMessages: any[]; messageIdMap?: Record<string, string> }> {
    const sourceThreadId = String(args.sourceThreadId);
    const source = this.threads.get(sourceThreadId);
    if (!source) {
      throw new Error(`Thread ${sourceThreadId} not found`);
    }
    const clonedThreadId = String(args.newThreadId ?? `${sourceThreadId}-clone`);
    const clonedThread = {
      ...source,
      id: clonedThreadId,
      resourceId: String(args.resourceId ?? source.resourceId),
      ...(args.title ? { title: args.title } : {}),
      ...(args.metadata ? { metadata: args.metadata } : {}),
      updatedAt: new Date(),
    };
    this.threads.set(clonedThreadId, clonedThread);

    const sourceMessages = this.messagesByThread.get(sourceThreadId) ?? [];
    const messageIdMap: Record<string, string> = {};
    const clonedMessages = sourceMessages.map((message, index) => ({
      ...message,
      id: (messageIdMap[message.id] = `${message.id}-clone-${index}`),
      threadId: clonedThreadId,
      ...(args.resourceId ? { resourceId: args.resourceId } : {}),
      createdAt: new Date(),
    }));
    this.messagesByThread.set(clonedThreadId, clonedMessages);

    const workingMemory = this.workingMemoryByThread.get(sourceThreadId);
    if (workingMemory) {
      this.workingMemoryByThread.set(clonedThreadId, workingMemory);
    }

    return {
      thread: clonedThread,
      clonedMessages,
      messageIdMap,
    };
  }
}

let sharedMastraMemory: ShenbiMastraMemory | undefined;

export function getSharedMastraMemory(): ShenbiMastraMemory {
  if (!sharedMastraMemory) {
    sharedMastraMemory = new ShenbiMastraMemory();
  }
  return sharedMastraMemory;
}
