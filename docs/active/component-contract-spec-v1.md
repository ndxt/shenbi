# 组件契约规范（草案 v1）

状态：`Draft`  
适用阶段：`Phase 1.5 -> 2.0`  
目标：为 Schema 驱动渲染提供稳定、可校验、可扩展的组件元数据契约。

---

## 1. 背景与目标

当前仓库已有：

- 运行时/编译时总契约：`packages/engine/src/types/contracts.ts`
- 通用组件契约类型（简版）：`packages/schema/types/contract.ts`

但尚未形成“每个组件一个契约文件”的体系，导致：

1. 组件 props/events/slots 能力边界不清晰
2. Schema 生成与校验缺统一依据
3. IDE 属性面板、AI 生成、文档三者难以对齐

本草案定义组件级契约格式与目录标准，先覆盖高频组件，再逐步扩展。

---

## 2. 设计原则

1. 单组件单文件：每个组件独立契约，便于演进与审查
2. 可机读：契约必须可直接用于校验与 UI 生成
3. 向后兼容：支持渐进迁移，不强制一次性替换全量
4. 最小可用优先：先覆盖高频组件，不追求一次性 80+ 全量

---

## 3. 目录规范（建议）

```text
packages/schema/
  contracts/
    button.ts
    input.ts
    select.ts
    form.ts
    form-item.ts
    table.ts
    modal.ts
    drawer.ts
    card.ts
    tag.ts
    alert.ts
    space.ts
    index.ts
```

---

## 4. v1 契约格式

> 注：以下是建议格式；当前代码尚未完全接入该结构。

```ts
export type ContractValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'object'
  | 'array'
  | 'function'
  | 'SchemaNode'
  | 'Expression'
  | 'any';

export interface ContractParam {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface ContractProp {
  type: ContractValueType;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  description?: string;
  allowExpression?: boolean; // 是否允许 '{{...}}'
}

export interface ContractEvent {
  description?: string;
  params?: ContractParam[];
}

export interface ContractSlot {
  description?: string;
  multiple?: boolean;
}

export interface ContractChildren {
  type: 'none' | 'text' | 'node' | 'nodes' | 'mixed';
  description?: string;
}

export interface ComponentContractV1 {
  componentType: string;      // Schema 中 component 名称
  runtimeType?: string;       // 实际组件映射，如 antd.Button
  category?: string;          // form/data-display/feedback/layout...
  props?: Record<string, ContractProp>;
  events?: Record<string, ContractEvent>;
  slots?: Record<string, ContractSlot>;
  children?: ContractChildren;
  version: '1.0.0';
  deprecated?: boolean;
  deprecatedMessage?: string;
}
```

---

## 5. Button 契约示例（v1）

```ts
import type { ComponentContractV1 } from './types';

export const buttonContract: ComponentContractV1 = {
  componentType: 'Button',
  runtimeType: 'antd.Button',
  category: 'general',
  version: '1.0.0',
  props: {
    type: {
      type: 'enum',
      enum: ['primary', 'default', 'dashed', 'text', 'link'],
      default: 'default',
      description: '按钮类型',
      allowExpression: true,
    },
    size: {
      type: 'enum',
      enum: ['large', 'middle', 'small'],
      allowExpression: true,
    },
    danger: { type: 'boolean', default: false, allowExpression: true },
    loading: { type: 'boolean', default: false, allowExpression: true },
    disabled: { type: 'boolean', default: false, allowExpression: true },
    icon: { type: 'SchemaNode', description: '图标节点（可选）' },
  },
  events: {
    onClick: {
      description: '点击事件',
      params: [{ name: 'event', type: 'MouseEvent' }],
    },
  },
  slots: {},
  children: {
    type: 'mixed',
    description: '按钮文本或子节点',
  },
};
```

---

## 6. 首批落地范围（建议）

第一批建议覆盖 12 个高频组件：

1. `Button`
2. `Input`
3. `Select`
4. `Form`
5. `Form.Item`
6. `Table`
7. `Modal`
8. `Drawer`
9. `Card`
10. `Tag`
11. `Alert`
12. `Space`

---

## 7. 校验规则（建议）

契约接入后，Schema 校验至少包含：

1. `componentType` 必须存在于契约注册表
2. `props` 仅允许契约声明字段（可配置是否允许透传）
3. `enum` 值校验
4. 必填 `required` 校验
5. `events` 名称与参数签名校验（基础层面）
6. `children/slots` 使用形态校验

---

## 8. 版本与变更策略

1. 单组件契约使用 `version`，默认 `1.0.0`
2. 破坏性变更（删字段/改语义）必须升级 minor 或 major，并写迁移说明
3. 标记废弃字段时：
   - `deprecated: true`
   - `deprecatedMessage` 明确替代方案

---

## 9. 与现有系统的迁移建议

分 3 步推进：

1. 先新增契约文件，不改 runtime 行为（只做文档与校验准备）
2. 在 schema 校验链路引入契约检查（warning 起步）
3. IDE 属性面板/AI 提示改为读取契约源，逐步收敛到单一事实源

---

## 10. 当前结论

该规范可作为“每个组件契约文件”的基线草案。  
建议你确认两件事后再进入实现：

1. `props/events` 是否采用 `Record` 结构（推荐）
2. 第一批组件范围是否按上面的 12 个执行

## 11. 包导出说明（2026-03-02）

`@shenbi/schema` 现采用“构建产物导出”策略：

1. 包正式导出统一指向 `dist/types/index.js + .d.ts`
2. `build` 前会自动清理 `dist`，避免脏产物
3. 发布包通过 `files: ["dist"]` 仅包含构建产物

这样可以确保非源码直连环境可稳定消费运行时契约（例如 `builtinContracts`）。
