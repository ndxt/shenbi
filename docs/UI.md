# 神笔 (Shenbi) Preview IDE - UI/UX Specification

> **Version:** 2.1.0 (Detailed)
> **Date:** 2026-02-21
> **Design Language:** Professional IDE (VS Code Inspired)
> **Tech Stack:** Tailwind CSS v4 + shadcn/ui + Radix UI + Monaco Editor

---

## 1. Design Principles (设计原则)

*   **Content First (内容至上)**: The UI Shell should be recessive. The user's focus must remain on the Canvas (the creation) and the Code/Data (the logic).
*   **High Density (高密度)**: Unlike consumer apps, this is a productivity tool. Use compact spacing (`gap-2`, `px-3`, `text-xs/sm`) to display maximum information without clutter.
*   **Visual Hierarchy (视觉层级)**: Use contrast (borders, background shades) rather than heavy drop shadows to define depth and separation.
*   **Dark Mode Native (原生深色)**: The interface is designed primarily for Dark Mode to reduce eye strain during long coding sessions, with high-contrast accent colors for active states.

---

## 2. Visual System (视觉系统)

### 2.1 Color Palette (Tailwind Tokens)

| Token Name | Tailwind Utility (Dark) | Description |
| :--- | :--- | :--- |
| **Surface** | | |
| `bg-activity-bar` | `bg-zinc-950` (`#09090b`) | 最左侧活动栏背景 |
| `bg-sidebar` | `bg-zinc-900` (`#18181b`) | 侧边栏/面板背景 |
| `bg-editor` | `bg-zinc-950` (`#09090b`) | 代码编辑器/主要工作区背景 |
| `bg-panel-header` | `bg-zinc-900` (`#18181b`) | 面板标题栏 |
| `bg-canvas` | `bg-zinc-800/50` | 画布外围背景 (Dot Pattern) |
| **Border** | | |
| `border-base` | `border-zinc-800` | 通用分割线 |
| `border-focus` | `border-blue-500` | 输入框/选中态边框 |
| **Text** | | |
| `text-primary` | `text-zinc-100` | 主要文字 |
| `text-secondary` | `text-zinc-400` | 次要文字/标签 |
| `text-muted` | `text-zinc-500` | 占位符/禁用态 |
| **Accents** | | |
| `accent-primary` | `bg-blue-600` | 主要操作/选中高亮 |
| `accent-success` | `text-emerald-500` | 成功状态/字符串 |
| `accent-warning` | `text-amber-500` | 警告/数字 |
| `accent-error` | `text-red-500` | 错误/删除 |

### 2.2 Typography (排版)

*   **UI Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`.
    *   Base Size: `13px` (Standard for VS Code UI).
    *   Headers: `11px` Uppercase Tracking-wide (Panel Titles).
    *   Labels: `10px` text-zinc-500 (Input labels).
*   **Code Font**: `JetBrains Mono`, `Fira Code`, `Consolas`.
    *   Size: `12px`.
    *   Ligatures: Enabled.

---

## 3. Application Shell (整体框架)

The application uses a **Holy Grail Layout** managed by `react-resizable-panels`.

```
[ Activity Bar (48px) ] [ Side Bar (Min 200px, Auto) ] [ Resizable Handle (1px) ] [      Editor / Canvas Area (Flex)      ] [ Resizable Handle (1px) ] [ Right Panel (Min 240px) ]
                                                                                                                           | 
                                                                                                                           [ Status Bar (22px) ]
