const traverse = require('@babel/traverse').default;
const _path = require('path');
const {resolveSync} = require('./resolve');
const fs = require('fs');

/**
 * JSON / Object format after parsing code file
 * ============================================
 * {
 *  filepath: {
 *      type: 'commonjs'/'module',
 * 
 *      error: true/false, @babel parser is in errorRecovery mode, so describes if any error encountered while parsing
 *      
 *      dependencyList: {
 * 
 *          dependencyName: [{
 * 
 *                stringLiteral: true/false, // in the require (commonjs syntax), ignored for type: 'module'
 *    
 *                sideEffectImport: true/false, // ie. import 'dotenv/config' or require('dotenv/config')
 *    
 *                // if stringLiteral false, then the value of identifier used in require (i.e. dependency value)
 *                identifier: {
 *                     loc: {
 *                          start: ,
 *                          end: ,
 *                      },
 *                      identifierName: ,
 *                      dependencyValue: ,
 *                }, // ignored for type: 'module' and stringLiteral: true
 *    
 *                dependencyIdentifiers: {
 *                     identifier: [
 *                         {
 *                             loc: {
 *                                 start: ,
 *                                 end: ,
 *                             },
 *                         },
 *                     ],   
 *                }
 *    
 *                declaration: {
 *                      loc: {
 *                         start: ,
 *                         end: ,
 *                     },
 *                },
 * 
 *                dependencyAbsolutePath: {
 *                  dependencyPath: ,
 *                  dependencyType: ,
 *                },
 * 
 *          },]
 *      },
 *  },
 * }
*/

const dependencies = {};

function isLocalDependency(dependency) {
    if (dependency.startsWith(".") || dependency.startsWith("~") || _path.isAbsolute(dependency)) return 0;
    return 1;
}

function setDependency(file, type, errors) {
    if (!dependencies[file]) {
        dependencies[file] = {
            'type': type,
            'error': (errors.length > 0) ? true : false,
            'dependencyList': {},
        };
    }
}

function getDependencyIdentifiersForIdTypeIdentifier(declarationName, bindings) {
    let obj = {};
    obj[declarationName] = [];
    bindings.referencePaths?.forEach((refPath) => {
        obj[declarationName].push({
            'loc': {
                'start': refPath.parentPath.node.loc.start, 
                'end': refPath.parentPath.node.loc.end
            }
        });
    });
    return obj;
}

function getDependencyIdentifiersForIdObjectPattern(properties, scope) {
    let obj = {};
    properties.forEach((property) => {
        if (property.value) Object.assign(obj, getDependencyIdentifiersForIdTypeIdentifier(property.value.name, scope.getBinding(property.value.name)));
        else if (property.local) Object.assign(obj, getDependencyIdentifiersForIdTypeIdentifier(property.local.name, scope.getBinding(property.local.name)));
    });
    return obj;
}

function setStringLiteralDependencyInfo(dependency, file, stringLiteral, sideEffectImport, fn, declaration, bindings, loc) {
    let notLocal = isLocalDependency(dependency);
    if (notLocal) {
        let res = resolveSync(file, dependency);
        if (!dependencies[file]['dependencyList'][dependency]) dependencies[_path.resolve(file)]['dependencyList'][dependency] = []
        dependencies[file]['dependencyList'][dependency].push({
            'stringLiteral': stringLiteral,
            'sideEffectImport': sideEffectImport,
            'identifier': {},
            'dependencyIdentifiers': fn ? {...fn(declaration, bindings)} : {},
            'declaration': {
                'loc': {
                    'start': loc.start,
                    'end': loc.end,
                },
            },
            'dependencyAbsolutePath': res,
        });
    }
}

