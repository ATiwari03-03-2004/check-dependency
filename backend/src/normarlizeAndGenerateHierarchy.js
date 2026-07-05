const projectsDependencies = require('./projectsDependencies');
const findImports = require('./findImports');
const path = require('path');
const fs = require('fs/promises');

const dependenciesInfo = {}, unusedDependenciesInfo = {}, treeData = {};

function setObjs(dep, file, declaration, sideEffectImport, dependencyIdentifiers, stringLiteral, identifier, dependencyType, _dependency, dependencyPath, devDependencies, version) {
    if (treeData['root']['children'].indexOf(dep) === -1) treeData['root']['children'].push(dep);
    if (!dependenciesInfo[dep]) dependenciesInfo[dep] = {};
    if (!dependenciesInfo[dep][file]) dependenciesInfo[dep][file] = [];
    dependenciesInfo[dep][file].push({
        'declaration': declaration,
        'sideEffect': sideEffectImport,
        'usage': dependencyIdentifiers,
        'moduleIdentifier': stringLiteral ? {} : identifier,
        'dependencyType': dependencyType,
        'dependencyValue': _dependency,
        'dependencyPath': dependencyPath,
        'devDependencies': devDependencies,
        'dependencyVersion': version,
    });
    if (!treeData[dep]) treeData[dep] = { 'label': dep, 'level': 1, 'children': [file] }
    else if (treeData[dep]['children'].indexOf(file) === -1) treeData[dep]['children'].push(file);
}

async function normarlizeAndGenerateHierarchy(projectsrc, scanProject = true, _files = []) {
    try {
        treeData['root'] = { 'label': [projectsrc, process.cwd()], 'level': 0, 'children': [] };
        let dependency = await projectsDependencies();
        await fs.writeFile(path.join(process.cwd(), 'check-dependency-data', 'dependency.json'), JSON.stringify(dependency), 'utf8');
        let imports = await findImports(scanProject, _files);
        let files = Object.keys(imports);
        for (let file of files) {
            let _dependencies = Object.keys(imports[file]['dependencyList']);
            for (let _dependency of _dependencies) {
                imports[file]['dependencyList'][_dependency].forEach(async d => {
                    if (d['dependencyAbsolutePath']['dependencyType'] === 'built-in') {
                        let dep = _dependency;
                        if (_dependency.startsWith('node:')) dep = _dependency.substring(5);
                        setObjs(dep, file, d['declaration'], d['sideEffectImport'], d['dependencyIdentifiers'], d['stringLiteral'], d['identifier'], 'built-in', _dependency, d['dependencyAbsolutePath']['dependencyPath'], false, undefined);
                    } else if (d['dependencyAbsolutePath']['dependencyType'] === 'local' && d['dependencyAbsolutePath']['dependencyPath'].includes('node_modules')) {
                        let pathParts = d['dependencyAbsolutePath']['dependencyPath'].split('\\');
                        for (let i = pathParts.length - 1; i >= 0; i--) {
                            if (pathParts[i] === 'node_modules') break;
                            let _path = pathParts.slice(0, i + 1).join('\\');
                            if (dependency[_path]) {
                                setObjs(dependency[_path]['dependency'], file, d['declaration'], d['sideEffectImport'], d['dependencyIdentifiers'], d['stringLiteral'], d['identifier'], 'local', _dependency, d['dependencyAbsolutePath']['dependencyPath'], dependency[_path]['devDependencies'], dependency[_path]['version']);
                                break;
                            }
                        }
                    } else if (d['dependencyAbsolutePath']['dependencyType'] === 'global' && d['dependencyAbsolutePath']['dependencyPath'].includes('node_modules')) {
                        setObjs(_dependency, file, d['declaration'], d['sideEffectImport'], d['dependencyIdentifiers'], d['stringLiteral'], d['identifier'], 'global', _dependency, d['dependencyAbsolutePath']['dependencyPath'], undefined, undefined);
                    }
                });
            }
            treeData[file] = { 'label': file.split('\\').slice(-2).join('\\'), 'level': 2, 'children': [], 'error': imports[file]['error'] };
        }
        Object.keys(dependency).forEach(d => {
            if (treeData['root']['children'].indexOf(dependency[d]['dependency']) === -1) treeData['root']['children'].push(dependency[d]['dependency']);
            if (!dependenciesInfo[dependency[d]['dependency']]) {
                if (!unusedDependenciesInfo[dependency[d]['dependency']]) unusedDependenciesInfo[dependency[d]['dependency']] = [];
                unusedDependenciesInfo[dependency[d]['dependency']].push({
                    'dependencyType': 'local',
                    'dependencyValue': dependency[d]['dependency'],
                    'dependencyPath': d,
                    'devDependencies': dependency[d]['devDependencies'],
                    'dependencyVersion': dependency[d]['version'],
                });
            }
        });
        let result = { dependenciesInfo, unusedDependenciesInfo, treeData };
        await fs.writeFile(path.join(process.cwd(), 'check-dependency-data', 'response.json'), JSON.stringify(result), 'utf8');
        return result;
    } catch (err) {
        return { error: err };
    }
}

module.exports = normarlizeAndGenerateHierarchy;
