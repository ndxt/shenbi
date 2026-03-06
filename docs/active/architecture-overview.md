# 神笔 (Shenbi) Engine 设计文档 & 并行执行计划

> 版本：v1.0.0 | 日期：2026-02-20
> 适配：React 19+ / Ant Design v6.3+ / TypeScript 5.7

---

## 一、架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                        PageSchema (JSON)                     │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     编译层 (Compiler)                         │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Expression   │  │ Schema       │  │ JSFunction         │ │
│  │ Compiler     │  │ Compiler     │  │ Compiler           │ │
│  │              │  │              │  │                     │ │
│  │ {{expr}}     │  │ SchemaNode   │  │ formatter/sorter   │ │
│  │ → Function   │  │ → Compiled   │  │ → Function         │ │
│  │ + deps 提取  │  │   Node Tree  │  │                     │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
└──────────────────────────────┬───────────────────────────────┘
                               │ CompiledNode Tree
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     运行时 (Runtime)                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ State    │  │ Action   │  │ Watcher  │  │ DataSource  │ │
│  │ Manager  │  │ Executor │  │ Manager  │  │ Manager     │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
│                    ┌──────────┐                               │
│                    │ Computed │                               │
│                    │ Manager  │                               │
│                    └──────────┘                               │
└──────────────────────────────┬───────────────────────────────┘
                               │ ExpressionContext
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     渲染层 (Renderer)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ NodeRenderer (递归)                                    │   │
│  │                                                        │   │
│  │  if/show → loop → props 求值 → events 绑定            │   │
│  │  → slots 渲染 → columns 渲染 → children 递归           │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ComponentResolver                                      │   │
│  │                                                        │   │
│  │ "Button" → antd.Button  (web)                          │   │
│  │ "Button" → vant.Button  (mobile)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、核心设计决策

| 决策 | 选项 | 结论 | 理由 |
|------|------|------|------|
| 渲染策略 | A:每次遍历JSON / B:预编译 | **B** | Schema 静态数据动态，预编译+依赖追踪可精确 memo |
| 表达式语法 | `${}` / `{{}}` | **`{{}}`** | 和 JS 模板字符串不冲突，业界低代码事实标准 |
| 函数类型标识 | 统一 / 按用途分 | **按用途分** | JSExpression(值) / JSFunction(函数) / SchemaRender(组件树) |
| 表达式沙箱 | new Function / 自定义 parser | **new Function** (阶段1) | 性能最好，阶段 3 可换更安全的方案 |
| 状态管理 | Redux / Zustand / useReducer | **useReducer** | 页面级状态轻量足够，不引入外部依赖 |
| Schema 模块化 | 单文件 / 按职责拆 | **按职责拆** | expression / action / node / page / datasource / contract |

---

## 三、技术栈

| 层 | 选型 | 版本 |
|---|------|------|
| 框架 | React | 19+ |
| UI 组件库 | Ant Design | v6.3+ |
| 语言 | TypeScript | 5.7+ |
| 构建 | Vite | 6 |
| 包管理 | pnpm workspace | 9+ |
| 测试 | Vitest + React Testing Library | latest |
| 工具库 | dayjs + lodash-es | 注入表达式 utils |
| 路由 | React Router | v6 |
| 回归测试 | Playwright + pixelmatch | 阶段 2 |

### React 19 关键变化

> React 19 相比 React 18 有若干破坏性变更，本引擎全面适配 React 19，以下为影响本项目的关键点。

**依赖版本**：

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0"
}
```

> 注：React 19 的类型已内置于 `@types/react@19`，antd v6 支持 React 18+，推荐 React 19。

**1. `Context.Provider` → `Context` 直接渲染**

React 19 中 `<Context.Provider>` 已标记废弃，改为直接用 `<Context>` 作为 Provider：

```typescript
// ✅ React 19 写法
const ShenbiContext = createContext<{...} | null>(null);
createElement(ShenbiContext, { value }, children);
// 或 JSX：<ShenbiContext value={...}>{children}</ShenbiContext>
```

影响：B3 ShenbiPage 的 Context Provider 写法、文档中所有 Context 示例代码。

**2. `ref` 作为普通 prop（`forwardRef` 废弃）**

React 19 中 `ref` 是普通 prop，不再需要 `forwardRef`：

```typescript
// React 19: ref 是普通 prop，直接注入
if (node.id) {
  resolvedProps.ref = (el: any) => runtime.registerRef(node.id!, el);
  // React 19 支持 ref cleanup 函数，返回清理函数自动在卸载时调用
}
```

影响：引擎内部 `registerRef` 实现——直接往组件 props 上传 ref 即可；NodeRenderer 绑定 ref 时不再需要特殊处理；ErrorBoundary 若用函数组件实现时 ref 处理更简单。

**3. `useRef` 必须传初始值**

```typescript
// ❌ React 18 允许
const refsMap = useRef<Record<string, any>>();

