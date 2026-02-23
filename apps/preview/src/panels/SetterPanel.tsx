import React, { useState } from 'react';
import { Type, Code, Link2, Plus, GripVertical } from 'lucide-react';

export interface SetterPanelProps {
  selectedNode?: any;
  contract?: any;
  onPatchProps?: (patch: any) => void;
  onPatchStyle?: (patch: any) => void;
  onPatchEvents?: (patch: any) => void;
  activeTab?: 'props' | 'style' | 'events' | 'logic';
}

export function SetterPanel({ 
  selectedNode, 
  contract, 
  onPatchProps, 
  onPatchStyle, 
  onPatchEvents,
  activeTab = 'props'
}: SetterPanelProps) {
  
  if (activeTab === 'props') {
    return <PropsSetter />;
  }
  if (activeTab === 'style') {
    return <StyleSetter />;
  }
  if (activeTab === 'events') {
    return <EventSetter />;
  }
  if (activeTab === 'logic') {
    return <LogicSetter />;
  }
  
  return null;
}

// 属性设置器 (Props Setter)
function PropsSetter() {
  return (
    <div className="flex flex-col gap-4 p-3 text-text-primary">
      <SetterGroup title="基础属性">
        <PropertyField label="标题" value="默认按钮" />
        <PropertyField label="类型" value="primary" type="select" options={['primary', 'default', 'dashed', 'link', 'text']} />
        <PropertyField label="图标" value="Plus" type="select" options={['None', 'Plus', 'Edit', 'Delete']} />
      </SetterGroup>

      <SetterGroup title="状态">
        <PropertyField label="禁用" value="false" type="switch" />
        <PropertyField label="加载中" value="false" type="switch" />
        <PropertyField label="隐藏" value="false" type="switch" />
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

// 样式设置器 (Style Setter)
function StyleSetter() {
  return (
    <div className="flex flex-col gap-4 p-3 text-text-primary">
      <SetterGroup title="布局 (Layout)">
        <PropertyField label="宽度 (Width)" value="100%" />
        <PropertyField label="高度 (Height)" value="auto" />
        <PropertyField label="内边距 (Padding)" value="16px 24px" />
        <PropertyField label="外边距 (Margin)" value="0px" />
      </SetterGroup>

      <SetterGroup title="外观 (Appearance)">
        <PropertyField label="背景色" value="#1677ff" isColor />
        <PropertyField label="文字颜色" value="#ffffff" isColor />
        <PropertyField label="边框" value="1px solid #1677ff" />
        <PropertyField label="圆角 (Radius)" value="6px" />
      </SetterGroup>
      
      <SetterGroup title="自定义 CSS">
        <div className="bg-[#1e1e1e] rounded p-2 border border-border-ide font-mono text-[11px] text-[#d4d4d4] h-20 overflow-y-auto">
          {'.container {\n  opacity: 0.8;\n  transition: all 0.3s;\n}'}
        </div>
      </SetterGroup>
    </div>
  );
}

// 事件设置器 (Event Setter)
function EventSetter() {
  return (
    <div className="flex flex-col gap-3 p-3 text-text-primary">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-bold text-text-secondary uppercase">已绑定事件</span>
        <button className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-600 transition-colors">
          <Plus size={10} /> 新增
        </button>
      </div>

      {['onClick', 'onMouseEnter'].map((eventName) => (
        <div key={eventName} className="border border-border-ide rounded bg-bg-canvas overflow-hidden">
          <div className="flex justify-between items-center bg-bg-activity-bar px-2 py-1.5 border-b border-border-ide">
            <span className="text-[12px] font-semibold text-blue-400">{eventName}</span>
            <span className="text-[10px] text-text-secondary">2个动作</span>
          </div>
          <div className="p-2 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] bg-bg-sidebar p-1.5 rounded border border-border-ide border-dashed">
              <GripVertical size={12} className="text-text-secondary cursor-grab" />
              <div className="flex-1 truncate">打开弹窗 (submitDialog)</div>
            </div>
            <div className="flex items-center gap-2 text-[11px] bg-bg-sidebar p-1.5 rounded border border-border-ide border-dashed">
              <GripVertical size={12} className="text-text-secondary cursor-grab" />
              <div className="flex-1 truncate text-green-400">Fetch API (updateUser)</div>
            </div>
          </div>
        </div>
      ))}
      
      <div className="mt-4 border border-dashed border-border-ide rounded p-4 flex flex-col items-center justify-center text-text-secondary gap-2 cursor-pointer hover:bg-bg-activity-bar transition-colors">
        <Plus size={16} />
        <span className="text-[12px]">添加事件监听</span>
      </div>
    </div>
  );
}

// 统一逻辑设置器 (Logic Setter)
function LogicSetter() {
  return (
    <div className="flex flex-col gap-4 p-3 text-text-primary">
      <SetterGroup title="条件渲染 (Condition)">
        <PropertyField 
          label="是否渲染 (x-if)" 
          value="!!user.permissions.includes('admin')" 
          isExpression 
        />
      </SetterGroup>

      <SetterGroup title="列表循环 (Loop)">
        <PropertyField 
          label="循环数据 (x-for)" 
          value="pageState.userList" 
          isExpression 
        />
        <PropertyField label="项别名 (item)" value="item" />
        <PropertyField label="索引别名 (index)" value="index" />
        <PropertyField label="绑定键 (Key)" value="item.id" isExpression />
      </SetterGroup>

      <SetterGroup title="国际化 (i18n)">
        <div className="flex items-center gap-2 mb-2">
          <input 
            type="checkbox" 
            checked 
            readOnly
            className="rounded border-border-ide text-blue-500 focus:ring-blue-500 bg-bg-canvas"
          />
          <span className="text-[12px]">启用国际化静态分析</span>
        </div>
        <PropertyField label="翻译键空间" value="components.button" />
      </SetterGroup>
    </div>
  );
}

// --- Helper Components ---

function SetterGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold text-text-secondary uppercase mb-2">
        {title}
      </h3>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

function PropertyField({ 
  label, 
  value, 
  type = 'input', 
  options = [], 
  isColor = false,
  isExpression = false
}: { 
  label: string, 
  value: string, 
  type?: 'input' | 'select' | 'switch', 
  options?: string[],
  isColor?: boolean,
  isExpression?: boolean
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] text-text-secondary uppercase block mb-1 flex justify-between items-center whitespace-nowrap overflow-hidden">
        <span className="truncate">{label}</span>
        {isExpression && (
          <div className="bg-yellow-500/20 text-yellow-500 rounded px-1 flex items-center gap-0.5 ml-2 shrink-0 cursor-pointer" title="表达式绑定" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <Link2 size={10} />
            <span className="text-[9px]">表达式</span>
          </div>
        )}
      </label>
      <div className="flex items-center gap-2 group relative">
        {isColor && <div className="w-4 h-4 rounded-sm border border-border-ide shrink-0" style={{ backgroundColor: value }} />}
        
        {type === 'input' && (
          <input 
            readOnly 
            value={value} 
            className={`flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500 w-full min-w-0 ${isExpression ? 'font-mono text-yellow-400 border-yellow-500/50 bg-yellow-500/5' : ''}`} 
          />
        )}
        
        {type === 'select' && (
          <select 
            disabled
            value={value} 
            className="flex-1 bg-bg-canvas border border-border-ide rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500 appearance-none w-full min-w-0"
          >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        )}
        
        {type === 'switch' && (
          <div className="w-8 h-4 bg-bg-activity-bar rounded-full border border-border-ide relative shrink-0">
            <div className={`absolute top-[1px] ${value === 'true' ? 'right-[1px] bg-blue-500' : 'left-[1px] bg-text-secondary'} w-[12px] h-[12px] rounded-full transition-all`} />
          </div>
        )}
      </div>
    </div>
  );
}
