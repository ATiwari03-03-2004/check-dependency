const findPackages = require('./findPackageJSON');
const getDependencies = require("./getDependencies");

async function projectsDependencies () {
    try {
        const dependencies = {};
        let packages = await findPackages(process.cwd());
        const promises = packages.map(async (package) => {
            return await getDependencies(package)
        });
        let results = await Promise.all(promises);
        for (let result of results) {
            if (result) {
                for (const [key, value] of Object.entries(result)) {
                    dependencies[key] = value;
                }
            }
        }
        return dependencies;
    } catch (err) {
        console.log(err);
    }
};

module.exports = projectsDependencies;
