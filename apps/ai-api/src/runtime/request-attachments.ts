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
