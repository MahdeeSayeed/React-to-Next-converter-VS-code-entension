const vscode = require('vscode');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

/**
 * Transforms standard React JSX string into Next.js compatible JSX string
 */
function transformReactToNext(code) {
    // 1. Parse the input React code into an AST
    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });

    let usesHooks = false;
    let replacesImgTag = false;

    // 2. Traverse and modify the AST nodes
    traverse(ast, {
        // Detect React Client Hooks (e.g., useState, useEffect)
        CallExpression(path) {
            if (
                t.isIdentifier(path.node.callee) &&
                /^use[A-Z]/.test(path.node.callee.name)
            ) {
                usesHooks = true;
            }
        },

        // Convert react-router-dom Link import to next/link
        ImportDeclaration(path) {
            if (path.node.source.value === 'react-router-dom') {
                path.node.source.value = 'next/link';
            }
        },

        // Convert <img> elements into Next.js <Image /> elements
        JSXElement(path) {
            const openingElement = path.node.openingElement;
            if (t.isJSXIdentifier(openingElement.name, { name: 'img' })) {
                replacesImgTag = true;

                // Rename 'img' tag to 'Image'
                openingElement.name.name = 'Image';
                if (path.node.closingElement) {
                    path.node.closingElement.name.name = 'Image';
                }

                // Ensure default width and height attributes exist if missing
                const hasWidth = openingElement.attributes.some(attr => 
                    t.isJSXAttribute(attr) && attr.name.name === 'width'
                );
                const hasHeight = openingElement.attributes.some(attr => 
                    t.isJSXAttribute(attr) && attr.name.name === 'height'
                );

                if (!hasWidth) {
                    openingElement.attributes.push(
                        t.jsxAttribute(
                            t.jsxIdentifier('width'),
                            t.jsxExpressionContainer(t.numericLiteral(500))
                        )
                    );
                }
                if (!hasHeight) {
                    openingElement.attributes.push(
                        t.jsxAttribute(
                            t.jsxIdentifier('height'),
                            t.jsxExpressionContainer(t.numericLiteral(300))
                        )
                    );
                }
            }
        }
    });

    // 3. Generate transformed code from modified AST
    let transformedCode = generate(ast, { retainLines: true }).code;

    // 4. Prepend Next.js 'use client' directive if hooks were detected
    if (usesHooks && !transformedCode.includes("'use client'") && !transformedCode.includes('"use client"')) {
        transformedCode = `'use client';\n\n` + transformedCode;
    }

    return transformedCode;
}

function activate(context) {
    let disposable = vscode.commands.registerCommand('react-to-next-converter.convert', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection.isEmpty ? undefined : selection);

        if (!text || text.trim() === '') {
            vscode.window.showWarningMessage('Please select or open some React JSX code to convert.');
            return;
        }

        try {
            const convertedText = transformReactToNext(text);

            await editor.edit(editBuilder => {
                if (selection.isEmpty) {
                    // Replace entire document if nothing is highlighted
                    const fullRange = new vscode.Range(
                        editor.document.positionAt(0),
                        editor.document.positionAt(editor.document.getText().length)
                    );
                    editBuilder.replace(fullRange, convertedText);
                } else {
                    // Replace highlighted text
                    editBuilder.replace(selection, convertedText);
                }
            });

            vscode.window.showInformationMessage('Successfully converted React code to Next.js!');
        } catch (error) {
            vscode.window.showErrorMessage(`Transformation failed: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};