// ---------------------------------------------------------------------------
// GatewayCanvas — React Flow canvas wrapper with drag-drop support
// ---------------------------------------------------------------------------

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CanvasToolRail, CanvasZoomHud, readPaletteDragPayload, type CanvasToolMode } from '@shenbi/editor-ui';
import { Focus } from 'lucide-react';

import { nodeTypes as baseNodeTypes } from '../nodes/node-registry';
import type { NodeMenuAction } from '../nodes/BaseNode';
import { TypedEdge, type TypedEdgeAddNodePayload } from '../edges/TypedEdge';
import { isValidConnection } from '../validation';
import type {
  GatewayNode,
  GatewayEdge,
  GatewayNodeKind,
  GatewayNodeData,
} from '../types';
import { NODE_CONTRACTS } from '../types';
import { NodeSelectorPanel } from './NodeSelectorPanel';
import { resolveBridgeOutputHandle } from './gateway-edge-insert';
import { buildGatewayMinimapModel } from './gateway-minimap';
import { buildGatewayPaletteAssets } from './gateway-palette-assets';
import { resolveGatewayInitialViewport, type GatewayViewport } from './gateway-viewport';
import '../styles/gateway.css';

type SelectorPanelState = {
  visible: boolean;
  position: { x: number; y: number };
  sourceNodeId: string;
  sourceHandle: string;
  edgeId?: string;
  targetNodeId?: string;
  targetHandle?: string;
  changeNodeId?: string;
};

const INSERT_NODE_GAP_X = 280;

