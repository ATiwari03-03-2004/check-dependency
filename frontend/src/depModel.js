/**
 * Turns a /dep or /resync response into one model shared by the explorer tree,
 * the ReactFlow graph and the metadata window, so all three agree on ids.
 *
 * Response shape:
 *   dependenciesInfo:       { [dep]: { [absFilePath]: usage[] } }
 *   unusedDependenciesInfo: { [dep]: info[] }   (an object, not an array, when
 *                                                it comes back from /resync)
 *   treeData: {
 *     root:           { label: [projectName, cwd], level: 0, children: dep[] },
 *     [dep]:          { label, level: 1, children: absFilePath[] },
 *     [absFilePath]:  { label, level: 2, children: [], error }
 *   }
 */

export const NODE_W = 208;
export const NODE_H = 56;

export const ROOT_ID = "project";

/** Every filter on — what selectVisible() treats as "show everything". */
export const ALL_ON = {
  all: true,
  usedDependenciesInfo: { "built-in": true, local: true, global: true },
  unusedDependenciesInfo: { local: true },
  importedButNotUsed: { "built-in": true, local: true, global: true },
  devDependencies: true,
};
export const depNodeId = (dep) => `dep::${dep}`;
export const fileNodeId = (dep, file) => `use::${dep}::${file}`;

/** /dep sends unused entries as an array, /resync sends a bare object. */
function firstInfo(entry) {
  if (!entry) return undefined;
  return Array.isArray(entry) ? entry[0] : entry;
}

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** dep -> visible file paths (empty array for a dependency with no usages). */
function selectVisible(response, params) {
  const treeData = response.treeData || {};
  const root = treeData.root;
  const visible = {};
  if (!root) return visible;

  if (params.all) {
    root.children.forEach((dep) => {
      if (treeData[dep]) {
        visible[dep] = treeData[dep].children.filter((file) => treeData[file]);
      }
    });
    return visible;
  }

  const used = response.dependenciesInfo || {};
  const unused = response.unusedDependenciesInfo || {};

  Object.keys(used).forEach((dep) => {
    Object.keys(used[dep]).forEach((file) => {
      const entry = used[dep][file][0];
      if (!entry) return;
      if (entry.devDependencies && !params.devDependencies) return;

      // A devDependency shown by its own checkbox overrides the used /
      // imported-but-not-used filters.
      let show;
      if (entry.devDependencies) show = true;
      else if (Object.keys(entry.usage || {}).length !== 0) {
        show = params.usedDependenciesInfo[entry.dependencyType];
      } else {
        show = params.importedButNotUsed[entry.dependencyType];
      }
      if (!show) return;

      if (!visible[dep]) visible[dep] = [];
      visible[dep].push(file);
    });
  });

  Object.keys(unused).forEach((dep) => {
    const info = firstInfo(unused[dep]);
    if (!info) return;
    if (info.devDependencies && !params.devDependencies) return;
    if (
      !info.devDependencies &&
      !params.unusedDependenciesInfo[info.dependencyType]
    ) {
      return;
    }
    if (!visible[dep]) visible[dep] = [];
  });

  return visible;
}

const isReferenced = (entries) =>
  (entries || []).some((e) => Object.keys(e.usage || {}).length !== 0);

function describe(response, dep, files) {
  const used = response.dependenciesInfo?.[dep];
  if (!used) {
    const info = firstInfo(response.unusedDependenciesInfo?.[dep]) || {};
    return {
      state: "dead",
      dev: !!info.devDependencies,
      kind: info.dependencyType,
      version: info.dependencyVersion,
      path: info.dependencyPath,
    };
  }
  const sample = used[Object.keys(used)[0]]?.[0] || {};
  const referenced = files.some((file) => isReferenced(used[file]));
  return {
    state: referenced ? "live" : "idle",
    dev: !!sample.devDependencies,
    kind: sample.dependencyType,
    version: sample.dependencyVersion,
    path: sample.dependencyPath,
  };
}

