// The package entry point pulls in "web-worker", which is not installed; the
// bundled build runs the layout on the main thread with no extra dependency.
import ELK from "elkjs/lib/elk.bundled.js";
import { buildModel } from "./depModel.js";
import { toFlowNode, toFlowEdge } from "./graphDelta.js";

const elk = new ELK();

const layoutOptions = {
  "elk.algorithm": "mrtree",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "200",
  "elk.spacing.edgeNode": "100",
  "elk.spacing.componentComponent": "100",
  "elk.padding": "[top=20,left=20,bottom=20,right=20]",
  "elk.edgeRouting": "POLYLINE",
};

/** Full ELK pass. Only for the first load and the Arrange button. */
export async function layoutModel(model) {
  if (!model.nodes.length) return { nodes: [], edges: [] };

  const layout = await elk.layout({
    id: "root",
    layoutOptions,
    children: model.nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
    })),
    edges: model.edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  });

  const placed = new Map(layout.children.map((c) => [c.id, { x: c.x, y: c.y }]));
  return {
    nodes: model.nodes.map((n) => toFlowNode(n, placed.get(n.id) || { x: 0, y: 0 })),
    edges: model.edges.map(toFlowEdge),
  };
}

/** Build the model from a response and lay it out from scratch. */
export default async function generateDependencyTree(response, params) {
  const model = buildModel(response, params);
  const { nodes, edges } = await layoutModel(model);
  return { model, nodes, edges };
}