// ✅ React 19 必须
const refsMap = useRef<Record<string, any>>({});
const dialogPayloads = useRef<Record<string, any>>({});
```

影响：A3 State 管理、A5 Watcher 中所有 `useRef` 调用。

**4. 新 Hooks 可利用（阶段 2 优化项）**

| Hook | 用途 | 可用在 |
|------|------|--------|
| `useActionState` | 管理异步 action 的 pending/error 状态 | fetch action 的 loading 管理（替代手动 setState loading） |
| `useOptimistic` | 乐观更新 | setState 的乐观更新模式 |
| `use()` | 在 render 中读取 Promise/Context | 条件读取 Context、datasource 懒加载 |
| `useFormStatus` | 表单提交状态 | Form validate action 优化 |

> 阶段 1 不强制使用这些新 Hook（保持简单），标注为阶段 2 优化项。重点关注：
> - `useActionState` 替代 fetch action 中手动管理 loading/error 的模式
> - `use()` 替代 `useContext` 用于条件读取（NodeRenderer 内部可以条件读取 Context）

**5. Strict Mode 行为变化**

React 19 的 Strict Mode 不再双重调用 ref 回调和 effect cleanup：

- A5 Watcher 的 `useEffect` 在 StrictMode 下行为更可预测（不再多触发一次）
- 测试用例中如果有依赖 StrictMode 双重调用计数的，需要调整

**6. TypeScript 类型变化**

```typescript
// ❌ React 18
React.MutableRefObject<T>   // ref 对象类型
React.RefObject<T>          // 只读 ref

// ✅ React 19
React.RefObject<T>          // 统一为 RefObject（可变）
// MutableRefObject 仍存在但将被废弃
```

影响：engine 内部所有 ref 类型声明统一使用 `React.RefObject<T>`。

**不需要修改的部分**：

| 项 | 理由 |
|----|------|
| `useReducer` | React 19 无破坏性变更 |
| `useMemo` / `useCallback` | 不变 |
| `createElement` | 不变 |
| `new Function` 沙箱 | 不变 |
| ActionChain 设计 | 不变 |
| Schema 类型定义 | 纯类型，不依赖 React 版本 |
| antd v6 组件映射表 | antd v6 原生支持 React 19，无需改动 |
| Vite 构建 | 不变 |

---

## 四、项目结构

```
shenbi/
├── packages/
│   ├── schema/              # 📦 类型定义（已冻结 v1.0.0）
│   │   └── types/
│   │       ├── index.ts
│   │       ├── expression.ts   # JSExpression / JSFunction / SchemaRender / PropValue
│   │       ├── action.ts       # 22 种 Action 类型
│   │       ├── node.ts         # SchemaNode / ColumnSchema / LoopDirective / EditorConfig
│   │       ├── page.ts         # PageSchema / state / params / watcher / lifecycle
│   │       ├── datasource.ts   # TypeDef / DataSchema / APISchema / FormRule
│   │       └── contract.ts     # ComponentContract / Diagnostic
│   │
│   ├── engine/              # 📦 渲染引擎核心
│   │   └── src/
│   │       ├── compiler/
│   │       │   ├── expression.ts    # {{}} 解析 → new Function + 依赖提取
│   │       │   └── schema.ts        # SchemaNode → CompiledNode 树
│   │       ├── renderer/
│   │       │   ├── node-renderer.tsx # 核心递归渲染
│   │       │   ├── shenbi-page.tsx   # 页面入口组件
│   │       │   └── builtins/        # 内置容器组件
│   │       ├── runtime/
│   │       │   ├── state.ts         # useReducer 状态管理
│   │       │   ├── action-executor.ts   # ActionChain 执行器
│   │       │   ├── computed.ts      # 计算属性管理
│   │       │   ├── watcher.ts       # 状态/参数变化监听
│   │       │   └── datasource.ts    # 数据源请求管理
│   │       └── resolver/
│   │           └── index.ts         # antdResolver（antd v6 全组件映射）
│   │
│   ├── contracts/           # 📦 组件契约（阶段 2）
│   └── test-suite/          # 📦 测试用例集（阶段 2）
│
└── apps/
    └── preview/             # 📦 预览应用（Vite + antd）
```

**npm 包名**：

```
@shenbi/schema       # 类型定义
@shenbi/engine       # 渲染引擎
@shenbi/contracts    # 组件契约
@shenbi/preview      # 预览应用（private）
```

---

## 五、模块接口契约

> ⚠️ 这是两个 Worker 并行开发的关键——接口必须明确冻结，双方各自用 mock 实现来独立测试。

### 5.1 编译层 → 渲染层 接口

```typescript
// ===== 编译器输出，渲染器输入 =====

interface CompiledNode {
  id?: string;
  Component: React.ComponentType<any> | string | null;
  componentType: string;                            // 调试用
  staticProps: Record<string, any>;                 // 无表达式的 props
  dynamicProps: Record<string, CompiledExpression>; // 有表达式的 props
  ifFn?: CompiledExpression;
  showFn?: CompiledExpression;
  childrenFn?: CompiledExpression;                  // 动态文本 children
  compiledChildren?: CompiledNode[];                // 子节点树
  compiledSlots?: Record<string, CompiledNode | CompiledNode[]>;
  compiledColumns?: CompiledColumn[];               // Table 列
  loop?: CompiledLoop;
  events?: Record<string, ActionChain>;             // 原始 ActionChain，由 Runtime 执行
  style?: Record<string, any> | CompiledExpression;
  className?: string | CompiledExpression;
  permission?: string;
  errorBoundary?: { fallback: CompiledNode };
  allDeps: string[];                                // memo 优化用
  __raw?: SchemaNode;                               // 调试用
}

interface CompiledExpression {
  fn: (ctx: ExpressionContext) => any;
  deps: string[];
  raw: string;
}