function collectDownstreamNodeIds(startNodeId: string, edges: GatewayEdge[]): Set<string> {
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const edge of edges) {
      if (edge.source === current && edge.target && !visited.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return visited;
}

function createNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface GatewayCanvasProps {
  nodes: GatewayNode[];
  edges: GatewayEdge[];
  onNodesChange: (nodes: GatewayNode[]) => void;
  onEdgesChange: (edges: GatewayEdge[]) => void;
  onDirty?: () => void;
  initialViewport?: GatewayViewport;
}

export function GatewayCanvas({
  nodes,
  edges,
  onNodesChange: onNodesChangeProp,
  onEdgesChange: onEdgesChangeProp,
  onDirty,
  initialViewport,
}: GatewayCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const hasInitializedViewportRef = useRef(false);
  const [activeTool, setActiveTool] = useState<CanvasToolMode>('select');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isViewportPanning, setIsViewportPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewportState, setViewportState] = useState({ x: 0, y: 0, zoom: 1 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const [selectorPanel, setSelectorPanel] = useState<SelectorPanelState | null>(null);

  React.useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  React.useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const next = applyNodeChanges(changes, nodes) as GatewayNode[];
      onNodesChangeProp(next);
      if (changes.some((c) => c.type !== 'select')) {
        onDirty?.();
      }
    },
    [nodes, onNodesChangeProp, onDirty],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const next = applyEdgeChanges(changes, edges) as GatewayEdge[];
      onEdgesChangeProp(next);
      if (changes.some((c) => c.type !== 'select')) {
        onDirty?.();
      }
    },
    [edges, onEdgesChangeProp, onDirty],
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      const newEdge: GatewayEdge = {
        ...connection,
        id: `edge_${Date.now()}`,
        type: 'typed',
        source: connection.source!,
        target: connection.target!,
      };
      const next = addEdge(newEdge, edges) as GatewayEdge[];
      onEdgesChangeProp(next);
      onDirty?.();
    },
    [edges, onEdgesChangeProp, onDirty],
  );

  const handleIsValidConnection = useCallback(
    (connection: Connection) => isValidConnection(connection, nodes, edges),
    [nodes, edges],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    // During dragover, browsers restrict getData() for security.
    // We can only check if the MIME type is present in dataTransfer.types.
    if (!event.dataTransfer.types.includes('application/x-shenbi-palette-item')) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const payload = readPaletteDragPayload(event.dataTransfer);
      if (!payload || payload.kind !== 'gateway-node') {
        return;
      }
      const kind = payload.type as GatewayNodeKind;
      if (!kind || !NODE_CONTRACTS[kind]) {
        return;
      }

      const contract = NODE_CONTRACTS[kind];

      // Check maxInstances
      if (contract.maxInstances) {
        const existingCount = nodes.filter((n) => (n.data as GatewayNodeData).kind === kind).length;
        if (existingCount >= contract.maxInstances) {
          return;
        }
      }

      const position = reactFlowInstance.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) ?? { x: event.clientX, y: event.clientY };

      const newNode: GatewayNode = {
        id: createNodeId(),
        type: kind,
        position,
        data: {
          kind,
          label: contract.label,
          config: {},
        },
      };

      onNodesChangeProp([...nodes, newNode]);
      onDirty?.();
    },
    [nodes, onNodesChangeProp, onDirty],
  );

  const defaultEdgeOptions = useMemo(() => ({
    type: 'typed',
    animated: false,
  }), []);
  const selectedNodes = useMemo(() => nodes.filter((node) => Boolean(node.selected)), [nodes]);
  const effectivePan = isSpacePressed || activeTool === 'pan';
  const gatewayAssetGroups = useMemo(() => buildGatewayPaletteAssets(), []);
  const minimapModel = useMemo(() => buildGatewayMinimapModel({
    nodes,
    viewport: viewportState,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
  }), [nodes, viewportSize.height, viewportSize.width, viewportState]);
  const railActions = useMemo(() => [
    {
      id: 'fit-graph',
      title: 'Fit Graph (Shift+1)',
      icon: <Focus size={14} />,
      onClick: () => {
        reactFlowInstance.current?.fitView({ padding: 0.2, duration: 200 });
      },
    },
    {
      id: 'focus-selected',
      title: 'Focus Selected Nodes (Shift+3)',
      icon: <span className="canvas-tool-rail__focus-dot" aria-hidden="true" />,
      disabled: selectedNodes.length === 0,
      onClick: () => {
        if (selectedNodes.length === 0) {
          return;
        }
        void reactFlowInstance.current?.fitView({
          nodes: selectedNodes.map((node) => ({ id: node.id })),
          padding: 0.3,
          duration: 200,
        });
      },
    },
  ], [selectedNodes]);

  // Handle add node button click
  const handleAddNode = useCallback((sourceNodeId: string, sourceHandle: string) => {
    const sourceNode = nodesRef.current.find((n) => n.id === sourceNodeId);
    if (!sourceNode || !reactFlowInstance.current) {
      return;
    }

    // Get the position of the source node in screen coordinates
    const nodeElement = document.querySelector(`[data-id="${sourceNodeId}"]`);
    if (!nodeElement) {
      return;
    }

    const rect = nodeElement.getBoundingClientRect();
    setSelectorPanel({
      visible: true,
      position: {
        x: rect.right + 40,
        y: rect.top + rect.height / 2 - 200,
      },
      sourceNodeId,
      sourceHandle,
    });
  }, []);

  const handleAddNodeFromEdge = useCallback((payload: TypedEdgeAddNodePayload) => {
    const sourceNode = nodesRef.current.find((node) => node.id === payload.sourceNodeId);
    const resolvedSourceHandle = payload.sourceHandle
      ?? (sourceNode ? NODE_CONTRACTS[sourceNode.data.kind].outputs[0]?.id : undefined);

    if (!resolvedSourceHandle) {
      return;
    }

    // Read targetHandle from the actual edge data (edgesRef) rather than
    // React Flow's EdgeProps, because EdgeProps.targetHandle can be null.
    const originalEdge = edgesRef.current.find((e) => e.id === payload.edgeId);
    const resolvedTargetHandle = originalEdge?.targetHandle
      ?? payload.targetHandle
      ?? undefined;

    setSelectorPanel({
      visible: true,
      position: {
        x: payload.position.x + 24,
        y: payload.position.y - 180,
      },
      sourceNodeId: payload.sourceNodeId,
      sourceHandle: resolvedSourceHandle,
      edgeId: payload.edgeId,
      targetNodeId: payload.targetNodeId,
      targetHandle: resolvedTargetHandle,
    });
  }, []);

  // Handle node selection from panel
  const handleSelectNodeFromPanel = useCallback((kind: GatewayNodeKind) => {
    if (!selectorPanel || !reactFlowInstance.current) {
      return;
    }

    // Handle "change node" mode: replace the existing node's type
    if (selectorPanel.changeNodeId) {
      const contract = NODE_CONTRACTS[kind];
      const nextNodes = nodesRef.current.map((n) => {
        if (n.id !== selectorPanel.changeNodeId) return n;
        return {
          ...n,
          type: kind,
          data: {
            ...n.data,
            kind,
            label: contract.label,
          },
        };
      });
      onNodesChangeProp(nextNodes);
      onDirty?.();
      setSelectorPanel(null);
      return;
    }

    const contract = NODE_CONTRACTS[kind];
    if (selectorPanel.edgeId && (contract.inputs.length === 0 || contract.outputs.length === 0)) {
      return;
    }
    const sourceNode = nodesRef.current.find((n) => n.id === selectorPanel.sourceNodeId);
    const targetNode = selectorPanel.targetNodeId
      ? nodesRef.current.find((node) => node.id === selectorPanel.targetNodeId)
      : null;

    if (!sourceNode) {
      return;
    }

    const downstreamIds = selectorPanel.edgeId && targetNode
      ? collectDownstreamNodeIds(selectorPanel.targetNodeId!, edgesRef.current)
      : new Set<string>();

    const shiftedNodes = new Map<string, GatewayNode>();
    let newNodePosition = {
      x: sourceNode.position.x + INSERT_NODE_GAP_X,
      y: sourceNode.position.y,
    };

    if (selectorPanel.edgeId && targetNode) {
      const nextTargetX = Math.max(
        targetNode.position.x,
        sourceNode.position.x + INSERT_NODE_GAP_X * 2,
      );
      const downstreamShiftX = nextTargetX - targetNode.position.x;

      newNodePosition = {
        x: nextTargetX - INSERT_NODE_GAP_X,
        y: targetNode.position.y,
      };

      if (downstreamShiftX > 0) {
        for (const node of nodesRef.current) {
          if (downstreamIds.has(node.id)) {
            shiftedNodes.set(node.id, {
              ...node,
              position: {
                ...node.position,
                x: node.position.x + downstreamShiftX,
              },
            });
          }
        }
      }
    }

    const newNode: GatewayNode = {
      id: createNodeId(),
      type: kind,
      position: newNodePosition,
      data: {
        kind,
        label: contract.label,
        config: {},
      },
    };

    const edgeToNewNode: GatewayEdge = {
      id: `edge_${Date.now()}`,
      type: 'typed',
      source: selectorPanel.sourceNodeId,
      sourceHandle: selectorPanel.sourceHandle,
      target: newNode.id,
      targetHandle: contract.inputs[0]?.id || 'input',
    };

    // 一次性添加新节点 + 所有边
    let nextEdges = [...edgesRef.current, edgeToNewNode];
    if (selectorPanel.edgeId && selectorPanel.targetNodeId) {
      const bridgeOutputHandle = resolveBridgeOutputHandle(
        contract,
        targetNode,
        selectorPanel.targetHandle,
      );
      nextEdges = nextEdges.filter((edge) => edge.id !== selectorPanel.edgeId);

      // Resolve the target handle: use the stored value from the original edge,
      // or fall back to the target node's first input handle.
      const targetContract = targetNode
        ? NODE_CONTRACTS[targetNode.data.kind]
        : undefined;
      const resolvedTargetHandle = selectorPanel.targetHandle
        || targetContract?.inputs[0]?.id
        || 'input';

      const secondEdge: GatewayEdge = {
        id: `edge_${Date.now()}_insert`,
        type: 'typed',
        source: newNode.id,
        sourceHandle: bridgeOutputHandle || contract.outputs[0]?.id || 'output',
        target: selectorPanel.targetNodeId,
        targetHandle: resolvedTargetHandle,
      };
      nextEdges.push(secondEdge);
    }

    const nextNodes = nodesRef.current.map((node) => shiftedNodes.get(node.id) ?? node);
    onNodesChangeProp([...nextNodes, newNode]);
    onEdgesChangeProp(nextEdges);
    onDirty?.();
    setSelectorPanel(null);
  }, [selectorPanel, onNodesChangeProp, onEdgesChangeProp, onDirty]);

  const handleNodeMenuAction = useCallback((nodeId: string, action: NodeMenuAction) => {
    switch (action) {
      case 'delete': {
        const nextNodes = nodesRef.current.filter((n) => n.id !== nodeId);
        const nextEdges = edgesRef.current.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );
        onNodesChangeProp(nextNodes);
        onEdgesChangeProp(nextEdges);
        onDirty?.();
        break;
      }
      case 'duplicate': {
        const sourceNode = nodesRef.current.find((n) => n.id === nodeId);
        if (!sourceNode) break;
        const newNode: GatewayNode = {
          id: `node_${Date.now()}`,
          type: sourceNode.type,
          position: {
            x: sourceNode.position.x + 40,
            y: sourceNode.position.y + 60,
          },
          data: { ...sourceNode.data },
        };
        onNodesChangeProp([...nodesRef.current, newNode]);
        onDirty?.();
        break;
      }
      case 'change': {
        const targetNode = nodesRef.current.find((n) => n.id === nodeId);
        if (!targetNode) break;
        const flowPos = reactFlowInstance.current?.flowToScreenPosition(targetNode.position);
        const x = flowPos ? flowPos.x + 220 : 400;
        const y = flowPos ? flowPos.y : 200;
        setSelectorPanel({
          visible: true,
          position: { x, y },
          sourceNodeId: nodeId,
          sourceHandle: '',
          changeNodeId: nodeId,
        });
        break;
      }
    }
  }, [onNodesChangeProp, onEdgesChangeProp, onDirty]);

  // Create node types with add node handler
  const nodeTypes = useMemo(() => {
    const types: Record<string, React.ComponentType<any>> = {};
    for (const [key, Component] of Object.entries(baseNodeTypes)) {
      types[key] = (props: any) => (
        <Component {...props} onAddNode={handleAddNode} onNodeMenuAction={handleNodeMenuAction} />
      );
    }
    return types;
  }, [handleAddNode, handleNodeMenuAction]);

  const edgeTypes = useMemo(() => ({
    typed: (props: any) => <TypedEdge {...props} onAddNode={handleAddNodeFromEdge} />,
  }), [handleAddNodeFromEdge]);

  // Zoom control functions — delegate to ReactFlow instance
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.current?.zoomOut();
  }, []);

  const handleZoomTo = useCallback((zoomLevel: number) => {
    reactFlowInstance.current?.zoomTo(zoomLevel);
    setShowZoomMenu(false);
  }, []);

  const handleZoomToFit = useCallback(() => {
    reactFlowInstance.current?.fitView({ padding: 0.2 });
    setShowZoomMenu(false);
  }, []);

  // Close zoom menu when clicking outside
  React.useEffect(() => {
    if (!showZoomMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.canvas-zoom-hud')) {
        setShowZoomMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showZoomMenu]);

  React.useEffect(() => {
    const element = reactFlowWrapper.current;
    if (!element) {
      return;
    }

    const syncViewportSize = () => {
      setViewportSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    syncViewportSize();
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => syncViewportSize())
      : null;
    observer?.observe(element);

    return () => {
      observer?.disconnect();
    };
  }, []);

  React.useEffect(() => {
    const shouldHandleSpace = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : document.activeElement;
      return !(element instanceof HTMLElement
        && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (!shouldHandleSpace(event.target)) {
          return;
        }
        event.preventDefault();
        if (!event.repeat) {
          setIsSpacePressed(true);
        }
        return;
      }
      if (event.code === 'KeyV') {
        setActiveTool('select');
        return;
      }
      if (event.code === 'KeyH') {
        setActiveTool('pan');
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (shouldHandleSpace(event.target)) {
          event.preventDefault();
        }
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
      setIsViewportPanning(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur, true);
    };
  }, []);

  React.useEffect(() => {
    const instance = reactFlowInstance.current;
    if (!instance || hasInitializedViewportRef.current || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    const nextViewport = resolveGatewayInitialViewport({
      nodes,
      viewportSize,
      persistedViewport: initialViewport,
    });

    hasInitializedViewportRef.current = true;
    setZoom(nextViewport.zoom);
    setViewportState(nextViewport);
    void instance.setViewport(nextViewport, { duration: 0 });
  }, [initialViewport, nodes, viewportSize]);

  return (
    <div
      ref={reactFlowWrapper}
      className={`gateway-canvas${isViewportPanning ? ' cursor-grabbing' : effectivePan ? ' canvas-cursor-grab' : ''}`}
    >
      <div className="canvas-toolbar-layer">
        <CanvasToolRail
          activeTool={activeTool}
          spacePanActive={isSpacePressed}
          focusSelectionDisabled={selectedNodes.length === 0}
          onSelectTool={() => setActiveTool('select')}
          onPanTool={() => setActiveTool('pan')}
          onFit={handleZoomToFit}
          onCenter={handleZoomToFit}
          onFocusSelection={() => {
            if (selectedNodes.length === 0) {
              return;
            }
            void reactFlowInstance.current?.fitView({
              nodes: selectedNodes.map((node) => ({ id: node.id })),
              padding: 0.3,
              duration: 200,
            });
          }}
          actions={railActions}
        />
      </div>
      <ReactFlow
        className="canvas-grid"
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        isValidConnection={handleIsValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
          setZoom(instance.getZoom());
          setViewportState(instance.toObject().viewport);
        }}
        onMoveStart={() => {
          if (effectivePan) {
            setIsViewportPanning(true);
          }
        }}
        onMove={(_, viewport) => {
          setZoom(viewport.zoom);
          setViewportState(viewport);
        }}
        onMoveEnd={() => {
          setIsViewportPanning(false);
        }}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!effectivePan}
        elementsSelectable={!effectivePan}
        selectionOnDrag={!effectivePan}
        panOnDrag={effectivePan ? [0, 1] : [1]}
      >
        <CanvasZoomHud
          className="nopan"
          scale={zoom}
          minimapModel={minimapModel}
          menuOpen={showZoomMenu}
          menuRef={zoomMenuRef}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onToggleMenu={() => setShowZoomMenu((prev) => !prev)}
          onSelectScale={handleZoomTo}
          onFit={handleZoomToFit}
        />
      </ReactFlow>

      {selectorPanel?.visible && (
        <NodeSelectorPanel
          position={selectorPanel.position}
          assetGroups={gatewayAssetGroups}
          insertKind={selectorPanel.edgeId ? 'edge-insert' : 'quick-insert'}
          onSelectNode={handleSelectNodeFromPanel}
          onClose={() => setSelectorPanel(null)}
        />
      )}
    </div>
  );
}
