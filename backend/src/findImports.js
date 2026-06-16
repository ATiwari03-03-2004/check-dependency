const projectsDependencies = require('./projectsDependencies');
const fs = require('fs/promises');
const _path = require('path');
const parser = require('@babel/parser');
const traverseAST = require('./traverseAST');

async function readDirectory(path) {
    let files = await fs.readdir(path, { withFileTypes: true });
    return files;
}

async function parseFile(path) {
    let content, baseOpt = { ecmaVersion: 'latest' };
    try {
        content = await fs.readFile(path, { encoding: 'utf8' });
        let ast = parser.parse(content, {
            sourceType: 'unambiguous', plugins: ['jsx'], sourceFilename: path, errorRecovery: true
        });
        return traverseAST(ast, content);
    } catch (err) {
        console.log(err);
    }
}

let imports = {};

async function scanProject(path) {
    try {
        let files = await readDirectory(path);
        for (const file of files) {
            if (file.isDirectory() && (file.name[0] != '.' && file.name != 'node_modules' && file.name != 'build' && file.name != 'dist' && file.name != 'out' && file.name != 'storybook-static' && file.name != 'coverage' && file.name != 'tmp' && file.name != 'temp' && file.name != 'logs' && file.name != 'expo')) {
                await scanProject(_path.join(path, file.name));
            } else if (file.isFile() && (file.name.endsWith(".js") || file.name.endsWith(".mjs") || file.name.endsWith(".cjs") || file.name.endsWith(".jsx"))) {
                let obj = await parseFile(_path.join(path, file.name));
                imports = { ...imports, ...obj };
            }
        }
    } catch (err) {
        console.log(err);
    }
}

async function findImports() {
    try {
        await scanProject(process.cwd());
        return imports;
    } catch (err) {
        console.log(err);
    }
}

module.exports = findImports;
