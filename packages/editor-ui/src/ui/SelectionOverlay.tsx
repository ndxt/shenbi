import React from 'react';
import ReactDOM from 'react-dom';
import type { CanvasSurfaceHandle } from '../canvas/types';

export interface SelectionOverlayProps {
  /** 当前画布 surface（支持 direct / iframe） */
  surface: CanvasSurfaceHandle | null;
  /** 当前选中的 schema node id */
  selectedNodeSchemaId?: string | undefined;
  /** 外部控制的 hover 目标（如面包屑 hover），优先于鼠标 hover */
  externalHoverNodeSchemaId?: string | null | undefined;
  /** 祖先链（面包屑数据），用于下拉选择父组件 */
  ancestorItems?: { id: string; label: string }[] | undefined;
  /** 下拉选择祖先时回调 */
  onSelectAncestor?: ((nodeId: string) => void) | undefined;
  /** 下拉项 hover 时回调（传入 tree node ID 或 null） */
  onHoverAncestor?: ((nodeId: string | null) => void) | undefined;
  /** hover 到节点时回调（可选，用于扩展） */
  onHoverNode?: (nodeId: string | null) => void;
  dragSelectedEnabled?: boolean;
  onStartDragSelected?: (event: React.DragEvent<HTMLDivElement>) => void;
  onEndDragSelected?: () => void;
}

interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const EMPTY_RECT: OverlayRect = { top: 0, left: 0, width: 0, height: 0 };

function isRectEmpty(rect: OverlayRect): boolean {
  return rect.width === 0 && rect.height === 0;
}

/**
 * 计算目标元素相对于容器的位置（考虑容器滚动）
 */
function computeRelativeRect(
  target: Element,
  surface: CanvasSurfaceHandle,
): OverlayRect {
  const rect = surface.getRelativeRect(target);
  if (rect.width === 0 && rect.height === 0) {
    return EMPTY_RECT;
  }
  return rect;
}

function findNodeElement(surface: CanvasSurfaceHandle, nodeId: string): Element | null {
  return surface.findNodeElement(nodeId);
}

function getComponentType(element: Element): string {
  return element.getAttribute('data-shenbi-component-type') ?? '';
}

