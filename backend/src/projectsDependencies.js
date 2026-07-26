const findPackages = require('./findPackageJSON');
const getDependencies = require("./getDependencies");
const { resolve } = require('./resolve');
const _path = require('path');
const fs = require('fs/promises');

const packageData = {};

async function projectsDependencies(flag = true, files) {
    try {
        const dependencies = {};
        let results;
        if (flag) {
            let packages = await findPackages(process.cwd());
            const promises = packages.map((package) => {
                return getDependencies(package);
            });
            results = await Promise.all(promises);
        } else {
            const promises = files.map((package) => {
                return getDependencies(package.split('\\').slice(0, package.split('\\').length - 1).join('\\'));
            });
            results = await Promise.all(promises);
        }
        for (let result of results) {
            if (result) packageData[_path.join(result.path, 'package.json')] = { 'dependencies': {} };
            if (result?.dependencies) {
                for (const [key, value] of Object.entries(result.dependencies)) {
                    let path = await resolve(_path.join(result.path, 'package.json'), key);
                    dependencies[path.dependencyPath] = {
                        'version': value,
                        'dependency': key,
                        'devDependencies': false
                    };
                    packageData[_path.join(result.path, 'package.json')]['dependencies'][key] = [value, path.dependencyPath];
                }
            }
            if (result?.devDependencies) {
                for (const [key, value] of Object.entries(result.devDependencies)) {
                    let path = await resolve(_path.join(result.path, 'package.json'), key);
                    dependencies[path.dependencyPath] = {
                        'version': value,
                        'dependency': key,
                        'devDependencies': true
                    };
                    packageData[_path.join(result.path, 'package.json')]['dependencies'][key] = [value, path.dependencyPath];
                }
            }
        }
        if (flag) await fs.writeFile(_path.join(process.cwd(), 'check-dependency-data', 'packageDependency.json'), JSON.stringify(packageData), 'utf8');
        return (flag) ? dependencies : { 'dependencies': dependencies, 'packageData': packageData };
    } catch (err) {
        console.log(err);
    }
};

module.exports = projectsDependencies;
