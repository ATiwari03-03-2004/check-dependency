import { useCallback, useEffect, useRef } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DependencyNode from "./DependencyNode.jsx";

// Defined once: a fresh object here would remount every node on each render.
const nodeTypes = { dep: DependencyNode };
const defaultEdgeOptions = { type: "smoothstep" };

export default function DependencyTree({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onSelect,
  onInspect,
  focus,
}) {
  const flow = useRef(null);

  const handleNodeClick = useCallback(
    (_event, node) => onSelect(node.id),
    [onSelect],
  );
  const handleNodeDoubleClick = useCallback(
    (_event, node) => onInspect(node.id),
    [onInspect],
  );
  const handlePaneClick = useCallback(() => onSelect(null), [onSelect]);

  // `focus` carries a token, so asking for the same node twice still re-frames.
  useEffect(() => {
    if (!flow.current || !focus?.ids?.length) return;
    flow.current.fitView({
      nodes: focus.ids.map((id) => ({ id })),
      duration: 400,
      padding: 0.35,
      maxZoom: 1.15,
    });
  }, [focus]);

  return (
    <ReactFlow
      fitView
      onInit={(instance) => (flow.current = instance)}
      minZoom={0.05}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      onPaneClick={handlePaneClick}
      onlyRenderVisibleElements
      /* The layout carries meaning, so the graph is read-only: pan and zoom
         to navigate, but nodes stay where they were placed. */
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      edgesReconnectable={false}
      zoomOnDoubleClick={false}
      colorMode="dark"
      proOptions={{ hideAttribution: false }}
    >
      <Background gap={26} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
