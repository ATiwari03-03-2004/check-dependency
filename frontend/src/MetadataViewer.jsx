import { useEffect, useMemo, useRef, useState } from "react";
import Badges from "./Badges.jsx";
import { fetchSource } from "./api.js";
import { fileNodeId } from "./depModel.js";

/**
 * Read-only by construction: everything renders as text, so there is nothing
 * to type into and nothing to save.
 *
 * A usage shows the real file with its import and every reference marked in
 * the dependency's own colour. A dependency lists the files importing it. Both
 * spell out every field the response carries, with the raw JSON still one
 * click away.
 */

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false)\b|\b(null)\b/g;

const LINE_LIMIT = 4000;

/**
 * Last two segments of an absolute path, enough to identify a file without the
 * noise. Paths arrive with the server's separator, so accept either.
 */
function tailOfPath(file) {
  const separator = file.includes("\\") ? "\\" : "/";
  return file.split(/[\\/]/).slice(-2).join(separator);
}

function tokenize(line) {
  const parts = [];
  let cursor = 0;
  let match;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(line)) !== null) {
    if (match.index > cursor) parts.push({ kind: "punct", text: line.slice(cursor, match.index) });
    if (match[1]) parts.push({ kind: match[2] ? "key" : "str", text: match[0] });
    else if (match[3]) parts.push({ kind: "num", text: match[3] });
    else if (match[4]) parts.push({ kind: "bool", text: match[4] });
    else if (match[5]) parts.push({ kind: "null", text: match[5] });
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) parts.push({ kind: "punct", text: line.slice(cursor) });
  return parts;
}

const at = (loc) => (loc ? `${loc.start.line}:${loc.start.column}` : "—");
const yesNo = (v) => (v ? "yes" : "no");

