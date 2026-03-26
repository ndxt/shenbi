import { MockMemory } from '@mastra/core/memory';

let sharedMastraMemory: MockMemory | undefined;

export function getSharedMastraMemory(): MockMemory {
  if (!sharedMastraMemory) {
    sharedMastraMemory = new MockMemory({
      enableMessageHistory: true,
      enableWorkingMemory: false,
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
  return sharedMastraMemory;
}
