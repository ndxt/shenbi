import React, { useEffect, useMemo, useState } from 'react';
import type { ActionChain, ComponentContract, ContractProp, SchemaNode } from '@shenbi/schema';
import { Code, GripVertical, Link2, Plus } from 'lucide-react';

export interface SetterPanelProps {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
  onPatchStyle?: (patch: Record<string, unknown>) => void;
  onPatchEvents?: (patch: Record<string, unknown>) => void;
  onPatchLogic?: (patch: Record<string, unknown>) => void;
  activeTab?: 'props' | 'style' | 'events' | 'logic';
}

export function SetterPanel({
  selectedNode,
  contract,
  onPatchProps,
  onPatchStyle,
  onPatchEvents,
  onPatchLogic,
  activeTab = 'props',
}: SetterPanelProps) {
  if (activeTab === 'props') {
    return (
      <PropsSetter
        {...(selectedNode ? { selectedNode } : {})}
        {...(contract ? { contract } : {})}
        {...(onPatchProps ? { onPatchProps } : {})}
      />
    );
  }
  if (activeTab === 'style') {
    return (
      <StyleSetter
        {...(selectedNode ? { selectedNode } : {})}
        {...(onPatchStyle ? { onPatchStyle } : {})}
      />
    );
  }
  if (activeTab === 'events') {
    return (
      <EventSetter
        {...(selectedNode ? { selectedNode } : {})}
        {...(onPatchEvents ? { onPatchEvents } : {})}
      />
    );
  }
  if (activeTab === 'logic') {
    return (
      <LogicSetter
        {...(selectedNode ? { selectedNode } : {})}
        {...(onPatchLogic ? { onPatchLogic } : {})}
      />
    );
  }

  return null;
}

function formatValue(value: unknown, fallback: unknown): string {
  const candidate = value ?? fallback;
  if (candidate === undefined) {
    return '';
  }
  if (typeof candidate === 'string') {
    return candidate;
  }
  try {
    return JSON.stringify(candidate);
  } catch {
    return String(candidate);
  }
}

function isExpressionLiteral(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith('{{') && trimmed.endsWith('}}');
}

function parseValueByContractType(raw: unknown, contractProp: ContractProp): unknown {
  if (typeof raw === 'string' && contractProp.allowExpression && isExpressionLiteral(raw)) {
    return raw;
  }
  if (contractProp.type === 'boolean') {
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'string') {
      return raw.trim().toLowerCase() === 'true';
    }
    return Boolean(raw);
  }
  if (contractProp.type === 'number') {
    if (typeof raw === 'number') {
      return raw;
    }
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? raw : parsed;
    }
    return raw;
  }
  if (contractProp.type === 'object' || contractProp.type === 'array') {
    if (typeof raw !== 'string') {
      return raw;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return trimmed;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error(contractProp.type === 'array' ? '属性值必须是数组 JSON' : '属性值必须是对象 JSON');
    }
    if (contractProp.type === 'array' && !Array.isArray(parsed)) {
      throw new Error('属性值必须是数组 JSON');
    }
    if (contractProp.type === 'object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
      throw new Error('属性值必须是对象 JSON');
    }
    return parsed;
  }
  if (contractProp.type === 'any' && typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return trimmed;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return raw;
      }
    }
  }
  return raw;
}

type PropControlType = 'input' | 'select' | 'number' | 'checkbox' | 'textarea';
type PropEntry = [string, ContractProp];

function resolvePropControlType(contractProp: ContractProp, currentValue: unknown): PropControlType {
  if (
    contractProp.allowExpression
    && typeof currentValue === 'string'
    && isExpressionLiteral(currentValue)
  ) {
    return 'input';
  }
  if (contractProp.type === 'enum' && Array.isArray(contractProp.enum) && contractProp.enum.length > 0) {
    return 'select';
  }
  if (contractProp.type === 'boolean') {
    return 'checkbox';
  }
  if (contractProp.type === 'number') {
    return 'number';
  }
  if (contractProp.type === 'object' || contractProp.type === 'array') {
    return 'textarea';
  }
  return 'input';
}

function isStructuredContractType(contractProp: ContractProp): boolean {
  return (
    contractProp.type === 'object'
    || contractProp.type === 'array'
    || contractProp.type === 'any'
    || contractProp.type === 'function'
    || contractProp.type === 'SchemaNode'
    || contractProp.type === 'Expression'
  );
}

