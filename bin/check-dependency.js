#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const pkg = require('../package.json');

const HELP = `
  check-dependency — explore the third-party dependencies of a JavaScript project.

  Usage
    $ check-dependency [options]

  Run it from the root of the project you want to scan.

  Options
    -p, --port <number>   Port to serve on (default: 3000; the next free port
                          is used if that one is taken)
    --no-open             Do not open the browser automatically
    -h, --help            Show this message
    -v, --version         Print the version
`;

function parseArgs(argv) {
  const options = { port: 3000, open: true };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '-v' || arg === '--version') return { version: true };
    if (arg === '--no-open') {
      options.open = false;
    } else if (arg === '-p' || arg === '--port') {
      options.port = Number(argv[++i]);
    } else if (arg.startsWith('--port=')) {
      options.port = Number(arg.slice('--port='.length));
    } else {
      return { error: `Unknown option: ${arg}` };
    }
  }

  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    return { error: 'Port must be an integer between 0 and 65535.' };
  }
  return options;
}

/** Best-effort browser launch — a failure here is never worth failing the run over. */
function openBrowser(url) {
  const command =
    process.platform === 'win32' ? 'cmd'
      : process.platform === 'darwin' ? 'open'
        : 'xdg-open';
  // `start` treats its first quoted argument as a window title, hence the empty one.
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* the URL is printed either way */
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.error) {
    console.error(options.error);
    console.error('Run `check-dependency --help` for usage.');
    process.exit(1);
  }
  if (options.help) return console.log(HELP);
  if (options.version) return console.log(pkg.version);

  // Required here so --help and --version stay instant and side-effect free.
  const { start } = require('../server/index.js');
  const server = await start({ port: options.port });
  const url = `http://localhost:${server.port}`;

  console.log(`\n  check-dependency v${pkg.version}`);
  console.log(`  scanning  ${process.cwd()}`);
  console.log(`  open      ${url}\n`);
  console.log('  Press Ctrl+C to stop.\n');

  if (options.open) openBrowser(url);

  const shutdown = () => server.close().then(() => process.exit(0), () => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`\n  check-dependency failed to start: ${err.message}\n`);
  process.exit(1);
});
