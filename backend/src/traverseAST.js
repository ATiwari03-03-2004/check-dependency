const traverse = require('@babel/traverse').default;



function traverseAST(ast) {
    const dependencies = {};
    traverse(ast, {
        VariableDeclaration(path) {
            path.node.declarations.forEach((declaration) => {
                if (declaration.id.type == 'Identifier' && declaration.init.type == 'CallExpression' && declaration.init.callee.name == 'require') {
                    console.log(path.node.loc.start);
                    console.log(path.node.loc.end);
                    console.log(path.node.loc.filename);
                    console.log(declaration.id.name);
                    if (declaration.init.arguments[0].type == 'StringLiteral') {
                        console.log(declaration.init.arguments[0].value);
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        console.log(declaration.init.arguments[0].name);
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        // path.scope.getBinding(declaration.init.arguments[0].name).referencePaths.forEach((refPath) => {
                        //     console.log(refPath.parentPath.node);
                        // })
                        if (binding.path.node.type == 'VariableDeclarator') {
                            console.log(binding.path.node.init.value);
                        }
                    }
                } else if (declaration.id.type == 'ObjectPattern' && declaration.init.type == 'CallExpression' && declaration.init.callee.name == 'require') {
                    console.log(path.node.loc.start);
                    console.log(path.node.loc.end);
                    console.log(path.node.loc.filename);
                    declaration.id.properties.forEach((property) => {
                        console.log(property.value.name);
                    });
                    if (declaration.init.arguments[0].type == 'StringLiteral') {
                        console.log(declaration.init.arguments[0].value);
                    } else if (declaration.init.arguments[0].type == 'Identifier') {
                        console.log(declaration.init.arguments[0].name);
                        let binding = path.scope.getBinding(declaration.init.arguments[0].name);
                        if (binding.path.node.type == 'VariableDeclarator') {
                            console.log(binding.path.node.init.value);
                        }
                    }
                } else if (declaration.id.type == 'Identifier' && declaration.init.type == 'AwaitExpression' && declaration.init.argument.type == 'CallExpression' && declaration.init.argument.callee.type == 'Import') {
                    console.log(path.node.loc.start);
                    console.log(path.node.loc.end);
                    console.log(path.node.loc.filename);
                    console.log(declaration.id.name);
                    console.log(declaration.init.argument.arguments[0].value);
                }
            })
        },
        ExpressionStatement(path) {
            if (path.node.expression.type == 'CallExpression' && path.node.expression.callee.name == 'require') {
                console.log(path.node.loc.start);
                console.log(path.node.loc.end);
                console.log(path.node.loc.filename);
                if (path.node.expression.arguments[0].type == 'StringLiteral') {
                    console.log(path.node.expression.arguments[0].value);
                } else if (path.node.expression.arguments[0].type == 'Identifier') {
                    console.log(path.node.expression.arguments[0].name);
                    let binding = path.scope.getBinding(path.node.expression.arguments[0].name);
                    if (binding.path.node.type == 'VariableDeclarator') {
                        console.log(binding.path.node.init.value);
                    }
                }
            }
        },
        ImportDeclaration(path) {
            console.log(path.node.loc.start);
            console.log(path.node.loc.end);
            console.log(path.node.loc.filename);
            path.node.specifiers.forEach((specifier) => {
                console.log(specifier.local.name);
            });
            console.log(path.node.source.value);
        }
    });
    return dependencies;
}

module.exports = traverseAST;