function parsePropsPatch(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('props 必须是对象 JSON');
  }
  return parsed as Record<string, unknown>;
}

interface PropsSetterProps {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
}

function PropsSetter({ selectedNode, contract, onPatchProps }: PropsSetterProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [showPropsJson, setShowPropsJson] = useState(false);
  const [propsJsonDraft, setPropsJsonDraft] = useState('{}');
  const [propsJsonError, setPropsJsonError] = useState<string | undefined>(undefined);
  const propsRecord = contract?.props ?? {};

  useEffect(() => {
    setDrafts({});
    setErrors({});
    setShowPropsJson(false);
  }, [selectedNode?.id, contract?.componentType]);

  useEffect(() => {
    setPropsJsonDraft(formatJsonValue(selectedNode?.props ?? {}));
    setPropsJsonError(undefined);
  }, [selectedNode?.id, selectedNode?.props, contract?.componentType]);

  const sortedPropEntries = useMemo(
    () =>
      Object.entries(propsRecord).sort((a, b) => {
        const aRequired = a[1].required ? 0 : 1;
        const bRequired = b[1].required ? 0 : 1;
        if (aRequired !== bRequired) {
          return aRequired - bRequired;
        }
        return a[0].localeCompare(b[0]);
      }),
    [propsRecord],
  );

  const groupedPropEntries = useMemo(() => {
    const basic: PropEntry[] = [];
    const structured: PropEntry[] = [];
    for (const entry of sortedPropEntries) {
      const [, propMeta] = entry;
      if (isStructuredContractType(propMeta)) {
        structured.push(entry);
      } else {
        basic.push(entry);
      }
    }
    return { basic, structured };
  }, [sortedPropEntries]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        请先在组件树中选择一个节点。
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        当前组件 `{selectedNode.component}` 暂无契约，请先补充 contracts。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3 text-text-primary">
      <SetterGroup title="当前节点">
        <div className="text-[12px] text-text-secondary break-all">
          <div>组件：{selectedNode.component}</div>
          {selectedNode.id ? <div>ID：{selectedNode.id}</div> : null}
        </div>
      </SetterGroup>

      <SetterGroup title="契约属性">
        {sortedPropEntries.length === 0 ? (
          <div className="text-[12px] text-text-secondary">该组件未声明 props。</div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedPropEntries.basic.length > 0 ? (
              <PropsGroup
                title="基础属性"
                entries={groupedPropEntries.basic}
                selectedNode={selectedNode}
                drafts={drafts}
                errors={errors}
                onChangeDraft={(propName, next) => {
                  setDrafts((prev) => ({ ...prev, [propName]: next }));
                }}
                onCommit={(propName, propMeta, next) => {
                  try {
                    onPatchProps?.({
                      [propName]: parseValueByContractType(next, propMeta),
                    });
                    setErrors((prev) => ({ ...prev, [propName]: undefined }));
                  } catch (err) {
                    const message = err instanceof Error ? err.message : '属性解析失败';
                    setErrors((prev) => ({ ...prev, [propName]: message }));
                  }
                }}
              />
            ) : null}

            {groupedPropEntries.structured.length > 0 ? (
              <PropsGroup
                title="结构属性"
                entries={groupedPropEntries.structured}
                selectedNode={selectedNode}
                drafts={drafts}
                errors={errors}
                onChangeDraft={(propName, next) => {
                  setDrafts((prev) => ({ ...prev, [propName]: next }));
                }}
                onCommit={(propName, propMeta, next) => {
                  try {
                    onPatchProps?.({
                      [propName]: parseValueByContractType(next, propMeta),
                    });
                    setErrors((prev) => ({ ...prev, [propName]: undefined }));
                  } catch (err) {
                    const message = err instanceof Error ? err.message : '属性解析失败';
                    setErrors((prev) => ({ ...prev, [propName]: message }));
                  }
                }}
              />
            ) : null}
          </div>
        )}
      </SetterGroup>

      <SetterGroup title="高级属性">
        <button
          type="button"
          onClick={() => setShowPropsJson((prev) => !prev)}
          className="w-full text-[12px] text-text-secondary border border-dashed border-border-ide p-3 rounded text-center flex items-center justify-center gap-2 cursor-pointer hover:bg-bg-activity-bar transition-colors"
        >
          <Code size={14} />
          <span>{showPropsJson ? '收起 JSON 视图' : '打开 JSON 视图'}</span>
        </button>
        {showPropsJson ? (
          <div className="flex flex-col gap-2">
            <textarea
              aria-label="props json"
              value={propsJsonDraft}
              onChange={(event) => setPropsJsonDraft(event.target.value)}
              onBlur={(event) => {
                try {
                  const patch = parsePropsPatch(event.target.value);
                  onPatchProps?.(patch);
                  setPropsJsonError(undefined);
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'props JSON 解析失败';
                  setPropsJsonError(message);
                }
              }}
              className="w-full min-h-[140px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-blue-500"
            />
            {propsJsonError ? <div className="text-[11px] text-red-400">{propsJsonError}</div> : null}
            <div className="text-[11px] text-text-secondary">
              用于批量编辑 props。失焦后按对象 patch 回写。
            </div>
          </div>
        ) : null}
      </SetterGroup>
    </div>
  );
}