function setIdentifierDependencyInfo(identifierName, binding, nodeType, dependency, file, stringLiteral, sideEffectImport, identifierBindingLoc, fn, declaration, bindings, loc) {
    if (nodeType == 'VariableDeclarator') {
        let notLocal = isLocalDependency(dependency);
        if (notLocal) {
            let res = resolveSync(file, dependency);
            if (!dependencies[_path.resolve(file)]['dependencyList'][dependency]) dependencies[_path.resolve(file)]['dependencyList'][dependency] = []
            dependencies[_path.resolve(file)]['dependencyList'][dependency].push({
                'stringLiteral': stringLiteral,
                'sideEffectImport': sideEffectImport,
                'identifier': {
                    'loc': {
                        'start': identifierBindingLoc.start,
                        'end': identifierBindingLoc.end,
                    },
                    'identifierName': identifierName,
                    'dependencyValue': dependency,
                },
                'dependencyIdentifiers': {...fn(declaration, bindings)},
                'declaration': {
                    'loc': {
                        'start': loc.start,
                        'end': loc.end,
                    },
                },
                'dependencyAbsolutePath': res,
            });
        }
    }
}

function traverseAST(ast) {
    traverse(ast, {
        VariableDeclaration(path) {
            path.node.declarations.forEach((declaration) => {
                if (declaration.id?.type == 'Identifier' && declaration.init?.type == 'MemberExpression' && declaration.init?.object?.type == 'CallExpression' && declaration.init?.object?.callee?.name == 'require') {
                    setDependency(path.node.loc.filename, 'commonjs', ast.errors);
                    if (declaration.init.object.arguments[0].type == 'StringLiteral') {
                        setStringLiteralDependencyInfo(declaration.init.object.arguments[0].value, path.node.loc.filename, true, false, getDependencyIdentifiersForIdTypeIdentifier, declaration.id.name, path.scope.getBinding(declaration.id.name), path.node.loc)
                    } else if (declaration.init.object.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.object.arguments[0].name);
                        setIdentifierDependencyInfo(declaration.init.object.arguments[0].name, binding, binding.path.node.type, binding.path.node.init.value, path.node.loc.filename, false, false, binding.path.node.loc, getDependencyIdentifiersForIdTypeIdentifier, declaration.id.name, path.scope.getBinding(declaration.id.name), path.node.loc);
                    }
                } else if (declaration.id?.type == 'ObjectPattern' && declaration.init?.type == 'MemberExpression' && declaration.init?.object?.type == 'CallExpression' && declaration.init?.object?.callee?.name == 'require') {
                    setDependency(path.node.loc.filename, 'commonjs', ast.errors);
                    if (declaration.init.object.arguments[0].type == 'StringLiteral') {
                        setStringLiteralDependencyInfo(declaration.init.object.arguments[0].value, path.node.loc.filename, true, false, getDependencyIdentifiersForIdObjectPattern, declaration.id.properties, path.scope, path.node.loc);
                    } else if (declaration.init.object.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.object.arguments[0].name);
                        setIdentifierDependencyInfo(declaration.init.object.arguments[0].name, binding, binding.path.node.type, binding.path.node.init.value, path.node.loc.filename, false, false, binding.path.node.loc, getDependencyIdentifiersForIdObjectPattern, declaration.id.properties, path.scope, path.node.loc);
                    }
                } else if (declaration.id?.type == 'Identifier' && declaration.init?.type == 'CallExpression' && declaration.init?.callee?.name == 'require') {
                    setDependency(path.node.loc.filename, 'commonjs', ast.errors);
                    if (declaration.init.arguments[0].type == 'StringLiteral') {
                        setStringLiteralDependencyInfo(declaration.init.arguments[0].value, path.node.loc.filename, true, false, getDependencyIdentifiersForIdTypeIdentifier, declaration.id.name, path.scope.getBinding(declaration.id.name), path.node.loc);
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        setIdentifierDependencyInfo(declaration.init.arguments[0].name, binding, binding.path.node.type, binding.path.node.init.value, path.node.loc.filename, false, false, binding.path.node.loc, getDependencyIdentifiersForIdTypeIdentifier, declaration.id.name, path.scope.getBinding(declaration.id.name), path.node.loc);
                    }
                } else if (declaration.id?.type == 'ObjectPattern' && declaration.init?.type == 'CallExpression' && declaration.init?.callee?.name == 'require') {
                    setDependency(path.node.loc.filename, 'commonjs', ast.errors);
                    if (declaration.init.arguments[0].type == 'StringLiteral') {
                        setStringLiteralDependencyInfo(declaration.init.arguments[0].value, path.node.loc.filename, true, false, getDependencyIdentifiersForIdObjectPattern, declaration.id.properties, path.scope, path.node.loc);
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        setIdentifierDependencyInfo(declaration.init.arguments[0].name, binding, binding.path.node.type, binding.path.node.init.value, path.node.loc.filename, false, false, binding.path.node.loc, getDependencyIdentifiersForIdObjectPattern, declaration.id.properties, path.scope, path.node.loc);
                    }
                } else if (declaration.id?.type == 'Identifier' && declaration.init?.type == 'AwaitExpression' && declaration.init?.argument?.type == 'CallExpression' && declaration.init?.argument?.callee?.type == 'Import') {
                    setDependency(path.node.loc.filename, 'module', ast.errors);
                    setStringLiteralDependencyInfo(declaration.init.argument.arguments[0].value, path.node.loc.filename, null, false, getDependencyIdentifiersForIdTypeIdentifier, declaration.id.name, path.scope.getBinding(declaration.id.name), path.node.loc);
                } else if (declaration.id?.type == 'ObjectPattern' && declaration.init?.type == 'AwaitExpression' && declaration.init?.argument?.type == 'CallExpression' && declaration.init?.argument?.callee?.type == 'Import') {
                    setDependency(path.node.loc.filename, 'module', ast.errors);
                    setStringLiteralDependencyInfo(declaration.init.argument.arguments[0].value, path.node.loc.filename, null, false, getDependencyIdentifiersForIdObjectPattern, declaration.id.properties, path.scope, path.node.loc);
                }
            })
        },
        ExpressionStatement(path) {
            if (path.node.expression.type == 'CallExpression' && path.node.expression.callee.name == 'require') {
                setDependency(path.node.loc.filename, 'commonjs', ast.errors);
                if (path.node.expression.arguments[0].type == 'StringLiteral') {
                    setStringLiteralDependencyInfo(path.node.expression.arguments[0].value, path.node.loc.filename, true, true, undefined, undefined, undefined, path.node.loc);
                } else if (path.node.expression.arguments[0].type == 'Identifier') {
                    let binding = path.scope.getBinding(path.node.expression.arguments[0].name);
                    setIdentifierDependencyInfo(path.node.expression.arguments[0].name, binding, binding.path.node.type, binding.path.node.init.value, path.node.loc.filename, false, true, binding.path.node.loc, undefined, undefined, undefined, path.node.loc);
                }
            } else if (path.node.expression.type == 'CallExpression' && path.node.expression.callee.type == 'MemberExpression' && path.node.expression.callee.object.type == 'CallExpression' && path.node.expression.callee.object.callee.name == 'require') {
                setDependency(path.node.loc.filename, 'commonjs', ast.errors);
                if (path.node.expression.callee.object.arguments[0].type == 'StringLiteral') {
                    setStringLiteralDependencyInfo(path.node.expression.callee.object.arguments[0].value, path.node.loc.filename, true, true, undefined, undefined, undefined, path.node.loc);
                } else if (path.node.expression.callee.object.arguments[0].type == 'Identifier') {
                    let binding = path.scope.getBinding(path.node.expression.callee.object.arguments[0].name);
                    setIdentifierDependencyInfo(path.node.expression.callee.object.arguments[0].name, binding, binding.path.node.type, binding.path.node.init.value, path.node.loc.filename, false, true, binding.path.node.loc, undefined, undefined, undefined, path.node.loc);
                }
            }
        },
        ImportDeclaration(path) {
            setDependency(path.node.loc.filename, 'module', ast.errors);
            let obj = getDependencyIdentifiersForIdObjectPattern(path.node.specifiers, path.scope);
            let notLocal = isLocalDependency(path.node.source.value);
            if (notLocal) {
                let res = resolveSync(path.node.loc.filename, path.node.source.value);
                if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][path.node.source.value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][path.node.source.value] = []
                dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][path.node.source.value].push({
                    'stringLiteral': null,
                    'identifier': {},
                    'sideEffectImport': (Object.keys(obj).length == 0) ? true : false,
                    'dependencyIdentifiers': {...obj},
                    'declaration': {
                        'loc': {
                            'start': path.node.loc.start,
                            'end': path.node.loc.end,
                        },
                    },
                    'dependencyAbsolutePath': res,
                });
            }
        }
    });
    return dependencies;
}

module.exports = traverseAST;
