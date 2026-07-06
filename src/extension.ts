/**
 * extension.ts – Entry point for the Markdown to PDF VS Code extension.
 *
 * Responsibilities:
 *  - Register the `markdownPdf.openPreview` command
 *  - Wire up context-menu and command palette activations
 *  - Dispose all services cleanly on deactivate
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PreviewProvider } from './previewProvider';
import { configService } from './configService';
import { logger } from './logger';
import { MarkdownDocument } from './types';
import { bootstrapContainer } from './services/bootstrap';

// ---------------------------------------------------------------------------

let previewProvider: PreviewProvider | null = null;

// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
    logger.info('Markdown PDF extension activating…');

    const container = bootstrapContainer(context.extensionPath);
    previewProvider = new PreviewProvider(context, container);

    // Register the open-in-browser command (only command)
    const openInBrowserCmd = vscode.commands.registerCommand(
        'markdownPdf.openInBrowser',
        async (uri?: vscode.Uri) => {
            try {
                const resolvedUri = await resolveMarkdownUri(uri);
                if (!resolvedUri) { return; }

                const doc = await buildMarkdownDocument(resolvedUri);
                await previewProvider!.openInBrowser(doc);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error('Failed to open in browser.', err);
                vscode.window.showErrorMessage(`Markdown PDF: ${msg}`);
            }
        },
    );

    context.subscriptions.push(openInBrowserCmd);
    context.subscriptions.push(configService);

    logger.info('Markdown PDF extension activated successfully.');
}

export async function deactivate(): Promise<void> {
    logger.info('Markdown PDF extension deactivating…');
    previewProvider?.dispose();
    logger.dispose();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a Uri from the command argument (context-menu click),
 * the active editor, or prompts the user to pick a file.
 */
async function resolveMarkdownUri(uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
    // Context-menu or editor/title click provides uri directly
    if (uri && uri.fsPath.endsWith('.md')) {
        return uri;
    }

    // Fallback: active editor
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc && activeDoc.uri.fsPath.endsWith('.md')) {
        return activeDoc.uri;
    }

    // Fallback: quick-pick from workspace .md files
    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**', 20);
    if (files.length === 0) {
        vscode.window.showWarningMessage('No Markdown files found in this workspace.');
        return undefined;
    }

    const picks = files.map((f) => ({
        label: path.basename(f.fsPath),
        description: vscode.workspace.asRelativePath(f),
        uri: f,
    }));

    const picked = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Select a Markdown file to preview as PDF',
        title: 'Markdown to PDF – Select File',
    });

    return picked?.uri;
}

async function buildMarkdownDocument(uri: vscode.Uri): Promise<MarkdownDocument> {
    const filePath = uri.fsPath;

    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
    } catch {
        throw new Error(`File not found: ${filePath}`);
    }

    // Prefer reading from VS Code's text model (unsaved changes) if open
    const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    const source = openDoc ? openDoc.getText() : await fs.promises.readFile(filePath, 'utf-8');

    const baseName = path.basename(filePath, path.extname(filePath));

    return { source, filePath, uri, baseName };
}
