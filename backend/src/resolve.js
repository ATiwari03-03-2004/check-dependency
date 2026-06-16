const fs = require('node:fs/promises');
const _fs = require('fs');
const path = require('node:path');
const {isBuiltin} = require('module');

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
        let res = await isValidAbsolutePath(path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependency));
        if (res) {
            if (i === pathParts.length - 2) {
                return {
                    dependencyPath: path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependency),
                    dependencyType: 'local'
                };
            } else {
                return {
                    dependencyPath: path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependency),
                    dependencyType: 'global'
                };
            }
        }
    }
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
        let res = isValidAbsolutePathSync(path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependency));
        if (res) {
            if (i === pathParts.length - 2) {
                return {
                    dependencyPath: path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependency),
                    dependencyType: 'local'
                };
            } else {
                return {
                    dependencyPath: path.join(pathParts.slice(0, i + 1).join('\\'), 'node_modules', dependency),
                    dependencyType: 'global'
                };
            }
        }
    }
}

module.exports = {resolve, resolveSync};