interface CompiledColumn {
  config: Omit<ColumnSchema, 'render' | 'editRender'>;
  compiledRender?: CompiledNode;
  renderParams?: string[];
  compiledEditRender?: CompiledNode;
  editRenderParams?: string[];
  ifFn?: CompiledExpression;
  editRules?: FormRule[];
}

interface CompiledLoop {
  dataFn: CompiledExpression;
  itemKey: string;
  indexKey: string;
  keyFn: CompiledExpression;
  body: CompiledNode;
}
```

### 5.2 运行时 → 渲染层 接口

```typescript
// ===== 运行时对外暴露的接口 =====

interface PageRuntime {
  /** 页面状态（响应式） */
  state: Record<string, any>;

  /** 状态更新分发 */
  dispatch: (action: StateAction) => void;

  /** 执行动作链（事件处理的统一入口） */
  executeActions: (actions: ActionChain, eventData?: any) => Promise<void>;

  /** 获取表达式上下文（用于 CompiledExpression.fn 求值） */
  getContext: (extra?: Partial<ExpressionContext>) => ExpressionContext;

  /** 计算属性值（自动缓存，依赖变化时重算） */
  computed: Record<string, any>;

  /** 弹窗 payload 数据（modal/drawer action 打开时传入的数据） */
  dialogPayloads: Record<string, any>;

  /** 组件实例注册（用于 $refs 访问）
   *  React 19: ref 是普通 prop，直接注入 resolvedProps.ref 即可，
   *  不再需要 forwardRef 包装。支持 ref cleanup 函数（返回清理函数自动在卸载时调用）。
   */
  registerRef: (id: string, ref: any) => void;
}

// ===== 状态更新 Action =====

type StateAction =
  | { type: 'SET'; key: string; value: any }       // 设置单个字段，key 支持路径 'a.b.c'
  | { type: 'MERGE'; data: Record<string, any> }   // 浅合并多个字段
  | { type: 'RESET'; initial: Record<string, any> }; // 重置到初始状态

// ===== 渲染层通过 React Context 获取 =====
// React 19: 直接用 <ShenbiContext> 作为 Provider（Context.Provider 已废弃）

const ShenbiContext = createContext<{
  runtime: PageRuntime;
  resolver: ComponentResolver;
} | null>(null);

// 使用方式（React 19）：
// <ShenbiContext value={{ runtime, resolver }}>{children}</ShenbiContext>
```

### 5.3 Resolver 接口

```typescript
interface ComponentResolver {
  resolve(componentType: string): React.ComponentType<any> | string | null;
  register(componentType: string, component: React.ComponentType<any>): void;
  registerAll(map: Record<string, React.ComponentType<any>>): void;
  has(componentType: string): boolean;
}
```

---

## 六、并行执行计划

### 分工原则

```
Worker A（编译层 + 运行时）：处理"数据"——把 JSON 变成可执行函数，管理状态和 action 执行
Worker B（渲染层 + 预览应用）：处理"UI"——把编译产物变成 React 组件，搭建可运行的 demo

接口契约：CompiledNode / PageRuntime / ComponentResolver（见第五节）
```

---

### MVP-0：项目基础（串行，任一 Worker 做）

**目标**：monorepo 脚手架，所有后续任务有地方写代码。

**交付物**：
```
✅ pnpm-workspace.yaml
✅ 根 package.json / tsconfig.json / .prettierrc / .gitignore
✅ packages/schema/  （类型定义文件，已冻结）
✅ packages/engine/  （package.json + tsconfig + vitest.config）
✅ apps/preview/     （package.json + vite.config + index.html）
```

**验收**：`pnpm install` 无报错，`pnpm test:engine` 能运行（即使没有 test case）。

**时间**：30 分钟

---

### MVP-1：双线并行开发

```
                    ┌──────────────────────────────┐
                    │       MVP-0 项目基础          │
                    │        (串行，30 min)          │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    ▼                               ▼
     ┌──────────────────────┐       ┌──────────────────────┐
     │   Worker A            │       │   Worker B            │
     │   编译层 + 运行时     │       │   渲染层 + 预览应用   │
     │                       │       │                       │
     │   A1 表达式编译器     │       │   B1 组件 Resolver    │
     │   A2 Schema 编译器    │       │   B2 NodeRenderer     │
     │   A3 State + Computed │       │   B3 ShenbiPage 入口  │
     │   A4 Action 执行器    │       │   B4 Preview App      │
     │   A5 Watcher         │       │   B5 内置容器组件     │
     │   A6 DataSource      │       │   B6 Demo Schema      │
     └──────────┬───────────┘       └──────────┬───────────┘
                │                               │
                └──────────────┬───────────────┘
                               ▼
                    ┌──────────────────────┐
                    │   MVP-2 集成联调      │
                    │   (串行，修 bug)      │
                    └──────────────────────┘
```

---

#### Worker A：编译层 + 运行时

> 文件路径：`packages/engine/src/compiler/` + `packages/engine/src/runtime/`

##### A1. 表达式编译器
**文件**：`compiler/expression.ts` + `compiler/expression.test.ts`

**功能**：
```typescript
// 入参：表达式字符串
compileExpression("{{state.count + 1}}")

