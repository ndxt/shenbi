export interface ParsedReActResponse {
  status?: string;
  reasoningSummary?: string;
  action: string;
  actionInput: Record<string, unknown>;
  rawActionInput: string;
}

const ACTIONS_WITH_OPTIONAL_INPUT = new Set([
  'listWorkspaceFiles',
  'getCurrentPageSchema',
  'getAvailableComponents',
]);

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function getLabelPattern(labels: string[]): string {
  return labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

function extractOptionalField(source: string, labels: string[]): string | undefined {
  const match = source.match(new RegExp(`(?:^|\\n)(?:${getLabelPattern(labels)})\\s*[:：]\\s*(.+)$`, 'im'));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

function extractActionFromLabels(source: string): string | undefined {
  const match = source.match(new RegExp(`(?:^|\\n)(?:${getLabelPattern(['Action', '动作'])})\\s*[:：]\\s*([^\\n]+)$`, 'im'));
  const action = match?.[1]?.trim();
  return action || undefined;
}

function extractActionInputTextFromLabels(source: string): string | undefined {
  const match = source.match(new RegExp(`(?:^|\\n)(?:${getLabelPattern(['Action Input', 'ActionInput', '动作输入'])})\\s*[:：]\\s*([\\s\\S]+)$`, 'im'));
  const raw = match?.[1]?.trim();
  return raw ? stripCodeFence(raw) : undefined;
}

function extractJSONObject(source: string): Record<string, unknown> | undefined {
  const candidates = [source, stripCodeFence(source)];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore and continue with other fallbacks.
    }
  }
  return undefined;
}

function extractWrappedText(source: string): string | undefined {
  const object = extractJSONObject(source);
  if (!object) {
    return undefined;
  }
  const wrapped = [
    object.answer,
    object.Answer,
    object.content,
    object.Content,
    object.output,
    object.Output,
    object.text,
    object.Text,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return wrapped?.trim();
}

function getObjectString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return undefined;
}

function extractNestedActionObject(object: Record<string, unknown>): Record<string, unknown> | undefined {
  const nested = [
    object.data,
    object.Data,
    object.payload,
    object.Payload,
  ].find((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value));
  return nested;
}

function extractFromJSONObject(source: string): ParsedReActResponse | undefined {
  const object = extractJSONObject(source);
  if (!object) {
    return undefined;
  }

  const nestedObject = extractNestedActionObject(object);
  if (nestedObject) {
    const nestedResult = extractFromJSONObject(JSON.stringify(nestedObject));
    if (nestedResult) {
      return nestedResult;
    }
  }

  const status = [
    object.status,
    object.Status,
    object['状态'],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const reasoningSummary = [
    object.reasoningSummary,
    object.reasoning_summary,
    object['Reasoning Summary'],
    object['原因摘要'],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const action = [
    object.action,
    object.Action,
    object.type === 'action' && typeof object.content === 'string' ? object.content : undefined,
    object.Type === 'action' && typeof object.content === 'string' ? object.content : undefined,
    object.type,
    object.Type,
    object.actionName,
    object.action_name,
    object['动作'],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (!action) {
    return undefined;
  }

  const actionInputValue = [
    object.actionInput,
    object.action_input,
    object.ActionInput,
    object['Action Input'],
    object.input,
    object.Input,
    object.params,
    object.Params,
    object.arguments,
    object.Arguments,
    object['动作输入'],
  ].find((value) => value !== undefined);
  if (actionInputValue === undefined) {
    if (!ACTIONS_WITH_OPTIONAL_INPUT.has(action.trim())) {
      return undefined;
    }
    return {
      ...(status ? { status } : {}),
      ...(reasoningSummary ? { reasoningSummary } : {}),
      action: action.trim(),
      actionInput: {},
      rawActionInput: '{}',
    };
  }

  const rawActionInput = getObjectString(actionInputValue);
  if (!rawActionInput) {
    return undefined;
  }

  let actionInput: Record<string, unknown>;
  try {
    actionInput = JSON.parse(rawActionInput) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid Action Input JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    ...(status ? { status } : {}),
    ...(reasoningSummary ? { reasoningSummary } : {}),
    action: action.trim(),
    actionInput,
    rawActionInput,
  };
}

export function parseReActResponse(source: string): ParsedReActResponse {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  const fromJson = extractFromJSONObject(normalized);
  if (fromJson) {
    return fromJson;
  }

  const wrappedText = extractWrappedText(normalized);
  if (wrappedText && wrappedText !== normalized) {
    return parseReActResponse(wrappedText);
  }

  const action = extractActionFromLabels(normalized);
  if (!action) {
    throw new Error('Missing Action field in ReAct response');
  }

  const status = extractOptionalField(normalized, ['Status', '状态']);
  const reasoningSummary = extractOptionalField(normalized, ['Reasoning Summary', '原因摘要']);
  const rawActionInput = extractActionInputTextFromLabels(normalized);
  if (!rawActionInput) {
    if (ACTIONS_WITH_OPTIONAL_INPUT.has(action.trim())) {
      return {
        ...(status ? { status } : {}),
        ...(reasoningSummary ? { reasoningSummary } : {}),
        action,
        actionInput: {},
        rawActionInput: '{}',
      };
    }
    throw new Error('Missing Action Input field in ReAct response');
  }
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
