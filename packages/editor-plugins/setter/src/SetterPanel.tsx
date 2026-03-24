import React, { useEffect, useMemo, useState } from 'react';
import type { ActionChain, ColumnSchema, ComponentContract, ContractProp, SchemaNode } from '@shenbi/schema';
import { i18n, useTranslation } from '@shenbi/i18n';
import { Code, GripVertical, Link2, Plus } from 'lucide-react';

export interface SetterPanelProps {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
  onPatchColumns?: (columns: unknown[]) => void;
  onPatchStyle?: (patch: Record<string, unknown>) => void;
  onPatchEvents?: (patch: Record<string, unknown>) => void;
  onPatchLogic?: (patch: Record<string, unknown>) => void;
  activeTab?: 'props' | 'style' | 'events' | 'logic';
}

export function SetterPanel({
  selectedNode,
  contract,
  onPatchProps,
  onPatchColumns,
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
        {...(onPatchColumns ? { onPatchColumns } : {})}
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

function isSameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
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
      throw new Error(i18n.t('pluginSetter:errors.mustBeArrayJsonForType', { type: contractProp.type }));
    }
    if (contractProp.type === 'array' && !Array.isArray(parsed)) {
      throw new Error(i18n.t('pluginSetter:errors.mustBeArrayJson'));
    }
    if (contractProp.type === 'object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
      throw new Error(i18n.t('pluginSetter:errors.mustBeObjectJson'));
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
type RuleObject = Record<string, unknown>;

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

function getNodePropCurrentValue(node: SchemaNode, propName: string, fallback: unknown): unknown {
  if (node.component === 'Table' && propName === 'columns') {
    return node.columns ?? node.props?.columns ?? fallback;
  }
  return node.props?.[propName] ?? fallback;
}

function formatFormItemName(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join('.');
  }
  return formatValue(value, '');
}

function parseFormItemName(raw: string, previousValue: unknown): string | string[] {
  if (isExpressionLiteral(raw)) {
    return raw;
  }
  if (Array.isArray(previousValue)) {
    return raw
      .split('.')
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }
  return raw;
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
    throw new Error(i18n.t('pluginSetter:errors.propsMustBeObject'));
  }
  return parsed as Record<string, unknown>;
}

function normalizeRules(value: unknown): RuleObject[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is RuleObject => isRecord(item)).map((item) => ({ ...item }));
}

function hasRequiredRule(rulesValue: unknown): boolean {
  return normalizeRules(rulesValue).some((rule) => rule.required === true);
}

function getRequiredRuleMessage(rulesValue: unknown): string {
  const requiredRule = normalizeRules(rulesValue).find((rule) => rule.required === true);
  return typeof requiredRule?.message === 'string' ? requiredRule.message : '';
}

function updateRulesRequired(rulesValue: unknown, required: boolean, requiredMessage?: string): RuleObject[] {
  const rules = normalizeRules(rulesValue);
  if (required) {
    if (rules.some((rule) => rule.required === true)) {
      return rules;
    }
    const message = requiredMessage?.trim() || i18n.t('pluginSetter:validation.requiredDefaultMessage');
    return [{ required: true, message }, ...rules];
  }

  const nextRules: RuleObject[] = [];
  for (const rule of rules) {
    if (rule.required === true) {
      const nextRule = { ...rule };
      delete nextRule.required;
      const keys = Object.keys(nextRule);
      if (keys.length === 0 || (keys.length === 1 && keys[0] === 'message')) {
        continue;
      }
      nextRules.push(nextRule);
      continue;
    }
    nextRules.push(rule);
  }
  return nextRules;
}

function updateRulesRequiredMessage(rulesValue: unknown, message: string): RuleObject[] {
  const rules = normalizeRules(rulesValue);
  const trimmed = message.trim();
  return rules.map((rule) => {
    if (rule.required !== true) {
      return rule;
    }
    if (!trimmed) {
      const next = { ...rule };
      delete next.message;
      return next;
    }
    return { ...rule, message: trimmed };
  });
}

interface PropsSetterProps {
  selectedNode?: SchemaNode;
  contract?: ComponentContract;
  onPatchProps?: (patch: Record<string, unknown>) => void;
  onPatchColumns?: (columns: unknown[]) => void;
}

