import type { AgentMemoryAttachment } from '@shenbi/ai-agents';
import type { RunAttachmentInput, RunRequest } from '@shenbi/ai-contracts';
import { ValidationError } from '../adapters/errors.ts';
import type { OpenAICompatibleContentPart, OpenAICompatibleMessage } from '../adapters/openai-compatible.ts';

const MAX_DOCUMENT_TEXT_CHARS = 12_000;
const MAX_DOCUMENT_PREVIEW_CHARS = 600;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

type PreparedRunRequest = RunRequest & {
  _originalPrompt?: string;
  _memoryAttachments?: AgentMemoryAttachment[];
};

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new ValidationError('attachment.dataUrl must be a base64 data URL');
  }
  return {
    mimeType: match[1]!,
    buffer: Buffer.from(match[2]!, 'base64'),
  };
}

const MAX_SHEET_ROWS = 200;
const MAX_SHEET_COLS = 12;

function cellValueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

async function extractSpreadsheetText(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: true });
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      range: 0,
    }) as string[][];

    if (rows.length === 0) continue;

    // Cap columns and rows
    const colCount = Math.min(Math.max(...rows.map((r) => r.length), 0), MAX_SHEET_COLS);
    const dataRows = rows.slice(0, MAX_SHEET_ROWS);

    if (colCount === 0) continue;

    const header = dataRows[0]?.slice(0, colCount).map((cell) => cellValueToString(cell)) ?? [];
    const separator = header.map(() => '---');
    const body = dataRows.slice(1).map((row) =>
      row.slice(0, colCount).map((cell) => cellValueToString(cell))
    );

    const tableLines = [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...body.map((row) => `| ${row.join(' | ')} |`),
    ];

    if (rows.length > MAX_SHEET_ROWS) {
      tableLines.push(`... (${rows.length - MAX_SHEET_ROWS} more rows omitted)`);
    }
    if (colCount < Math.max(...rows.map((r) => r.length), 0)) {
      tableLines.push(`... (some columns omitted, max ${MAX_SHEET_COLS} shown)`);
    }

    sections.push(`[Sheet: ${sheetName}]\n${tableLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

async function extractDocumentText(attachment: RunAttachmentInput): Promise<string> {
  const { mimeType, buffer } = parseDataUrl(attachment.dataUrl);
  if (mimeType !== attachment.mimeType) {
    throw new ValidationError(`attachment "${attachment.name}" mimeType does not match dataUrl`);
  }

  if (attachment.mimeType === 'application/pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return normalizeWhitespace(result.text ?? '');
    } finally {
      await parser.destroy();
    }
  }

  if (attachment.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(result.value ?? '');
  }

  if (attachment.mimeType === 'application/msword') {
    const { default: WordExtractor } = await import('word-extractor');
    const wordExtractor = new WordExtractor();
    const document = await wordExtractor.extract(buffer);
    return normalizeWhitespace(document.getBody());
  }

  if (
    attachment.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || attachment.mimeType === 'application/vnd.ms-excel'
  ) {
    return extractSpreadsheetText(buffer);
  }

  throw new ValidationError(`Unsupported document mimeType: ${attachment.mimeType}`);
}

function buildDocumentSection(attachment: RunAttachmentInput, extractedText: string): string {
  return [
    `[Attached Document: ${attachment.name}]`,
    truncateText(extractedText, MAX_DOCUMENT_TEXT_CHARS),
  ].join('\n');
}

function buildImageContentParts(attachments: RunAttachmentInput[]): OpenAICompatibleContentPart[] {
  return attachments.map((attachment) => ({
    type: 'image_url',
    image_url: {
      url: attachment.dataUrl,
    },
  }));
}

export function buildUserMessageContent(
  text: string,
  attachments: RunAttachmentInput[] | undefined,
): OpenAICompatibleMessage['content'] {
  const imageAttachments = (attachments ?? []).filter((attachment) => attachment.kind === 'image');
  if (imageAttachments.length === 0) {
    return text;
  }
  return [
    { type: 'text', text },
    ...buildImageContentParts(imageAttachments),
  ];
}

export function buildUserMessageContentFromLines(
  lines: string[],
  attachments: RunAttachmentInput[] | undefined,
): OpenAICompatibleMessage['content'] {
  return buildUserMessageContent(lines.join('\n'), attachments);
}

export async function prepareRunRequest(request: RunRequest): Promise<PreparedRunRequest> {
  if (!request.attachments || request.attachments.length === 0) {
    return request as PreparedRunRequest;
  }

  const memoryAttachments: AgentMemoryAttachment[] = [];
  const imageAttachments: RunAttachmentInput[] = [];
  const documentSections: string[] = [];

  for (const attachment of request.attachments) {
    if (attachment.kind === 'image') {
      imageAttachments.push(attachment);
      memoryAttachments.push({
        id: attachment.id,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      });
      continue;
    }

    const extractedText = await extractDocumentText(attachment);
    if (!extractedText) {
      throw new ValidationError(`Failed to extract usable text from "${attachment.name}"`);
    }

    documentSections.push(buildDocumentSection(attachment, extractedText));
    memoryAttachments.push({
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      extractedTextPreview: truncateText(extractedText, MAX_DOCUMENT_PREVIEW_CHARS),
    });
  }

  const effectivePrompt = documentSections.length > 0
    ? [
      request.prompt,
      'Attached document excerpts:',
      ...documentSections,
    ].join('\n\n')
    : request.prompt;
  const { attachments: _attachments, ...restRequest } = request;

  return {
    ...restRequest,
    prompt: effectivePrompt,
    ...(imageAttachments.length > 0 ? { attachments: imageAttachments } : {}),
    _originalPrompt: request.prompt,
    ...(memoryAttachments.length > 0 ? { _memoryAttachments: memoryAttachments } : {}),
  };
}