// 出参：
{
  fn: (ctx: ExpressionContext) => any,  // 可执行函数
  deps: ["state.count"],                // 依赖路径
  raw: "{{state.count + 1}}"            // 原始字符串
}
```

**实现要点**：
- `isExpression(value)` — 判断是否 `{{...}}` 表达式
- `compileExpression(raw)` — 编译为 `{ fn, deps, raw }`
- `compilePropValue(value)` — 自动判断是否需要编译（静态值返回 null）
- `extractDeps(expr)` — 正则提取 `state.xxx` / `params.xxx` 等路径
- `compileJSFunction(jsFn)` — 编译 JSFunction 描述符为可执行函数
- `new Function('ctx', 'const {state,params,...} = ctx; return (...)')` 沙箱

**测试用例**（至少 20 个）：
```
✅ 简单属性访问: {{state.count}} → 5
✅ 算术运算: {{state.count + 1}} → 6
✅ 三元表达式: {{state.count > 3 ? 'many' : 'few'}} → 'many'
✅ 模板字面量: {{`hello ${state.name}`}} → 'hello test'
✅ 嵌套路径: {{params.route.id}} → '123'
✅ 数组方法: {{state.list.filter(x => x > 1).length}} → 2
✅ 逻辑运算: {{state.a && state.b}} → true/false
✅ 可选链: {{state.user?.name}} → undefined
✅ loop 变量: item / index 上下文
✅ render 变量: text / record 上下文
✅ utils 访问: {{utils.dayjs().format('YYYY')}}
✅ computed 访问: {{computed.filteredList.length}}
✅ 非表达式字符串: 'hello' → 原样返回
✅ 无效表达式: 编译错误时返回 undefined 而非 throw
✅ 空表达式: {{}} → undefined
✅ JSExpression 对象: { __type: 'JSExpression', value: '...' }
✅ JSFunction 编译: { __type: 'JSFunction', params: ['v'], body: 'v * 2' }
✅ 依赖提取: 多路径、嵌套路径、重复路径去重
✅ 性能: 10000 次编译 < 100ms
```

##### A2. Schema 编译器
**文件**：`compiler/schema.ts` + `compiler/schema.test.ts`

**功能**：
```typescript
// 入参：SchemaNode + ComponentResolver
compileSchema(schemaNode, resolver)

// 出参：CompiledNode 树（接口见第五节）
```

**实现要点**：
- 递归编译节点树
- props 分离：静态 vs 动态（有表达式的走 `compilePropValue`）
- if / show 条件编译
- children 三种形态：SchemaNode[] / SchemaNode / string(表达式)
- slots 编译：每个 slot 也递归编译
- columns 编译：render / editRender → CompiledColumn
- loop 编译：分离循环指令和循环体
- JSFunction 类型 props（如 sorter / formatter）→ 编译为可执行函数
- 依赖汇总：收集所有子表达式的 deps

**测试用例**：
```
✅ 静态节点: 无表达式，所有 props 进 staticProps
✅ 动态节点: 表达式 props 进 dynamicProps
✅ 混合节点: 部分静态部分动态，正确分离
✅ 嵌套 children: 递归编译子树
✅ 文本 children: 表达式文本走 childrenFn
✅ slots: title / extra / footer 正确编译
✅ columns: render → compiledRender + renderParams
✅ columns: editRender → compiledEditRender
✅ columns: if 条件列
✅ loop: 分离出 body + dataFn + keyFn
✅ if / show: 分别编译为 ifFn / showFn
✅ 组件解析: resolver.resolve 被正确调用
✅ 未知组件: Component = null，不 throw
✅ JSFunction props: { __type: 'JSFunction', ... } 编译为函数
✅ 依赖汇总: allDeps 包含所有子表达式的 deps 去重
✅ __raw 引用: 保留原始 SchemaNode
```

##### A3. State 管理 + Computed
**文件**：`runtime/state.ts` + `runtime/computed.ts` + 各自 `.test.ts`

**State 功能**：
```typescript
const [state, dispatch] = usePageState(page.state);

dispatch({ type: 'SET', key: 'loading', value: true });
dispatch({ type: 'SET', key: 'pagination.current', value: 2 }); // 路径写法
dispatch({ type: 'MERGE', data: { a: 1, b: 2 } });
dispatch({ type: 'RESET', initial: {...} });
```

**State 实现要点**：
- 从 `page.state` 定义提取初始值（`StateFieldDef.default`）
- `SET` 支持 `a.b.c` 深层路径（不可变更新）
- `MERGE` 浅合并
- `RESET` 重置到初始状态
- ⚠️ React 19：所有 `useRef` 必须传初始值，如 `useRef<Record<string, any>>({})`

**Computed 功能**：
```typescript
// page.computed 定义
computed: {
  filteredList: {
    deps: ["state.userList", "state.keyword"],
    expr: "{{state.userList.filter(u => u.name.includes(state.keyword))}}"
  }
}

