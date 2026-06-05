const fs = require('fs');
const f = 'fs';
const { readFile, 
    writeFile } = require(
        f

    );
const { log: logger } = require('console');
const moduleName = 'express';
const app = require(moduleName);
const m = './initialize-database.js';
require(m);
require('dotenv/config');

console.log(moduleName);
console.log(fs);
console.log(app);
console.log(fs);
console.log(readFile);
console.log(logger);
