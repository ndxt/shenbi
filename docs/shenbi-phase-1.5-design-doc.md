# 神笔 (Shenbi) 阶段 1.5 设计文档：CRUD 纵切面验证

> 前置条件：阶段 1 已完成（引擎核心 + 6 个基础组件跑通）
> 目标：用一个完整的「用户管理」CRUD 页面，验证引擎在真实业务场景下的完整能力
> 执行方式：单 Worker 串行，按依赖关系排序

---

## 一、为什么不直接做阶段 2

阶段 2 计划是横向铺 35+ 组件。问题是：横铺组件暴露不了引擎的架构缺陷。纵切面的价值在于——**一个页面串联所有机制**。做完这个纵切面后，横向铺组件就是纯体力活。

---

## 二、目标页面：用户管理

搜索区（Form + Input/Select/DatePicker）→ 列表区（Table + 分页/排序/行选择/可编辑/操作列）→ 弹窗区（Modal + Form 校验/联动）+ 全局机制（lifecycle/watcher/computed/syncToUrl/datasource/fetch/confirm/message）

---

## 三、执行顺序 & 依赖关系

```
Step 1  mock API + 共享 state
  → Step 2  引擎基础设施增强（嵌套 props 表达式 / JSFunction 编译 / 路径事件）
    → Step 3  Form 基础 + ref 注册
      → Step 4  Action 完善（fetch / validate / resetForm / confirm / modal payload）
        → Step 5  Dialog 渲染系统
          → Step 6  Form 校验 + 联动
            → Step 7  Table 基础 + columns render
              → Step 8  Table 交互（分页/排序/行选择/操作列）
                → Step 9  可编辑行
                  → Step 10 全局机制（lifecycle/watcher/computed/syncToUrl）
                    → Step 11 集成 CRUD 页面 + 端到端验收
```

先 Form + Modal（引擎基础设施），再 Table（依赖基础设施），最后集成。

---

## 四、各 Step 详细规格

### Step 1：Mock API + 共享 State

**Mock API**：拦截 window.fetch，50 条内存用户数据，支持 CRUD + 分页/搜索/排序，模拟 200-500ms 延迟。零第三方依赖。

**API 路由**：
- GET /api/users?keyword=&status=&page=1&pageSize=10&sortField=&sortOrder= → { code: 0, data: { list, total } }
- POST /api/users → { code: 0, data: User }
- PUT /api/users/:id → { code: 0, data: User }
- DELETE /api/users/:id → { code: 0 }

**共享 State（13 个字段）**：
```json
{
  "userList": [], "total": 0, "loading": false,
  "keyword": "", "statusFilter": "", "dateRange": null,
  "pagination": { "current": 1, "pageSize": 10 },
  "sorter": { "field": null, "order": null },
  "selectedRowKeys": [],
  "editingRowId": null, "editingData": {},
  "dialogMode": null, "currentRecord": null
}
```

dialogMode: null=无弹窗, "add"=新增, "edit"=编辑

---

### Step 2：引擎基础设施增强

#### 2a. 嵌套对象 props 表达式

**问题**：阶段 1 只处理扁平 props。Table 的 pagination/rowSelection 是嵌套对象，内部字段含表达式。

**方案**：`compilePropsValue(value)` 递归扫描——表达式字符串/JSExpression/JSFunction/SchemaRender 各自编译，普通对象递归检查子字段，数组递归检查元素。含动态子字段的对象标记为 `{ __compiledObject: true, fields }`。

渲染层配套 `resolveCompiledValue(compiled, ctx)` 递归求值。

**测试**：扁平兼容 / 嵌套对象 / 深层嵌套 / 数组中表达式 / 混合 / 全静态对象不进 dynamicProps

#### 2b. JSFunction props 编译

**问题**：antd 部分 props 需要函数（sorter/onFilter/validator/showTotal）。

