import { describe, expect, it } from 'vitest';
import { validateChatRequest, validateFinalizeRequest, validateRunRequest } from './validate.ts';

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

  it('accepts supported attachments', () => {
    const request = validateRunRequest({
      prompt: 'look at this image',
      attachments: [
        {
          id: 'img-1',
          kind: 'image',
          name: 'wireframe.png',
          mimeType: 'image/png',
          sizeBytes: 128,
          dataUrl: 'data:image/png;base64,Zm9v',
        },
        {
          id: 'doc-1',
          kind: 'document',
          name: 'brief.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 256,
          dataUrl: 'data:application/pdf;base64,Zm9v',
        },
      ],
      context: {
        schemaSummary: 'pageId=page-1',
        componentSummary: 'Card',
      },
    });

    expect(request.attachments).toHaveLength(2);
    expect(request.attachments?.[0]?.kind).toBe('image');
    expect(request.attachments?.[1]?.kind).toBe('document');
  });

  it('rejects unsupported attachment mime types', () => {
    expect(() => validateRunRequest({
      prompt: 'modify page',
      attachments: [
        {
          id: 'file-1',
          kind: 'document',
          name: 'brief.txt',
          mimeType: 'text/plain',
          sizeBytes: 128,
          dataUrl: 'data:text/plain;base64,Zm9v',
        },
      ],
      context: {
        schemaSummary: 'pageId=page-1',
        componentSummary: 'Card',
      },
    })).toThrow(/mimeType/i);
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

describe('validateChatRequest', () => {
  it('accepts chat payloads with optional thinking and stream', () => {
    expect(validateChatRequest({
      model: 'openai-compatible::glm-4.6',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Summarize this request.' },
      ],
      thinking: { type: 'enabled' },
      stream: true,
      maxTokens: 512,
    })).toEqual({
      model: 'openai-compatible::glm-4.6',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Summarize this request.' },
      ],
      thinking: { type: 'enabled' },
      stream: true,
      maxTokens: 512,
    });
  });

  it('rejects invalid roles and empty content', () => {
    expect(() => validateChatRequest({
      model: 'foo',
      messages: [{ role: 'tool', content: 'x' }],
    })).toThrow(/role/i);

    expect(() => validateChatRequest({
      model: 'foo',
      messages: [{ role: 'user', content: '' }],
    })).toThrow(/content/i);
  });
});