function Facts({ rows }) {
  const shown = rows.filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!shown.length) return null;
  return (
    <dl className="facts">
      {shown.map(([label, value]) => (
        <div className="facts__row" key={label}>
          <dt>{label}</dt>
          <dd title={typeof value === "string" ? value : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** line number -> spans to mark, derived from the declaration and usage locs. */
function collectMarks(entries) {
  const byLine = new Map();
  const jumps = [];

  const add = (loc, kind, label) => {
    if (!loc) return;
    jumps.push({ line: loc.start.line, kind, label });
    for (let line = loc.start.line; line <= loc.end.line; line++) {
      const from = line === loc.start.line ? loc.start.column : 0;
      const to = line === loc.end.line ? loc.end.column : Infinity;
      if (!byLine.has(line)) byLine.set(line, []);
      byLine.get(line).push({ from, to, kind });
    }
  };

  entries.forEach((entry) => {
    add(entry.declaration?.loc, "decl", "import");
    Object.entries(entry.usage || {}).forEach(([name, spots]) => {
      (spots || []).forEach((spot) => add(spot.loc, "use", name));
    });
  });

  jumps.sort((a, b) => a.line - b.line);
  return { byLine, jumps };
}

/** Cut a line into plain and marked pieces. */
function segment(text, marks) {
  if (!marks?.length) return [{ text }];
  const edges = new Set([0, text.length]);
  const bounded = marks.map((m) => ({
    from: Math.max(0, Math.min(m.from, text.length)),
    to: Math.min(m.to === Infinity ? text.length : m.to, text.length),
    kind: m.kind,
  }));
  bounded.forEach((m) => {
    edges.add(m.from);
    edges.add(m.to);
  });
  const stops = [...edges].sort((a, b) => a - b);

  const out = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    if (from === to) continue;
    const hit = bounded.find((m) => m.from <= from && m.to >= to && m.from !== m.to);
    out.push({ text: text.slice(from, to), kind: hit?.kind });
  }
  return out;
}

function RawJson({ info }) {
  const lines = useMemo(() => {
    const text = JSON.stringify(info, null, 2) ?? "null";
    const raw = text.split("\n");
    return raw.length > LINE_LIMIT
      ? raw.map((line) => [{ kind: "punct", text: line }])
      : raw.map(tokenize);
  }, [info]);

  return (
    <details className="raw">
      <summary>Raw JSON</summary>
      <pre className="code">
        {lines.map((parts, index) => (
          <div className="code__line" key={index}>
            <span className="code__num">{index + 1}</span>
            <span className="code__text">
              {parts.map((part, i) => (
                <span className={`tok tok--${part.kind}`} key={i}>
                  {part.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </details>
  );
}

function SourceView({ meta }) {
  // Mounted with key={meta.path}, so a different file arrives as a fresh
  // component and this starts out loading without having to reset it.
  const [state, setState] = useState({ status: "loading" });
  const scroller = useRef(null);

  useEffect(() => {
    let live = true;
    fetchSource(meta.path)
      .then((text) => live && setState({ status: "ready", text }))
      .catch((error) => live && setState({ status: "error", message: error.message }));
    return () => {
      live = false;
    };
  }, [meta.path]);

  const { byLine, jumps } = useMemo(
    () => collectMarks(meta.info.details || []),
    [meta.info.details],
  );

  // CRLF files would otherwise render a stray carriage return per line.
  const lines = useMemo(
    () => (state.status === "ready" ? state.text.split(/\r?\n/) : []),
    [state],
  );

  const goTo = (line) => {
    const row = scroller.current?.querySelector(`[data-line="${line}"]`);
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // Land on the import rather than the top of the file.
  useEffect(() => {
    if (state.status !== "ready" || !jumps.length) return;
    scroller.current
      ?.querySelector(`[data-line="${jumps[0].line}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [state.status, jumps]);

  if (state.status === "loading") {
    return <p className="viewer__empty">Reading {meta.label}…</p>;
  }
  if (state.status === "error") {
    return <p className="viewer__empty">Could not read the file. {state.message}</p>;
  }

  const clipped = lines.length > LINE_LIMIT;
  const shown = clipped ? lines.slice(0, LINE_LIMIT) : lines;

  return (
    <>
      {jumps.length ? (
        <div className="jumps">
          {jumps.map((jump, i) => (
            <button
              type="button"
              className="jump"
              data-kind={jump.kind}
              key={`${jump.line}-${jump.label}-${i}`}
              onClick={() => goTo(jump.line)}
            >
              {jump.label} <span className="jump__line">L{jump.line}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="viewer__code" ref={scroller} tabIndex={0} role="region" aria-label={`Source of ${meta.label}`}>
        <pre className="code">
          {shown.map((line, index) => {
            const number = index + 1;
            const marks = byLine.get(number);
            return (
              <div
                className="code__line"
                data-line={number}
                data-marked={marks ? "" : undefined}
                key={number}
              >
                <span className="code__num">{number}</span>
                <span className="code__text">
                  {segment(line, marks).map((piece, i) =>
                    piece.kind ? (
                      <mark className={`hit hit--${piece.kind}`} key={i}>
                        {piece.text}
                      </mark>
                    ) : (
                      <span key={i}>{piece.text}</span>
                    ),
                  )}
                </span>
              </div>
            );
          })}
        </pre>
        {clipped ? (
          <p className="viewer__empty">
            Showing the first {LINE_LIMIT} of {lines.length} lines.
          </p>
        ) : null}
      </div>
    </>
  );
}

function UsageBody({ meta }) {
  const entries = meta.info.details || [];
  return (
    <>
      <div className="viewer__facts">
        <Facts
          rows={[
            ["Dependency", meta.dep],
            ["Source", meta.kind],
            ["Imports here", entries.length],
            ["References", meta.info.references],
            ["Parse error", yesNo(meta.info.parseError)],
            ["File", meta.path],
          ]}
        />

        {entries.map((entry, i) => (
          <section className="entry" key={i}>
            <h3 className="entry__head">
              {entries.length > 1 ? `Import ${i + 1} of ${entries.length}` : "Import"}
            </h3>
            <Facts
              rows={[
                ["Specifier", entry.dependencyValue],
                ["Version", entry.dependencyVersion],
                ["Type", entry.dependencyType],
                ["Dev dependency", yesNo(entry.devDependencies)],
                ["Side effect only", yesNo(entry.sideEffect)],
                ["Declared at", at(entry.declaration?.loc)],
                [
                  "Bound names",
                  Object.keys(entry.usage || {}).join(", ") || "none referenced",
                ],
                [
                  "Module identifier",
                  Object.keys(entry.moduleIdentifier || {}).length
                    ? JSON.stringify(entry.moduleIdentifier)
                    : undefined,
                ],
                ["Resolved to", entry.dependencyPath],
              ]}
            />
          </section>
        ))}
      </div>

      <SourceView meta={meta} key={meta.path} />
      <div className="viewer__facts">
        <RawJson info={meta.info} />
      </div>
    </>
  );
}

function DependencyBody({ meta, onSelect }) {
  const usages = meta.info.usages;
  const files = usages && !Array.isArray(usages) ? Object.keys(usages) : [];

  return (
    <div className="viewer__facts viewer__facts--scroll">
      <Facts
        rows={[
          ["Name", meta.label],
          ["Source", meta.kind],
          ["Version", meta.version],
          ["Dev dependency", yesNo(meta.dev)],
          ["Status", meta.info.status],
          ["Imported by", `${meta.info.importedBy} file${meta.info.importedBy === 1 ? "" : "s"}`],
          ["Resolved from", meta.info.resolvedFrom],
        ]}
      />

      {files.length ? (
        <section className="entry">
          <h3 className="entry__head">Imported by</h3>
          <ul className="filelist">
            {files.map((file) => {
              const entries = usages[file] || [];
              const refs = entries.reduce(
                (n, e) => n + Object.keys(e.usage || {}).length,
                0,
              );
              return (
                <li key={file}>
                  <button
                    type="button"
                    className="filelist__item"
                    onClick={() => onSelect(fileNodeId(meta.dep, file))}
                  >
                    <span className="filelist__name">{tailOfPath(file)}</span>
                    <span className="filelist__meta">
                      L{entries[0]?.declaration?.loc?.start.line ?? "?"} · {refs} ref
                      {refs === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <RawJson info={meta.info} />
    </div>
  );
}

function ProjectBody({ meta }) {
  return (
    <div className="viewer__facts viewer__facts--scroll">
      <Facts
        rows={[
          ["Project", meta.info.project],
          ["Location", meta.info.location],
          ["Dependencies", meta.info.dependencies],
          ["Usages", meta.info.usages],
          ["In use", meta.info.inUse],
          ["Imported, unreferenced", meta.info.importedButNotReferenced],
          ["Never imported", meta.info.neverImported],
        ]}
      />
      <RawJson info={meta.info} />
    </div>
  );
}

export default function MetadataViewer({ meta, onSelect }) {
  return (
    <section
      className="viewer"
      aria-label="Metadata"
      data-kind={meta ? (meta.type === 0 ? "root" : meta.kind) : "none"}
    >
      <header
        className="viewer__head"
        data-kind={meta ? (meta.type === 0 ? "root" : meta.kind) : "none"}
      >
        <span className="viewer__name">{meta ? meta.label : "Metadata"}</span>
        {meta ? (
          <span className="viewer__badges">
            <Badges meta={meta} showKind={meta.type !== 0} />
          </span>
        ) : null}
        {meta ? (
          <span className="viewer__path" title={meta.path || ""}>
            {meta.path || ""}
          </span>
        ) : null}
        <span className="viewer__flag">read-only</span>
      </header>

      {!meta ? (
        <p className="viewer__empty">
          Pick anything in the explorer or the graph to read its metadata.
        </p>
      ) : meta.type === 2 ? (
        <UsageBody meta={meta} />
      ) : meta.type === 1 ? (
        <DependencyBody meta={meta} onSelect={onSelect} />
      ) : (
        <ProjectBody meta={meta} />
      )}
    </section>
  );
}
