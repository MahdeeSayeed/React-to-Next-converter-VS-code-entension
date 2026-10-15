const vscode = require('vscode');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.convertReactToNext', function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        const document = editor.document;
        const code = document.getText();

        try {
            const ast = parser.parse(code, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });

            let needsUseClient = false;
            let needsImageImport = false;
            let needsLinkImport = false;
            let needsRouterImport = false;

            traverse(ast, {
                // 1. Detect Hooks & Event Handlers for 'use client'
                CallExpression(path) {
                    if (t.isIdentifier(path.node.callee) && /^use[A-Z]/.test(path.node.callee.name)) {
                        needsUseClient = true;
                    }
                },
                JSXAttribute(path) {
                    if (t.isJSXIdentifier(path.node.name) && /^on[A-Z]/.test(path.node.name.name)) {
                        needsUseClient = true;
                    }
                },

                // 2. Convert <img> to <Image />, <a> and <Link> to Next.js <Link />
                JSXElement(path) {
                    const name = path.node.openingElement.name.name;

                    if (name === 'img') {
                        path.node.openingElement.name.name = 'Image';
                        if (path.node.closingElement) {
                            path.node.closingElement.name.name = 'Image';
                        }
                        needsImageImport = true;
                    }

                    if (name === 'a' || name === 'Link') {
                        path.node.openingElement.name.name = 'Link';
                        if (path.node.closingElement) {
                            path.node.closingElement.name.name = 'Link';
                        }

                        path.node.openingElement.attributes.forEach(attr => {
                            if (t.isJSXAttribute(attr) && attr.name.name === 'to') {
                                attr.name.name = 'href';
                            }
                        });
                        needsLinkImport = true;
                    }
                },

                // 3. Transform react-router-dom Imports
                ImportDeclaration(path) {
                    if (path.node.source.value === 'react-router-dom') {
                        const specifiers = path.node.specifiers;
                        const hasUseNavigate = specifiers.some(
                            s => t.isImportSpecifier(s) && s.imported.name === 'useNavigate'
                        );

                        if (hasUseNavigate) {
                            needsRouterImport = true;
                        }

                        path.remove();
                    }
                }
            });

            // 4. Prepend Required Imports
            if (needsRouterImport) {
                ast.program.body.unshift(
                    t.importDeclaration(
                        [t.importSpecifier(t.identifier('useRouter'), t.identifier('useRouter'))],
                        t.stringLiteral('next/navigation')
                    )
                );
            }

            if (needsLinkImport) {
                ast.program.body.unshift(
                    t.importDeclaration(
                        [t.importDefaultSpecifier(t.identifier('Link'))],
                        t.stringLiteral('next/link')
                    )
                );
            }

            if (needsImageImport) {
                ast.program.body.unshift(
                    t.importDeclaration(
                        [t.importDefaultSpecifier(t.identifier('Image'))],
                        t.stringLiteral('next/image')
                    )
                );
            }

            // 5. Prepend 'use client' Directive if needed
            if (needsUseClient) {
                const directive = t.expressionStatement(t.stringLiteral('use client'));
                ast.program.body.unshift(directive);
            }

            const output = generate(ast, {}, code);

            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(code.length)
            );

            editor.edit(editBuilder => {
                editBuilder.replace(fullRange, output.code);
            });

            vscode.window.showInformationMessage('Successfully converted React component to Next.js!');
        } catch (err) {
            vscode.window.showErrorMessage('AST Conversion Error: ' + err.message);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};