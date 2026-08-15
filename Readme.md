# check-dependency

Scan a JavaScript project and explore its third-party dependencies — where each
one is imported, how it is used, and which ones are never used at all.

`check-dependency` parses your source with Babel rather than matching text, so
it reports what the code actually imports: the declaration form, the identifiers
pulled off each module, side-effect imports, and the resolved path on disk.
Results are shown as an interactive graph, a directory explorer, and a metadata
view, and they stay in sync as you edit.

## Usage

Run it from the root of the project you want to inspect. No install required:

```sh
npx check-dependency
```

It scans the current directory, starts a local server, and opens the UI in your
browser.

To install it as a project dev dependency instead:

```sh
npm install --save-dev check-dependency
```

### Options

```
-p, --port <number>   Port to serve on (default: 3000; the next free port
                      is used if that one is taken)
--no-open             Do not open the browser automatically
-h, --help            Show usage
-v, --version         Print the version
```

## What it reports

- **Dependency usage** — every file that imports a package, with the import
  declaration, the identifiers used from it, and whether it is a side-effect
  import.
- **Unused dependencies** — packages declared in a `package.json` that no file
  in the project imports.
- **Source classification** — local (resolved inside the project), global
  (resolved outside it), and Node.js built-ins.
- **Live re-sync** — the project tree is watched, and re-syncing folds file
  changes, renames, deletions, and `package.json` edits into the existing graph
  rather than rescanning from scratch.

Monorepos are handled: every `package.json` in the tree is discovered and its
dependencies resolved from that package's own location.

## Scope

JavaScript only — `.js`, `.mjs`, `.cjs`, and `.jsx`. TypeScript is not parsed
yet. `node_modules`, dotfiles, and common build directories (`dist`, `build`,
`out`, `coverage`, and similar) are skipped.

Scan results are cached in a `check-dependency-data/` directory created in the
project being scanned; add it to your `.gitignore`.

## Requirements

Node.js 20.12 or later.

## Development

```sh
git clone https://github.com/ATiwari03-03-2004/check-dependency.git
cd check-dependency
npm install
npm run build          # builds the frontend into ui/
node bin/check-dependency.js
```

To work on the UI with hot reload, start the server as above and then run
`npm --prefix frontend run dev` in a second terminal — Vite proxies `/api`
through to it.

## Reporting an issue

Found something wrong — a dependency reported as unused when it isn't, a file
that fails to parse, a graph that looks off? Please
[open an issue](https://github.com/ATiwari03-03-2004/check-dependency/issues/new).

**A screenshot helps more than anything else.** Attach one of the graph or the
metadata view showing the problem — drag the image straight into the GitHub
issue box. If the error is in the terminal instead, a screenshot or a paste of
that output works just as well.

Along with it, please include:

- what you ran (`check-dependency`, plus any flags)
- your OS, and `node --version`
- roughly what the project looks like — single package or monorepo, CommonJS or
  ESM, and anything unusual about how dependencies are installed
- the dependency or file involved, if it is a specific one

If you are comfortable sharing it, the generated
`check-dependency-data/response.json` is the single most useful attachment for
a wrong-result report — it is exactly what the UI is drawing from. Do check it
over first, since it contains absolute paths from your machine.

## License

MIT © Anshuman Tiwari
