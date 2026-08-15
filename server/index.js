const express = require('express');
const app = express();
const { Worker } = require('worker_threads');
const path = require('path');
const generateHierarchy = require('./src/normarlizeAndGenerateHierarchy');
const crypto = require('crypto');
const fs = require('fs/promises');
const _fs = require('fs');
const projectsDependencies = require('./src/projectsDependencies');
const { resolve } = require('./src/resolve');

/** The built frontend, shipped inside the package — never inside the scanned project. */
const UI_DIR = path.join(__dirname, '..', 'ui');

const uuidResMap = new Map();

async function handleWorkerMessage(msg) {
  if (msg.msg === 'resync-info') {
    const res = uuidResMap.get(msg.uuid);
    let writeDependency = true;
    if (msg.check) {
      let dependency = _fs.readFileSync(path.join(process.cwd(), 'check-dependency-data', 'packageDependency.json'), { 'encoding': 'utf8' });
      let response = _fs.readFileSync(path.join(process.cwd(), 'check-dependency-data', 'response.json'), { 'encoding': 'utf8' });
      dependency = JSON.parse(dependency);
      response = JSON.parse(response);
      if (msg.delete) {
        if (msg.packageJSONStatus.delete) {
          for (let filePath of msg.deletedFilepath) {
            if (filePath.endsWith("package.json") && dependency[filePath]) {
              Object.keys(dependency[filePath]['dependencies']).forEach(dep => {
                Object.keys(response['dependenciesInfo'][dep]).forEach(file => {
                  let usages = response['dependenciesInfo'][dep][file];
                  for (let i = 0; i < response['dependenciesInfo'][dep][file].length; i++) {
                    if (usages[i]['dependencyPath'] === dependency[filePath]['dependencies'][dep][1]) {
                      usages.splice(i, 1);
                      i--;
                    }
                  }
                  if (!usages.length) {
                    response['treeData'][dep]['children'].splice(response['treeData'][dep]['children'].indexOf(file), 1);
                    delete response['dependenciesInfo'][dep][file];
                    let flag = true;
                    response['treeData']['root']['children'].forEach(_dep => {
                      if (!response['unusedDependenciesInfo'][_dep] && response['dependenciesInfo'][_dep] && response['dependenciesInfo'][_dep][file]) flag = false;
                    });
                    if (flag) delete response['treeData'][file];
                  }
                });
                if (!Object.keys(response['dependenciesInfo'][dep]).length) {
                  delete response['dependenciesInfo'][dep];
                  delete response['treeData'][dep];
                  let idx = response['treeData']['root']['children'].indexOf(dep);
                  if (idx != -1) response['treeData']['root']['children'].splice(idx, 1);
                }
              });
              delete dependency[filePath];
            }
          }
        }
        let deps = response['treeData']['root']['children'];
        for (let filePath of msg.deletedFilepath) {
          if (!filePath.endsWith("package.json") && response['treeData'][filePath]) {
            delete response['treeData'][filePath];
            deps.forEach(dep => {
              let idx = response['treeData'][dep]['children'].indexOf(filePath);
              if (idx != -1) {
                response['treeData'][dep]['children'].splice(idx, 1);
                delete response['dependenciesInfo'][dep][filePath];
              }
            });
          }
        }
      }
      if (msg.rename) {
        if (msg.packageJSONStatus.rename) {
          for (let [filePath, filePathNext] of msg.renamedFilePath) {
            if (filePath.endsWith("package.json") && dependency[filePath]) {
              Object.keys(dependency[filePath]['dependencies']).forEach(async dep => {
                let depInfo = await resolve(filePathNext, dep);
                Object.keys(response['dependenciesInfo']).forEach(dep => {
                  Object.keys(response['dependenciesInfo'][dep]).forEach(file => {
                    for (let i = 0; i < response['dependenciesInfo'][dep][file].length; i++) {
                      if (dependency[filePath]['dependencies'][dep][1] === response['dependenciesInfo'][dep][file][i]['dependencyPath']) response['dependenciesInfo'][dep][file][i]['dependencyPath'] = depInfo['dependencyPath'];
                    }
                  });
                });
                dependency[filePath]['dependencies'][dep][1] = depInfo['dependencyPath'];
              });
              dependency[filePathNext]['dependencies'] = {};
              dependency[filePathNext]['dependencies'] = dependency[filePath]['dependencies'];
              delete dependency[filePath]['dependencies'];
            }
          }
        }
        let deps = response['treeData']['root']['children'];
        for (let [filePath, filePathNext] of msg.renamedFilePath) {
          if (response['treeData'][filePath]) {
            response['treeData'][filePathNext] = response['treeData'][filePath];
            delete response['treeData'][filePath];
            deps.forEach(dep => {
              let idx = response['treeData'][dep]['children'].indexOf(filePath);
              if (idx != -1) {
                response['treeData'][dep]['children'][idx] = filePathNext;
                response['dependenciesInfo'][dep][filePathNext] = response['dependenciesInfo'][dep][filePath];
                delete response['dependenciesInfo'][dep][filePath];
              }
            });
          }
        }
      }
      if (msg.change) {
        writeDependency = false;
        let files = [...msg.changedFilePath];
        if (msg.packageJSONStatus['change']) {
          let packages = files.filter(file => file.endsWith('package.json'));
          let deps = await projectsDependencies(false, packages);
          Object.keys(deps['packageData']).forEach(file => {
            // if the package.json is not present in dependency
            if (!dependency[file]) {
              dependency[file] = deps['packageData'][file];
              let _deps = Object.keys(deps['packageData'][file]['dependencies']);
              _deps.forEach(dep => {
                if (!response['dependenciesInfo'][dep]) {
                  response['unusedDependenciesInfo'][dep] = {
                    "dependencyType": "local",
                    "dependencyValue": dep,
                    "dependencyPath": deps['packageData'][file]['dependencies'][dep][1],
                    "devDependencies": deps['dependencies'][deps['packageData'][file]['dependencies'][dep][1]]['devDependencies'],
                    "dependencyVersion": deps['packageData'][file]['dependencies'][dep][0]
                  };
                }
                if (!response['treeData'][dep]) {
                  response['treeData']['root']['children'].push(dep);
                  response['treeData'][dep] = {
                    "label": dep,
                    "level": 1,
                    "children": []
                  };
                }
              });
            } else {
              // added new dependency in package.json
              let _deps = Object.keys(deps['packageData'][file]['dependencies']);
              _deps.forEach(dep => {
                if (!dependency[file]['dependencies'][dep]) {
                  if (!response['dependenciesInfo'][dep]) {
                    response['unusedDependenciesInfo'][dep] = {
                      "dependencyType": "local",
                      "dependencyValue": dep,
                      "dependencyPath": deps['packageData'][file]['dependencies'][dep][1],
                      "devDependencies": deps['dependencies'][deps['packageData'][file]['dependencies'][dep][1]]['devDependencies'],
                      "dependencyVersion": deps['packageData'][file]['dependencies'][dep][0]
                    };
                    if (!response['treeData'][dep]) {
                      response['treeData']['root']['children'].push(dep);
                      response['treeData'][dep] = {
                        "label": dep,
                        "level": 1,
                        "children": []
                      };
                    }
                  }
                }
              });
              // deleted a dependency in package.json
              let __deps = Object.keys(dependency[file]['dependencies']);
              __deps.forEach(dep => {
                if (!deps['packageData'][file]['dependencies'][dep]) {
                  if (response['dependenciesInfo'][dep]) {
                    let resolvePath = deps['packageData'][file]['dependencies'][dep][1];
                    let childs = [];
                    Object.keys(response['dependenciesInfo'][dep]).forEach(file => {
                      for (let i = 0; i < response['dependenciesInfo'][dep][file].length; i++) {
                        if (response['dependenciesInfo'][dep][file][i]['dependencyPath'] === resolvePath) {
                          response['dependenciesInfo'][dep][file].splice(i, 1);
                          i--;
                        }
                      }
                      if (response['dependenciesInfo'][dep][file].length === 0) {
                        childs.push(file);
                        delete response['dependenciesInfo'][dep][file];
                        let idx = response['treeData'][dep]['children'].indexOf(file);
                        response['treeData'][dep]['children'].splice(idx, 1);
                      }
                    });
                    if (Object.keys(response['dependenciesInfo'][dep]).length === 0) {
                      delete response['dependenciesInfo'][dep];
                      let idx = response['treeData']['root']['children'].indexOf(dep);
                      response['treeData']['root']['children'].splice(idx, 1);
                      delete response['treeData'][dep];
                    }
                    childs.forEach(child => {
                      let flag = true;
                      response['treeData']['root']['children'].forEach(_dep => {
                        if (response['dependenciesInfo'][_dep][child]) flag = false;
                      });
                      if (flag) delete response['treeData'][child];
                    });
                  }
                  if (response['unusedDependenciesInfo'][dep]) {
                    delete response['unusedDependenciesInfo'][dep];
                    let idx = response['treeData']['root']['children'].indexOf(dep);
                    response['treeData']['root']['children'].splice(idx, 1);
                    delete response['treeData'][dep];
                  }
                }
              });
            }
          });
        }
        files = files.filter(file => file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs') || file.endsWith('.jsx'));
        let result = await generateHierarchy(path.basename(process.cwd()), false, files);
        let _keys = Object.keys(response['dependenciesInfo']);
        let unusedDependency = {};
        _keys.forEach(key => {
          const FILEPATH = [];
          if (result['dependenciesInfo'][key]) {
            let filePaths = Object.keys(result['dependenciesInfo'][key]);
            filePaths.forEach(filePath => {
              if (!response['dependenciesInfo'][key][filePath]) {
                response['treeData'][key]['children'].push(filePath);
                response['treeData'][filePath] = result['treeData'][filePath];
              }
              response['dependenciesInfo'][key][filePath] = result['dependenciesInfo'][key][filePath];
            });
            let _filePaths = Object.keys(response['dependenciesInfo'][key]);
            _filePaths.forEach(_filePath => {
              if (msg.changedFilePath.has(_filePath) && !result['dependenciesInfo'][key][_filePath]) {
                let usage = response['dependenciesInfo'][key][_filePath];
                let idx = response['treeData'][key]['children'].indexOf(_filePath);
                response['treeData'][key]['children'].splice(idx, 1);
                delete response['dependenciesInfo'][key][_filePath];
                FILEPATH.push(_filePath);
                Object.keys(response['dependenciesInfo'][key]).length == 0 ? (unusedDependency[key] = {
                  'dependencyType': 'local',
                  'dependencyValue': key,
                  'dependencyPath': usage[0]['dependencyPath'],
                  'devDependencies': usage[0]['devDependencies'],
                  'dependencyVersion': usage[0]['dependencyVersion'],
                }, delete response['dependenciesInfo'][key]) : null;
              }
            });
            FILEPATH.forEach(file => {
              let flag = true;
              response['treeData']['root']['children'].forEach(dep => {
                if (!response['unusedDependenciesInfo'][dep] && response['dependenciesInfo'][dep] && response['dependenciesInfo'][dep][file]) flag = false;
              });
              if (flag) delete response['treeData'][file];
            });
          } else {
            let filePaths = Object.keys(response['dependenciesInfo'][key]);
            filePaths.forEach(filePath => {
              if (msg.changedFilePath.has(filePath)) {
                let usage = response['dependenciesInfo'][key][filePath];
                let idx = response['treeData'][key]['children'].indexOf(filePath);
                response['treeData'][key]['children'].splice(idx, 1);
                delete response['dependenciesInfo'][key][filePath];
                FILEPATH.push(filePath);
                Object.keys(response['dependenciesInfo'][key]).length == 0 ? (unusedDependency[key] = {
                  'dependencyType': 'local',
                  'dependencyValue': key,
                  'dependencyPath': usage[0]['dependencyPath'],
                  'devDependencies': usage[0]['devDependencies'],
                  'dependencyVersion': usage[0]['dependencyVersion'],
                }, delete response['dependenciesInfo'][key]) : null;
              }
            });
            FILEPATH.forEach(file => {
              let flag = true;
              response['treeData']['root']['children'].forEach(dep => {
                if (!response['unusedDependenciesInfo'][dep] && response['dependenciesInfo'][dep] && response['dependenciesInfo'][dep][file]) flag = false;
              });
              if (flag) delete response['treeData'][file];
            });
          }
        });
        _keys = Object.keys(response['unusedDependenciesInfo']);
        _keys.forEach(key => {
          if (result['dependenciesInfo'][key]) {
            delete response['unusedDependenciesInfo'][key];
            response['dependenciesInfo'][key] = result['dependenciesInfo'][key];
            response['treeData'][key] = result['treeData'][key];
            response['treeData'][key]['children'].forEach(child => {
              response['treeData'][child] = result['treeData'][child];
            });
          }
        });
        Object.keys(unusedDependency).forEach(key => {
          response['unusedDependenciesInfo'][key] = unusedDependency[key];
        });
        files.forEach(file => {
          if (result['treeData'][file]) response['treeData'][file]['error'] = result['treeData'][file]['error'];
        });
      }
      _fs.writeFileSync(path.join(process.cwd(), 'check-dependency-data', 'response.json'), JSON.stringify(response), 'utf8');
      if (writeDependency) _fs.writeFileSync(path.join(process.cwd(), 'check-dependency-data', 'packageDependency.json'), JSON.stringify(dependency), 'utf8');
      res.status(200).send(response);
    } else {
      res.status(200).send({ 'msg': 'everthing is up-to-date!' });
    }
  }
}

let worker = null;

/**
 * Spawned on first use, not at import: a worker thread keeps the event loop
 * alive, which would hang `--help` and any other command that only requires
 * this module. The path is resolved against this file, since process.cwd() is
 * the project being scanned rather than ours.
 */
function getWorker() {
  if (worker) return worker;
  worker = new Worker(path.join(__dirname, 'worker.js'));
  worker.on('message', handleWorkerMessage);
  worker.on("error", (err) => console.log(err));
  worker.on('exit', (code) => (code != 0) ? console.log('Worker stopped working with status code ' + code + '.') : null);
  return worker;
}

/**
 * GET - project name, third-party dependency(optionally includes devDependencies & nodejs built-in dependencies)
 *       including the dependency usage information.
*/
app.get('/api/dep', async (req, res) => {
  let result = await generateHierarchy(path.basename(process.cwd()));
  await fs.writeFile(path.join(process.cwd(), 'check-dependency-data', 'response.json'), JSON.stringify(result), 'utf8');
  getWorker().postMessage({ 'msg': 'start-monitoring' });
  res.status(200).send(result);
});

/**
 * GET - dependency information needs to be re-synchronized due to changes within project files.
 */
app.get('/api/resync', async (req, res) => {
  const uuid = crypto.randomUUID();
  uuidResMap.set(uuid, res);
  getWorker().postMessage({
    'msg': 'resync-info',
    'uuid': uuid
  });
});

/**
 * GET - contents of the filePath (best to visit /api/resync before getting contents).
 * Namespaced under /api/file so it cannot shadow the UI's own assets.
 */
app.get('/api/file/:filePath', async (req, res) => {
  const filePath = req.params.filePath;
  try {
    let contents = await fs.readFile(filePath, { encoding: 'utf8' });
    res.status(200).send({ contents });
  } catch (err) {
    res.status(404).send({ error: err.message });
  }
});

// The bundled UI, and a fallback so a reload on any route still lands on the app.
app.use(express.static(UI_DIR));
app.get(/.*/, (req, res) => res.sendFile(path.join(UI_DIR, 'index.html')));

/**
 * Binds the server, walking forward from `port` when something already holds it.
 * Resolves with the port actually taken.
 */
function listen(port, host, attemptsLeft) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    server.once('listening', () => resolve(server));
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0 && port !== 0) {
        listen(port + 1, host, attemptsLeft - 1).then(resolve, reject);
      } else {
        reject(err);
      }
    });
  });
}

async function start({ port = 3000, host = '127.0.0.1' } = {}) {
  if (!_fs.existsSync(UI_DIR)) {
    throw new Error(`the UI was not built — expected it at ${UI_DIR}. Run \`npm run build\`.`);
  }
  await fs.mkdir(path.join(process.cwd(), 'check-dependency-data'), { 'recursive': true });

  const server = await listen(port, host, 10);
  return {
    port: server.address().port,
    close: () => Promise.all([
      new Promise((resolve) => server.close(resolve)),
      worker ? worker.terminate() : Promise.resolve(),
    ]),
  };
}

module.exports = { app, start };