**方案**：`compileJSFunction(jsFn)` 编译为 `(ctx) => (...params) => result`。标记 `isFactory: true`，渲染时先用 ctx 调用得到真实函数。自动判断 body 是否需要包裹 return。

**测试**：showTotal / sorter / validator / ctx 访问 / auto return / explicit return

#### 2c. 路径事件绑定

**问题**：antd rowSelection.onChange 嵌套在 props 内部。

**方案**：events key 含 `.` 时，用 `setByPath(props, key, handler)` 挂载到嵌套位置。顺序：先解析表达式 props → 再挂路径事件。

**测试**：顶层兼容 / 路径事件 / 深层路径 / 路径事件+路径 props 共存

---

### Step 3：Form 基础渲染 + ref 自动注册

**方案**：NodeRenderer 中 componentType='Form' 时特殊处理——自动 `Form.useForm()` 创建实例，注入 form prop，注册到 `$refs[node.id]`。initialValues 变化时调用 `form.setFieldsValue`（antd initialValues 只首次生效）。

**Resolver**：注册 Form / Form.Item / DatePicker.RangePicker / Radio.Group / Checkbox.Group

**测试**：Form 渲染 / Form.Item label+name / 子控件 / ref 注册 / getFieldsValue / setFieldsValue / resetFields / initialValues / initialValues 变化

---

### Step 4：Action 完善

#### 4a. fetch
解析请求配置（支持 datasource 引用或直接 URL），GET 参数拼 URL，POST 参数放 body，onSuccess 注入 response 到 event 上下文，onError/onFinally 递归执行。

#### 4b. validate / resetForm
通过 `$refs[action.ref]` 获取 form 实例。validate: `form.validateFields()` → onSuccess(values) / onError(errorInfo)。resetForm: `form.resetFields(fields?)`。

#### 4c. confirm
动态 import antd Modal，调用 `Modal[confirmType]({ title, content, onOk, onCancel })`。onOk/onCancel 递归执行动作链。

#### 4d. modal/drawer payload
open 时存储 payload 到 `dialogPayloads[id]`，close 时清除。dispatch SET `__dialog_{id}` 控制显隐。

**测试**：fetch GET/POST/onSuccess/onError/onFinally/datasource引用/参数覆盖 + validate 通过/失败/ref不存在 + resetForm 全部/部分 + confirm 弹出/onOk/onCancel + modal open/close/payload

---

### Step 5：Dialog 渲染系统

**改造文件**：shenbi-page.tsx

ShenbiPage 遍历 `page.dialogs`，为每个 dialog 编译 body/footer → 渲染 Modal/Drawer（根据 type）。显隐通过 `state.__dialog_{id}` 控制。props 中的表达式实时求值（如动态标题）。destroyOnClose 时 visible=false 不渲染 body。footer 自定义渲染。

**测试**：初始不渲染 / open → 显示 / close → 隐藏 / 动态标题 / destroyOnClose / footer 自定义 / footer 事件 / 编辑回填 / Drawer 类型

---

### Step 6：Form 校验 + 联动

#### 6a. rules 中 JSFunction validator
Step 2 的嵌套 props 递归已覆盖——rules 数组内对象的 validator JSFunction 会被 compilePropsValue 递归编译。确认此路径通畅。

#### 6b. 表单联动
Form onValuesChange → condition action → setState currentRecord.role → 下方 Form.Item if 条件重新求值 → 权限组字段显隐。

**测试**：required / min/max / JSFunction validator / 多规则 / 联动显隐 / onValuesChange 同步

---

### Step 7：Table 基础 + columns render

**7a 基础**：dataSource / rowKey / loading / bordered 透传。简单列 { title, dataIndex } 正确渲染。

**7b columns render**：NodeRenderer 处理 compiledColumns，为有 compiledRender 的列生成 antd 格式 `render: (text, record, index) => <NodeRenderer compiled={...} extraContext={{text,record,index}} />`。

操作列用 Space > Button(编辑) + Popconfirm > Button(删除) 组合。