// 运行时自动计算，注入到 ExpressionContext.computed
const computed = useComputed(page.computed, state);
// computed.filteredList → 缓存结果，deps 变化时重算
```

**Computed 实现要点**：
- `useMemo` 对每个计算属性做缓存
- 依赖通过 `deps` 声明的路径检测变化
- 计算结果注入到 `ExpressionContext.computed` 中
- 循环依赖检测（A 依赖 B 且 B 依赖 A → 报错）

**测试用例**：
```
✅ 初始化: 从 StateFieldDef 提取 default 值
✅ 普通 SET: 单层 key
✅ 路径 SET: 'a.b.c' 深层不可变更新
✅ MERGE: 浅合并不丢失未合并字段
✅ RESET: 恢复初始值
✅ null/undefined 处理: default 缺失时为 null
✅ computed 基本求值: deps 满足时正确计算
✅ computed 缓存: deps 不变时不重新计算
✅ computed 依赖变化: state 变化触发重算
```

##### A4. Action 执行器
**文件**：`runtime/action-executor.ts` + `runtime/action-executor.test.ts`

**功能**：
```typescript
async function executeActions(
  actions: ActionChain,
  ctx: ExpressionContext,
  dispatch: Dispatch,
  options: ExecutorOptions
): Promise<void>
```

**需支持的 Action 类型**（阶段 1 MVP）：

| Action | 实现方式 |
|--------|---------|
| `setState` | dispatch SET，value 中表达式求值 |
| `callMethod` | 从 `options.methods` 中查找定义 → 递归执行 body ActionChain |
| `fetch` | 查找 datasource 配置 → window.fetch → onSuccess/onError/onFinally |
| `navigate` | 调用 router.push / router.replace / router.back |
| `message` | 动态 import antd message，调用对应 level |
| `notification` | 动态 import antd notification |
| `confirm` | 动态 import antd Modal.confirm → onOk/onCancel |
| `modal` | dispatch SET `__dialog_{id}` 控制显隐 |
| `drawer` | dispatch SET `__drawer_{id}` 控制显隐 |
| `validate` | 通过 $refs 获取 form → validateFields → onSuccess/onError |
| `resetForm` | 通过 $refs 获取 form → resetFields |
| `condition` | 求值 if 表达式 → 执行 then 或 else |
| `loop` | 求值 data → 遍历执行 body |
| `script` | new Function 执行自定义代码 |
| `copy` | navigator.clipboard.writeText |
| `debounce` | setTimeout 包装 |
| `throttle` | 时间戳节流包装 |
| `batch` | 顺序执行多个 action |
| `emit` | EventBus.emit |
| `callProp` | 从 params.props 获取函数并调用 |
| `setQuery` | router query 更新 |
| `download` | window.open 或 a.click |

**callMethod 处理方式**：
```typescript
// ExecutorOptions 中注入 page.methods 定义
interface ExecutorOptions {
  methods: Record<string, MethodDef>;     // page.methods
  dataSources: Record<string, DataSourceDef>;
  router?: RouterAdapter;
  refs: Record<string, any>;
}

