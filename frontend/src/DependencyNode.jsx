import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import Badges from "./Badges.jsx";

function DependencyNode({ data, selected }) {
  const detail =
    data.type === 2
      ? `${data.info.imports} import${data.info.imports === 1 ? "" : "s"}`
      : data.type === 1
        ? data.version || ""
        : `${data.info.dependencies} dependencies`;

  return (
    <div
      className="node"
      data-kind={data.type === 0 ? "root" : data.kind}
      data-selected={selected || undefined}
      data-rel={data.rel}
      data-flash={data.flash || undefined}
    >
      {data.type !== 0 ? <Handle type="target" position={Position.Top} /> : null}
      <span className="node__label" title={data.path || data.label}>
        {data.label}
      </span>
      <span className="node__detail">
        {detail ? <span className="node__meta">{detail}</span> : null}
        <Badges meta={data} showKind={data.type === 1} />
      </span>
      {data.type !== 2 ? <Handle type="source" position={Position.Bottom} /> : null}
    </div>
  );
}

export default memo(DependencyNode);
