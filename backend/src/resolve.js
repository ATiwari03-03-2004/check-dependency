const fs = require('node:fs/promises');
const _fs = require('fs');
const path = require('node:path');
const { isBuiltin } = require('module');

/**
 * async version for resolving dependency
 */
async function isValidAbsolutePath(targetPath) {
    if (!path.isAbsolute(targetPath)) return false;
    try {
        await fs.access(targetPath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function resolve(_path, dependency) {
    if (isBuiltin(dependency)) {
        return {
            dependencyPath: (dependency.startsWith('node:')) ? dependency : 'node:' + dependency,
            dependencyType: 'built-in',
        };
    }
    let pathParts = _path.split('\\');
    for (let i = pathParts.length - 2; i >= 0; i--) {
        let dependencyPart = dependency.split('/');
        for (let j = dependencyPart.length; j >= 0; j--) {
            let absPath = path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependencyPart.slice(0, j).join('/'));
            let res = await isValidAbsolutePath(absPath);
            if (res) {
                return {
                    dependencyPath: absPath,
                    dependencyType: (absPath.startsWith(process.cwd())) ? 'local' : 'global'
                };
            } else if (j != dependencyPart.length) {
                let _res = await isValidAbsolutePath(path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependencyPart.slice(j).join('/'), 'package.json'));
                if (_res) {
                    let jsonData = await fs.readFile(path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependencyPart.slice(j).join('/'), 'package.json'), { encoding: 'utf8' });
                    let exports = JSON.parse(jsonData).exports;
                    if (exports['./' + (dependency.substring(j).join('/'))]['default']) {
                        return {
                            dependencyPath: absPath,
                            dependencyType: (absPath.startsWith(process.cwd())) ? 'local' : 'global'
                        };
                    }
                }
            }
        }
    }
    return {'error': `${dependency} couldn't be resolved!`};
}

/** 
 * synchronous dependency resolver for @babel/traverse in traverseAST.js
 */
function isValidAbsolutePathSync(targetPath) {
    if (path.isAbsolute(targetPath) && _fs.existsSync(targetPath)) return true;
    return false;
}

function resolveSync(_path, dependency) {
    if (isBuiltin(dependency)) {
        return {
            dependencyPath: (dependency.startsWith('node:')) ? dependency : 'node:' + dependency,
            dependencyType: 'built-in',
        };
    }
    let pathParts = _path.split('\\');
    for (let i = pathParts.length - 2; i >= 0; i--) {
        let dependencyPart = dependency.split('/');
        for (let j = dependencyPart.length; j > 0; j--) {
            let absPath = path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependencyPart.slice(0, j).join('/'));
            let res = isValidAbsolutePathSync(absPath);
            if (res) {
                return {
                    dependencyPath: absPath,
                    dependencyType: (absPath.startsWith(process.cwd())) ? 'local' : 'global'
                };
            } else if (j != dependencyPart.length) {
                let _res = isValidAbsolutePathSync(path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependencyPart.slice(j).join('/'), 'package.json'));
                if (_res) {
                    let jsonData = _fs.readFileSync(path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependencyPart.slice(j).join('/'), 'package.json'), { encoding: 'utf8' });
                    let exports = JSON.parse(jsonData).exports;
                    if (exports['./' + (dependency.substring(j).join('/'))]['default']) {
                        return {
                            dependencyPath: absPath,
                            dependencyType: (absPath.startsWith(process.cwd())) ? 'local' : 'global'
                        };
                    }
                }
            }
        }
    }
    return {'error': `${dependency} couldn't be resolved!`};
}

module.exports = { resolve, resolveSync };