/**
 * @returns {{
 *   project: string, projectPath: string,
 *   nodes: {id,width,height,meta}[], edges: {id,source,target}[],
 *   tree: object, byId: Map<string, object>, summary: object
 * }}
 */
export function buildModel(response, params) {
  const treeData = response?.treeData || {};
  const root = treeData.root;
  const nodes = [];
  const edges = [];
  const byId = new Map();

  if (!root) {
    return {
      project: "",
      projectPath: "",
      nodes,
      edges,
      tree: null,
      byId,
      summary: { dependencies: 0, usages: 0, live: 0, idle: 0, dead: 0 },
    };
  }

  const [project, projectPath] = root.label;
  const visible = selectVisible(response, params);
  const deps = Object.keys(visible).sort(byName);
  const summary = {
    dependencies: deps.length,
    usages: 0,
    live: 0,
    idle: 0,
    dead: 0,
    kinds: { "built-in": 0, local: 0, global: 0 },
  };

  const rootMeta = {
    id: ROOT_ID,
    type: 0,
    label: project,
    path: projectPath,
    state: "root",
    info: null, // filled in below, once the counts are known
  };
  const tree = { ...rootMeta, children: [] };

  deps.forEach((dep) => {
    const files = [...visible[dep]].sort((a, b) =>
      byName(treeData[a]?.label || a, treeData[b]?.label || b),
    );
    const traits = describe(response, dep, files);
    const id = depNodeId(dep);
    summary[traits.state] += 1;
    if (traits.kind in summary.kinds) summary.kinds[traits.kind] += 1;

    const depMeta = {
      id,
      type: 1,
      label: dep,
      parentId: ROOT_ID,
      dep,
      ...traits,
      info: {
        dependency: dep,
        type: traits.kind,
        version: traits.version,
        devDependency: traits.dev,
        status:
          traits.state === "dead"
            ? "declared but never imported"
            : traits.state === "idle"
              ? "imported but not referenced"
              : "in use",
        resolvedFrom: traits.path,
        importedBy: files.length,
        usages:
          response.dependenciesInfo?.[dep] ??
          response.unusedDependenciesInfo?.[dep] ??
          null,
      },
    };

    const depBranch = { ...depMeta, children: [] };
    tree.children.push(depBranch);
    nodes.push({ id, width: NODE_W, height: NODE_H, meta: depMeta });
    edges.push({ id: `${ROOT_ID}->${id}`, source: ROOT_ID, target: id });

    files.forEach((file) => {
      const entries = response.dependenciesInfo?.[dep]?.[file] || [];
      const fileId = fileNodeId(dep, file);
      const error = !!treeData[file]?.error;
      summary.usages += 1;

      const fileMeta = {
        id: fileId,
        type: 2,
        label: treeData[file]?.label || file,
        parentId: id,
        dep,
        path: file,
        error,
        state: isReferenced(entries) ? "live" : "idle",
        kind: traits.kind,
        dev: traits.dev,
        info: {
          file,
          dependency: dep,
          imports: entries.length,
          references: entries.reduce(
            (n, e) => n + Object.keys(e.usage || {}).length,
            0,
          ),
          parseError: error,
          details: entries,
        },
      };

      depBranch.children.push({ ...fileMeta, children: null });
      nodes.push({ id: fileId, width: NODE_W, height: NODE_H, meta: fileMeta });
      edges.push({ id: `${id}->${fileId}`, source: id, target: fileId });
    });
  });

  rootMeta.info = {
    project,
    location: projectPath,
    dependencies: summary.dependencies,
    usages: summary.usages,
    inUse: summary.live,
    importedButNotReferenced: summary.idle,
    neverImported: summary.dead,
  };
  tree.info = rootMeta.info;
  nodes.unshift({ id: ROOT_ID, width: NODE_W, height: NODE_H, meta: rootMeta });

  // A signature per node lets a re-sync tell, in one comparison, whether a node
  // needs a new React element or can keep the one already mounted.
  nodes.forEach((node) => {
    node.meta.sig = JSON.stringify(node.meta.info);
    byId.set(node.id, node.meta);
  });

  return { project, projectPath, nodes, edges, tree, byId, summary };
}