```

### 3.1 Activity Bar (ActivityBar.tsx)
*   **Position**: Fixed Left.
*   **Width**: `48px`.
*   **Style**: `bg-zinc-950 border-r border-zinc-800`.
*   **Interaction**:
    *   **Items**: Icon-only buttons (24px icons).
    *   **State**: Active item has a white `border-l-2` (left border) and `text-white`. Inactive items are `text-zinc-500` with `hover:text-zinc-300`.
    *   **Tooltips**: Custom shadcn tooltip appearing to the right (`Explorer (Ctrl+Shift+E)`).
*   **Items**:
    1.  `Files` (Explorer)
    2.  `Search` (Global Search)
    3.  `Database` (State Management)
    4.  `Bug` (Debug/Actions)
    5.  `Extensions` (Components Library - Future)
    6.  *(Bottom)* `Settings` (Cog icon)

### 3.2 Side Bar (Sidebar.tsx)
*   **Position**: Left of Activity Bar.
*   **Width**: Resizable (Default 260px).
*   **Style**: `bg-zinc-900`.
*   **Header**:
    *   Height: `35px`.
    *   Content: Uppercase Title (e.g., "EXPLORER") + Actions (Collapse, Refresh).
    *   Font: `text-[11px] font-bold text-zinc-400`.
*   **Content - "Explorer" View**:
    *   **Component Tree**: A recursive tree view of the Schema.
    *   **Row Item**:
        *   Height: `22px`.
        *   Indentation: `12px` per level.
        *   Icon: Type-specific icon (e.g., `Box` for Container, `Type` for Text).
        *   Interaction: Single click selects (updates Inspector). Double click expands/collapses.
        *   **Drag & Drop**: Ghost indicator line between items when dragging to reorder.
*   **Content - "State" View**:
    *   **State Tree**: JSON viewer for `page.state`.
    *   **Values**: Editable input fields for primitive types (string/number/boolean) to facilitate testing.
    *   **Micro-interaction**: When a state value changes (via runtime), the background flashes yellow (`bg-yellow-500/20`) -> transparent (fade out 500ms).

### 3.3 Status Bar (StatusBar.tsx)
*   **Position**: Fixed Bottom.
*   **Height**: `22px`.
*   **Style**: `bg-blue-600` (Processing) or `bg-zinc-800` (Idle).
*   **Content**:
    *   **Left**: `Ready`, `Errors: 0`, `Warnings: 0`.
    *   **Right**: `Schema: v1.0`, `UTF-8`, `TypeScript React`.

---

## 4. Workbench Area (工作区)

The central area is a tabbed interface or a split view between Canvas and Code.

### 4.1 Toolbar (WorkbenchToolbar.tsx)
*   **Height**: `36px`.
*   **Style**: `bg-zinc-900 border-b border-zinc-800 flex items-center px-2 justify-between`.
*   **Controls**:
    *   **Left (Canvas Controls)**:
        *   `Select` (Cursor icon) vs `Pan` (Hand icon).
        *   `Device Toggles`: Desktop (Monitor), Tablet (iPad), Mobile (iPhone).
        *   `Zoom`: Dropdown (50%, 75%, 100%, Fit).
    *   **Center (Address/Breadcrumb)**:
        *   Shows selected node path: `Page > Container > Card > Button`.
    *   **Right (Actions)**:
        *   `Play` (Run): Green icon. Triggers `reload`.
        *   `Code`: Toggle Split View (Canvas | JSON).
        *   `Share`: Publish/Export button.

### 4.2 The Canvas (RuntimeHost.tsx)
*   **Background**: Infinite pan/zoom area with `bg-zinc-900`.
*   **Pattern**: CSS Radial Gradient dots (`#333` on `#18181b`, size 1px, spacing 20px).
*   **Viewport (The Stage)**:
    *   A centered `iframe` or `div` acting as the sandbox.
    *   **Shadow**: `shadow-2xl` (black, large diffusion).
    *   **Transition**: Width/Height animates `transition-all duration-300 ease-out` when switching devices.
*   **Overlays (The "Magic" Layer)**:
    *   Rendered *over* the Viewport, strictly synchronized with the Runtime Node positions.
    *   **Selection Box**:
        *   Border: `1px solid #3b82f6` (Blue-500).
        *   Knobs: 8 white squares (`4x4px`) with blue borders at corners and edges.
        *   Label: Small tag at top-left: `Button #submit-btn`.
    *   **Hover Box**:
        *   Border: `1px dashed #60a5fa` (Blue-400).
        *   Pointer Events: `none`.
    *   **Drag Placeholder**: Blue line indicating drop position.

### 4.3 Code Editor (MonacoEditorWrapper.tsx)
*   **Component**: `@monaco-editor/react`.
*   **Theme**: `vs-dark`.
*   **Features**:
    *   **JSON Schema Validation**: Integrated with `@shenbi/schema` Types.
    *   **Auto-complete**: Typing `"type": "` suggests `"button" | "input" | ...`.
    *   **Minimap**: Enabled.

---

## 5. Inspector Panel (右侧面板)

Designed to edit the properties of the selected component.

### 5.1 Structure
*   **Tabs**: `Properties`, `Style`, `Events`, `Advanced`.
*   **Header**: Selected Component Name + Type (e.g., **Submit Button** `antd.Button`).

### 5.2 Property Controls (Smart Inputs)
Every property input has two modes, toggled by a small `{}` icon.

1.  **Static Mode (Default)**:
    *   **String**: Simple Input.
    *   **Number**: Input with increment/decrement steppers.
    *   **Boolean**: Switch toggle.
    *   **Enum**: Select dropdown (shadcn `Select`).
    *   **Color**: Color picker block + Hex code.
    *   **Icon**: Icon picker popover.

