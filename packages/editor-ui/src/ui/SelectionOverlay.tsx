import React from 'react';
import ReactDOM from 'react-dom';

export interface SelectionOverlayProps {
  /** 画布内容容器的 ref（用于事件委托和位置计算） */
  containerRef: React.RefObject<HTMLDivElement | null>;
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
  container: HTMLElement,
): OverlayRect {
  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // 宽高为 0 表示元素不可见（display: none 等）
  if (targetRect.width === 0 && targetRect.height === 0) {
    return EMPTY_RECT;
  }

  return {
    top: targetRect.top - containerRect.top + container.scrollTop,
    left: targetRect.left - containerRect.left + container.scrollLeft,
    width: targetRect.width,
    height: targetRect.height,
  };
}

function findNodeElement(container: HTMLElement, nodeId: string): Element | null {
  return container.querySelector(`[data-shenbi-node-id="${CSS.escape(nodeId)}"]`);
}

function getComponentType(element: Element): string {
  return element.getAttribute('data-shenbi-component-type') ?? '';
}

export function SelectionOverlay({
  containerRef,
  selectedNodeSchemaId,
  externalHoverNodeSchemaId,
  ancestorItems,
  onSelectAncestor,
  onHoverAncestor,
  onHoverNode,
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
    const container = containerRef.current;
    if (!container || !selectedNodeSchemaId) {
      setSelectedRect(EMPTY_RECT);
      setSelectedComponentType('');
      return;
    }

    const element = findNodeElement(container, selectedNodeSchemaId);
    if (!element) {
      setSelectedRect(EMPTY_RECT);
      setSelectedComponentType('');
      return;
    }

    setSelectedRect(computeRelativeRect(element, container));
    setSelectedComponentType(getComponentType(element));
  }, [containerRef, selectedNodeSchemaId]);

  // 监听选中节点变化
  React.useEffect(() => {
    updateSelectedRect();

    const container = containerRef.current;
    if (!container || !selectedNodeSchemaId) {
      return;
    }

    const element = findNodeElement(container, selectedNodeSchemaId);
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
  }, [containerRef, selectedNodeSchemaId, updateSelectedRect]);

  // 监听画布滚动和窗口 resize，更新选中框位置
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedNodeSchemaId) {
      return;
    }

    // 找到可滚动的祖先（canvas main 区域）
    const scrollParent = container.closest('[data-shenbi-shortcut-area="canvas"]');

    const handleUpdate = () => {
      updateSelectedRect();
    };

    scrollParent?.addEventListener('scroll', handleUpdate);
    window.addEventListener('resize', handleUpdate);

    return () => {
      scrollParent?.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [containerRef, selectedNodeSchemaId, updateSelectedRect]);

  // 鼠标悬浮事件处理（事件委托）
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) {
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
        setHoverRect(computeRelativeRect(hit, container));
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

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [containerRef, onHoverNode]);

  // 外部 hover（面包屑等）位置计算
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !externalHoverNodeSchemaId) {
      setExternalHoverRect(EMPTY_RECT);
      setExternalHoverComponentType('');
      return;
    }

    const element = findNodeElement(container, externalHoverNodeSchemaId);
    if (!element) {
      setExternalHoverRect(EMPTY_RECT);
      setExternalHoverComponentType('');
      return;
    }

    setExternalHoverRect(computeRelativeRect(element, container));
    setExternalHoverComponentType(getComponentType(element));
  }, [containerRef, externalHoverNodeSchemaId]);

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