interface PropsGroupProps {
  title: string;
  entries: PropEntry[];
  selectedNode: SchemaNode;
  drafts: Record<string, string>;
  errors: Record<string, string | undefined>;
  onChangeDraft: (propName: string, next: string) => void;
  onCommit: (propName: string, propMeta: ContractProp, next: unknown) => void;
}

function PropsGroup({
  title,
  entries,
  selectedNode,
  drafts,
  errors,
  onChangeDraft,
  onCommit,
}: PropsGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-semibold text-text-secondary">{title}</div>
      <div className="flex flex-col gap-2">
        {entries.map(([propName, propMeta]) => {
          const currentValue = selectedNode.props?.[propName] ?? propMeta.default;
          const controlType = resolvePropControlType(propMeta, currentValue);
          const rawValue = drafts[propName] ?? formatValue(currentValue, propMeta.default);
          const enumOptions = Array.isArray(propMeta.enum)
            ? propMeta.enum.map((item) => String(item))
            : [];
          const error = errors[propName];

          return (
            <div key={propName} className="flex flex-col gap-1">
              <PropertyField
                label={propName}
                value={controlType === 'checkbox' ? Boolean(currentValue) : rawValue}
                isExpression={Boolean(propMeta.allowExpression)}
                controlType={controlType}
                options={enumOptions}
                {...(propMeta.description ? { description: propMeta.description } : {})}
                {...(propMeta.required ? { required: true } : {})}
                onChange={(next) => {
                  if (typeof next === 'string') {
                    onChangeDraft(propName, next);
                  }
                }}
                onCommit={(next) => onCommit(propName, propMeta, next)}
              />
              {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StyleSetterProps {
  selectedNode?: SchemaNode;
  onPatchStyle?: (patch: Record<string, unknown>) => void;
}

function formatJsonValue(value: unknown): string {
  if (value == null) {
    return '{}';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function parseStyleValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (isExpressionLiteral(trimmed)) {
    return trimmed;
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('style 必须是对象 JSON 或表达式字符串');
  }
  return parsed;
}

function StyleSetter({ selectedNode, onPatchStyle }: StyleSetterProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(formatJsonValue(selectedNode?.style));
    setError(undefined);
  }, [selectedNode?.id, selectedNode?.style]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        请先在组件树或画布中选择一个节点。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3 text-text-primary">
      <SetterGroup title="Style JSON">
        <textarea
          aria-label="style json"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            try {
              const nextStyle = parseStyleValue(event.target.value);
              onPatchStyle?.({ style: nextStyle });
              setError(undefined);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'style JSON 解析失败';
              setError(message);
            }
          }}
          className="w-full min-h-[140px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-blue-500"
        />
        {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
        <div className="text-[11px] text-text-secondary">
          支持对象 JSON（如 <code>{'{ "display": "none" }'}</code>）或表达式字符串（如 <code>{'{{state.dynamicStyle}}'}</code>）。
        </div>
      </SetterGroup>
    </div>
  );
}

interface EventSetterProps {
  selectedNode?: SchemaNode;
  onPatchEvents?: (patch: Record<string, unknown>) => void;
}

function formatActions(actions: unknown): string {
  if (!actions) {
    return '[]';
  }
  try {
    return JSON.stringify(actions, null, 2);
  } catch {
    return '[]';
  }
}

function parseActionChain(raw: string): ActionChain {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('事件动作必须是数组');
  }
  return parsed as ActionChain;
}

function EventSetter({ selectedNode, onPatchEvents }: EventSetterProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errorByEvent, setErrorByEvent] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    setDrafts({});
    setErrorByEvent({});
  }, [selectedNode?.id, selectedNode?.component]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        请先在组件树或画布中选择一个节点。
      </div>
    );
  }

  const eventRecord = selectedNode.events ?? {};
  const eventEntries = Object.entries(eventRecord).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-col gap-3 p-3 text-text-primary">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-bold text-text-secondary uppercase">已绑定事件</span>
        <button
          className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-600 transition-colors"
          onClick={() => {
            if (eventRecord.onClick) {
              return;
            }
            onPatchEvents?.({ onClick: [] });
          }}
        >
          <Plus size={10} /> 新增
        </button>
      </div>

      {eventEntries.length === 0 ? (
        <div className="text-[12px] text-text-secondary border border-dashed border-border-ide rounded p-3">
          当前节点暂无事件。点击“新增”可先添加 `onClick`。
        </div>
      ) : null}

      {eventEntries.map(([eventName, actions]) => {
        const rawValue = drafts[eventName] ?? formatActions(actions);
        const error = errorByEvent[eventName];
        return (
          <div key={eventName} className="border border-border-ide rounded bg-bg-canvas overflow-hidden">
            <div className="flex justify-between items-center bg-bg-activity-bar px-2 py-1.5 border-b border-border-ide">
              <span className="text-[12px] font-semibold text-blue-400">{eventName}</span>
              <span className="text-[10px] text-text-secondary">
                {Array.isArray(actions) ? `${actions.length}个动作` : '1个动作'}
              </span>
            </div>
            <div className="p-2 flex flex-col gap-2">
              <textarea
                aria-label={`${eventName} actions`}
                value={rawValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDrafts((prev) => ({ ...prev, [eventName]: nextValue }));
                }}
                onBlur={(event) => {
                  try {
                    const nextChain = parseActionChain(event.target.value);
                    onPatchEvents?.({ [eventName]: nextChain });
                    setErrorByEvent((prev) => ({ ...prev, [eventName]: undefined }));
                  } catch (error) {
                    const message = error instanceof Error ? error.message : '事件 JSON 解析失败';
                    setErrorByEvent((prev) => ({ ...prev, [eventName]: message }));
                  }
                }}
                className="w-full min-h-[104px] bg-bg-sidebar border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-blue-500"
              />
              {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
              <div className="flex items-center gap-2 text-[11px] text-text-secondary bg-bg-sidebar p-1.5 rounded border border-border-ide border-dashed">
                <GripVertical size={12} className="text-text-secondary" />
                <div className="flex-1 truncate">支持直接编辑 ActionChain JSON，失焦后自动回写。</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface LogicSetterProps {
  selectedNode?: SchemaNode;
  onPatchLogic?: (patch: Record<string, unknown>) => void;
}

function parseLogicPatch(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('logic 必须是对象 JSON');
  }
  const source = parsed as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of ['if', 'show', 'loop']) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }
  return result;
}

function formatLogicValue(node: SchemaNode | undefined): string {
  if (!node) {
    return '{}';
  }
  const payload: Record<string, unknown> = {};
  if (node.if !== undefined) {
    payload.if = node.if;
  }
  if (node.show !== undefined) {
    payload.show = node.show;
  }
  if (node.loop !== undefined) {
    payload.loop = node.loop;
  }
  return JSON.stringify(payload, null, 2);
}

function LogicSetter({ selectedNode, onPatchLogic }: LogicSetterProps) {
  const [draft, setDraft] = useState('{}');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(formatLogicValue(selectedNode));
    setError(undefined);
  }, [selectedNode?.id, selectedNode?.if, selectedNode?.show, selectedNode?.loop]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        请先在组件树或画布中选择一个节点。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3 text-text-primary">
      <SetterGroup title="Logic JSON">
        <textarea
          aria-label="logic json"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            try {
              const patch = parseLogicPatch(event.target.value);
              onPatchLogic?.(patch);
              setError(undefined);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'logic JSON 解析失败';
              setError(message);
            }
          }}
          className="w-full min-h-[140px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-blue-500"
        />
        {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
        <div className="text-[11px] text-text-secondary">
          可编辑字段：`if` / `show` / `loop`。删除逻辑可把字段设置为 `null`。
        </div>
      </SetterGroup>
    </div>
  );
}

function SetterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold text-text-secondary uppercase mb-2">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

interface PropertyFieldProps {
  label: string;
  value: string | boolean;
  controlType?: PropControlType;
  options?: string[];
  isColor?: boolean;
  isExpression?: boolean;
  required?: boolean;
  description?: string;
  onChange?: (next: unknown) => void;
  onCommit?: (next: unknown) => void;
}

function PropertyField({
  label,
  value,
  controlType = 'input',
  options = [],
  isColor = false,
  isExpression = false,
  required = false,
  description,
  onChange,
  onCommit,
}: PropertyFieldProps) {
  const inputId = `setter-${label}`;
  const displayValue = typeof value === 'boolean' ? String(value) : value;
  const selectOptions = options.includes(displayValue) || !displayValue
    ? options
    : [displayValue, ...options];
  return (
    <div className="flex flex-col">
      <label
        htmlFor={inputId}
        className="text-[10px] text-text-secondary uppercase block mb-1 flex justify-between items-center whitespace-nowrap overflow-hidden"
      >
        <span className="truncate">
          {label}
          {required ? ' *' : ''}
        </span>
        {isExpression ? (
          <span className="bg-yellow-500/20 text-yellow-500 rounded px-1 flex items-center gap-0.5 ml-2 shrink-0">
            <Link2 size={10} />
            <span className="text-[9px]">表达式</span>
          </span>
        ) : null}
      </label>
      <div className="flex items-center gap-2 group relative">
        {isColor ? (
          <div
            className="w-4 h-4 rounded-sm border border-border-ide shrink-0"
            style={{ backgroundColor: displayValue }}
          />
        ) : null}

        {controlType === 'checkbox' ? (
          <input
            id={inputId}
            aria-label={label}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => {
              onChange?.(event.target.checked);
              onCommit?.(event.target.checked);
            }}
            className="size-4 accent-blue-500"
          />
        ) : null}

        {controlType === 'input' ? (
          <input
            id={inputId}
            aria-label={label}
            value={displayValue}
            onChange={(event) => onChange?.(event.target.value)}
            onBlur={(event) => onCommit?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onCommit?.((event.target as HTMLInputElement).value);
              }
            }}
            className={`flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500 w-full min-w-0 ${
              isExpression ? 'font-mono text-yellow-400 border-yellow-500/50 bg-yellow-500/5' : ''
            }`}
          />
        ) : null}

        {controlType === 'number' ? (
          <input
            id={inputId}
            aria-label={label}
            type="number"
            value={displayValue}
            onChange={(event) => onChange?.(event.target.value)}
            onBlur={(event) => onCommit?.(event.target.value)}
            className={`flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500 w-full min-w-0 ${
              isExpression ? 'font-mono text-yellow-400 border-yellow-500/50 bg-yellow-500/5' : ''
            }`}
          />
        ) : null}

        {controlType === 'select' ? (
          <select
            id={inputId}
            aria-label={label}
            value={displayValue}
            onChange={(event) => {
              onChange?.(event.target.value);
              onCommit?.(event.target.value);
            }}
            className="flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500 appearance-none w-full min-w-0"
          >
            {selectOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : null}

        {controlType === 'textarea' ? (
          <textarea
            id={inputId}
            aria-label={label}
            value={displayValue}
            onChange={(event) => onChange?.(event.target.value)}
            onBlur={(event) => onCommit?.(event.target.value)}
            className={`flex-1 min-h-[88px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-blue-500 w-full min-w-0 ${
              isExpression ? 'text-yellow-400 border-yellow-500/50 bg-yellow-500/5' : ''
            }`}
          />
        ) : null}
      </div>
      {description ? <span className="text-[10px] text-text-secondary mt-1">{description}</span> : null}
    </div>
  );
}
