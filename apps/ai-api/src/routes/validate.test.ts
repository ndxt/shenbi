import { describe, expect, it } from 'vitest';
import { validateRunRequest } from './validate.ts';

describe('validateRunRequest', () => {
  it('preserves optional schemaJson and workspaceFileIds', () => {
    const request = validateRunRequest({
      prompt: 'modify page',
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
});
