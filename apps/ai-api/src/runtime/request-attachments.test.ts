import { beforeEach, describe, expect, it, vi } from 'vitest';

const extractRawTextMock = vi.hoisted(() => vi.fn());
const pdfGetTextMock = vi.hoisted(() => vi.fn());
const pdfDestroyMock = vi.hoisted(() => vi.fn());
const wordExtractMock = vi.hoisted(() => vi.fn());

vi.mock('mammoth', () => ({
  extractRawText: extractRawTextMock,
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
      value: '看板\n\n分成左上、左下、右侧三个区域：\n（1）左上：全年统计看板：会议数、事项数、完成数、逾期数；\n（2）左下：人员看板，显示所有责任人的事项总数、未完成数、逾期数；\n（3）右侧：最新动态。',
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
    expect(prepared.prompt).toContain('看板');
    expect(prepared.prompt).toContain('[Preferred evidence snippets]');
    expect(prepared.prompt).toContain('Snippet 1:');
    expect(prepared.prompt).toContain('（1）左上：全年统计看板：会议数、事项数、完成数、逾期数；');
    expect(prepared.attachments).toBeUndefined();
    expect(prepared._memoryAttachments).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        kind: 'document',
        extractedTextPreview: expect.stringContaining('看板'),
        extractedText: expect.stringContaining('全年统计看板'),
        evidenceSnippets: expect.arrayContaining([
          expect.stringContaining('（1）左上：全年统计看板'),
        ]),
      }),
    ]);
  });
});
