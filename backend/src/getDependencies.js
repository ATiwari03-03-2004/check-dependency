const fs = require('fs/promises');
const path = require('path');

async function getDependencies(_path) {
    try {
        let dependenciesJSON = await fs.readFile(path.join(_path, 'package.json'), {encoding: 'utf8'});
        if (dependenciesJSON) return JSON.parse(dependenciesJSON).dependencies;
    } catch(err) {
        console.log(err);
    }
}

module.exports = getDependencies;
