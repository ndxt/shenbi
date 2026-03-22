import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Trash2,
} from 'lucide-react';
import type {
  CanvasRendererHostRuntime,
  CanvasRendererRenderContext,
} from '@shenbi/editor-plugin-api';
import { CanvasSurface } from '../canvas/CanvasSurface';
import {
  DEVICE_FRAME_PADDING,
  DEVICE_PRESETS,
  STAGE_MIN_HEIGHT,
} from '../canvas/constants';
import type {
  CanvasDropTarget,
  CanvasSurfaceHandle,
  CanvasToolMode,
} from '../canvas/types';
import { buildPageMinimapModel } from '../canvas/page-minimap-model';
import { useCanvasDragDrop } from '../hooks/useCanvasDragDrop';
import { useCanvasPan } from '../hooks/useCanvasPan';
import { useCanvasZoom } from '../hooks/useCanvasZoom';
import { SelectionOverlay, type SelectionOverlayAction } from './SelectionOverlay';
import { CanvasToolRail } from './CanvasToolRail';
import { CanvasZoomHud } from './CanvasZoomHud';
import { DevicePreviewBar } from './DevicePreviewBar';

export interface PageCanvasRendererProps extends CanvasRendererRenderContext {}

export function PageCanvasRenderer(props: PageCanvasRendererProps) {
  const {
    surface,
    canvasHost,
  } = props;
  const {
    children,
    renderMode = 'direct',
    theme = 'light',
    readOnly: canvasReadOnly = false,
  } = surface;
  const {
    selection,
    editing,
    overlay,
    interaction,
  } = canvasHost;
  const {
    selectedNodeSchemaId,
    selectedNodeTreeId,
    hoveredNodeSchemaId,
    breadcrumbItems,
    onBreadcrumbSelect,
    onBreadcrumbHover,
  } = selection;
  const {
    canDropInsideNode,
    onInsertComponent,
    onMoveSelectedNode,
    canDeleteSelectedNode,
    canDuplicateSelectedNode,
    canMoveSelectedNodeUp,
    canMoveSelectedNodeDown,
  } = editing;
  const {
    selectionActions: externalOverlayActions,
    cursorClassName: externalCursorClassName,
    onSurfaceReady: onCanvasSurfaceReady,
    onContextMenu: onCanvasContextMenu,
  } = overlay;
  const {
    activeTool: externalCanvasTool,
    setActiveTool: externalSetActiveCanvasTool,
    onRuntimeReady: onCanvasRuntimeReady,
  } = interaction;

  const [canvasSurface, setCanvasSurface] = React.useState<CanvasSurfaceHandle | null>(null);
  const canvasScrollRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [localCanvasTool, setLocalCanvasTool] = React.useState<CanvasToolMode>('select');
  const activeCanvasTool = (externalCanvasTool as CanvasToolMode | undefined) ?? localCanvasTool;
  const setActiveCanvasTool = (externalSetActiveCanvasTool as ((mode: CanvasToolMode) => void) | undefined) ?? setLocalCanvasTool;
  const [activeDeviceId, setActiveDeviceId] = React.useState('desktop');
  const fallbackDevice = DEVICE_PRESETS[DEVICE_PRESETS.length - 1]!;
  const activeDevice = React.useMemo(
    () => DEVICE_PRESETS.find((device) => device.id === activeDeviceId) ?? fallbackDevice,
    [activeDeviceId, fallbackDevice],
  );
  const [customStageWidth, setCustomStageWidth] = React.useState<number | null>(null);
  const stageWidth = customStageWidth ?? activeDevice.width;
  const [showDeviceFrame, setShowDeviceFrame] = React.useState(false);

  const zoom = useCanvasZoom({
    canvasScrollRef,
    stageRef,
    canvasSurface,
    stageWidth,
    selectedNodeSchemaId,
  });
  const pan = useCanvasPan({
    canvasScrollRef,
    canvasSurface,
    activeCanvasTool,
    syncCanvasViewportState: zoom.syncCanvasViewportState,
    closeZoomMenu: () => zoom.setZoomMenuState({ open: false }),
  });
  const dragDrop = useCanvasDragDrop({
    stageRef,
    canvasSurface,
    canvasScale: zoom.canvasScale,
    stageWidth,
    stageContentHeightRef: zoom.stageContentHeightRef,
    activeCanvasTool,
    canvasReadOnly,
    selectedNodeSchemaId,
    selectedNodeTreeId,
    canCanvasDropInsideNode: canDropInsideNode,
    onCanvasInsertComponent: onInsertComponent as ((componentType: string, target: CanvasDropTarget) => void) | undefined,
    onCanvasMoveSelectedNode: onMoveSelectedNode as ((target: CanvasDropTarget) => void) | undefined,
  });

  const {
    canvasScale,
    canvasViewportState,
    stageContentHeight,
    canvasWorkspaceWidth,
    canvasWorkspaceHeight,
    canvasStageLeft,
    canvasStageTop: canvasWorkspaceStageTop,
    zoomMenuState,
    setZoomMenuState,
    zoomMenuRef,
    canvasChromeRef,
    updateCanvasScalePreset,
    fitCanvasToViewport,
  } = zoom;
  const {
    isSpacePressed,
    isCanvasPanning,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  } = pan;
  const {
    canvasDragSession,
    canvasDropIndicator,
    clearCanvasDragState,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    handleSelectedDragStart,
  } = dragDrop;

  React.useEffect(() => {
    onCanvasSurfaceReady?.(canvasSurface);
  }, [canvasSurface, onCanvasSurfaceReady]);

  const runtime = React.useMemo<CanvasRendererHostRuntime>(() => ({
    zoomIn: () => zoom.zoomCanvasIn(),
    zoomOut: () => zoom.zoomCanvasOut(),
    resetZoom: () => zoom.resetCanvasZoom(),
    fitCanvas: () => fitCanvasToViewport(),
    centerCanvas: () => zoom.centerCanvasStage(),
    focusSelection: () => zoom.focusCanvasSelection(),
    getScale: () => canvasScale,
    startSidebarDragComponent: dragDrop.handleSidebarStartDragComponent,
    endSidebarDragComponent: dragDrop.handleSidebarEndDragComponent,
    isSpacePanActive: () => isSpacePressed,
    isCanvasPanning: () => isCanvasPanning,
    hasCanvasDragSession: () => Boolean(canvasDragSession),
  }), [
    canvasDragSession,
    canvasScale,
    dragDrop.handleSidebarEndDragComponent,
    dragDrop.handleSidebarStartDragComponent,
    fitCanvasToViewport,
    isCanvasPanning,
    isSpacePressed,
    zoom,
  ]);

  React.useEffect(() => {
    onCanvasRuntimeReady?.(runtime);
    return () => {
      onCanvasRuntimeReady?.(null);
    };
  }, [onCanvasRuntimeReady, runtime]);

  const canvasCursorClassName = externalCursorClassName ?? (
    isCanvasPanning
      ? 'cursor-grabbing'
      : (isSpacePressed || activeCanvasTool === 'pan')
        ? 'canvas-cursor-grab'
        : 'cursor-default'
  );
  const canFocusCanvasSelection = Boolean(selectedNodeSchemaId && canvasSurface);
  const selectionOverlayActions = React.useMemo(() => {
    if (externalOverlayActions) {
      return externalOverlayActions.map<SelectionOverlayAction>((action) => ({
        id: action.id,
        title: action.title,
        icon: action.icon ?? null,
        ...(action.disabled !== undefined ? { disabled: action.disabled } : {}),
        onRun: action.onRun ?? (() => undefined),
      }));
    }

    const actions: SelectionOverlayAction[] = [];
    if (canDuplicateSelectedNode !== false) {
      actions.push({ id: 'canvas.duplicateSelectedNode', title: 'Duplicate', icon: <Copy size={12} />, onRun: () => undefined });
    }
    if (canMoveSelectedNodeUp !== false) {
      actions.push({ id: 'canvas.moveSelectedNodeUp', title: 'Move Up', icon: <ArrowUp size={12} />, onRun: () => undefined });
    }
    if (canMoveSelectedNodeDown !== false) {
      actions.push({ id: 'canvas.moveSelectedNodeDown', title: 'Move Down', icon: <ArrowDown size={12} />, onRun: () => undefined });
    }
    if (canDeleteSelectedNode !== false) {
      actions.push({ id: 'canvas.deleteSelectedNode', title: 'Delete', icon: <Trash2 size={12} />, onRun: () => undefined });
    }
    return actions;
  }, [
    canDeleteSelectedNode,
    canDuplicateSelectedNode,
    canMoveSelectedNodeDown,
    canMoveSelectedNodeUp,
    externalOverlayActions,
  ]);

  const framePad = showDeviceFrame && activeDevice.frame
    ? DEVICE_FRAME_PADDING[activeDevice.frame]
    : undefined;
  const framePadH = framePad ? (framePad[1] + framePad[3]) : 0;
  const framePadV = framePad ? (framePad[0] + framePad[2]) : 0;
  const minimapModel = React.useMemo(() => buildPageMinimapModel({
    viewportState: canvasViewportState,
    canvasScale,
    stageWidth,
    stageHeight: Math.max(stageContentHeight, STAGE_MIN_HEIGHT),
    stageLeft: canvasStageLeft,
    stageTop: canvasWorkspaceStageTop,
  }), [
    canvasScale,
    canvasStageLeft,
    canvasViewportState,
    stageContentHeight,
    stageWidth,
    canvasWorkspaceStageTop,
  ]);

  return (
    <div className="relative flex flex-1 min-h-0 flex-col">
      <div ref={canvasChromeRef} className="canvas-toolbar-layer">
        <CanvasToolRail
          activeTool={activeCanvasTool}
          spacePanActive={isSpacePressed}
          focusSelectionDisabled={!canFocusCanvasSelection}
          onSelectTool={() => setActiveCanvasTool('select')}
          onPanTool={() => setActiveCanvasTool('pan')}
          onFit={() => fitCanvasToViewport()}
          onCenter={() => zoom.centerCanvasStage()}
          onFocusSelection={() => zoom.focusCanvasSelection()}
        />
        <CanvasZoomHud
          scale={canvasScale}
          minimapModel={minimapModel}
          menuOpen={zoomMenuState.open}
          menuRef={zoomMenuRef}
          onZoomOut={() => zoom.zoomCanvasOut()}
          onZoomIn={() => zoom.zoomCanvasIn()}
          onToggleMenu={() => setZoomMenuState((current) => ({ open: !current.open }))}
          onSelectScale={(nextScale) => {
            updateCanvasScalePreset(nextScale);
          }}
          onFit={() => {
            fitCanvasToViewport();
            setZoomMenuState({ open: false });
          }}
        />
      </div>
      <main
        data-shenbi-shortcut-area="canvas"
        ref={(node) => {
          canvasScrollRef.current = node;
        }}
        className={`flex-1 overflow-auto scrollbar-hide relative canvas-grid ${canvasCursorClassName}`}
        onContextMenu={onCanvasContextMenu}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        onDragLeave={handleCanvasDragLeave}
      >
        <div
          className="relative"
          style={{
            width: `${canvasWorkspaceWidth}px`,
            height: `${canvasWorkspaceHeight}px`,
            minWidth: `${canvasWorkspaceWidth}px`,
            minHeight: `${canvasWorkspaceHeight}px`,
          }}
        >
          <div
            ref={stageRef}
            className="absolute"
            style={{
              left: `${canvasStageLeft}px`,
              top: `${canvasWorkspaceStageTop}px`,
              width: `${stageWidth + framePadH}px`,
              minHeight: `${STAGE_MIN_HEIGHT + framePadV}px`,
              transform: `translate3d(0, 0, 0) scale(${canvasScale})`,
              transformOrigin: 'top left',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            {framePad ? (
              <div className={`device-frame device-frame--${activeDevice.frame}`}>
                <div className="relative z-10 stage-viewport rounded-sm overflow-hidden border border-border-ide" style={{ width: `${stageWidth}px`, minHeight: `${STAGE_MIN_HEIGHT}px` }}>
                  <CanvasSurface
                    mode={renderMode}
                    themeClassName={`theme-${theme}`}
                    pointerEventsDisabled={Boolean(canvasDragSession)}
                    onReady={setCanvasSurface}
                  >
                    {children}
                  </CanvasSurface>
                  {canvasDropIndicator ? (
                    <div
                      className={`absolute z-[55] ${canvasDropIndicator.variant === 'line' ? 'bg-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-2 border-dashed border-blue-500 bg-blue-500/8'}`}
                      style={{
                        top: canvasDropIndicator.top,
                        left: canvasDropIndicator.left,
                        width: canvasDropIndicator.width,
                        height: canvasDropIndicator.variant === 'line'
                          ? 2
                          : Math.max(canvasDropIndicator.height, 24),
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="relative z-10 stage-viewport rounded-sm overflow-hidden border border-border-ide" style={{ width: `${stageWidth}px`, minHeight: `${STAGE_MIN_HEIGHT}px` }}>
                <CanvasSurface
                  mode={renderMode}
                  themeClassName={`theme-${theme}`}
                  pointerEventsDisabled={Boolean(canvasDragSession)}
                  onReady={setCanvasSurface}
                >
                  {children}
                </CanvasSurface>
                {canvasDropIndicator ? (
                  <div
                    className={`absolute z-[55] ${canvasDropIndicator.variant === 'line' ? 'bg-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : 'border-2 border-dashed border-blue-500 bg-blue-500/8'}`}
                    style={{
                      top: canvasDropIndicator.top,
                      left: canvasDropIndicator.left,
                      width: canvasDropIndicator.width,
                      height: canvasDropIndicator.variant === 'line'
                        ? 2
                        : Math.max(canvasDropIndicator.height, 24),
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>

          <div
            className="absolute"
            style={{
              left: `${canvasStageLeft + (framePad ? framePad[3] * canvasScale : 0)}px`,
              top: `${canvasWorkspaceStageTop + (framePad ? framePad[0] * canvasScale : 0)}px`,
              width: `${stageWidth * canvasScale}px`,
              height: `${Math.max(stageContentHeight, STAGE_MIN_HEIGHT) * canvasScale}px`,
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            <SelectionOverlay
              surface={canvasSurface}
              selectedNodeSchemaId={selectedNodeSchemaId}
              externalHoverNodeSchemaId={activeCanvasTool === 'pan' ? undefined : hoveredNodeSchemaId}
              ancestorItems={breadcrumbItems}
              actions={selectionOverlayActions}
              onSelectAncestor={onBreadcrumbSelect}
              onHoverAncestor={onBreadcrumbHover}
              hoverEnabled={activeCanvasTool !== 'pan'}
              dragSelectedEnabled={!canvasReadOnly && activeCanvasTool !== 'pan' && Boolean(selectedNodeTreeId)}
              onStartDragSelected={handleSelectedDragStart}
              onEndDragSelected={clearCanvasDragState}
              canvasScale={canvasScale}
            />
          </div>

          <div
            className="absolute flex items-center justify-center"
            style={{
              left: `${canvasStageLeft}px`,
              top: `${canvasWorkspaceStageTop - 48}px`,
              width: `${(stageWidth + framePadH) * canvasScale}px`,
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            <DevicePreviewBar
              presets={DEVICE_PRESETS}
              activeDeviceId={activeDeviceId}
              stageWidth={stageWidth}
              stageMinHeight={STAGE_MIN_HEIGHT}
              scale={canvasViewportState.scale}
              showDeviceFrame={showDeviceFrame}
              hasFrame={Boolean(activeDevice.frame)}
              onSelectDevice={(id) => {
                setActiveDeviceId(id);
              }}
              onChangeWidth={setCustomStageWidth}
              onToggleFrame={() => setShowDeviceFrame((value) => !value)}
              onSelectScale={updateCanvasScalePreset}
              onFit={fitCanvasToViewport}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