// callMethod 执行逻辑
case 'callMethod': {
  const methodDef = options.methods[action.name];
  if (!methodDef) throw new Error(`Method "${action.name}" not found`);
  // 将 action.params 注入上下文
  const methodCtx = { ...ctx, ...resolveParams(action.params, ctx) };
  // 递归执行 method.body（也是 ActionChain）
  await executeActions(methodDef.body, methodCtx, dispatch, options);
}
```

**关键设计**：
- 顺序执行（`for...of + await`）
- `fetch` / `confirm` 的 onSuccess/onError 递归调用 `executeActions`
- `condition` 的 then/else 递归调用
- **表达式值解析**：action 中所有 PropValue 类型的字段都可能是 `{{expr}}`，需要统一的 `resolveValue(value, ctx)` 函数
- 反馈类 action（message/notification/confirm）通过动态 import 避免 engine 直接依赖 antd

**测试用例**：
```
✅ setState: 简单值 / 表达式值 / 路径值
✅ callMethod: 查找 method → 执行 body
✅ callMethod: method 不存在 → 报错
✅ condition: if true → then / if false → else
✅ condition: 无 else 分支
✅ loop: 遍历数组执行 body
✅ batch: 多个 action 顺序执行
✅ 嵌套: condition 内嵌 setState + message
✅ fetch: mock fetch → onSuccess 中 setState
✅ fetch: mock fetch 失败 → onError
✅ fetch: onFinally 无论成功失败都执行
✅ modal: open → state.__dialog_xx = true + payload
✅ modal: close → state.__dialog_xx = false
✅ validate: mock form → 校验通过 → onSuccess
✅ validate: mock form → 校验失败 → onError
✅ debounce: 连续调用只执行最后一次
✅ resolveValue: {{expr}} 正确求值，静态值直接返回
```

##### A5. Watcher 管理器
**文件**：`runtime/watcher.ts` + `runtime/watcher.test.ts`

**功能**：
```typescript
useWatchers(page.watchers, state, executeActions);
```

**实现要点**：
- 用 `useEffect` + `useRef` 实现变化检测
- ⚠️ React 19：所有 `useRef` 必须传初始值，如 `useRef<any>(null)`、`useRef<Record<string, any>>({})`
- ⚠️ React 19 Strict Mode 不再双重调用 effect cleanup，Watcher 的 `useEffect` 行为更可预测
- 支持 `watch: string | string[]`（多路径监听）
- `immediate: true` → 初始化立即执行
- `debounce` / `throttle` 包装
- `deep` → JSON.stringify 深度比较（阶段 1 够用）
- handler 中可访问 `watch.newValue` / `watch.oldValue`

**测试用例**：
```
✅ 单路径监听: state.keyword 变化 → handler 执行
✅ 多路径监听: [state.a, state.b] 任一变化 → 执行
✅ immediate: 初始化就执行一次
✅ debounce: 连续变化只执行最后一次
✅ deep: 对象内部变化也触发
✅ newValue/oldValue: 正确注入 watch 上下文
```

##### A6. DataSource 管理器
**文件**：`runtime/datasource.ts` + `runtime/datasource.test.ts`

**功能**：
```typescript
useDataSources(page.dataSources, state, executeActions);
```

**实现要点**：
- 解析 datasource 配置中的表达式（url / params / headers）
- `auto: true` → 页面加载时自动请求
- `deps` → 依赖变化时重新请求
- `debounce` → 防抖
- `transform` → JSFunction 数据转换
- 请求结果存入 `ds.{name}` 供表达式访问
- loading / error 状态管理

**测试用例**：
```
✅ 手动触发: fetch action 引用 datasource
✅ auto: 页面加载自动请求
✅ deps: 依赖变化重新请求
✅ 表达式参数: params 中 {{state.xx}} 正确解析
✅ transform: 原始响应经过 JSFunction 转换
✅ onSuccess/onError: 回调动作链执行
✅ loading 状态: 请求中 ds.{name}.loading = true
```

##### React 19 新 Hooks 优化（阶段 2）

> 以下为 React 19 新增 Hook 在本引擎中的潜在应用，阶段 1 不强制使用，标注为阶段 2 优化项。

| Hook | 用途 | 可用在 |
|------|------|--------|
| `useActionState` | 管理异步 action 的 pending/error 状态 | A4 Action 执行器：fetch action 的 loading 管理（替代手动 setState loading） |
| `useOptimistic` | 乐观更新 | A3 State：setState 的乐观更新模式 |
| `use()` | 在 render 中读取 Promise/Context | B2 NodeRenderer：条件读取 Context、datasource 懒加载 |
| `useFormStatus` | 表单提交状态 | A4 Action 执行器：Form validate action 优化 |

重点关注：
- `useActionState` 替代 fetch action 中手动管理 loading/error 的模式
- `use()` 替代 `useContext` 用于条件读取（NodeRenderer 内部可以条件读取 Context）

---

#### Worker B：渲染层 + 预览应用

> 文件路径：`packages/engine/src/renderer/` + `packages/engine/src/resolver/` + `apps/preview/`

##### B1. 组件 Resolver
**文件**：`resolver/index.ts` + `resolver/index.test.ts`

**功能**：
```typescript
const resolver = createResolver();
resolver.registerAll({ Button: antd.Button, ... });
resolver.resolve("Button")     // → antd.Button
resolver.resolve("Form.Item")  // → antd.Form.Item
resolver.resolve("Unknown")    // → null + console.warn
```

**实现要点**：
- `createResolver(initialMap?)` 工厂函数
- `resolve` 支持点号子组件查找（`Form.Item` → `Form` 的 `Item` 属性）
- `__fragment` → React.Fragment
- 未找到时返回 null，不 throw
- `antdResolver(antdModule)` → 预注册 antd v6 全部组件

**antd v6 组件注册表**（约 80+ 映射）：
```
通用:    Button, Typography, Typography.Title/Text/Paragraph/Link
布局:    Row, Col, Layout, Layout.Header/Content/Footer/Sider, Space, Space.Compact, Divider, Flex
导航:    Menu, Breadcrumb, Dropdown, Pagination, Steps
数据录入: Form, Form.Item, Form.List, Input, Input.Search/TextArea/Password,
         InputNumber, Select, Cascader, TreeSelect, DatePicker, DatePicker.RangePicker,
         TimePicker, Checkbox, Checkbox.Group, Radio, Radio.Group, Radio.Button,
         Switch, Slider, Upload, Upload.Dragger, Transfer, ColorPicker, Rate, Mentions
数据展示: Table, Descriptions, Descriptions.Item, List, List.Item, List.Item.Meta,
         Card, Card.Meta, Card.Grid, Tabs, Tree, Tree.DirectoryTree,
         Collapse, Timeline, Tag, Tag.CheckableTag, Tooltip, Popover, Popconfirm,
         Badge, Badge.Ribbon, Avatar, Avatar.Group, Calendar, Carousel, Image,
         Statistic, Statistic.Countdown, Segmented, Empty, QRCode
反馈:    Modal, Drawer, Alert, Progress, Skeleton, Spin, Result, Watermark
其他:    Anchor, FloatButton, FloatButton.BackTop/Group, Splitter, ConfigProvider, App
```

**测试用例**：
```
✅ 直接组件: resolve("Button") → 对应组件
✅ 子组件: resolve("Form.Item") → Form.Item
✅ 内置特殊: resolve("__fragment") → React.Fragment
✅ 未注册: resolve("Unknown") → null
✅ 批量注册: registerAll 一次注册多个
✅ 后注册覆盖: 同名注册覆盖旧值
```

##### B2. NodeRenderer（核心）
**文件**：`renderer/node-renderer.tsx` + `renderer/node-renderer.test.tsx`

**功能**：接收 CompiledNode + ExpressionContext，递归渲染 React 元素。

**渲染流程（严格按此顺序，共 13 步）**：
```
 1. if 条件 → false 则 return null
 2. 权限检查 → permission 不通过则 return null
 3. loop 检测 → 有则展开循环渲染，每项递归 NodeRenderer
 4. 解析 dynamicProps → 调用 compiled.fn(ctx)
 5. 合并 staticProps + dynamicProps
 6. 绑定 events → 包装为 (...args) => runtime.executeActions(chain, args[0])
 7. 处理 style / className（表达式求值）
 8. show 条件 → false 则 style.display = 'none'
 9. slots → 每个 slot 渲染为 ReactNode 注入 props