**测试**：简单列 / render 列 Tag / render 中表达式 / render 中嵌套 Space / render 中事件 / 操作列编辑+删除 / 多列混合

---

### Step 8：Table 交互（分页 / 排序 / 行选择）

**8a 分页**：pagination 嵌套对象 props（Step 2a），showTotal JSFunction（Step 2b），onChange → setState pagination → callMethod fetchUsers。event[0]=pagination, event[2]=sorter。

**8b 排序**：column sorter: true，从 onChange event[2] 取 field/order。

**8c 行选择**：rowSelection 嵌套 props + 路径事件 rowSelection.onChange（Step 2c），更新 selectedRowKeys。

**8d 操作列端到端**：编辑流程（setState → modal open → validate → fetch PUT → close → refresh）+ 删除流程（Popconfirm → fetch DELETE → message → refresh）。

**测试**：翻页 / 改 pageSize / showTotal / 排序 / 行选择/全选 / 编辑流程 / 删除流程

---

### Step 9：可编辑行

根据 `props.editable.editingKey` 对比 `record[rowKey]`，匹配行用 compiledEditRender，不匹配用 compiledRender。编辑数据通过 editingData state 双向绑定。保存调 callMethod → fetch PUT → 清空 editingRowId → refresh。

**测试**：默认 render / 点编辑切换 / Input onChange 更新 editingData / 保存 / 取消 / 只能编辑一行 / 无 editRender 列不变 / 无任何 render 显示文本

---

### Step 10：全局机制

**10a lifecycle**：onMount → callMethod fetchUsers（useEffect mount）
**10b watcher**：useEffect + useRef 变化检测 + debounce（setTimeout/clearTimeout）+ immediate
**10c computed**：useMemo + deps 路径取值检测变化 + 注入 ExpressionContext.computed
**10d syncToUrl**：新增 runtime/sync-url.ts。初始化从 URL 恢复 state，state 变化更新 URL（history.replaceState）。支持 number/boolean/json transform。

**测试**：onMount 自动查询 / watcher debounce / 连续输入只触发一次 / computed 实时更新 / computed 控制显隐 / syncToUrl 双向同步 / URL 恢复

---

### Step 11：集成完整 CRUD 页面

组合 Step 1-10 为一份 user-management.json。包含：state(13) + computed(2) + methods(3) + dataSources(4) + lifecycle + watchers(1) + syncToUrl(3) + dialogs(1) + body(Card > 搜索Form + 已选提示 + Table)。

**端到端验收**（共 17 项）：页面加载自动查询 / 搜索 debounce / 状态筛选 / 重置 / 翻页 / 改 pageSize / 排序 / 行选择 / 新增(校验失败+校验通过) / 编辑(回填+修改+提交) / 删除(Popconfirm+确认) / 表单联动 / 行内编辑(保存+取消) / URL 同步 / URL 恢复 / 无 console.error

---

## 五、引擎改造汇总

| Step | 改造 | 文件 |
|------|------|------|
| 2a | 嵌套对象 props 表达式递归解析 | compiler/schema.ts + renderer/node-renderer.tsx |
| 2b | JSFunction props 编译为可执行函数 | compiler/expression.ts |
| 2c | 路径事件绑定 | renderer/node-renderer.tsx |
| 3 | Form ref 自动注册 + initialValues 同步 | renderer/node-renderer.tsx |
| 4a | fetch action 完整实现 | runtime/action-executor.ts |
| 4b | validate / resetForm action | runtime/action-executor.ts |
| 4c | confirm action | runtime/action-executor.ts |
| 4d | modal/drawer action payload | runtime/action-executor.ts |
| 5 | Dialog 渲染系统 | renderer/shenbi-page.tsx |
| 7 | columns render/editRender → antd render | renderer/node-renderer.tsx |
| 9 | Table editable 行切换逻辑 | renderer/node-renderer.tsx |
| 10b | watcher 完整实现 | runtime/watcher.ts |
| 10c | computed 完整实现 | runtime/computed.ts |
| 10d | syncToUrl | runtime/sync-url.ts（新增）|

