const fs = require('fs/promises');
const path = require('path');

async function getDependencies(_path) {
    try {
        let dependenciesJSON = await fs.readFile(path.join(_path, 'package.json'), { encoding: 'utf8' });
        if (dependenciesJSON) {
            let dependency = JSON.parse(dependenciesJSON);
            return { 'type': dependency.type, 'dependencies': dependency.dependencies, "path": _path, "devDependencies": dependency.devDependencies };
        }
    } catch (err) {
        console.log(err);
    }
}

module.exports = getDependencies;
