const { parentPort, workerData } = require('worker_threads');
const Watcher = require('watcher').default;
const path = require('path');
const fs = require('fs/promises');

const changedFilePath = new Set(); // tracks files whose contents are changed and are to be re-parsed
const renamedFilePath = new Map(); // tracks reanmed files (includes the changed path as well)
const deletedFilepath = new Set(); // tracks deleted files


async function task() {
    let watcher = new Watcher(path.resolve(process.cwd()), { renameDetection: true, recursive: true, ignore: (targetPath) => targetPath.includes('node_modules') || /(^|[\/\\])\../.test(targetPath) });
    watcher.on('error', error => {
        console.error(`❌ Error with watcher: ${error.message}`);
        console.error(error.stack);
    });

    watcher.on('ready', () => {
        console.log('🟢 Started watching project tree...');
    });

    watcher.on('close', () => {
        console.log('🔴 Stopped watching project tree.');
    });

    watcher.on('change', filePath => {
        if (filePath.endsWith("package.json") || filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs") || filePath.endsWith(".jsx")) {
            changedFilePath.add(filePath);
        }
    });

    watcher.on('rename', (filePath, filePathNext) => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs") || filePath.endsWith(".jsx")) {
            renamedFilePath.set(filePath, filePathNext);
        }
    });

    watcher.on('unlink', filePath => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs") || filePath.endsWith(".jsx")) {
            deletedFilepath.add(filePath);
        }
    });
}

parentPort.on('message', (msg) => {
    console.log(msg);
    if (msg.msg === 'start-monitoring') task();
    if (msg.msg === 'resync-info') {
        parentPort.postMessage({
            'msg': 'resync-info',
            'uuid': msg.uuid,
            'changedFilePath': changedFilePath,
            'renamedFilePath': renamedFilePath,
            'deletedFilepath': deletedFilepath
        });
        changedFilePath.clear();
        renamedFilePath.clear();
        deletedFilepath.clear();
    }
});
