const findPackages = require('./findPackageJSON');
const getDependencies = require("./getDependencies");
const {resolve} = require('./resolve');
const _path = require('path');

async function projectsDependencies () {
    try {
        const dependencies = {};
        let packages = await findPackages(process.cwd());
        const promises = packages.map(async (package) => {
            return await getDependencies(package)
        });
        let results = await Promise.all(promises);
        for (let result of results) {
            if (result?.dependencies) {
                for (const [key, value] of Object.entries(result.dependencies)) {
                    let path = await resolve(_path.join(result.path, 'package.json'), key);
                    dependencies[key] = {
                        'version': value,
                        'absPath': path.dependencyPath,
                        'devDependencies': false
                    };
                }
            }
            if (result?.devDependencies) {
                for (const [key, value] of Object.entries(result.devDependencies)) {
                    let path = await resolve(_path.join(result.path, 'package.json'), key);
                    dependencies[key] = {
                        'version': value,
                        'absPath': path.dependencyPath,
                        'devDependencies': true
                    };
                }
            }
        }
        return dependencies;
    } catch (err) {
        console.log(err);
    }
};

module.exports = projectsDependencies;
