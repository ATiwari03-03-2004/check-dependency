const projectsDependencies = require('./src/projectsDependencies');
const { findImports, parseFile } = require('./src/findImports');
const generateGraph = require('./src/generateGraph');
const { parentPort } = require('worker_threads');
const Watcher = require('watcher').default;
const path = require('path');
const fs = require('fs/promises');

async function generateDependencyGraph() {
    await fs.mkdir(path.join(process.cwd(), 'json'), { recursive: true });
    let dependencies = await projectsDependencies();
    await fs.writeFile(path.join(process.cwd(), 'json', 'dependency.json'), JSON.stringify(dependencies), 'utf8');
    parentPort.postMessage({ type: 'init_dependency', path: path.join(process.cwd(), 'json', 'dependency.json') });
    let imports = await findImports();
    await fs.writeFile(path.join(process.cwd(), 'json', 'imports.json'), JSON.stringify(imports), 'utf8');
    parentPort.postMessage({ type: 'init_imports', path: path.join(process.cwd(), 'json', 'imports.json') });
    // let graph = await generateGraph(imports, dependencies);
    // await fs.writeFile(path.join(process.cwd(), 'json', 'graph.json'), JSON.stringify(graph), 'utf8');
    // parentPort.postMessage({type: 'init_graph', path: path.join(process.cwd(), 'json', 'graph.json')});
}

async function task() {
    await generateDependencyGraph();
    let watcher = new Watcher(path.resolve(process.cwd()), { renameDetection: true, recursive: true, ignore: (targetPath) => targetPath.includes('node_modules') || /(^|[\/\\])\../.test(targetPath) });
    watcher.on('error', error => {
        console.log(error);
    });

    watcher.on('ready', () => {
        console.log('Started watching project tree.');
    });

    watcher.on('close', () => {
        console.log('Stopped watching project tree.');
    });

    watcher.on('change', async (filePath) => {
        try {
            if (path.resolve(filePath).endsWith('.js') || path.resolve(filePath).endsWith('.cjs') || path.resolve(filePath).endsWith('.mjs') || path.resolve(filePath).endsWith('.jsx')) {
                let imports = await parseFile(path.resolve(filePath));
                let contents = JSON.parse(await fs.readFile(path.join(process.cwd(), 'json', 'imports.json'), { encoding: 'utf8' }));
                if (imports[path.resolve(filePath)]) contents[path.resolve(filePath)] = imports[path.resolve(filePath)];
                await fs.writeFile(path.join(process.cwd(), 'json', 'imports.json'), JSON.stringify(contents), 'utf8');
                parentPort.postMessage({ type: 'imports', path: path.join(process.cwd(), 'json', 'imports.json') });
            }
        } catch (err) {
            console.log(err);
        }
    });

    watcher.on('rename', async (filePath, filePathNext) => {
        try {
            if ((filePath.split('\\')[filePath.length - 1] != filePathNext.split('\\')[filePathNext.length - 1]) && path.resolve(filePath).endsWith('.js') || path.resolve(filePath).endsWith('.cjs') || path.resolve(filePath).endsWith('.mjs') || path.resolve(filePath).endsWith('.jsx')) {
                let contents = JSON.parse(await fs.readFile(path.join(process.cwd(), 'json', 'imports.json'), { encoding: 'utf8' }));
                contents[path.resolve(filePathNext)] = contents[path.resolve(filePath)];
                delete contents[path.resolve(filePath)];
                await fs.writeFile(path.join(process.cwd(), 'json', 'imports.json'), JSON.stringify(contents), 'utf8');
                parentPort.postMessage({ type: 'imports', path: path.join(process.cwd(), 'json', 'imports.json') });
            }
        } catch (err) {
            console.log(err);
        }
    });

    watcher.on('renameDir', async (directoryPath, directoryPathNext) => {
        try {
            let contents = JSON.parse(await fs.readFile(path.join(process.cwd(), 'json', 'imports.json'), { encoding: 'utf8' }));
            let dir = directoryPath.split('\\');
            let keys = Object.keys(contents);
            let tempKeys = [];
            for (let key of keys) {
                let k = key.split('\\');
                let flag = true;
                for (let i = 0; i < dir.length; i++) {
                    if (dir[i] != k[i]) flag = false;
                }
                if (flag) tempKeys.push([key, path.join(directoryPathNext, key.substring(directoryPath.length + 1))]);
            }
            for (let keys of tempKeys) {
                contents[keys[1]] = contents[keys[0]];
                delete contents[keys[0]];
            }
            await fs.writeFile(path.join(process.cwd(), 'json', 'imports.json'), JSON.stringify(contents), 'utf8');
            parentPort.postMessage({ type: 'imports', path: path.join(process.cwd(), 'json', 'imports.json') });
        } catch (err) {
            console.log(err);
        }
    });

    watcher.on('unlink', async filePath => {
        try {
            if (path.resolve(filePath).endsWith('.js') || path.resolve(filePath).endsWith('.cjs') || path.resolve(filePath).endsWith('.mjs') || path.resolve(filePath).endsWith('.jsx')) {
                let _path = filePath.split('\\');
                _path.pop();
                let fp = _path.join('\\');
                const stats = await fs.stat(path.normalize(fp));
                if (stats.isDirectory()) {
                    let contents = JSON.parse(await fs.readFile(path.join(process.cwd(), 'json', 'imports.json'), { encoding: 'utf8' }));
                    delete contents[path.resolve(filePath)];
                    await fs.writeFile(path.join(process.cwd(), 'json', 'imports.json'), JSON.stringify(contents), 'utf8');
                    parentPort.postMessage({ type: 'imports', path: path.join(process.cwd(), 'json', 'imports.json') });
                }
            }
        } catch (err) {
            if (err != 'ENOENT') console.log(err);
            console.log("Deleted Directory");
        }
    });

    watcher.on('unlinkDir', async (directoryPath) => {
        try {
            let contents = JSON.parse(await fs.readFile(path.join(process.cwd(), 'json', 'imports.json'), { encoding: 'utf8' }));
            let dir = directoryPath.split('\\');
            let keys = Object.keys(contents);
            let tempKeys = [];
            for (let key of keys) {
                let k = key.split('\\');
                let flag = true;
                for (let i = 0; i < dir.length; i++) {
                    if (dir[i] != k[i]) flag = false;
                }
                if (flag) tempKeys.push(key);
            }
            for (let key of tempKeys) delete contents[key];
            await fs.writeFile(path.join(process.cwd(), 'json', 'imports.json'), JSON.stringify(contents), 'utf8');
            parentPort.postMessage({ type: 'imports', path: path.join(process.cwd(), 'json', 'imports.json') });
        } catch (err) {
            console.log(err);
        }
    });
}

task();