---

## 六、Prompt 模板

```
你正在开发「神笔 (Shenbi)」低代码渲染引擎的阶段 1.5：CRUD 纵切面验证。

阶段 1 已完成：引擎核心（编译层 + 运行时 + 渲染层）+ 6 个基础组件已跑通。
阶段 1.5 目标：用一个完整的「用户管理」CRUD 页面验证引擎在真实场景下的能力。

技术栈：React 19 + TypeScript 5.7 + Ant Design v6.3 + Vite 6 + Vitest
包名：@shenbi/engine + @shenbi/schema（类型已冻结）

请按以下顺序串行实现，每完成一个 Step 运行测试确认通过后再进入下一个：

Step 1:  Mock API + 共享 state 定义
Step 2:  引擎基础设施增强（嵌套 props 表达式 / JSFunction 编译 / 路径事件）
Step 3:  Form 基础渲染 + ref 自动注册
Step 4:  Action 完善（fetch / validate / resetForm / confirm / modal payload）
Step 5:  Dialog 渲染系统（page.dialogs → Modal/Drawer）
Step 6:  Form 校验 rules + 联动
Step 7:  Table 基础 + columns render（SchemaRender）
Step 8:  Table 交互（分页 / 排序 / 行选择 / 操作列）
Step 9:  可编辑行（editRender）
Step 10: 全局机制（lifecycle / watcher / computed / syncToUrl）
Step 11: 集成完整 CRUD 页面 + 端到端验收

每个 Step 要求：
1. 实现代码
2. 对应的单元测试或集成测试
3. 运行 pnpm test:engine 全绿后再继续

[在此粘贴本文档各 Step 详细规格]
[在此粘贴 @shenbi/schema 类型定义文件内容]
[在此粘贴阶段 1 已有代码]
```

---

## 附录：各 Step 关键代码规格

### Step 2a 嵌套 props 编译核心代码

```typescript
// compiler/schema.ts
function compilePropsValue(value: any): { isStatic: boolean; compiled: any } {
  if (isExpression(value))
    return { isStatic: false, compiled: compileExpression(value) };
  if (value?.__type === 'JSExpression')
    return { isStatic: false, compiled: compileExpression(value.value) };
  if (value?.__type === 'JSFunction')
    return { isStatic: false, compiled: compileJSFunction(value) };
  if (value?.__type === 'SchemaRender')
    return { isStatic: false, compiled: compileSchemaRender(value) };

  if (isPlainObject(value)) {
    let hasAnyDynamic = false;
    const compiled: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const result = compilePropsValue(v);
      compiled[k] = result.compiled;
      if (!result.isStatic) hasAnyDynamic = true;
    }
    if (hasAnyDynamic)
      return { isStatic: false, compiled: { __compiledObject: true, fields: compiled } };
    return { isStatic: true, compiled: value };
  }

  if (Array.isArray(value)) {
    let hasAnyDynamic = false;
    const compiled = value.map(item => {
      const result = compilePropsValue(item);
      if (!result.isStatic) hasAnyDynamic = true;
      return result.compiled;
    });
    if (hasAnyDynamic)
      return { isStatic: false, compiled: { __compiledArray: true, items: compiled } };
    return { isStatic: true, compiled: value };
  }

  return { isStatic: true, compiled: value };
}

// renderer/node-renderer.tsx
function resolveCompiledValue(compiled: any, ctx: ExpressionContext): any {
  if (compiled?.fn && compiled?.deps) return compiled.fn(ctx);
  if (compiled?.isFactory) return compiled.fn(ctx);
  if (compiled?.__compiledObject) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(compiled.fields))
      result[k] = resolveCompiledValue(v, ctx);
    return result;
  }
  if (compiled?.__compiledArray)
    return compiled.items.map((item: any) => resolveCompiledValue(item, ctx));
  return compiled;
}
```

### Step 2b JSFunction 编译核心代码

