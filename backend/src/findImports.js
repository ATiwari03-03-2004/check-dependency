const projectsDependencies = require('./projectsDependencies');
const fs = require('fs/promises');
const _path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');

const MAX_WORKERS = Math.max(os.cpus().length - 1, 1);

async function readDirectory(path) {
    let files = await fs.readdir(path, { withFileTypes: true });
    return files;
}

async function scanProject(path, _files) {
    try {
        let files = await readDirectory(path);
        for (const file of files) {
            if (file.isDirectory() && (file.name[0] != '.' && file.name != 'node_modules' && file.name != 'build' && file.name != 'dist' && file.name != 'out' && file.name != 'storybook-static' && file.name != 'coverage' && file.name != 'tmp' && file.name != 'temp' && file.name != 'logs' && file.name != 'expo')) {
                await scanProject(_path.join(path, file.name), _files);
            } else if (file.isFile() && (file.name.endsWith(".js") || file.name.endsWith(".mjs") || file.name.endsWith(".cjs") || file.name.endsWith(".jsx"))) {
                _files.push(_path.join(path, file.name));
            }
        }
    } catch (err) {
        console.log(err);
    }
}

let imports = {};

/**
 * Promisified worker threads for parsing a file.
 */
function parse(path) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./backend/src/fileParser-worker.js', { 'workerData': path });
        worker.on('message', (msg) => resolve(msg));
        worker.on('error', (err) => reject(new Error(`Error parsing ${path}: ${err.message}`)));
        worker.on('exit', (code) => reject(new Error(`Worker stopped parsing with exit code ${code}`)));
    })
}

async function getParsedInfo(_files) {
    let i = 0;
    while (i < _files.length) {
        // spawning worker threads (based on the number of processors / cores) for parsing multiple files parallely
        let end = (MAX_WORKERS + i <= _files.length) ? MAX_WORKERS + i : _files.length;
        let tasks = _files.slice(i, end).map((filePath) => {
            return parse(filePath);
        });
        let result = await Promise.allSettled(tasks);
        result.forEach((res) => {
            if (res.status === 'fulfilled') {
                Object.keys(res.value).forEach(key => {
                    imports[key] = res['value'][key];
                })
            }
        });
        i += MAX_WORKERS;
    }
}

async function findImports(scanProj, _files) {
    try {
        imports = {};
        if (scanProj)  await scanProject(process.cwd(), _files);
        await getParsedInfo(_files);
        return imports;
    } catch (err) {
        console.log(err);
    }
}

module.exports = findImports;
