export interface ParsedReActResponse {
  status?: string;
  reasoningSummary?: string;
  action: string;
  actionInput: Record<string, unknown>;
  rawActionInput: string;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function extractOptionalField(source: string, label: 'Status' | 'Reasoning Summary'): string | undefined {
  const match = source.match(new RegExp(`(?:^|\\n)${label}:\\s*(.+)$`, 'm'));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

function extractAction(source: string): string {
  const match = source.match(/(?:^|\n)Action:\s*([^\n]+)$/m);
  const action = match?.[1]?.trim();
  if (!action) {
    throw new Error('Missing Action field in ReAct response');
  }
  return action;
}

function extractActionInputText(source: string): string {
  const match = source.match(/(?:^|\n)Action Input:\s*([\s\S]+)$/m);
  const raw = match?.[1]?.trim();
  if (!raw) {
    throw new Error('Missing Action Input field in ReAct response');
  }
  return stripCodeFence(raw);
}

export function parseReActResponse(source: string): ParsedReActResponse {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  const action = extractAction(normalized);
  const rawActionInput = extractActionInputText(normalized);
  const status = extractOptionalField(normalized, 'Status');
  const reasoningSummary = extractOptionalField(normalized, 'Reasoning Summary');
  let actionInput: Record<string, unknown>;

  try {
    actionInput = JSON.parse(rawActionInput) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid Action Input JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    ...(status ? { status } : {}),
    ...(reasoningSummary ? { reasoningSummary } : {}),
    action,
    actionInput,
    rawActionInput,
  };
}