```typescript
// compiler/expression.ts
function compileJSFunction(jsFn: JSFunction): CompiledExpression {
  const paramList = jsFn.params || [];
  const fn = new Function(
    'ctx',
    `const {state,params:_params,computed,ds,utils,env,$refs} = ctx;
     return function(${paramList.join(',')}) {
       ${jsFn.body.includes('return') ? jsFn.body : `return (${jsFn.body})`}
     };`
  ) as (ctx: ExpressionContext) => (...args: any[]) => any;

  return {
    fn,
    deps: extractDeps(jsFn.body),
    raw: `JSFunction(${paramList.join(',')}) { ${jsFn.body} }`,
    isFactory: true
  };
}
```

### Step 2c 路径事件核心代码

```typescript
// renderer/node-renderer.tsx
for (const [eventKey, actionChain] of Object.entries(events)) {
  const handler = (...args: any[]) => {
    runtime.executeActions(actionChain, args[0], { event: args });
  };
  if (eventKey.includes('.')) {
    setByPath(resolvedProps, eventKey, handler);
  } else {
    resolvedProps[eventKey] = handler;
  }
}

function setByPath(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object')
      current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}
```

### Step 3 Form ref 核心代码

```typescript
// renderer/node-renderer.tsx — Form 特殊处理
if (compiled.componentType === 'Form') {
  const [form] = Form.useForm();
  resolvedProps.form = form;

  useEffect(() => {
    if (compiled.id) {
      runtime.registerRef(compiled.id, form);
      return () => runtime.registerRef(compiled.id!, null);
    }
  }, [compiled.id, form]);

  useEffect(() => {
    if (resolvedProps.initialValues) {
      form.setFieldsValue(resolvedProps.initialValues);
    }
  }, [resolvedProps.initialValues]);
}
```

### Step 4a fetch Action 核心代码

```typescript
case 'fetch': {
  let url, method, params, headers, onSuccess, onError, onFinally;

  if (action.datasource) {
    const ds = options.dataSources[action.datasource];
    if (!ds) { console.error(`DataSource "${action.datasource}" not found`); break; }
    url = resolveValue(ds.url, ctx);
    method = ds.method || action.method || 'GET';
    params = resolveValue(action.params || ds.params, ctx);
    headers = resolveValue(action.headers || ds.headers, ctx);
    onSuccess = action.onSuccess || ds.onSuccess;
    onError = action.onError || ds.onError;
    onFinally = action.onFinally || ds.onFinally;
  } else {
    url = resolveValue(action.url, ctx);
    method = action.method || 'GET';
    params = resolveValue(action.params, ctx);
    headers = resolveValue(action.headers, ctx);
    onSuccess = action.onSuccess;
    onError = action.onError;
    onFinally = action.onFinally;
  }

  try {
    const fetchOpts: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (method === 'GET') {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      url = url + qs;
    } else {
      fetchOpts.body = JSON.stringify(params);
    }
    const res = await window.fetch(url, fetchOpts);
    const data = await res.json();
    if (onSuccess) await executeActions(onSuccess, { ...ctx, event: data }, dispatch, options);
  } catch (error) {
    if (onError) await executeActions(onError, { ...ctx, event: error }, dispatch, options);
  } finally {
    if (onFinally) await executeActions(onFinally, ctx, dispatch, options);
  }
  break;
}
```

### Step 4b validate / resetForm

```typescript
case 'validate': {
  const form = options.refs[action.ref];
  if (!form) { console.error(`[Shenbi] Form ref "${action.ref}" not found`); break; }
  try {
    const values = await form.validateFields();
    if (action.onSuccess)
      await executeActions(action.onSuccess, { ...ctx, event: values }, dispatch, options);
  } catch (errorInfo) {
    if (action.onError)
      await executeActions(action.onError, { ...ctx, event: errorInfo }, dispatch, options);
  }
  break;
}

case 'resetForm': {
  const form = options.refs[action.ref];
  if (!form) { console.error(`[Shenbi] Form ref "${action.ref}" not found`); break; }
  form.resetFields(action.fields);
  break;
}
```