function PropsSetter({ selectedNode, contract, onPatchProps, onPatchColumns }: PropsSetterProps) {
  const { t } = useTranslation('pluginSetter');
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
    const propsForJson: Record<string, unknown> = {
      ...(selectedNode?.props ?? {}),
    };
    if (selectedNode?.component === 'Table' && Array.isArray(selectedNode.columns)) {
      propsForJson.columns = selectedNode.columns;
    }
    setPropsJsonDraft(formatJsonValue(propsForJson));
    setPropsJsonError(undefined);
  }, [selectedNode?.id, selectedNode?.props, selectedNode?.columns, contract?.componentType]);

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
      const [propName, propMeta] = entry;
      if (selectedNode?.component === 'Form.Item' && propName === 'required') {
        continue;
      }
      if (
        selectedNode?.component === 'Form.Item'
        && (propName === 'label' || propName === 'name' || propName === 'rules')
      ) {
        basic.push(entry);
        continue;
      }
      if (isStructuredContractType(propMeta)) {
        structured.push(entry);
      } else {
        basic.push(entry);
      }
    }
    return { basic, structured };
  }, [selectedNode?.component, sortedPropEntries]);

  const commitPropChange = (propName: string, propMeta: ContractProp, next: unknown) => {
    if (!selectedNode) {
      return;
    }
    try {
      const parsed = parseValueByContractType(next, propMeta);
      if (selectedNode.component === 'Table' && propName === 'columns') {
        if (!Array.isArray(parsed)) {
          throw new Error(t('errors.columnsMustBeArray'));
        }
        if (onPatchColumns) {
          onPatchColumns(parsed as unknown[]);
        } else {
          onPatchProps?.({ columns: parsed });
        }
      } else {
        onPatchProps?.({
          [propName]: parsed,
        });
      }
      setErrors((prev) => ({ ...prev, [propName]: undefined }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.propParseFailed');
      setErrors((prev) => ({ ...prev, [propName]: message }));
    }
  };

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        {t('panel.selectNodeFirst')}
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        {t('panel.noContractTitle', { component: selectedNode.component })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3 text-text-primary">
      <SetterGroup title={t('panel.currentNode')}>
        <div className="text-[12px] text-text-secondary break-all">
          <div>{t('props.component')}：{selectedNode.component}</div>
          {selectedNode.id ? <div>ID：{selectedNode.id}</div> : null}
        </div>
      </SetterGroup>

      <SetterGroup title={t('panel.contractProps')}>
        {sortedPropEntries.length === 0 ? (
          <div className="text-[12px] text-text-secondary">{t('empty.noProps')}</div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedPropEntries.basic.length > 0 ? (
              <PropsGroup
                title={t('panel.basicProps')}
                entries={groupedPropEntries.basic}
                selectedNode={selectedNode}
                drafts={drafts}
                errors={errors}
                onChangeDraft={(propName, next) => {
                  setDrafts((prev) => ({ ...prev, [propName]: next }));
                }}
                onCommit={commitPropChange}
              />
            ) : null}

            {groupedPropEntries.structured.length > 0 ? (
              <PropsGroup
                title={t('panel.structuralProps')}
                entries={groupedPropEntries.structured}
                selectedNode={selectedNode}
                drafts={drafts}
                errors={errors}
                onChangeDraft={(propName, next) => {
                  setDrafts((prev) => ({ ...prev, [propName]: next }));
                }}
                onCommit={commitPropChange}
              />
            ) : null}
          </div>
        )}
      </SetterGroup>

      <SetterGroup title={t('panel.advancedProps')}>
        <button
          type="button"
          onClick={() => setShowPropsJson((prev) => !prev)}
          className="w-full text-[12px] text-text-secondary border border-dashed border-border-ide p-3 rounded text-center flex items-center justify-center gap-2 cursor-pointer hover:bg-bg-activity-bar transition-colors"
        >
          <Code size={14} />
          <span>{showPropsJson ? t('props.hideJsonView') : t('props.showJsonView')}</span>
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
                  if (selectedNode.component === 'Table' && Object.prototype.hasOwnProperty.call(patch, 'columns')) {
                    const columnsValue = patch.columns;
                    if (!Array.isArray(columnsValue)) {
                      throw new Error(t('errors.propsColumnsMustBeArray'));
                    }
                    if (onPatchColumns) {
                      onPatchColumns(columnsValue as unknown[]);
                      delete patch.columns;
                    }
                  }
                  if (Object.keys(patch).length > 0) {
                    onPatchProps?.(patch);
                  }
                  setPropsJsonError(undefined);
                } catch (err) {
                  const message = err instanceof Error ? err.message : t('errors.propsJsonParseFailed');
                  setPropsJsonError(message);
                }
              }}
              className="w-full min-h-[140px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            {propsJsonError ? <div className="text-[11px] text-red-400">{propsJsonError}</div> : null}
            <div className="text-[11px] text-text-secondary">
              {t('props.batchEditHint')}
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
          const currentValue = getNodePropCurrentValue(selectedNode, propName, propMeta.default);
          const canReset = propMeta.default !== undefined && !isSameValue(currentValue, propMeta.default);
          const isFormItemRulesField = (
            selectedNode.component === 'Form.Item'
            && propName === 'rules'
            && !(typeof currentValue === 'string' && isExpressionLiteral(currentValue))
          );
          if (isFormItemRulesField) {
            const error = errors[propName];
            return (
              <div key={propName} className="flex flex-col gap-1">
                <FormItemRulesField
                  rulesValue={currentValue}
                  onChange={(nextRules) => onCommit(propName, propMeta, nextRules)}
                />
                {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
              </div>
            );
          }

          const isFormItemNameField = selectedNode.component === 'Form.Item' && propName === 'name';
          if (isFormItemNameField) {
            const rawName = drafts[propName] ?? formatFormItemName(currentValue);
            const error = errors[propName];
            return (
              <div key={propName} className="flex flex-col gap-1">
                <PropertyField
                  label={propName}
                  value={rawName}
                  isExpression={Boolean(propMeta.allowExpression)}
                  controlType="input"
                  canReset={canReset}
                  onReset={() => onCommit(propName, propMeta, propMeta.default)}
                  {...(propMeta.description ? { description: propMeta.description } : {})}
                  {...(propMeta.required ? { required: true } : {})}
                  onChange={(next) => {
                    if (typeof next === 'string') {
                      onChangeDraft(propName, next);
                    }
                  }}
                  onCommit={(next) => {
                    const nextName = typeof next === 'string'
                      ? parseFormItemName(next, currentValue)
                      : next;
                    onCommit(propName, propMeta, nextName);
                  }}
                />
                {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
              </div>
            );
          }

          const isTableColumnsField = selectedNode.component === 'Table' && propName === 'columns';
          if (isTableColumnsField) {
            const nextColumns = Array.isArray(currentValue) ? currentValue : [];
            const error = errors[propName];
            return (
              <div key={propName} className="flex flex-col gap-1">
                <TableColumnsField
                  label={propName}
                  columns={nextColumns as ColumnSchema[]}
                  onChange={(columns) => onCommit(propName, propMeta, columns)}
                />
                {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
              </div>
            );
          }
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
                canReset={canReset}
                onReset={() => onCommit(propName, propMeta, propMeta.default)}
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

function FormItemRulesField({
  rulesValue,
  onChange,
}: {
  rulesValue: unknown;
  onChange: (nextRules: RuleObject[]) => void;
}) {
  const { t } = useTranslation('pluginSetter');
  const required = hasRequiredRule(rulesValue);
  const [messageDraft, setMessageDraft] = useState('');

  useEffect(() => {
    setMessageDraft(getRequiredRuleMessage(rulesValue));
  }, [rulesValue]);

  return (
    <div className="flex flex-col gap-2 rounded border border-border-ide p-2 bg-bg-canvas">
      <div className="text-[10px] uppercase text-text-secondary">rules.required</div>
      <label className="flex items-center gap-2 text-[12px] text-text-primary">
        <input
          aria-label="rules.required"
          type="checkbox"
          checked={required}
          onChange={(event) => {
            const nextRules = updateRulesRequired(rulesValue, event.target.checked, messageDraft);
            onChange(nextRules);
          }}
          className="size-4 accent-primary"
        />
        {t('validation.required')}
      </label>
      <input
        aria-label="rules.required.message"
        className="bg-bg-sidebar border border-border-ide rounded px-2 py-1 text-[11px] text-text-primary disabled:opacity-50"
        placeholder={t('validation.requiredPlaceholder')}
        value={messageDraft}
        disabled={!required}
        onChange={(event) => setMessageDraft(event.target.value)}
        onBlur={(event) => {
          if (!required) {
            return;
          }
          const nextRules = updateRulesRequiredMessage(rulesValue, event.target.value);
          onChange(nextRules);
        }}
      />
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function updateColumnAt(
  columns: ColumnSchema[],
  index: number,
  updater: (column: ColumnSchema) => ColumnSchema,
): ColumnSchema[] {
  return columns.map((column, i) => (i === index ? updater(column) : column));
}

function parseWidthValue(raw: string): number | string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && trimmed === String(numeric)) {
    return numeric;
  }
  return trimmed;
}

function toEditableColumn(column: ColumnSchema): ColumnSchema {
  return isRecord(column) ? { ...column } : {};
}

function TableColumnsField({
  label,
  columns,
  onChange,
}: {
  label: string;
  columns: ColumnSchema[];
  onChange: (columns: ColumnSchema[]) => void;
}) {
  const { t } = useTranslation('pluginSetter');

  const handleAddColumn = () => {
    const nextIndex = columns.length + 1;
    onChange([
      ...columns,
      { title: t('columns.columnWithIndex', { index: nextIndex }), dataIndex: `field${nextIndex}` },
    ]);
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-border-ide p-2 bg-bg-canvas">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-text-secondary">{label}</span>
        <button
          type="button"
          className="text-[11px] text-primary hover:text-blue-300"
          onClick={handleAddColumn}
        >
          {t('columns.newColumn')}
        </button>
      </div>

      {columns.length === 0 ? (
        <div className="text-[11px] text-text-secondary">{t('empty.noColumns')}</div>
      ) : null}

      <div className="flex flex-col gap-2">
        {columns.map((column, index) => {
          const editable = toEditableColumn(column);
          const title = typeof editable.title === 'string' ? editable.title : '';
          const dataIndex = typeof editable.dataIndex === 'string' ? editable.dataIndex : '';
          const key = typeof editable.key === 'string' ? editable.key : '';
          const width = editable.width == null ? '' : String(editable.width);
          const align = editable.align === 'left' || editable.align === 'center' || editable.align === 'right'
            ? editable.align
            : '';

          return (
            <div key={`col-${index}`} className="rounded border border-border-ide p-2 bg-bg-sidebar">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] text-text-secondary">{t('columns.column')} {index + 1}</span>
                <button
                  type="button"
                  className="text-[11px] text-red-400 hover:text-red-300"
                  onClick={() => {
                    onChange(columns.filter((_, i) => i !== index));
                  }}
                >
                  {t('columns.delete')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label={t('columns.titleAriaLabel', { index: index + 1 })}
                  className="bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px]"
                  placeholder={t('columns.title')}
                  value={title}
                  onChange={(event) => {
                    onChange(updateColumnAt(columns, index, (prev) => ({
                      ...toEditableColumn(prev),
                      title: event.target.value,
                    })));
                  }}
                />
                <input
                  aria-label={t('columns.fieldAriaLabel', { index: index + 1 })}
                  className="bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px]"
                  placeholder="dataIndex"
                  value={dataIndex}
                  onChange={(event) => {
                    onChange(updateColumnAt(columns, index, (prev) => ({
                      ...toEditableColumn(prev),
                      dataIndex: event.target.value,
                    })));
                  }}
                />
                <input
                  aria-label={t('columns.keyAriaLabel', { index: index + 1 })}
                  className="bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px]"
                  placeholder="key"
                  value={key}
                  onChange={(event) => {
                    onChange(updateColumnAt(columns, index, (prev) => {
                      const next = { ...toEditableColumn(prev) };
                      const nextKey = event.target.value.trim();
                      if (!nextKey) {
                        delete next.key;
                      } else {
                        next.key = nextKey;
                      }
                      return next;
                    }));
                  }}
                />
                <input
                  aria-label={t('columns.widthAriaLabel', { index: index + 1 })}
                  className="bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px]"
                  placeholder="width"
                  value={width}
                  onChange={(event) => {
                    const parsedWidth = parseWidthValue(event.target.value);
                    onChange(updateColumnAt(columns, index, (prev) => {
                      const next = { ...toEditableColumn(prev) };
                      if (parsedWidth === undefined) {
                        delete next.width;
                      } else {
                        next.width = parsedWidth;
                      }
                      return next;
                    }));
                  }}
                />
                <select
                  aria-label={t('columns.alignAriaLabel', { index: index + 1 })}
                  className="bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] col-span-2"
                  value={align}
                  onChange={(event) => {
                    const nextAlign = event.target.value;
                    onChange(updateColumnAt(columns, index, (prev) => {
                      const next = { ...toEditableColumn(prev) };
                      if (!nextAlign) {
                        delete next.align;
                      } else {
                        next.align = nextAlign as 'left' | 'center' | 'right';
                      }
                      return next;
                    }));
                  }}
                >
                  <option value="">{t('columns.defaultAlign')}</option>
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </div>
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
    throw new Error(i18n.t('pluginSetter:errors.styleMustBeObject'));
  }
  return parsed;
}

function StyleSetter({ selectedNode, onPatchStyle }: StyleSetterProps) {
  const { t } = useTranslation('pluginSetter');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(formatJsonValue(selectedNode?.style));
    setError(undefined);
  }, [selectedNode?.id, selectedNode?.style]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        {t('panel.selectNodeFirstCanvas')}
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
              const message = err instanceof Error ? err.message : t('errors.styleJsonParseFailed');
              setError(message);
            }
          }}
          className="w-full min-h-[140px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
        <div className="text-[11px] text-text-secondary"
          dangerouslySetInnerHTML={{ __html: t('style.supportHint') }}
        />
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
    throw new Error(i18n.t('pluginSetter:errors.eventActionsMustBeArray'));
  }
  return parsed as ActionChain;
}

function EventSetter({ selectedNode, onPatchEvents }: EventSetterProps) {
  const { t } = useTranslation('pluginSetter');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errorByEvent, setErrorByEvent] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    setDrafts({});
    setErrorByEvent({});
  }, [selectedNode?.id, selectedNode?.component]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        {t('panel.selectNodeFirstCanvas')}
      </div>
    );
  }

  const eventRecord = selectedNode.events ?? {};
  const eventEntries = Object.entries(eventRecord).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-col gap-3 p-3 text-text-primary">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-bold text-text-secondary uppercase">{t('events.boundEvents')}</span>
        <button
          className="text-[10px] bg-primary text-white px-2 py-0.5 rounded flex items-center gap-1 hover:bg-primary transition-colors"
          onClick={() => {
            if (eventRecord.onClick) {
              return;
            }
            onPatchEvents?.({ onClick: [] });
          }}
        >
          <Plus size={10} /> {t('events.addNew')}
        </button>
      </div>

      {eventEntries.length === 0 ? (
        <div className="text-[12px] text-text-secondary border border-dashed border-border-ide rounded p-3">
          {t('empty.noEvents')}
        </div>
      ) : null}

      {eventEntries.map(([eventName, actions]) => {
        const rawValue = drafts[eventName] ?? formatActions(actions);
        const error = errorByEvent[eventName];
        const actionsCount = Array.isArray(actions)
          ? t('events.actionsCount', { count: actions.length })
          : t('events.oneAction');
        return (
          <div key={eventName} className="border border-border-ide rounded bg-bg-canvas overflow-hidden">
            <div className="flex justify-between items-center bg-bg-activity-bar px-2 py-1.5 border-b border-border-ide">
              <span className="text-[12px] font-semibold text-primary">{eventName}</span>
              <span className="text-[10px] text-text-secondary">
                {actionsCount}
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
                    const message = error instanceof Error ? error.message : t('errors.eventJsonParseFailed');
                    setErrorByEvent((prev) => ({ ...prev, [eventName]: message }));
                  }
                }}
                className="w-full min-h-[104px] bg-bg-sidebar border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
              <div className="flex items-center gap-2 text-[11px] text-text-secondary bg-bg-sidebar p-1.5 rounded border border-border-ide border-dashed">
                <GripVertical size={12} className="text-text-secondary" />
                <div className="flex-1 truncate">{t('events.editHint')}</div>
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
    throw new Error(i18n.t('pluginSetter:errors.logicMustBeObject'));
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
  const { t } = useTranslation('pluginSetter');
  const [draft, setDraft] = useState('{}');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(formatLogicValue(selectedNode));
    setError(undefined);
  }, [selectedNode?.id, selectedNode?.if, selectedNode?.show, selectedNode?.loop]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-[12px] text-text-secondary">
        {t('panel.selectNodeFirstCanvas')}
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
              const message = err instanceof Error ? err.message : t('errors.logicJsonParseFailed');
              setError(message);
            }
          }}
          className="w-full min-h-[140px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        {error ? <div className="text-[11px] text-red-400">{error}</div> : null}
        <div className="text-[11px] text-text-secondary">
          {t('logic.editHint')}
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
  canReset?: boolean;
  onReset?: () => void;
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
  canReset = false,
  onReset,
  onChange,
  onCommit,
}: PropertyFieldProps) {
  const { t } = useTranslation('pluginSetter');
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
            <span className="text-[9px]">{t('props.expression')}</span>
          </span>
        ) : null}
        {canReset ? (
          <button
            type="button"
            aria-label={`${label}-reset`}
            onClick={onReset}
            className="ml-2 rounded border border-border-ide px-1.5 py-0.5 text-[9px] text-text-secondary hover:text-text-primary hover:bg-bg-activity-bar"
          >
            {t('common.reset')}
          </button>
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
            className="size-4 accent-primary"
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
            className={`flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 w-full min-w-0 ${
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
            className={`flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 w-full min-w-0 ${
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
            className="flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 appearance-none w-full min-w-0"
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
            className={`flex-1 min-h-[88px] bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 w-full min-w-0 ${
              isExpression ? 'text-yellow-400 border-yellow-500/50 bg-yellow-500/5' : ''
            }`}
          />
        ) : null}
      </div>
      {description ? <span className="text-[10px] text-text-secondary mt-1">{description}</span> : null}
    </div>
  );
}
