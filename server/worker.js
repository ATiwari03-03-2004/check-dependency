const { parentPort, workerData } = require('worker_threads');
const Watcher = require('watcher').default;
const path = require('path');
const fs = require('fs/promises');

const changedFilePath = new Set(); // tracks files whose contents are changed and are to be re-parsed
const renamedFilePath = new Map(); // tracks reanmed files (includes the changed path as well)
const deletedFilepath = new Set(); // tracks deleted files
const packageJSONStatus = { 'change': false, 'rename': false, 'delete': false };

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
        console.log('🔴 Stopped watching project tree...');
    });

    watcher.on('change', filePath => {
        if (filePath.endsWith("package.json") || filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs") || filePath.endsWith(".jsx")) {
            if (filePath.endsWith("package.json") && !packageJSONStatus['change']) packageJSONStatus['change'] = true;
            if (renamedFilePath.has(filePath)) delete renamedFilePath.delete(filePath);
            if (deletedFilepath.has(filePath)) delete deletedFilepath.delete(filePath);
            changedFilePath.add(filePath);
        }
    });

    watcher.on('rename', (filePath, filePathNext) => {
        if (filePath.endsWith("package.json") || filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs") || filePath.endsWith(".jsx")) {
            if (filePath.endsWith("package.json") && !packageJSONStatus['rename']) packageJSONStatus['rename'] = true;
            if (changedFilePath.has(filePath)) delete changedFilePath.delete(filePath);
            if (deletedFilepath.has(filePath)) delete deletedFilepath.delete(filePath);
            renamedFilePath.set(filePath, filePathNext);
        }
    });

    watcher.on('unlink', filePath => {
        if (filePath.endsWith("package.json") || filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs") || filePath.endsWith(".jsx")) {
            if (filePath.endsWith("package.json") && !packageJSONStatus['delete']) packageJSONStatus['delete'] = true;
            if (changedFilePath.has(filePath)) delete changedFilePath.delete(filePath);
            if (renamedFilePath.has(filePath)) delete renamedFilePath.delete(filePath);
            deletedFilepath.add(filePath);
        }
    });
}

let watcherActive = false;
parentPort.on('message', (msg) => {
    if (msg.msg === 'start-monitoring' && !watcherActive) {
        task();
        watcherActive = true;
    } else if (msg.msg === 'resync-info') {
        parentPort.postMessage({
            'msg': 'resync-info',
            'uuid': msg.uuid,
            'changedFilePath': changedFilePath,
            'renamedFilePath': renamedFilePath,
            'deletedFilepath': deletedFilepath,
            'change': changedFilePath.size || packageJSONStatus['change'] ? true : false,
            'rename': renamedFilePath.size ? true : false,
            'delete': deletedFilepath.size ? true : false,
            'check': changedFilePath.size || renamedFilePath.size || deletedFilepath.size ? true : false,
            'packageJSONStatus': packageJSONStatus
        });
        changedFilePath.clear();
        renamedFilePath.clear();
        deletedFilepath.clear();
        packageJSONStatus['change'] = false;
        packageJSONStatus['rename'] = false;
        packageJSONStatus['delete'] = false;
    }
});