### Step 4c confirm

```typescript
case 'confirm': {
  const title = resolveValue(action.title, ctx);
  const content = resolveValue(action.content, ctx);
  const { Modal } = await import('antd');
  Modal[action.confirmType || 'confirm']({
    title, content,
    okText: action.okText, cancelText: action.cancelText,
    onOk: async () => {
      if (action.onOk) await executeActions(action.onOk, ctx, dispatch, options);
    },
    onCancel: async () => {
      if (action.onCancel) await executeActions(action.onCancel, ctx, dispatch, options);
    },
  });
  break;
}
```

### Step 4d modal/drawer payload

```typescript
case 'modal':
case 'drawer': {
  const dialogId = action.id;
  if (action.action === 'open') {
    const payload = action.payload ? resolveValue(action.payload, ctx) : undefined;
    if (payload !== undefined) options.dialogPayloads[dialogId] = payload;
    dispatch({ type: 'SET', key: `__dialog_${dialogId}`, value: true });
  } else {
    dispatch({ type: 'SET', key: `__dialog_${dialogId}`, value: false });
    delete options.dialogPayloads[dialogId];
  }
  break;
}
```

### Step 5 Dialog 渲染核心代码

```tsx
// renderer/shenbi-page.tsx
{Object.entries(compiledDialogs).map(([id, dialog]) => {
  const visible = !!runtime.state[`__dialog_${id}`];
  const DialogComponent = dialog.type === 'modal' ? Modal : Drawer;
  const dialogProps = resolveCompiledProps(dialog.props, ctx);

  return (
    <DialogComponent
      key={id}
      open={visible}
      onCancel={() => runtime.dispatch({ type: 'SET', key: `__dialog_${id}`, value: false })}
      footer={dialog.footer?.map((f, i) =>
        <NodeRenderer key={i} compiled={f} context={ctx} />
      )}
      {...dialogProps}
    >
      {visible && <NodeRenderer compiled={dialog.body} context={ctx} />}
    </DialogComponent>
  );
})}
```

### Step 7 columns render 核心代码

```typescript
const antdColumns = compiledColumns
  .filter(col => !col.ifFn || col.ifFn.fn(ctx))
  .map(col => {
    const result = { ...col.config };
    if (col.compiledRender) {
      result.render = (text: any, record: any, index: number) => {
        const paramNames = col.renderParams || ['text', 'record', 'index'];
        const extraCtx = paramNames.reduce((acc, key, i) => ({
          ...acc, [key]: [text, record, index][i]
        }), {});
        return <NodeRenderer compiled={col.compiledRender} extraContext={extraCtx} />;
      };
    }
    return result;
  });
```

### Step 9 editable 行切换核心代码

```typescript
if (col.compiledEditRender && editableConfig) {
  const editingKey = resolveValue(editableConfig.editingKey, ctx);

  result.render = (text: any, record: any, index: number) => {
    const isEditing = record[rowKey] === editingKey;
    const compiledNode = isEditing ? col.compiledEditRender! : col.compiledRender;
    if (!compiledNode) return text;
    const extraCtx = { text, record, index };
    return <NodeRenderer compiled={compiledNode} extraContext={extraCtx} />;
  };
}
```

### Step 10d syncToUrl 核心代码

