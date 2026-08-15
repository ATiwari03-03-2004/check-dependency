/**
 * Re-sync without re-laying out the graph.
 *
 * A full ELK pass costs the whole graph and moves every node, so a re-sync
 * instead reconciles the new model against the mounted nodes: untouched nodes
 * keep their exact object reference (React skips them entirely), changed nodes
 * keep their position and get fresh data, and only genuinely new nodes need a
 * position, which is picked next to their parent in a free slot on that row.
 */

import { NODE_W } from "./depModel.js";

const ROW_GAP = 190;
const COL_GAP = 44;

export function toFlowNode(logical, position) {
  return {
    id: logical.id,
    type: "dep",
    position,
    width: logical.width,
    height: logical.height,
    data: logical.meta,
  };
}

export function toFlowEdge(logical) {
  return { id: logical.id, source: logical.source, target: logical.target };
}

/**
 * Free x closest to `desired`, searching both directions so a new node lands
 * beside its parent rather than tacked onto the end of a crowded row.
 * `taken` is sorted by start.
 */
function freeSlot(taken, desired, width) {
  if (!taken.length) return desired;
  const clearance = width + COL_GAP;
  const options = [Math.min(desired, taken[0][0] - clearance)];

  for (let i = 0; i < taken.length - 1; i++) {
    const from = taken[i][1] + COL_GAP;
    const to = taken[i + 1][0] - clearance;
    if (to >= from) options.push(Math.min(Math.max(desired, from), to));
  }

  options.push(Math.max(desired, taken[taken.length - 1][1] + COL_GAP));
  return options.reduce((best, x) =>
    Math.abs(x - desired) < Math.abs(best - desired) ? x : best,
  );
}

/** Rows of surviving nodes, keyed by depth, so new nodes can join them. */
function surveyRows(prevNodes, model) {
  const rows = new Map();
  for (const node of prevNodes) {
    if (!model.byId.has(node.id)) continue; // a removed node frees its space
    const depth = node.data.type;
    const row = rows.get(depth);
    const span = [node.position.x, node.position.x + (node.width || NODE_W)];
    if (!row) rows.set(depth, { y: node.position.y, taken: [span] });
    else {
      row.y = Math.min(row.y, node.position.y);
      row.taken.push(span);
    }
  }
  for (const row of rows.values()) row.taken.sort((a, b) => a[0] - b[0]);
  return rows;
}

function place(logical, rows, positions, parentOf) {
  const depth = logical.meta.type;
  const parent = positions.get(parentOf.get(logical.id));

  let row = rows.get(depth);
  if (!row) {
    row = { y: parent ? parent.y + ROW_GAP : depth * ROW_GAP, taken: [] };
    rows.set(depth, row);
  }

  const rightmost = row.taken.length ? row.taken[row.taken.length - 1][1] : 0;
  const desired = parent ? parent.x : rightmost + COL_GAP;
  const x = freeSlot(row.taken, desired, logical.width);

  row.taken.push([x, x + logical.width]);
  row.taken.sort((a, b) => a[0] - b[0]);
  return { x, y: row.y };
}

/**
 * @returns {{nodes, edges, changed: boolean, stats: {added,updated,removed}}}
 *   `changed: false` means the arrays are the previous ones by reference, so
 *   the caller can skip setState and avoid a render altogether.
 */
export function applyDelta(prevNodes, prevEdges, model) {
  const previous = new Map(prevNodes.map((n) => [n.id, n]));
  const parentOf = new Map(model.edges.map((e) => [e.target, e.source]));
  const positions = new Map(prevNodes.map((n) => [n.id, n.position]));
  const rows = surveyRows(prevNodes, model);

  const stats = { added: 0, updated: 0, removed: 0 };
  for (const node of prevNodes) if (!model.byId.has(node.id)) stats.removed += 1;

  const nodes = model.nodes.map((logical) => {
    const prev = previous.get(logical.id);

    if (prev) {
      if (prev.data.sig === logical.meta.sig) return prev;
      stats.updated += 1;
      return { ...prev, data: { ...logical.meta, flash: true } };
    }

    const position = place(logical, rows, positions, parentOf);
    positions.set(logical.id, position);
    stats.added += 1;
    const node = toFlowNode(logical, position);
    return { ...node, data: { ...logical.meta, flash: true } };
  });

  const priorEdges = new Map(prevEdges.map((e) => [e.id, e]));
  const edges = model.edges.map((e) => priorEdges.get(e.id) || toFlowEdge(e));

  const same = (next, prev) =>
    next.length === prev.length && next.every((item, i) => item === prev[i]);
  const nodesSame = same(nodes, prevNodes);
  const edgesSame = same(edges, prevEdges);

  return {
    nodes: nodesSame ? prevNodes : nodes,
    edges: edgesSame ? prevEdges : edges,
    changed: !nodesSame || !edgesSame,
    stats,
  };
}

/** Move mounted nodes onto freshly laid-out positions, keeping identities. */
export function applyPositions(prevNodes, laidOut) {
  const placed = new Map(laidOut.map((n) => [n.id, n.position]));
  return prevNodes.map((node) => {
    const next = placed.get(node.id);
    if (!next || (next.x === node.position.x && next.y === node.position.y)) {
      return node;
    }
    return { ...node, position: next };
  });
}

/**
 * A node together with whatever hangs off it, and the edges joining them to
 * the tree. Pure, so the node and edge passes below can run independently.
 * Returns null when nothing is selected, which means "clear the highlight".
 */
export function relatedTo(model, id) {
  if (!id || !model?.byId.has(id)) return null;
  const kin = { nodes: new Set([id]), edges: new Set() };
  for (const edge of model.edges) {
    if (edge.source === id) {
      kin.nodes.add(edge.target);
      kin.edges.add(edge.id);
    } else if (edge.target === id) {
      kin.edges.add(edge.id);
    }
  }
  return kin;
}

const flag = (kin, member) => (kin ? (member ? "on" : "off") : undefined);

/** Untouched nodes keep their exact object reference. */
export function markNodes(nodes, kin, id) {
  return nodes.map((node) => {
    const chosen = node.id === id;
    const rel = flag(kin, kin?.nodes.has(node.id));
    if (node.selected === chosen && node.data.rel === rel) return node;
    return { ...node, selected: chosen, data: { ...node.data, rel } };
  });
}

export function markEdges(edges, kin) {
  return edges.map((edge) => {
    const rel = flag(kin, kin?.edges.has(edge.id));
    if (edge.data?.rel === rel) return edge;
    return {
      ...edge,
      className: rel ? `edge--${rel}` : undefined,
      data: { ...edge.data, rel },
    };
  });
}

/** Drop the one-shot re-sync highlight without disturbing untouched nodes. */
export function clearFlash(prevNodes) {
  let touched = false;
  const nodes = prevNodes.map((node) => {
    if (!node.data.flash) return node;
    touched = true;
    const data = { ...node.data };
    delete data.flash;
    return { ...node, data };
  });
  return touched ? nodes : prevNodes;
}
