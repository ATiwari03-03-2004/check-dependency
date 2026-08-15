const { parentPort, workerData } = require('worker_threads');
const fs = require('fs/promises');
const parser = require('@babel/parser');
const traverseAST = require('./traverseAST');

const path = workerData;

async function parseFile(path) {
    let content, baseOpt = { ecmaVersion: 'latest' };
    content = await fs.readFile(path, { encoding: 'utf8' });
    let ast = parser.parse(content, {
        sourceType: 'unambiguous', plugins: ['jsx'], sourceFilename: path, errorRecovery: true
    });
    parentPort.postMessage(traverseAST(ast));
}

parseFile(path);