export function SelectionOverlay({
  surface,
  selectedNodeSchemaId,
  externalHoverNodeSchemaId,
  ancestorItems,
  onSelectAncestor,
  onHoverAncestor,
  onHoverNode,
  dragSelectedEnabled = false,
  onStartDragSelected,
  onEndDragSelected,
}: SelectionOverlayProps) {
  const [hoverRect, setHoverRect] = React.useState<OverlayRect>(EMPTY_RECT);
  const [hoverComponentType, setHoverComponentType] = React.useState('');
  const [selectedRect, setSelectedRect] = React.useState<OverlayRect>(EMPTY_RECT);
  const [selectedComponentType, setSelectedComponentType] = React.useState('');
  // 当 hover 和 selected 是同一节点时隐藏 hover 框
  const [mouseHoveredNodeId, setMouseHoveredNodeId] = React.useState<string | null>(null);

  // 外部 hover（面包屑等）的位置
  const [externalHoverRect, setExternalHoverRect] = React.useState<OverlayRect>(EMPTY_RECT);
  const [externalHoverComponentType, setExternalHoverComponentType] = React.useState('');

  // 祖先下拉菜单状态
  const [showAncestorDropdown, setShowAncestorDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const hoverCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const rafRef = React.useRef<number>(0);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  // 更新选中框位置
  const updateSelectedRect = React.useCallback(() => {
    if (!surface || !selectedNodeSchemaId) {
      setSelectedRect(EMPTY_RECT);
      setSelectedComponentType('');
      return;
    }

    const element = findNodeElement(surface, selectedNodeSchemaId);
    if (!element) {
      setSelectedRect(EMPTY_RECT);
      setSelectedComponentType('');
      return;
    }

    setSelectedRect(computeRelativeRect(element, surface));
    setSelectedComponentType(getComponentType(element));
  }, [selectedNodeSchemaId, surface]);

  // 监听选中节点变化
  React.useEffect(() => {
    updateSelectedRect();

    if (!surface || !selectedNodeSchemaId) {
      return;
    }

    const element = findNodeElement(surface, selectedNodeSchemaId);
    if (!element) {
      return;
    }

    // ResizeObserver 监听选中元素尺寸变化
    const observer = new ResizeObserver(() => {
      updateSelectedRect();
    });
    observer.observe(element);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [selectedNodeSchemaId, surface, updateSelectedRect]);

  // 监听画布滚动和窗口 resize，更新选中框位置
  React.useEffect(() => {
    if (!surface || !selectedNodeSchemaId) {
      return;
    }

    const scrollParent = surface.hostElement?.closest?.('[data-shenbi-shortcut-area="canvas"]');

    const handleUpdate = () => {
      updateSelectedRect();
    };

    scrollParent?.addEventListener('scroll', handleUpdate);
    window.addEventListener('resize', handleUpdate);
    surface.ownerWindow?.addEventListener('resize', handleUpdate);

    return () => {
      scrollParent?.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
      surface.ownerWindow?.removeEventListener('resize', handleUpdate);
    };
  }, [selectedNodeSchemaId, surface, updateSelectedRect]);

  // 鼠标悬浮事件处理（事件委托）
  React.useEffect(() => {
    if (!surface?.rootElement) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      // 使用 rAF 节流
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        const target = event.target;
        if (!(target instanceof Element)) {
          setHoverRect(EMPTY_RECT);
          setMouseHoveredNodeId(null);
          onHoverNode?.(null);
          return;
        }

        const hit = target.closest('[data-shenbi-node-id]');
        if (!hit) {
          setHoverRect(EMPTY_RECT);
          setMouseHoveredNodeId(null);
          onHoverNode?.(null);
          return;
        }

        const nodeId = hit.getAttribute('data-shenbi-node-id');
        if (!nodeId) {
          setHoverRect(EMPTY_RECT);
          setMouseHoveredNodeId(null);
          onHoverNode?.(null);
          return;
        }

        setMouseHoveredNodeId(nodeId);
        setHoverRect(computeRelativeRect(hit, surface));
        setHoverComponentType(getComponentType(hit));
        onHoverNode?.(nodeId);
      });
    };

    const handleMouseLeave = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      setHoverRect(EMPTY_RECT);
      setMouseHoveredNodeId(null);
      onHoverNode?.(null);
    };

    surface.rootElement.addEventListener('mousemove', handleMouseMove);
    surface.rootElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      surface.rootElement?.removeEventListener('mousemove', handleMouseMove);
      surface.rootElement?.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [onHoverNode, surface]);

  // 外部 hover（面包屑等）位置计算
  React.useEffect(() => {
    if (!surface || !externalHoverNodeSchemaId) {
      setExternalHoverRect(EMPTY_RECT);
      setExternalHoverComponentType('');
      return;
    }

    const element = findNodeElement(surface, externalHoverNodeSchemaId);
    if (!element) {
      setExternalHoverRect(EMPTY_RECT);
      setExternalHoverComponentType('');
      return;
    }

    setExternalHoverRect(computeRelativeRect(element, surface));
    setExternalHoverComponentType(getComponentType(element));
  }, [externalHoverNodeSchemaId, surface]);

  // 选中节点变化时关闭下拉
  React.useEffect(() => {
    setShowAncestorDropdown(false);
  }, [selectedNodeSchemaId]);

  // 下拉关闭时清除外部 hover（下拉卸载不会触发 mouseleave）
  React.useEffect(() => {
    if (!showAncestorDropdown) {
      onHoverAncestor?.(null);
    }
  }, [showAncestorDropdown, onHoverAncestor]);

  // 确定最终的 hover 显示：外部 hover 优先于鼠标 hover
  const hasExternalHover = externalHoverNodeSchemaId != null && !isRectEmpty(externalHoverRect);
  const effectiveHoverRect = hasExternalHover ? externalHoverRect : hoverRect;
  const effectiveHoverComponentType = hasExternalHover ? externalHoverComponentType : hoverComponentType;
  const effectiveHoveredNodeId = hasExternalHover ? externalHoverNodeSchemaId : mouseHoveredNodeId;

  // hover 和 selected 相同节点时隐藏 hover 框
  const showHover = !isRectEmpty(effectiveHoverRect) && effectiveHoveredNodeId !== selectedNodeSchemaId;
  const showSelected = !isRectEmpty(selectedRect);

  return (
    <div className="selection-overlay" aria-hidden="true">
      {/* Hover 框 */}
      {showHover && (
        <div
          className="selection-overlay__hover"
          style={{
            top: effectiveHoverRect.top,
            left: effectiveHoverRect.left,
            width: effectiveHoverRect.width,
            height: effectiveHoverRect.height,
          }}
        >
          {effectiveHoverComponentType && (
            <span className="selection-overlay__label selection-overlay__label--hover">
              {effectiveHoverComponentType}
            </span>
          )}
        </div>
      )}

      {/* Selected 框 */}
      {showSelected && (
        <div
          className="selection-overlay__selected"
          style={{
            top: selectedRect.top,
            left: selectedRect.left,
            width: selectedRect.width,
            height: selectedRect.height,
          }}
        >
          {selectedComponentType && (
            <div
              className="selection-overlay__label-group"
              ref={dropdownRef}
              draggable={dragSelectedEnabled}
              onDragStart={(event) => {
                onStartDragSelected?.(event);
              }}
              onDragEnd={() => {
                onEndDragSelected?.();
              }}
              onMouseEnter={() => {
                if (hoverCloseTimerRef.current) {
                  clearTimeout(hoverCloseTimerRef.current);
                  hoverCloseTimerRef.current = null;
                }
                if (ancestorItems && ancestorItems.length > 1 && onSelectAncestor) {
                  setShowAncestorDropdown(true);
                }
              }}
              onMouseLeave={() => {
                hoverCloseTimerRef.current = setTimeout(() => {
                  setShowAncestorDropdown(false);
                }, 150);
              }}
            >
              <span className="selection-overlay__label-btn">
                <span>{selectedComponentType}</span>
                {ancestorItems && ancestorItems.length > 1 && onSelectAncestor && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    className={`selection-overlay__chevron ${showAncestorDropdown ? 'selection-overlay__chevron--open' : ''}`}
                  >
                    <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {showAncestorDropdown && ancestorItems && ReactDOM.createPortal(
                <AncestorDropdown
                  items={ancestorItems}
                  triggerRef={dropdownRef}
                  onSelect={(id) => {
                    onSelectAncestor?.(id);
                    setShowAncestorDropdown(false);
                  }}
                  onClose={() => setShowAncestorDropdown(false)}
                  onHoverItem={(id) => onHoverAncestor?.(id)}
                  onMouseEnter={() => {
                    if (hoverCloseTimerRef.current) {
                      clearTimeout(hoverCloseTimerRef.current);
                      hoverCloseTimerRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    hoverCloseTimerRef.current = setTimeout(() => {
                      setShowAncestorDropdown(false);
                    }, 150);
                  }}
                />,
                document.body,
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 祖先下拉菜单（通过 portal 渲染到 body，避免被 overflow:hidden 裁剪） */
function AncestorDropdown({
  items,
  triggerRef,
  onSelect,
  onClose,
  onMouseEnter,
  onMouseLeave,
  onHoverItem,
}: {
  items: { id: string; label: string }[];
  triggerRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onHoverItem?: (id: string | null) => void;
}) {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  // 计算位置
  React.useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPos({ top: rect.bottom + 2, left: rect.left });
  }, [triggerRef]);

  // 点击外部关闭
  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      const target = event.target as Node;
      if (trigger?.contains(target) || menu?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [onClose, triggerRef]);

  return (
    <div
      ref={menuRef}
      className="selection-overlay__dropdown"
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={`selection-overlay__dropdown-item ${
            index === items.length - 1 ? 'selection-overlay__dropdown-item--active' : ''
          }`}
          onClick={() => onSelect(item.id)}
          onMouseEnter={() => onHoverItem?.(item.id)}
          onMouseLeave={() => onHoverItem?.(null)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
