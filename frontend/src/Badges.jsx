/**
 * Pills shared by the explorer, the graph nodes and the metadata header, so a
 * dependency reads the same wherever you meet it.
 *
 * Colour means one thing only: where the dependency comes from (built-in,
 * local, global). Anything unusual about it — a dev dependency, an unused one,
 * a file that would not parse — gets a pill instead, so the ordinary case
 * stays quiet.
 */
export default function Badges({ meta, showKind = true }) {
  return (
    <>
      {showKind && meta.kind ? (
        <span className="pill" data-kind={meta.kind}>
          {meta.kind}
        </span>
      ) : null}
      {meta.dev ? <span className="pill pill--flag">dev</span> : null}
      {meta.error ? <span className="pill pill--bad">parse error</span> : null}
      {meta.state === "dead" ? (
        <span className="pill pill--bad">never imported</span>
      ) : null}
      {meta.state === "idle" ? (
        <span className="pill pill--warn">unreferenced</span>
      ) : null}
    </>
  );
}
