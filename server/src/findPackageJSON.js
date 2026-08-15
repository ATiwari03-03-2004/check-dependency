const fs = require('fs/promises');
const path = require('path');

const packageJSONPath = [];

async function readProject(_path) {
    let files = await fs.readdir(_path, { withFileTypes: true });
    return files;
}

async function handleDirectory(_path) {
    try {
        let files = await readProject(_path);
        for (let file of files) {
            if (file.isDirectory() && (file.name[0] != '.' && file.name != 'node_modules' && file.name != 'build' &&  file.name != 'dist' && file.name != 'test' && file.name != 'tests' && file.name != '__test__' && file.name != '__tests__')) {
                await handleDirectory(path.join(file.parentPath, file.name));
            } else if (file.isFile() && file.name === 'package.json') {
                packageJSONPath.push(_path);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

async function findPackages(rootPath) {
    try {
        await handleDirectory(rootPath);
        return packageJSONPath;
    } catch (err) {
        console.error(err);
    }
}

module.exports = findPackages;
