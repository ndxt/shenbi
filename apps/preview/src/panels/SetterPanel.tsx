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

function parseValueByContractType(raw: string, contractProp: ContractProp): unknown {
  if (contractProp.allowExpression && isExpressionLiteral(raw)) {
    return raw;
  }
  if (contractProp.type === 'boolean') {
    return raw.trim().toLowerCase() === 'true';
  }
  if (contractProp.type === 'number') {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }
  if (contractProp.type === 'object' || contractProp.type === 'array' || contractProp.type === 'any') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return trimmed;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

interface PropsSetterProps {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
}

function PropsSetter({ selectedNode, contract, onPatchProps }: PropsSetterProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const propsRecord = contract?.props ?? {};

  useEffect(() => {
    setDrafts({});
  }, [selectedNode?.id, contract?.componentType]);

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
          <div className="flex flex-col gap-2">
            {sortedPropEntries.map(([propName, propMeta]) => {
              const rawValue = drafts[propName] ?? formatValue(selectedNode.props?.[propName], propMeta.default);
              const enumOptions = Array.isArray(propMeta.enum)
                ? propMeta.enum.map((item) => String(item))
                : [];

              return (
                <PropertyField
                  key={propName}
                  label={propName}
                  value={rawValue}
                  isExpression={Boolean(propMeta.allowExpression)}
                  type={enumOptions.length > 0 ? 'select' : 'input'}
                  options={enumOptions}
                  {...(propMeta.description ? { description: propMeta.description } : {})}
                  {...(propMeta.required ? { required: true } : {})}
                  onChange={(next) => {
                    setDrafts((prev) => ({ ...prev, [propName]: next }));
                  }}
                  onCommit={(next) => {
                    onPatchProps?.({
                      [propName]: parseValueByContractType(next, propMeta),
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </SetterGroup>

      <SetterGroup title="高级属性">
        <div className="text-[12px] text-text-secondary border border-dashed border-border-ide p-3 rounded text-center flex items-center justify-center gap-2 cursor-pointer hover:bg-bg-activity-bar transition-colors">
          <Code size={14} />
          <span>打开 JSON 视图</span>
        </div>
      </SetterGroup>
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
  value: string;
  type?: 'input' | 'select';
  options?: string[];
  isColor?: boolean;
  isExpression?: boolean;
  required?: boolean;
  description?: string;
  onChange?: (next: string) => void;
  onCommit?: (next: string) => void;
}

function PropertyField({
  label,
  value,
  type = 'input',
  options = [],
  isColor = false,
  isExpression = false,
  required = false,
  description,
  onChange,
  onCommit,
}: PropertyFieldProps) {
  const inputId = `setter-${label}`;
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
            style={{ backgroundColor: value }}
          />
        ) : null}

        {type === 'input' ? (
          <input
            id={inputId}
            aria-label={label}
            value={value}
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
        ) : (
          <select
            id={inputId}
            aria-label={label}
            value={value}
            onChange={(event) => {
              onChange?.(event.target.value);
              onCommit?.(event.target.value);
            }}
            className="flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500 appearance-none w-full min-w-0"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
      </div>
      {description ? <span className="text-[10px] text-text-secondary mt-1">{description}</span> : null}
    </div>
  );
}
