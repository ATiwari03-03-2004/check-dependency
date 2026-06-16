const traverse = require('@babel/traverse').default;
const _path = require('path');
const {resolveSync} = require('./resolve');

/**
 * JSON / Object format after parsing code file
 * ============================================
 * {
 *  filepath: {
 *      type: 'commonjs'/'module',
 * 
 *      code: [],
 * 
 *      syntaxError: [], // errors encountered by @babel parser during parsing
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
 *                }, // using require.resoleve('dependencyName') or fileURLToPath(import.meta.resolve('dependencyNam'))
 * 
 *          },]
 *      },
 *  },
 * }
*/

function isLocalDependency(dependency) {
    if (dependency.startsWith(".") || dependency.startsWith("..") || _path.isAbsolute(dependency)) return 0;
    return 1;
}

function traverseAST(ast, content) {
    const dependencies = {};
    traverse(ast, {
        VariableDeclaration(path) {
            path.node.declarations.forEach((declaration) => {
                if (declaration.id?.type == 'Identifier' && declaration.init?.type == 'CallExpression' && declaration.init?.callee?.name == 'require') {
                    if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                        dependencies[_path.resolve(path.node.loc.filename)] = {
                            'type': 'commonjs',
                            'code': [content.split(/\r?\n/)],
                            'syntaxError': (ast.errors.length > 0) ? ast.errors : [],
                            'dependencyList': {},
                        };
                    }
                    let obj = {};
                    obj[declaration.id.name] = [];
                    path.scope.getBinding(declaration.id.name).referencePaths?.forEach((refPath) => {
                        obj[declaration.id.name].push({
                            'loc': {
                                'start': refPath.parentPath.node.loc.start, 
                                'end': refPath.parentPath.node.loc.end
                            }
                        });
                    });
                    if (declaration.init.arguments[0].type == 'StringLiteral') {
                        let notLocal = isLocalDependency(declaration.init.arguments[0].value);
                        if (notLocal) {
                            let res = resolveSync(path.node.loc.filename, declaration.init.arguments[0].value);
                            if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.arguments[0].value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.arguments[0].value] = []
                            dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.arguments[0].value].push({
                                'stringLiteral': true,
                                'sideEffectImport': false,
                                'identifier': {},
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
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        if (binding.path.node.type == 'VariableDeclarator') {
                            let notLocal = isLocalDependency(binding.path.node.init.value);
                            if (notLocal) {
                                let res = resolveSync(path.node.loc.filename, binding.path.node.init.value);
                                if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value] = []
                                dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value].push({
                                    'stringLiteral': false,
                                    'sideEffectImport': false,
                                    'identifier': {
                                        'loc': {
                                            'start': binding.path.node.loc.start,
                                            'end': binding.path.node.loc.end,
                                        },
                                        'identifierName': declaration.init.arguments[0].name,
                                        'dependencyValue': binding.path.node.init.value,
                                    },
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
                    }
                } else if (declaration.id?.type == 'ObjectPattern' && declaration.init?.type == 'CallExpression' && declaration.init?.callee?.name == 'require') {
                    if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                        dependencies[_path.resolve(path.node.loc.filename)] = {
                            'type': 'commonjs',
                            'code': [content.split(/\r?\n/)],
                            'syntaxError': (ast.errors.length > 0) ? ast.errors : [],
                            'dependencyList': {},
                        };
                    }
                    let obj = {};
                    declaration.id.properties.forEach((property) => {
                        obj[property.value.name] = [];
                        path.scope.getBinding(property.value.name).referencePaths?.forEach((refPath) => {
                            obj[property.value.name].push({
                                'loc': {
                                    'start': refPath.parentPath.node.loc.start,
                                    'end': refPath.parentPath.node.loc.end,
                                }
                            });
                        });
                    });
                    if (declaration.init.arguments[0].type == 'StringLiteral') {
                        let notLocal = isLocalDependency(declaration.init.arguments[0].value);
                        if (notLocal) {
                            let res = resolveSync(path.node.loc.filename, declaration.init.arguments[0].value);
                            if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.arguments[0].value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.arguments[0].value] = []
                            dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.arguments[0].value].push({
                                'stringLiteral': true,
                                'sideEffectImport': false,
                                'identifier': {},
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
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        if (binding.path.node.type == 'VariableDeclarator') {
                            let notLocal = isLocalDependency(binding.path.node.init.value);
                            if (notLocal) {
                                let res = resolveSync(path.node.loc.filename, binding.path.node.init.value);
                                if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value] = []
                                dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value].push({
                                    'stringLiteral': false,
                                    'sideEffectImport': false,
                                    'identifier': {
                                        'loc': {
                                            'start': binding.path.node.loc.start,
                                            'end': binding.path.node.loc.end,
                                        },
                                        'identifierName': declaration.init.arguments[0].name,
                                        'dependencyValue': binding.path.node.init.value,
                                    },
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
                    }
                } else if (declaration.id?.type == 'Identifier' && declaration.init?.type == 'AwaitExpression' && declaration.init?.argument?.type == 'CallExpression' && declaration.init?.argument?.callee?.type == 'Import') {
                    if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                        dependencies[_path.resolve(path.node.loc.filename)] = {
                            'type': 'module',
                            'code': [content.split(/\r?\n/)],
                            'syntaxError': (ast.errors.length > 0) ? ast.errors : [],
                            'dependencyList': {},
                        };
                    }
                    let obj = {};
                    obj[declaration.id.name] = [];
                    path.scope.getBinding(declaration.id.name).referencePaths?.forEach((refPath) => {
                        obj[declaration.id.name].push({
                            'loc': {
                                'start': refPath.parentPath.node.loc.start,
                                'end': refPath.parentPath.node.loc.end,
                            }
                        });
                    });
                    let notLocal = isLocalDependency(declaration.init.argument.arguments[0].value);
                    if (notLocal) {
                        let res = resolveSync(path.node.loc.filename, declaration.init.argument.arguments[0].value);
                        if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.argument.arguments[0].value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.argument.arguments[0].value] = []
                        dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.argument.arguments[0].value].push({
                            'stringLiteral': null,
                            'sideEffectImport': false,
                            'identifier': {},
                            'dependencyIdentifiers': {...obj},
                            'declaration': {
                                'loc': {
                                    'start': path.node.loc.start,
                                    'end': path.node.loc.end,
                                }
                            },
                            'dependencyAbsolutePath': res,
                        });
                    }
                } else if (declaration.id?.type == 'ObjectPattern' && declaration.init?.type == 'AwaitExpression' && declaration.init?.argument?.type == 'CallExpression' && declaration.init?.argument?.callee?.type == 'Import') {
                    if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                        dependencies[_path.resolve(path.node.loc.filename)] = {
                            'type': 'module',
                            'code': [content.split(/\r?\n/)],
                            'syntaxError': (ast.errors.length > 0) ? ast.errors : [],
                            'dependencyList': {},
                        };
                    }
                    let obj = {};
                    declaration.id.properties.forEach((property) => {
                        obj[property.value.name] = [];
                        path.scope.getBinding(property.value.name).referencePaths?.forEach((refPath) => {
                            obj[property.value.name].push({
                                'loc': {
                                    'start': refPath.parentPath.node.loc.start,
                                    'end': refPath.parentPath.node.loc.end,
                                }
                            });
                        });
                    });
                    let notLocal = isLocalDependency(declaration.init.argument.arguments[0].value);
                    if (notLocal) {
                        let res = resolveSync(path.node.loc.filename, declaration.init.argument.arguments[0].value);
                        if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.argument.arguments[0].value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.argument.arguments[0].value] = []
                        dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][declaration.init.argument.arguments[0].value].push({
                            'stringLiteral': null,
                            'sideEffectImport': false,
                            'identifier': {},
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
            })
        },
        ExpressionStatement(path) {
            if (path.node.expression.type == 'CallExpression' && path.node.expression.callee.name == 'require') {
                if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                    dependencies[_path.resolve(path.node.loc.filename)] = {
                        'type': 'commonjs',
                        'code': [content.split(/\r?\n/)],
                        'syntaxError': (ast.errors.length > 0) ? ast.errors : [],
                        'dependencyList': {},
                    };
                }
                if (path.node.expression.arguments[0].type == 'StringLiteral') {
                    let notLocal = isLocalDependency(path.node.expression.arguments[0].value);
                    if (notLocal) {
                        let res = resolveSync(path.node.loc.filename, path.node.expression.arguments[0].value);
                        if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][path.node.expression.arguments[0].value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][path.node.expression.arguments[0].value] = []
                        dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][path.node.expression.arguments[0].value].push({
                            'stringLiteral': true,
                            'identifier': {},
                            'sideEffectImport': true,
                            'dependencyIdentifiers': {},
                            'declaration': {
                                'loc': {
                                    'start': path.node.loc.start,
                                    'end': path.node.loc.end,
                                },
                            },
                            'dependencyAbsolutePath': res,
                        });
                    }
                } else if (path.node.expression.arguments[0].type == 'Identifier') {
                    let binding = path.scope.getBinding(path.node.expression.arguments[0].name);
                    if (binding.path.node.type == 'VariableDeclarator') {
                        let notLocal = isLocalDependency(binding.path.node.init.value);
                        if (notLocal) {
                            let res = resolveSync(path.node.loc.filename, binding.path.node.init.value);
                            if (!dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value]) dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value] = []
                            dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'][binding.path.node.init.value].push({
                                'stringLiteral': false,
                                'identifier': {
                                    'loc': {
                                        'start': binding.path.node.loc.start,
                                        'end': binding.path.node.loc.end,
                                    },
                                    'identifierName': path.node.expression.arguments[0].name,
                                    'dependencyValue': binding.path.node.init.value,
                                },
                                'sideEffectImport': true,
                                'dependencyIdentifiers': {},
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
                }
            }
        },
        ImportDeclaration(path) {
            if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                dependencies[_path.resolve(path.node.loc.filename)] = {
                    'type': 'module',
                    'code': [content.split(/\r?\n/)],
                    'syntaxError': (ast.errors.length > 0) ? ast.errors : [],
                    'dependencyList': {},
                };
            }
            let obj = {};
            path.node.specifiers.forEach((specifier) => {
                obj[specifier.local.name] = [];
                path.scope.getBinding(specifier.local.name).referencePaths?.forEach((refPath) => {
                    obj[specifier.local.name].push({
                        'loc': {
                            'start': refPath.parentPath.node.loc.start,
                            'end': refPath.parentPath.node.loc.end,
                        }
                    });
                });
            });
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
