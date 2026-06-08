const traverse = require('@babel/traverse').default;
const _path = require('path');

/**
 * JSON / Object format after parsing code file
 * ============================================
 * {
 *  filepath: {
 *      type: 'commonjs'/'module',
 * 
 *      code: [],
 *      
 *      dependencyList: [
 *         {
 *             dependencyName: ,
 * 
 *             stringLiteral: true/false, // in the require (commonjs syntax), ignored for type: 'module'
 * 
 *             sideEffectImport: true/false, // ie. import 'dotenv/config' or require('dotenv/config')
 * 
 *             // if stringLiteral false, then the value of identifier used in require (i.e. dependency value)
 *             identifier: {
 *                  loc: {
 *                       start: ,
 *                       end: ,
 *                   },
 *                   identifierName: ,
 *                   dependencyValue: ,
 *             }, // ignored for type: 'module' and stringLiteral: true
 * 
 *             dependencyIdentifiers: {
 *                  identifier: [
 *                      {
 *                          loc: {
 *                              start: ,
 *                              end: ,
 *                          },
 *                      },
 *                  ],   
 *             }
 * 
 *             declaration: {
 *                   loc: {
 *                      start: ,
 *                      end: ,
 *                  },
 *             },
 * 
 *         },
 *      ],
 *  },
 * }
 * 
 * Example:
 * ========
 * 
 * 
*/

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
                            'dependencyList': [],
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
                        dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                            'dependencyName': declaration.init.arguments[0].value,
                            'stringLiteral': true,
                            'sideEffectImport': false,
                            'identifier': {},
                            'dependencyIdentifiers': {...obj},
                            'declaration': {
                                'loc': {
                                    'start': path.node.loc.start,
                                    'end': path.node.loc.end,
                                },
                            }
                        });
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        if (binding.path.node.type == 'VariableDeclarator') {
                            dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                                'dependencyName': binding.path.node.init.value,
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
                                }
                            });
                        }
                    }
                } else if (declaration.id?.type == 'ObjectPattern' && declaration.init?.type == 'CallExpression' && declaration.init?.callee?.name == 'require') {
                    if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                        dependencies[_path.resolve(path.node.loc.filename)] = {
                            'type': 'commonjs',
                            'code': [content.split(/\r?\n/)],
                            'dependencyList': [],
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
                        dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                            'dependencyName': declaration.init.arguments[0].value,
                            'stringLiteral': true,
                            'sideEffectImport': false,
                            'identifier': {},
                            'dependencyIdentifiers': {...obj},
                            'declaration': {
                                'loc': {
                                    'start': path.node.loc.start,
                                    'end': path.node.loc.end,
                                },
                            }
                        });
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        if (binding.path.node.type == 'VariableDeclarator') {
                            dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                                'dependencyName': binding.path.node.init.value,
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
                                }
                            });
                        }
                    }
                } else if (declaration.id?.type == 'Identifier' && declaration.init?.type == 'AwaitExpression' && declaration.init?.argument?.type == 'CallExpression' && declaration.init?.argument?.callee?.type == 'Import') {
                    if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                        dependencies[_path.resolve(path.node.loc.filename)] = {
                            'type': 'module',
                            'code': [content.split(/\r?\n/)],
                            'dependencyList': [],
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
                    dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                        'dependencyName': declaration.init.argument.arguments[0].value,
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
                    });
                } else if (declaration.id?.type == 'ObjectPattern' && declaration.init?.type == 'AwaitExpression' && declaration.init?.argument?.type == 'CallExpression' && declaration.init?.argument?.callee?.type == 'Import') {
                    if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                        dependencies[_path.resolve(path.node.loc.filename)] = {
                            'type': 'module',
                            'code': [content.split(/\r?\n/)],
                            'dependencyList': [],
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
                    dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                        'dependencyName': declaration.init.argument.arguments[0].value,
                        'stringLiteral': null,
                        'sideEffectImport': false,
                        'identifier': {},
                        'dependencyIdentifiers': {...obj},
                        'declaration': {
                            'loc': {
                                'start': path.node.loc.start,
                                'end': path.node.loc.end,
                            },
                        }
                    });
                }
            })
        },
        ExpressionStatement(path) {
            if (path.node.expression.type == 'CallExpression' && path.node.expression.callee.name == 'require') {
                if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                    dependencies[_path.resolve(path.node.loc.filename)] = {
                        'type': 'commonjs',
                        'code': [content.split(/\r?\n/)],
                        'dependencyList': [],
                    };
                }
                if (path.node.expression.arguments[0].type == 'StringLiteral') {
                    dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                        'dependencyName':  path.node.expression.arguments[0].value,
                        'stringLiteral': true,
                        'identifier': {},
                        'sideEffectImport': true,
                        'dependencyIdentifiers': {},
                        'declaration': {
                            'loc': {
                                'start': path.node.loc.start,
                                'end': path.node.loc.end,
                            },
                        }
                    });
                } else if (path.node.expression.arguments[0].type == 'Identifier') {
                    let binding = path.scope.getBinding(path.node.expression.arguments[0].name);
                    if (binding.path.node.type == 'VariableDeclarator') {
                        dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                            'dependencyName':  binding.path.node.init.value,
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
                            }
                        });
                    }
                }
            }
        },
        ImportDeclaration(path) {
            if (!dependencies[_path.resolve(path.node.loc.filename)]) {
                dependencies[_path.resolve(path.node.loc.filename)] = {
                    'type': 'module',
                    'code': [content.split(/\r?\n/)],
                    'dependencyList': [],
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
            dependencies[_path.resolve(path.node.loc.filename)]['dependencyList'].push({
                'dependencyName':  path.node.source.value,
                'stringLiteral': null,
                'identifier': {},
                'sideEffectImport': (Object.keys(obj).length == 0) ? true : false,
                'dependencyIdentifiers': {...obj},
                'declaration': {
                    'loc': {
                        'start': path.node.loc.start,
                        'end': path.node.loc.end,
                    },
                }
            });
        }
    });
    return dependencies;
}

module.exports = traverseAST;
