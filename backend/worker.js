const { parentPort, workerData } = require('worker_threads');
const Watcher = require('watcher').default;
const path = require('path');
const fs = require('fs/promises');

const resync = new Uint8Array(workerData);

async function task() {
    let watcher = new Watcher(path.resolve(process.cwd()), { renameDetection: true, recursive: true, ignore: (targetPath) => targetPath.includes('node_modules') || /(^|[\/\\])\../.test(targetPath) });
    watcher.on('error', error => {
        console.log(error);
    });

    watcher.on('ready', () => {
        console.log('🟢 Started watching project tree...');
    });

    watcher.on('close', () => {
        console.log('🔴 Stopped watching project tree.');
    });

    watcher.on('all', async (event, targetPath, targetPathNext) => {
        if (Atomics.compareExchange(resync, 0, 0, 1) === 0) {
            parentPort.postMessage("🔄 Resync might be needed...");
        }
    });
}

task();
