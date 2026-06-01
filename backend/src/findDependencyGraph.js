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
        console.log(content);
        return parser.parse(content, {
            sourceType: 'unambiguous', plugins: ['jsx'], sourceFilename: path
        });
    } catch (err) {
        console.log(err);
    }
}

const imports = {};

async function scanProject(path) {
    try {
        let files = await readDirectory(path);
        for (const file of files) {
            if (file.isDirectory() && (file.name[0] != '.' && file.name != 'node_modules' && file.name != 'build' && file.name != 'dist' && file.name != 'test' && file.name != 'tests' && file.name != '__test__' && file.name != '__tests__')) {
                scanProject(_path.join(path, file.name));
            } else if ((file.name == "importstest.js" || file.name == "importstest.jsx") && file.isFile() && (file.name.endsWith(".js") || file.name.endsWith(".mjs") || file.name.endsWith(".cjs") || file.name.endsWith(".jsx"))) {
                let ast = await parseFile(_path.join(path, file.name));
                traverseAST(ast);
            }
        }
    } catch (err) {
        console.log(err);
    }
}

async function findDependencyGraph() {
    try {
        let dependencies = await projectsDependencies();
        await scanProject(process.cwd());
        // console.log(imports);
    } catch (err) {
        console.log(err);
    }
}

module.exports = findDependencyGraph;
