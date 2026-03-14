import { beforeEach, describe, expect, it, vi } from 'vitest';

const extractRawTextMock = vi.hoisted(() => vi.fn());
const pdfGetTextMock = vi.hoisted(() => vi.fn());
const pdfDestroyMock = vi.hoisted(() => vi.fn());
const wordExtractMock = vi.hoisted(() => vi.fn());

vi.mock('mammoth', () => ({
  default: {
    extractRawText: extractRawTextMock,
  },
}));

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: pdfGetTextMock,
    destroy: pdfDestroyMock,
  })),
}));

vi.mock('word-extractor', () => ({
  default: class WordExtractor {
    extract(input: string | Buffer) {
      return wordExtractMock(input);
    }
  },
}));

import { buildUserMessageContent, prepareRunRequest } from './request-attachments.ts';

describe('request attachments', () => {
  beforeEach(() => {
    extractRawTextMock.mockReset();
    pdfGetTextMock.mockReset();
    pdfDestroyMock.mockReset();
    wordExtractMock.mockReset();
  });

  it('builds image-aware user content arrays for multimodal requests', () => {
    const content = buildUserMessageContent('Analyze this image', [
      {
        id: 'img-1',
        kind: 'image',
        name: 'wireframe.png',
        mimeType: 'image/png',
        sizeBytes: 128,
        dataUrl: 'data:image/png;base64,Zm9v',
      },
    ]);

    expect(content).toEqual([
      { type: 'text', text: 'Analyze this image' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,Zm9v',
        },
      },
    ]);
  });

  it('extracts document text into the effective prompt and keeps only image attachments for the model', async () => {
    extractRawTextMock.mockResolvedValue({
      value: 'Line 1\n\nLine 2',
    });

    const prepared = await prepareRunRequest({
      prompt: 'Please review the attachment',
      attachments: [
        {
          id: 'doc-1',
          kind: 'document',
          name: 'brief.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 256,
          dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,Zm9v',
        },
      ],
      context: {
        schemaSummary: 'page',
        componentSummary: 'Card',
      },
    });

    expect(prepared.prompt).toContain('Attached document excerpts:');
    expect(prepared.prompt).toContain('[Attached Document: brief.docx]');
    expect(prepared.prompt).toContain('Line 1');
    expect(prepared.attachments).toBeUndefined();
    expect(prepared._memoryAttachments).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        kind: 'document',
        extractedTextPreview: 'Line 1\n\nLine 2',
      }),
    ]);
  });
});