10. columns → 编译的 render 包装为 antd column render 函数
11. children → 文本表达式 / 静态文本 / 递归子节点
12. 错误边界 → 有则包裹 ErrorBoundary
13. createElement(Component, props, children)
```

**实现要点**：
- 通过 `useShenbi()` 从 Context 获取 runtime 和 resolver（React 19 可用 `use(ShenbiContext)` 条件读取，阶段 2 优化）
- ⚠️ React 19：ref 是普通 prop，绑定 ref 时直接注入 `resolvedProps.ref` 即可，不需要 `forwardRef` 特殊处理
- `extraContext` 参数：loop 的 item/index，column render 的 text/record/index
- columns 渲染：过滤 `ifFn`，render 包装为 `(text, record, index) => <NodeRenderer extraContext={{text, record, index}} />`
- 未知组件渲染红色错误框 + 组件名提示
- ErrorBoundary：用 class component 实现 componentDidCatch，渲染 fallback 节点
- ⚠️ React 19：ref 类型统一使用 `React.RefObject<T>`（`MutableRefObject` 将被废弃）

**测试用例**（用 React Testing Library）：
```
✅ 静态渲染: Button 文本 props + children 正确渲染
✅ 动态 props: 表达式 prop 正确求值
✅ if=false: 不渲染
✅ if=true: 正常渲染
✅ show=false: display:none 但 DOM 存在
✅ loop: 3 个数据项 → 3 个节点
✅ loop + if: 循环内条件过滤
✅ loop + key: 不同 key 生成不同 React 元素
✅ slots: Card title/extra 渲染到正确位置
✅ 文本 children 表达式: {{state.msg}} 正确显示
✅ 事件绑定: onClick 触发 executeActions
✅ 嵌套: Container > Card > Button 递归正确
✅ columns: render 函数正确生成
✅ 未知组件: 显示红色错误框
✅ permission: 无权限则不渲染
```

##### B3. ShenbiPage 入口组件
**文件**：`renderer/shenbi-page.tsx`

**功能**：
```tsx
<ShenbiPage
  schema={pageSchema}
  resolver={resolver}
  params={{ route: { id: '123' } }}
/>
```

**实现要点**：
- 调用 `usePageRuntime(page)` 初始化运行时
- 调用 `compileSchema(page.body, resolver)` 编译（useMemo 缓存）
- 创建 `<ShenbiContext value={...}>` 包裹 NodeRenderer（React 19 不再使用 `.Provider`）
- 渲染 `page.dialogs` 中声明的弹窗/抽屉（根据 state.__dialog_{id} 显隐）
- 注入外部 params（路由参数 / 父页面传入参数）

##### B4. 内置容器组件
**文件**：`renderer/builtins/container.tsx` + `renderer/builtins/index.ts`

**功能**：Schema 中需要但 antd 没有的内置组件：

| 组件 | 用途 |
|------|------|
| `Container` | 通用 Flex 容器（direction / gap / wrap） |
| `PageEmbed` | 页面嵌入（inline / modal / drawer / tab） |
| `__fragment` | Fragment 渲染，不产生 DOM |
| `__ref` | 模板引用，查找 page.templates 并渲染 |

##### B5. Preview 应用
**文件**：`apps/preview/src/`

**功能**：
- Vite + React + antd v6 项目
- 加载 JSON Schema → ShenbiPage 渲染
- 开发阶段：内嵌 Demo Schema（硬编码）
- 后续阶段：支持文件上传 / URL 加载 Schema

##### B6. Demo Schema
**文件**：`apps/preview/src/schemas/demo.json`

**6 个基础组件验证场景**：

```
场景 1 - Button:      静态 props + 事件 + loading 表达式
场景 2 - Input:       value 双向绑定（onChange → setState）
场景 3 - Select:      options 数据驱动 + onChange
场景 4 - Card:        children 嵌套 + slots (title/extra)
场景 5 - Tag + loop:  循环渲染 + if 条件过滤 + 表达式 color
场景 6 - Alert + if:  条件渲染 + 动态 message
```

组合为一个完整页面：搜索框 + Tag 列表 + 条件提示 + 操作按钮

---

### MVP-2：集成联调（串行）

**前提**：Worker A 和 B 各自模块测试通过。

**集成步骤**：

```
1. 将 Worker A 的 compiler/ + runtime/ 和 Worker B 的 renderer/ + resolver/ 合并到 engine 包
2. apps/preview 中引入 engine，用 Demo Schema 跑通完整流程
3. 修复集成 bug（主要是接口类型不匹配、Context 传递遗漏等）
4. 端到端验证：
   - 改 JSON 中的 state 默认值 → 页面自动更新 ✓
   - 点按钮 → 事件触发 → state 变化 → UI 响应 ✓
   - 输入框输入 → value 双向绑定 ✓
   - loop 渲染 + if 条件过滤 ✓
   - slots 渲染到正确位置 ✓
   - computed 计算属性响应式更新 ✓
   - watcher 监听变化触发 action ✓
