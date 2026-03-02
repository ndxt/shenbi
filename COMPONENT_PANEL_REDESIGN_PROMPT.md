# 组件面板重设计需求

## 背景

当前组件面板使用网格布局（2列）展示所有组件，但存在以下问题：

1. **空间浪费**：像 `Layout`、`Layout.Header`、`Layout.Content`、`Layout.Footer`、`Layout.Sider` 这样的父子组件占用了 5 个格子，非常占空间
2. **视觉混乱**：父子组件没有明显的层级关系，用户难以理解它们的关联
3. **信息缺失**：用户不知道每个组件的用途和使用场景

## 当前实现

**文件位置**：`apps/preview/src/panels/ComponentPanel.tsx`

**当前布局**：
```
┌─────────────┬─────────────┐
│ Layout      │ Layout.Hdr  │
├─────────────┼─────────────┤
│ Layout.Cnt  │ Layout.Ftr  │
├─────────────┼─────────────┤
│ Layout.Sdr  │ Space       │
└─────────────┴─────────────┘
```

**数据结构**：
```typescript
interface ComponentItem {
  id: string;           // 如 "Layout.Header"
  name: string;         // 显示名称
  icon: React.ReactNode; // 从契约的 icon 字段动态加载
  description?: string;  // 组件说明（可选）
}
```

**父子关系识别规则**：
- 组件名包含 `.` 的是子组件（如 `Layout.Header`）
- `.` 前面的部分是父组件名（如 `Layout`）
- 例如：`Layout`、`FloatButton`、`Typography`、`Tabs`、`Tree`、`Skeleton` 等都有子组件

## 设计需求

### 核心目标
1. **节省空间**：减少父子组件占用的空间
2. **清晰层级**：让用户一眼看出父子关系
3. **提供说明**：让用户了解组件用途
4. **保持美观**：符合专业 IDE 的视觉风格

### 约束条件
1. **必须保持原有样式变量**：
   - `bg-bg-sidebar`、`bg-bg-canvas`、`bg-bg-activity-bar`
   - `text-text-primary`、`text-text-secondary`
   - `border-border-ide`
   - 使用 Tailwind CSS
2. **必须支持搜索过滤**：当前有搜索框，需要保留
3. **必须支持点击插入**：点击组件调用 `onInsert(componentType)`
4. **图标动态加载**：从 `lucide-react` 动态加载，已实现 `getIconFromContract()` 函数

### 参考设计

可以参考以下专业工具的组件面板设计：
- **Figma**：左侧组件面板，支持分组和搜索
- **Webflow**：组件面板有清晰的分类和层级
- **VS Code**：文件树的展开/折叠交互
- **Photoshop**：图层面板的层级展示

## 设计方案探讨

### 方案 A：树形展开/折叠（类似 PS 图层面板）

**优点**：
- 清晰的层级关系
- 节省空间（默认折叠）
- 符合用户习惯

**缺点**：
- 需要点击才能看到子组件
- 展开会撑开其他组件

**视觉示例**：
```
▼ Layout          [图标]  ⓘ
  ├ Header        [图标]  ⓘ
  ├ Content       [图标]  ⓘ
  ├ Footer        [图标]  ⓘ
  └ Sider         [图标]  ⓘ
▶ FloatButton     [图标]  ⓘ
```

### 方案 B：悬浮展开（Popover）

**优点**：
- 不占用空间
- 不影响其他组件位置

**缺点**：
- 需要额外交互
- 容易误触

**视觉示例**：
```
Layout        [图标] ⋮  ← 悬停显示子组件
FloatButton   [图标]
```

### 方案 C：分组卡片（类似 Figma）

**优点**：
- 一目了然
- 视觉清晰

**缺点**：
- 仍然占用较多空间

**视觉示例**：
```
┌─────────────────────────┐
│ Layout                  │
│ ┌─────┬─────┬─────┬───┐ │
│ │ Hdr │ Cnt │ Ftr │Sdr│ │
│ └─────┴─────┴─────┴───┘ │
└─────────────────────────┘
```

### 方案 D：智能合并显示

**优点**：
- 最节省空间
- 保留完整功能

**缺点**：
- 需要设计合理的交互

**视觉示例**：
```
┌─────────────┬─────────────┐
│ Layout ▼    │ FloatBtn ▼  │  ← 点击展开子菜单
├─────────────┼─────────────┤
│ Space       │ Row         │
└─────────────┴─────────────┘
```

### 方案 E：列表 + 标签（推荐）

**优点**：
- 紧凑但信息完整
- 不需要额外交互
- 视觉清晰

**视觉示例**：
```
Layout                    [图标]  ⓘ
  Header | Content | Footer | Sider
FloatButton               [图标]  ⓘ
  Group | BackTop
Space                     [图标]  ⓘ
```

## 技术实现要点

### 1. 父子关系识别
```typescript
function buildComponentTree(contracts: ComponentContract[]): ComponentItem[] {
  // 识别 "Layout.Header" 中的父组件 "Layout"
  // 构建树形结构
}
```

### 2. 组件说明
```typescript
const componentDescriptions: Record<string, string> = {
  'Layout': '页面整体布局容器，支持顶部、底部、侧边栏等区域',
  'Layout.Header': '页面顶部导航栏，常用于 Logo、菜单、用户信息',
  // ...
};
```

### 3. 搜索过滤
- 搜索时需要同时匹配父组件和子组件
- 如果子组件匹配，父组件也应该显示

### 4. 图标加载
```typescript
function getIconFromContract(iconName?: string): React.ReactNode {
  const IconComponent = (LucideIcons as Record<string, LucideIcon>)[iconName];
  return <IconComponent size={16} />;
}
```

## 期望输出

请提供：
1. **推荐的设计方案**（可以是上述方案之一，或全新方案）
2. **完整的实现代码**（替换 `ComponentPanel.tsx`）
3. **视觉效果说明**（用 ASCII 或文字描述）
4. **交互细节说明**（点击、悬停、展开等行为）

## 评估标准

1. **空间效率**：父子组件占用的空间是否合理
2. **视觉清晰度**：层级关系是否一目了然
3. **交互便捷性**：是否需要多次点击才能使用
4. **美观专业**：是否符合专业 IDE 的视觉标准
5. **实现复杂度**：代码是否简洁易维护

## 附加信息

- **项目技术栈**：React 19 + TypeScript + Tailwind CSS 4
- **图标库**：lucide-react ^0.575.0
- **组件总数**：约 87 个组件，其中约 20 个有子组件
- **目标用户**：低代码平台的开发者

---

**请基于以上需求，提供你认为最优的设计方案和完整实现代码。**
