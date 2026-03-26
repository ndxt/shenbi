import type { AgentMemoryAttachment } from '@shenbi/ai-agents';
import type { ProjectRunRequest, RunRequest } from '@shenbi/ai-contracts';

type RequestWithAttachments = (RunRequest | ProjectRunRequest) & {
  _memoryAttachments?: AgentMemoryAttachment[];
};

export interface DocumentKnowledgeChunk {
  id: string;
  conversationId: string;
  sessionId: string;
  attachmentId: string;
  attachmentName: string;
  attachmentKind: 'document';
  sectionTitle?: string;
  chunkIndex: number;
  text: string;
  evidenceSnippet?: string;
}

export interface DocumentKnowledgeHit extends DocumentKnowledgeChunk {
  score: number;
}

const headingPattern = /^(?:\d+(?:\.\d+)*[、.]?\s*)?[\u4e00-\u9fa5A-Za-z0-9_-]{2,32}$/u;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeChunkText(text: string): string {
  return normalizeWhitespace(text).slice(0, 1200);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5_-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function isHeading(paragraph: string): boolean {
  const singleLine = !paragraph.includes('\n');
  return singleLine && paragraph.length <= 32 && headingPattern.test(paragraph.trim());
}

function splitDocumentIntoChunks(text: string): Array<{ sectionTitle?: string; text: string }> {
  const paragraphs = normalizeWhitespace(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  const chunks: Array<{ sectionTitle?: string; text: string }> = [];
  let currentSectionTitle: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    chunks.push({
      ...(currentSectionTitle ? { sectionTitle: currentSectionTitle } : {}),
      text: normalizeChunkText(buffer.join('\n\n')),
    });
    buffer = [];
  };

  for (const paragraph of paragraphs) {
    if (isHeading(paragraph)) {
      flush();
      currentSectionTitle = paragraph;
      continue;
    }

    const lines = paragraph.split('\n').filter(Boolean);
    const hasEnumeratedLines = lines.length > 1 && lines.some((line) => /^(?:[（(]?\d+[)）]|[-*•]|\d+[.、])/.test(line.trim()));
    if (hasEnumeratedLines) {
      flush();
      for (const line of lines) {
        const normalizedLine = line.trim();
        if (!normalizedLine) {
          continue;
        }
        chunks.push({
          ...(currentSectionTitle ? { sectionTitle: currentSectionTitle } : {}),
          text: normalizeChunkText(normalizedLine),
        });
      }
      continue;
    }

    const nextText = buffer.length === 0 ? paragraph : `${buffer.join('\n\n')}\n\n${paragraph}`;
    if (nextText.length > 900) {
      flush();
      buffer.push(paragraph);
      continue;
    }
    buffer.push(paragraph);
  }

  flush();
  return chunks;
}

function buildChunkScore(chunk: DocumentKnowledgeChunk, query: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return 0;
  }
  const haystack = `${chunk.sectionTitle ?? ''}\n${chunk.text}`.toLowerCase();
  const chunkTokens = tokenize(haystack);
  const chunkTokenSet = new Set(chunkTokens);
  let score = 0;

  for (const token of queryTokens) {
    if (chunkTokenSet.has(token)) {
      score += token.length >= 4 ? 3 : 2;
    } else if (haystack.includes(token)) {
      score += 1;
    }
  }

  if (chunk.sectionTitle) {
    const title = chunk.sectionTitle.toLowerCase();
    for (const token of queryTokens) {
      if (title.includes(token)) {
        score += 2;
      }
    }
  }

  return score;
}

export function indexDocumentKnowledge(request: RequestWithAttachments): DocumentKnowledgeChunk[] {
  const attachments = Array.isArray(request._memoryAttachments) ? request._memoryAttachments : [];
  const documents = attachments.filter(
    (attachment): attachment is AgentMemoryAttachment & { kind: 'document'; extractedText: string } => (
      attachment.kind === 'document'
      && typeof attachment.extractedText === 'string'
      && attachment.extractedText.trim().length > 0
    ),
  );

  const conversationId = request.conversationId ?? 'unknown-conversation';
  const sessionId = conversationId;
  const chunks: DocumentKnowledgeChunk[] = [];

  for (const attachment of documents) {
    const splitChunks = splitDocumentIntoChunks(attachment.extractedText);
    splitChunks.forEach((chunk, index) => {
      chunks.push({
        id: `${conversationId}:${attachment.id}:${index}`,
        conversationId,
        sessionId,
        attachmentId: attachment.id,
        attachmentName: attachment.name,
        attachmentKind: 'document',
        ...(chunk.sectionTitle ? { sectionTitle: chunk.sectionTitle } : {}),
        chunkIndex: index,
        text: chunk.text,
        ...(attachment.evidenceSnippets?.[index] ? { evidenceSnippet: attachment.evidenceSnippets[index] } : {}),
      });
    });
  }

  return chunks;
}

export function retrieveDocumentKnowledge(
  chunks: DocumentKnowledgeChunk[],
  query: string,
  limit = 4,
): DocumentKnowledgeHit[] {
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: buildChunkScore(chunk, query),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score || left.chunkIndex - right.chunkIndex)
    .slice(0, limit);
}

export function formatDocumentKnowledgeHits(hits: DocumentKnowledgeHit[]): string {
  if (hits.length === 0) {
    return 'none';
  }
  return hits.map((hit) => [
    `[${hit.id}]`,
    `Attachment: ${hit.attachmentName}`,
    ...(hit.sectionTitle ? [`Section: ${hit.sectionTitle}`] : []),
    `Excerpt: ${hit.text}`,
  ].join('\n')).join('\n\n');
}

export function bindEvidenceSourceIds(
  evidence: string | undefined,
  hits: DocumentKnowledgeHit[],
): string[] | undefined {
  if (!evidence || hits.length === 0) {
    return undefined;
  }
  const evidenceTokens = new Set(tokenize(evidence));
  const matched = hits
    .map((hit) => {
      const text = hit.text.toLowerCase();
      const overlap = Array.from(evidenceTokens).reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
      return { id: hit.id, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, 2)
    .map((entry) => entry.id);

  return matched.length > 0 ? matched : hits.slice(0, 1).map((hit) => hit.id);
}