```

---

## 七、验收标准

### 阶段 1 整体验收

| 验收项 | 标准 |
|--------|------|
| 表达式编译器 | 20+ 单元测试全绿 |
| Schema 编译器 | 16+ 单元测试全绿 |
| State + Computed | 路径 SET 正确，computed 缓存有效 |
| Action 执行器 | 17+ 测试覆盖基础 Action 类型 + callMethod |
| NodeRenderer | 递归渲染 + 条件 + 循环 + slots + events + columns |
| Resolver | antd v6 全组件映射，子组件解析 |
| Demo 页面 | 6 个组件场景全部可交互 |
| 性能 | 编译 200 节点 < 50ms，渲染帧率 > 55fps（基准：M1 MacBook / Chrome） |

### 各 Worker 的独立验收

**Worker A 独立验收**（不依赖 Worker B）：
```
✅ 纯逻辑测试：所有 compiler/ 和 runtime/ 测试在 vitest + jsdom 中通过
✅ 不依赖真实 antd 组件：用 mock resolver（resolve 返回 'div'）
✅ 不依赖真实 DOM 渲染：用 mock dispatch
```

**Worker B 独立验收**（不依赖 Worker A 的完整实现）：
```
✅ 用硬编码的 CompiledNode 对象测试 NodeRenderer（不经过 compiler）
✅ 用 mock runtime 测试事件绑定（executeActions 记录调用参数）
✅ Preview 应用能启动，渲染静态内容
```

---

## 八、后续阶段概要

### 阶段 2（常用组件验证，4-5 周）
- Table 全场景（远程分页+排序+筛选+行选择+可编辑）
- Form 全场景（校验+联动+Form.List）
- Modal / Drawer / Tabs / Tree / Descriptions
- 搜索列表 CRUD 页面端到端
- 组件契约注册（35+ 组件）
- Playwright 截图回归框架
- **React 19 新 Hooks 优化**：
  - `useActionState` 替代 fetch action 中手动管理 loading/error 的模式
  - `use()` 替代 `useContext` 用于 NodeRenderer 内部条件读取 Context
  - `useOptimistic` 用于 setState 的乐观更新模式
  - `useFormStatus` 用于 Form validate action 优化

### 阶段 3（全覆盖，3-4 周）
- 256 场景全覆盖
- 数据流校验引擎
- v6 语义化 classNames/styles
- 性能基准测试
- 文档 + 使用指南

---

## 九、给 Worker 的 Prompt 模板

### Worker A Prompt

```
你正在开发「神笔 (Shenbi)」低代码渲染引擎的 **编译层 + 运行时** 模块。

项目信息：
- 技术栈：React 19 + TypeScript 5.7 + Vitest
- 包名：@shenbi/engine
- 你负责的文件路径：packages/engine/src/compiler/ + packages/engine/src/runtime/
- Schema 类型定义在 packages/schema/types/ 中（包名 @shenbi/schema），已冻结不可修改

你需要实现的模块（按顺序）：
1. compiler/expression.ts — 表达式编译器（{{}} → Function + 依赖提取 + JSFunction 编译）
2. compiler/schema.ts — Schema 预编译器（SchemaNode → CompiledNode 树）
3. runtime/state.ts — 页面状态管理（useReducer，支持路径 SET）
4. runtime/computed.ts — 计算属性管理（依赖追踪 + 缓存）
5. runtime/action-executor.ts — ActionChain 执行器（22 种 Action 类型，含 callMethod 递归执行 page.methods）
6. runtime/watcher.ts — 状态监听器（声明式 watch + debounce/throttle）
7. runtime/datasource.ts — 数据源管理器（auto / deps / transform）

每个模块都要附带完整的单元测试文件 (.test.ts)。

[在此粘贴本文档第五节「模块接口契约」全文]
[在此粘贴本文档第六节 Worker A 部分的详细规格（A1-A6）]
[在此粘贴 @shenbi/schema 的类型定义文件内容]
```

### Worker B Prompt

```
你正在开发「神笔 (Shenbi)」低代码渲染引擎的 **渲染层 + 预览应用** 模块。

项目信息：
- 技术栈：React 19 + TypeScript 5.7 + Ant Design v6.3 + Vite 6
- 包名：@shenbi/engine（渲染层）+ @shenbi/preview（预览应用）
- 你负责的文件路径：packages/engine/src/renderer/ + packages/engine/src/resolver/ + apps/preview/
- Schema 类型定义在 packages/schema/types/ 中（包名 @shenbi/schema），已冻结不可修改

你需要实现的模块（按顺序）：
1. resolver/index.ts — 组件映射器（antd v6 全组件注册 + 子组件解析）
2. renderer/node-renderer.tsx — 核心递归渲染器（13 步渲染流程）
3. renderer/shenbi-page.tsx — 页面入口组件（Context Provider + Dialog 渲染）
4. renderer/builtins/ — 内置容器组件（Container / PageEmbed / __ref）
5. apps/preview/ — Vite 预览应用 + Demo Schema

渲染层消费的输入是 CompiledNode 类型（由编译层产出），
运行时接口是 PageRuntime 类型（由运行时产出）。
你可以用 mock 数据和 mock runtime 来独立开发和测试。

[在此粘贴本文档第五节「模块接口契约」全文]
[在此粘贴本文档第六节 Worker B 部分的详细规格（B1-B6）]
[在此粘贴 @shenbi/schema 的类型定义文件内容]
```
