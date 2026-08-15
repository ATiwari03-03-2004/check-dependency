import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import DependencyTree from "./DependencyTree.jsx";
import DependencyDirectory from "./DependencyDirectory.jsx";
import MetadataViewer from "./MetadataViewer.jsx";
import FilterPanel from "./FilterPanel.jsx";
import generateDependencyTree, { layoutModel } from "./generateDependencyTree.js";
import { ALL_ON, buildModel } from "./depModel.js";
import { API } from "./api.js";
import {
  applyDelta,
  applyPositions,
  clearFlash,
  markEdges,
  markNodes,
  relatedTo,
} from "./graphDelta.js";
import "./App.css";

const FLASH_MS = 1600;

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [model, setModel] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("graph");
  const [focus, setFocus] = useState(null);
  const [status, setStatus] = useState({ tone: "busy", text: "Loading dependencies…" });
  const [busy, setBusy] = useState(true);
  const [params, setParams] = useState(ALL_ON);

  const flashTimer = useRef(null);
  const loaded = useRef(false);
  const lastResponse = useRef(null); // so filters can rebuild without refetching

  const startFlashTimer = useCallback(() => {
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setNodes(clearFlash), FLASH_MS);
  }, [setNodes]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  useEffect(() => {
    if (loaded.current) return; // StrictMode mounts effects twice in dev
    loaded.current = true;

    (async () => {
      try {
        const response = await fetch(`${API}/dep`);
        const depInfo = await response.json();
        lastResponse.current = depInfo;
        const graph = await generateDependencyTree(depInfo, params);
        setModel(graph.model);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setStatus({ tone: "idle", text: "Ready" });
      } catch (error) {
        console.error("Error fetching dependency information!!\nError: ", error);
        setStatus({ tone: "error", text: "Cannot reach the scanner. Is the server still running?" });
      } finally {
        setBusy(false);
      }
    })();
  }, [params, setNodes, setEdges]);

  const select = useCallback(
    (id, { zoom = false } = {}) => {
      setSelectedId(id);
      const kin = relatedTo(model, id);
      setNodes((current) => markNodes(current, kin, id));
      setEdges((current) => markEdges(current, kin));
      if (zoom && kin) {
        setFocus((prev) => ({ ids: [...kin.nodes], token: (prev?.token || 0) + 1 }));
      }
    },
    [model, setEdges, setNodes],
  );

  // Picking something in the explorer acts on whichever view is already open:
  // it frames the node on the graph, or updates the metadata. It never
  // switches the view out from under you — that is the toggle's job alone.
  const activate = useCallback(
    (id) => select(id, { zoom: view === "graph" }),
    [select, view],
  );

  // Double-clicking a node is the one gesture that does switch view: you asked
  // for that node's metadata, so it opens.
  const inspect = useCallback(
    (id) => {
      select(id);
      setView("meta");
    },
    [select],
  );

  const resync = useCallback(async () => {
    setBusy(true);
    setStatus({ tone: "busy", text: "Re-syncing…" });
    try {
      const response = await fetch(`${API}/resync`);
      const payload = await response.json();

      if (!payload?.treeData) {
        setStatus({ tone: "idle", text: payload?.msg || "Already up to date" });
        return;
      }

      lastResponse.current = payload;
      const next = buildModel(payload, params);
      const delta = applyDelta(nodes, edges, next);
      setModel(next);

      if (!delta.changed) {
        setStatus({ tone: "idle", text: "Re-synced · nothing changed on screen" });
        return;
      }

      // Re-derive the highlight against the new model, so nodes that just
      // appeared are dimmed with everything else rather than standing out.
      const kin = relatedTo(next, selectedId);
      setNodes(markNodes(delta.nodes, kin, selectedId));
      setEdges(markEdges(delta.edges, kin));
      startFlashTimer();

      const { added, updated, removed } = delta.stats;
      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (removed) parts.push(`${removed} removed`);
      setStatus({ tone: "ok", text: `Re-synced · ${parts.join(", ") || "no changes"}` });
    } catch (error) {
      console.error("Error re-synchronizing dependency information!!\nError: ", error);
      setStatus({ tone: "error", text: "Re-sync failed. Is the server still running?" });
    } finally {
      setBusy(false);
    }
  }, [edges, nodes, params, selectedId, setEdges, setNodes, startFlashTimer]);

  // Filtering changes which nodes exist at all, so unlike a re-sync it earns a
  // fresh layout rather than an incremental patch.
  const applyFilters = useCallback(
    async (next) => {
      setParams(next);
      if (!lastResponse.current) return;
      setBusy(true);
      try {
        const rebuilt = buildModel(lastResponse.current, next);
        const laid = await layoutModel(rebuilt);
        const keep = selectedId && rebuilt.byId.has(selectedId) ? selectedId : null;
        const kin = relatedTo(rebuilt, keep);

        setModel(rebuilt);
        setSelectedId(keep);
        setNodes(markNodes(laid.nodes, kin, keep));
        setEdges(markEdges(laid.edges, kin));
        setStatus({
          tone: "idle",
          text: next.all
            ? "Filters cleared"
            : `Filtered to ${rebuilt.summary.dependencies} dependencies`,
        });
      } finally {
        setBusy(false);
      }
    },
    [selectedId, setEdges, setNodes],
  );

  const arrange = useCallback(async () => {
    if (!model) return;
    const laidOut = await layoutModel(model);
    setNodes((current) => applyPositions(current, laidOut.nodes));
    setStatus({ tone: "idle", text: "Graph arranged" });
  }, [model, setNodes]);

  const selected = selectedId ? model?.byId.get(selectedId) : null;

  const tally = useMemo(() => {
    if (!model) return "";
    const { dependencies, usages, idle, dead } = model.summary;
    return (
      `${dependencies} dependencies · ${usages} usages` +
      (idle ? ` · ${idle} unreferenced` : "") +
      (dead ? ` · ${dead} never imported` : "")
    );
  }, [model]);

  return (
    <div className="app">
      <header className="bar">
        <h1 className="bar__title">{model?.project || "check-dependency"}</h1>
        {model ? (
          <ul className="bar__legend" aria-label="Dependency source">
            <li data-kind="built-in">{model.summary.kinds["built-in"]} built-in</li>
            <li data-kind="local">{model.summary.kinds.local} local</li>
            <li data-kind="global">{model.summary.kinds.global} global</li>
          </ul>
        ) : null}
        <div className="bar__actions">
          <div className="switch" role="group" aria-label="Workspace view">
            <button
              type="button"
              className="switch__side"
              aria-pressed={view === "graph"}
              onClick={() => setView("graph")}
            >
              Graph
            </button>
            <button
              type="button"
              className="switch__side"
              aria-pressed={view === "meta"}
              onClick={() => setView("meta")}
            >
              Metadata
            </button>
          </div>
          <FilterPanel params={params} onApply={applyFilters} disabled={!model || busy} />
          <button
            type="button"
            className="btn"
            onClick={arrange}
            disabled={!model || view !== "graph"}
          >
            Arrange
          </button>
          <button type="button" className="btn btn--go" onClick={resync} disabled={busy}>
            Re-sync
          </button>
        </div>
      </header>

      <div className="main">
        <DependencyDirectory
          tree={model?.tree}
          selectedId={selectedId}
          onSelect={select}
          onActivate={activate}
        />
        <div className="work">
          {/* The graph stays mounted while hidden: unmounting it would drop the
              viewport and re-run fitView every time you switched back. */}
          <div className="canvas" data-active={view === "graph"}>
            <DependencyTree
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onSelect={select}
              onInspect={inspect}
              focus={focus}
            />
          </div>
          {view === "meta" ? <MetadataViewer meta={selected} onSelect={select} /> : null}
        </div>
      </div>

      <footer className="status">
        <span className="status__msg" data-tone={status.tone} role="status">
          {status.text}
        </span>
        {/* Derived from the model, never from a message, so arranging or
            re-syncing cannot overwrite it. */}
        {model ? <span className="status__tally">{tally}</span> : null}
      </footer>
    </div>
  );
}