2.  **Expression Mode ({{}})**:
    *   Input becomes a monospaced code input.
    *   Syntax highlighting for JS expressions.
    *   **Autocomplete**: Typing `state.` suggests defined state variables.

### 5.3 Event Handlers
*   **List View**: Shows attached events (e.g., `onClick`, `onChange`).
*   **Add Action**: "Plus" button to add a new action to the chain.
*   **Action Flow**:
    *   Visual representation of the Action Chain.
    *   Step 1: `Set State (loading=true)`
    *   Step 2: `Fetch (api/user)`
    *   Arrow connectors between steps.

---

## 6. Bottom Panel (Console)

Collapsible bottom panel for debugging logs.

*   **Tabs**: `Problems` (Validation Errors), `Output` (Build logs), `Debug Console` (Runtime logs).
*   **Debug Console**:
    *   Table view of actions.
    *   Columns: `Time`, `Source` (Button#1), `Action` (setState), `Payload`, `Duration`.
    *   Filter input at top.
    *   "Clear" button (Trash icon).

---

## 7. Keyboard Shortcuts (快捷键)

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + S` | Save Schema | Global |
| `Ctrl + Z` | Undo | Global |
| `Ctrl + Shift + Z` | Redo | Global |
| `Ctrl + `` | Toggle Terminal/Console | Global |
| `Ctrl + B` | Toggle Sidebar | Global |
| `Ctrl + P` | Command Palette (Go to File/Node) | Global |
| `Delete` | Delete Selected Node | Canvas/Tree |
| `Ctrl + D` | Duplicate Node | Canvas/Tree |

---

## 8. Micro-Interactions (微交互)

*   **Toast Notifications**:
    *   Location: Bottom Right.
    *   Style: Dark glassmorphism.
    *   Events: "Schema Saved", "Compilation Error", "Copied to Clipboard".
*   **Loading States**:
    *   Canvas: Skeleton loader when compiling schema.
    *   Sidebar: Shimmer effect on tree items during initialization.
*   **Empty States**:
    *   Canvas: "No Page Selected" with a "Create New Page" button.
    *   Inspector: "Select a component to edit properties".

---

## 9. Iconography System (Lucide React Mapping)

Consistent icon usage helps users recognize functions quickly.

| Function | Icon Name (`lucide-react`) |
| :--- | :--- |
| **Activity Bar** | |
| Explorer | `FileText` |
| Search | `Search` |
| State/Database | `Database` |
| Debug | `BugPlay` |
| Settings | `Settings` |
| **Toolbar** | |
| Select Tool | `MousePointer2` |
| Pan Tool | `Hand` |
| Desktop | `Monitor` |
| Tablet | `Tablet` |
| Mobile | `Smartphone` |
| Run/Preview | `Play` |
| Code View | `Code2` |
| **Inspector** | |
| Properties | `Sliders` |
| Events | `Zap` |
| Style | `Palette` |
| Expression | `Braces` |
| Add | `Plus` |
| Delete | `Trash2` |
| Edit | `Edit3` |

---

## 10. Component Dictionary (shadcn/ui Mapping)

Detailed mapping of logical UI parts to specific `shadcn/ui` components for implementation.

| UI Area | Logical Component | shadcn/ui Component |
| :--- | :--- | :--- |
| **Layout** | Split Panels | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` |
| **Sidebar** | Tree View | `ScrollArea` + Custom Recursive Component |
| | Collapse/Expand | `Collapsible` |
| **Inspector** | Tab Switching | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| | Property Group | `Accordion` |
| | Input Field | `Input` |
| | Dropdown | `Select` |
| | Toggle | `Switch` |
| | Tooltips | `Tooltip` |
| **Canvas** | Context Menu | `ContextMenu` |
| | Overlays | `Popover` |
| **General** | Modals/Dialogs | `Dialog` |
| | Command Palette | `Command` (cmdk) |
| | Toast | `Toaster`, `useToast` |
| | Dropdown Menu | `DropdownMenu` |

---

## 11. Z-Index Strategy (层级策略)

Defining the visual stacking context to ensure correct overlay behavior.

| Layer | Z-Index | Description |
| :--- | :--- | :--- |
| **Base** | `0` | Standard UI elements |
| **Canvas Viewport** | `10` | The iframe/container holding the page |
| **Canvas Overlays** | `20` | Selection box, hover box (must be above iframe) |
| **Panels** | `30` | Sidebars, Bottom Panel (if floating) |
| **Dropdowns/Popovers** | `40` | Select menus, Tooltips |
| **Modals/Dialogs** | `50` | Full screen blockers |
| **Command Palette** | `60` | Global search overlay |
| **Toasts** | `70` | Notifications |
| **Cursor Drag** | `100` | Dragging ghost elements |