```typescript
// runtime/sync-url.ts
function useSyncToUrl(config: Record<string, SyncToUrlDef>, state: any, dispatch: Dispatch) {
  // 初始化：从 URL 恢复 state
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    for (const [stateKey, def] of Object.entries(config)) {
      const raw = sp.get(def.queryKey);
      if (raw !== null) {
        let parsed: any = raw;
        if (def.transform === 'number') parsed = Number(raw);
        if (def.transform === 'boolean') parsed = raw === 'true';
        if (def.transform === 'json') parsed = JSON.parse(raw);
        dispatch({ type: 'SET', key: stateKey, value: parsed });
      }
    }
  }, []);

  // state → URL
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    for (const [stateKey, def] of Object.entries(config)) {
      const value = getByPath(state, stateKey);
      if (value == null || value === '' || value === def.default) {
        sp.delete(def.queryKey);
      } else {
        sp.set(def.queryKey, def.transform === 'json' ? JSON.stringify(value) : String(value));
      }
    }
    const url = sp.toString()
      ? `${window.location.pathname}?${sp}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [state]);
}
```

### Step 11 完整 Schema 结构（关键片段）

```json
{
  "page": {
    "id": "user-management",
    "title": "用户管理",
    "state": { "...13 fields..." },
    "computed": {
      "selectedCount": { "deps": ["state.selectedRowKeys"], "expr": "{{state.selectedRowKeys.length}}" },
      "hasSelected": { "deps": ["state.selectedRowKeys"], "expr": "{{state.selectedRowKeys.length > 0}}" }
    },
    "methods": {
      "fetchUsers": { "body": [
        { "type": "setState", "key": "loading", "value": true },
        { "type": "fetch", "datasource": "userList",
          "params": { "keyword": "{{state.keyword}}", "status": "{{state.statusFilter}}",
            "page": "{{state.pagination.current}}", "pageSize": "{{state.pagination.pageSize}}",
            "sortField": "{{state.sorter.field}}", "sortOrder": "{{state.sorter.order}}" },
          "onSuccess": [
            { "type": "setState", "key": "userList", "value": "{{event.data.list}}" },
            { "type": "setState", "key": "total", "value": "{{event.data.total}}" }
          ],
          "onFinally": [{ "type": "setState", "key": "loading", "value": false }]
        }
      ]},
      "saveUser": { "body": [
        { "type": "condition", "if": "{{state.dialogMode === 'edit'}}",
          "then": [{ "type": "fetch", "datasource": "updateUser", "params": "{{event}}" }],
          "else": [{ "type": "fetch", "datasource": "createUser", "params": "{{event}}" }] },
        { "type": "message", "level": "success", "content": "保存成功" },
        { "type": "modal", "id": "userDialog", "action": "close" },
        { "type": "callMethod", "name": "fetchUsers" }
      ]},
      "saveEditRow": { "body": [
        { "type": "fetch", "datasource": "updateUser", "params": "{{state.editingData}}",
          "onSuccess": [
            { "type": "message", "level": "success", "content": "保存成功" },
            { "type": "setState", "key": "editingRowId", "value": null },
            { "type": "callMethod", "name": "fetchUsers" }
          ]}
      ]}
    },
    "dataSources": {
      "userList":   { "url": "/api/users", "method": "GET" },
      "createUser": { "url": "/api/users", "method": "POST" },
      "updateUser": { "url": "{{`/api/users/${state.currentRecord?.id || state.editingData?.id}`}}", "method": "PUT" },
      "deleteUser": { "url": "{{`/api/users/${event.id}`}}", "method": "DELETE" }
    },
    "lifecycle": { "onMount": [{ "type": "callMethod", "name": "fetchUsers" }] },
    "watchers": [{ "watch": ["state.keyword", "state.statusFilter"],
      "handler": [
        { "type": "setState", "key": "pagination.current", "value": 1 },
        { "type": "callMethod", "name": "fetchUsers" }
      ], "debounce": 300 }],
    "syncToUrl": {
      "keyword": { "queryKey": "q" },
      "statusFilter": { "queryKey": "status" },
      "pagination": { "queryKey": "page", "transform": "json" }
    },
    "dialogs": { "userDialog": { "type": "modal", "props": { "title": "{{state.dialogMode === 'edit' ? '编辑用户' : '新增用户'}}", "width": 600, "destroyOnClose": true }, "body": "...", "footer": "..." } },
    "body": { "componentType": "Card", "children": ["搜索Form", "已选提示", "Table"] }
  }
}
```
