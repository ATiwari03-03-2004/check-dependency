import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ROOT_ID } from "./depModel.js";
import Badges from "./Badges.jsx";

function Chevron({ open }) {
  return (
    <svg className="row__chevron" data-open={open} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Depth-first walk of the branches the reader has opened. */
function flatten(tree, expanded) {
  const rows = [];
  const walk = (node, depth) => {
    const open = expanded.has(node.id);
    rows.push({ node, depth, open, expandable: !!node.children });
    if (open && node.children) node.children.forEach((child) => walk(child, depth + 1));
  };
  if (tree) walk(tree, 0);
  return rows;
}

const Row = memo(function Row({ row, selected, focused, onActivate, onToggle }) {
  const { node, depth, open, expandable } = row;
  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? open : undefined}
      tabIndex={focused ? 0 : -1}
      data-id={node.id}
      className="row"
      data-kind={node.type === 0 ? "root" : node.kind}
      data-selected={selected}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      onClick={() => onActivate(node.id)}
      onDoubleClick={() => expandable && onToggle(node.id)}
    >
      {expandable ? (
        <button
          type="button"
          className="row__twisty"
          tabIndex={-1}
          aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
        >
          <Chevron open={open} />
        </button>
      ) : (
        <span className="row__twisty" aria-hidden="true" />
      )}

      <span className="row__label">{node.label}</span>

      {/* The stripe already carries the kind on a usage row, so only the
          dependency itself spells it out. */}
      <span className="row__badges">
        <Badges meta={node} showKind={node.type === 1} />
      </span>

      {node.type === 1 && node.children?.length ? (
        <span className="row__count">{node.children.length}</span>
      ) : null}
    </div>
  );
});

export default function DependencyDirectory({ tree, selectedId, onSelect, onActivate }) {
  const [opened, setOpened] = useState(() => new Set([ROOT_ID]));
  const [closed, setClosed] = useState(() => new Set());
  const listRef = useRef(null);
  const pendingFocus = useRef(null);

  const parents = useMemo(() => {
    const map = new Map();
    const walk = (node) => {
      node.children?.forEach((child) => {
        map.set(child.id, node.id);
        walk(child);
      });
    };
    if (tree) walk(tree);
    return map;
  }, [tree]);

  // Derived, not synchronised: a selection made out in the graph reveals its
  // branch, and a branch the reader collapsed on purpose stays collapsed.
  const expanded = useMemo(() => {
    const set = new Set(opened);
    for (let id = parents.get(selectedId); id; id = parents.get(id)) set.add(id);
    for (const id of closed) set.delete(id);
    return set;
  }, [opened, closed, parents, selectedId]);

  const toggle = useCallback(
    (id) => {
      const shutIt = expanded.has(id);
      setOpened((prev) => {
        const next = new Set(prev);
        if (shutIt) next.delete(id);
        else next.add(id);
        return next;
      });
      setClosed((prev) => {
        const next = new Set(prev);
        if (shutIt) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [expanded],
  );

  const rows = useMemo(() => flatten(tree, expanded), [tree, expanded]);

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    listRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.focus();
  }, [rows, selectedId]);

  const move = (index) => {
    const row = rows[index];
    if (!row) return;
    pendingFocus.current = row.node.id;
    onSelect(row.node.id);
  };

  const onKeyDown = (event) => {
    const index = rows.findIndex((row) => row.node.id === selectedId);
    if (index === -1) return;
    const row = rows[index];

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(index - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (row.expandable && !row.open) toggle(row.node.id);
        else move(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (row.expandable && row.open) toggle(row.node.id);
        else {
          const parent = rows.findIndex((r) => r.node.id === row.node.parentId);
          if (parent !== -1) move(parent);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onActivate(row.node.id);
        break;
      default:
        break;
    }
  };

  return (
    <aside className="explorer">
      <div className="explorer__head">Explorer</div>
      {tree ? (
        <div
          className="explorer__list"
          role="tree"
          aria-label="Project dependencies"
          ref={listRef}
          onKeyDown={onKeyDown}
        >
          {rows.map((row) => (
            <Row
              key={row.node.id}
              row={row}
              selected={row.node.id === selectedId}
              focused={row.node.id === (selectedId || rows[0]?.node.id)}
              onActivate={onActivate}
              onToggle={toggle}
            />
          ))}
        </div>
      ) : (
        <p className="explorer__empty">Reading dependencies…</p>
      )}
    </aside>
  );
}
