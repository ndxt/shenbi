import { describe, expect, it } from 'vitest';
import { validateFinalizeRequest, validateRunRequest } from './validate.ts';

describe('validateRunRequest', () => {
  it('preserves optional schemaJson and workspaceFileIds', () => {
    const request = validateRunRequest({
      prompt: 'modify page',
      intent: 'schema.modify',
      context: {
        schemaSummary: 'pageId=page-1',
        componentSummary: 'Card',
        schemaJson: {
          id: 'page-1',
          body: [{ id: 'card-1', component: 'Card' }],
        },
        workspaceFileIds: ['page-1.json', 'shared.ts'],
      },
    });

    expect(request.context.schemaJson).toEqual({
      id: 'page-1',
      body: [{ id: 'card-1', component: 'Card' }],
    });
    expect(request.context.workspaceFileIds).toEqual(['page-1.json', 'shared.ts']);
    expect(request.intent).toBe('schema.modify');
  });

  it('rejects invalid schemaJson payloads', () => {
    expect(() => validateRunRequest({
      prompt: 'modify page',
      context: {
        schemaSummary: 'pageId=page-1',
        componentSummary: 'Card',
        schemaJson: { id: 'page-1', body: 'invalid' },
      },
    })).toThrow(/schemaJson/i);
  });

  it('rejects non-string workspaceFileIds entries', () => {
    expect(() => validateRunRequest({
      prompt: 'modify page',
      context: {
        schemaSummary: 'pageId=page-1',
        componentSummary: 'Card',
        workspaceFileIds: ['page-1.json', 1],
      },
    })).toThrow(/workspaceFileIds/i);
  });

  it('rejects invalid intent values', () => {
    expect(() => validateRunRequest({
      prompt: 'modify page',
      intent: 'modify',
      context: {
        schemaSummary: 'pageId=page-1',
        componentSummary: 'Card',
      },
    })).toThrow(/intent/i);
  });
});

describe('validateFinalizeRequest', () => {
  it('accepts finalize payloads', () => {
    expect(validateFinalizeRequest({
      conversationId: 'conv-1',
      sessionId: 'session-1',
      success: false,
      failedOpIndex: 2,
      error: 'node not found',
      schemaDigest: 'fnv1a-12345678',
    })).toEqual({
      conversationId: 'conv-1',
      sessionId: 'session-1',
      success: false,
      failedOpIndex: 2,
      error: 'node not found',
      schemaDigest: 'fnv1a-12345678',
    });
  });

  it('rejects invalid failedOpIndex', () => {
    expect(() => validateFinalizeRequest({
      conversationId: 'conv-1',
      sessionId: 'session-1',
      success: false,
      failedOpIndex: -1,
    })).toThrow(/failedOpIndex/i);
  });
});
