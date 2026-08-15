import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_ON } from "./depModel.js";

/**
 * Edits a draft of `params` and only hands it over when Apply is pressed, so
 * ticking boxes never re-lays out the graph underneath you.
 *
 * The shape mirrors what selectVisible() in depModel.js reads:
 *   all                     — show everything, ignoring every box below
 *   usedDependenciesInfo    — by kind, for imports that are actually referenced
 *   importedButNotUsed      — by kind, for imports nothing references
 *   unusedDependenciesInfo  — declared in package.json but never imported
 *   devDependencies         — overrides the three groups above
 */

const KINDS = ["built-in", "local", "global"];

const draftOf = (params) => ({
  all: params.all,
  usedDependenciesInfo: { ...params.usedDependenciesInfo },
  unusedDependenciesInfo: { ...params.unusedDependenciesInfo },
  importedButNotUsed: { ...params.importedButNotUsed },
  devDependencies: params.devDependencies,
});

function Check({ label, checked, onChange, disabled }) {
  return (
    <label className="check" data-off={disabled || undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export default function FilterPanel({ params, onApply, disabled }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(params));
  const wrap = useRef(null);

  const openPanel = () => {
    setDraft(draftOf(params)); // always start from what is actually applied
    setOpen((was) => !was);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setGroup = useCallback((group, kind, value) => {
    setDraft((prev) => ({ ...prev, [group]: { ...prev[group], [kind]: value } }));
  }, []);

  const locked = draft.all;

  return (
    <div className="filters" ref={wrap}>
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        disabled={disabled}
        onClick={openPanel}
      >
        Filters
        {params.all ? null : <span className="filters__on" aria-label="filters active" />}
      </button>

      {open ? (
        <div className="panel" role="dialog" aria-label="Filter dependencies">
          <Check
            label="Show everything"
            checked={draft.all}
            onChange={(v) => setDraft((prev) => ({ ...prev, all: v }))}
          />

          <p className="panel__note">
            {locked
              ? "Untick to choose what appears."
              : "Only the ticked kinds are drawn."}
          </p>

          <fieldset className="panel__group" disabled={locked}>
            <legend>In use</legend>
            {KINDS.map((kind) => (
              <Check
                key={kind}
                label={kind}
                checked={!!draft.usedDependenciesInfo[kind]}
                disabled={locked}
                onChange={(v) => setGroup("usedDependenciesInfo", kind, v)}
              />
            ))}
          </fieldset>

          <fieldset className="panel__group" disabled={locked}>
            <legend>Imported, unreferenced</legend>
            {KINDS.map((kind) => (
              <Check
                key={kind}
                label={kind}
                checked={!!draft.importedButNotUsed[kind]}
                disabled={locked}
                onChange={(v) => setGroup("importedButNotUsed", kind, v)}
              />
            ))}
          </fieldset>

          <fieldset className="panel__group" disabled={locked}>
            <legend>Never imported</legend>
            <Check
              label="local"
              checked={!!draft.unusedDependenciesInfo.local}
              disabled={locked}
              onChange={(v) => setGroup("unusedDependenciesInfo", "local", v)}
            />
          </fieldset>

          <fieldset className="panel__group" disabled={locked}>
            <legend>Dev dependencies</legend>
            <Check
              label="include (overrides the above)"
              checked={draft.devDependencies}
              disabled={locked}
              onChange={(v) => setDraft((prev) => ({ ...prev, devDependencies: v }))}
            />
          </fieldset>

          <div className="panel__foot">
            <button
              type="button"
              className="btn"
              onClick={() => setDraft(draftOf(ALL_ON))}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn btn--go"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
