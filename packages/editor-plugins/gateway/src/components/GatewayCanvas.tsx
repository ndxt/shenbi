// ---------------------------------------------------------------------------
// GatewayCanvas — React Flow canvas wrapper with drag-drop support
// ---------------------------------------------------------------------------

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes as baseNodeTypes } from '../nodes/node-registry';
import { TypedEdge } from '../edges/TypedEdge';
import { isValidConnection } from '../validation';
import type {
  GatewayNode,
  GatewayEdge,
  GatewayNodeKind,
  GatewayNodeData,
} from '../types';
import { NODE_CONTRACTS } from '../types';
import { NodeSelectorPanel } from './NodeSelectorPanel';
import '../styles/gateway.css';

const edgeTypes = {
  typed: TypedEdge,
};

function createNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface GatewayCanvasProps {
  nodes: GatewayNode[];
  edges: GatewayEdge[];
  onNodesChange: (nodes: GatewayNode[]) => void;
  onEdgesChange: (edges: GatewayEdge[]) => void;
  onDirty?: () => void;
}

export function GatewayCanvas({
  nodes,
  edges,
  onNodesChange: onNodesChangeProp,
  onEdgesChange: onEdgesChangeProp,
  onDirty,
}: GatewayCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [selectorPanel, setSelectorPanel] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    sourceNodeId: string;
    sourceHandle: string;
  } | null>(null);

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
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/gateway-node-kind') as GatewayNodeKind;
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

  const minimapNodeColor = useCallback((node: GatewayNode) => {
    const data = node.data as GatewayNodeData;
    return NODE_CONTRACTS[data.kind]?.color ?? '#64748b';
  }, []);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'typed',
    animated: false,
  }), []);

  // Handle add node button click
  const handleAddNode = useCallback((sourceNodeId: string, sourceHandle: string) => {
    const sourceNode = nodes.find((n) => n.id === sourceNodeId);
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
  }, [nodes]);

  // Handle node selection from panel
  const handleSelectNodeFromPanel = useCallback((kind: GatewayNodeKind) => {
    if (!selectorPanel || !reactFlowInstance.current) {
      return;
    }

    const contract = NODE_CONTRACTS[kind];
    const sourceNode = nodes.find((n) => n.id === selectorPanel.sourceNodeId);
    
    if (!sourceNode) {
      return;
    }

    // Create new node to the right of source node
    const newNodePosition = {
      x: sourceNode.position.x + 280,
      y: sourceNode.position.y,
    };

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

    // Create edge connecting source to new node
    const newEdge: GatewayEdge = {
      id: `edge_${Date.now()}`,
      type: 'typed',
      source: selectorPanel.sourceNodeId,
      sourceHandle: selectorPanel.sourceHandle,
      target: newNode.id,
      targetHandle: contract.inputs[0]?.id || 'input',
    };

    onNodesChangeProp([...nodes, newNode]);
    onEdgesChangeProp([...edges, newEdge]);
    onDirty?.();
    setSelectorPanel(null);
  }, [selectorPanel, nodes, edges, onNodesChangeProp, onEdgesChangeProp, onDirty]);

  // Create node types with add node handler
  const nodeTypes = useMemo(() => {
    const types: Record<string, React.ComponentType<any>> = {};
    for (const [key, Component] of Object.entries(baseNodeTypes)) {
      types[key] = (props: any) => <Component {...props} onAddNode={handleAddNode} />;
    }
    return types;
  }, [handleAddNode]);

  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.zoomOut();
    }
  }, []);

  const handleZoomTo = useCallback((zoomLevel: number) => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.zoomTo(zoomLevel);
      setShowZoomMenu(false);
    }
  }, []);

  const handleZoomToFit = useCallback(() => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.fitView({ padding: 0.2 });
      setShowZoomMenu(false);
    }
  }, []);

  // Close zoom menu when clicking outside
  React.useEffect(() => {
    if (!showZoomMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.gateway-canvas__zoom-display-wrapper')) {
        setShowZoomMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showZoomMenu]);

  return (
    <div ref={reactFlowWrapper} className="gateway-canvas">
      <ReactFlow
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
        }}
        onMove={(_, viewport) => {
          setZoom(viewport.zoom);
        }}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#333333" />
        <Controls />
        <MiniMap
          nodeColor={minimapNodeColor}
          nodeStrokeWidth={2}
          pannable
          zoomable
          style={{
            width: 160,
            height: 120,
          }}
        />
      </ReactFlow>

      {/* Zoom controls */}
      <div className="gateway-canvas__zoom-controls">
        <button
          className="gateway-canvas__zoom-button"
          onClick={handleZoomOut}
          title="缩小"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        
        <div className="gateway-canvas__zoom-display-wrapper">
          <button
            className="gateway-canvas__zoom-display"
            onClick={() => setShowZoomMenu(!showZoomMenu)}
          >
            {Math.round(zoom * 100)}%
          </button>
          
          {showZoomMenu && (
            <div className="gateway-canvas__zoom-menu">
              <button onClick={() => handleZoomTo(2)} className="gateway-canvas__zoom-menu-item">
                200%
              </button>
              <button onClick={() => handleZoomTo(1)} className="gateway-canvas__zoom-menu-item">
                100% <span className="gateway-canvas__zoom-menu-shortcut">Shift 1</span>
              </button>
              <button onClick={() => handleZoomTo(0.75)} className="gateway-canvas__zoom-menu-item">
                75%
              </button>
              <button onClick={() => handleZoomTo(0.5)} className="gateway-canvas__zoom-menu-item">
                50% <span className="gateway-canvas__zoom-menu-shortcut">Shift 5</span>
              </button>
              <button onClick={() => handleZoomTo(0.25)} className="gateway-canvas__zoom-menu-item">
                25%
              </button>
              <div className="gateway-canvas__zoom-menu-divider" />
              <button onClick={handleZoomToFit} className="gateway-canvas__zoom-menu-item">
                Zoom to Fit <span className="gateway-canvas__zoom-menu-shortcut">Ctrl 1</span>
              </button>
            </div>
          )}
        </div>

        <button
          className="gateway-canvas__zoom-button"
          onClick={handleZoomIn}
          title="放大"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" strokeWidth="1.5" />
            <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {selectorPanel?.visible && (
        <NodeSelectorPanel
          position={selectorPanel.position}
          onSelectNode={handleSelectNodeFromPanel}
          onClose={() => setSelectorPanel(null)}
        />
      )}
    </div>
  );
}
