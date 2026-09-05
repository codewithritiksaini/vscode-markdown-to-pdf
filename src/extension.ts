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
import { PreviewService } from './services/PreviewService';
import { BrowserSocketTransport } from './transports/BrowserSocketTransport';

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

    // Watch Markdown document changes for Live Preview
    const changeDocSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.document.languageId !== 'markdown') {
            return;
        }
        if (event.contentChanges.length === 0) {
            return;
        }

        try {
            const doc = await buildMarkdownDocument(event.document.uri);
            const previewService = container.get<PreviewService>('PreviewService');
            await previewService.updatePreview(doc);
        } catch (err) {
            logger.error('Failed to trigger live preview update.', err);
        }
    });

    // Helper to refresh active live previews targeting only affected sessions
    const refreshActivePreviews = async (changedUri?: vscode.Uri, force: boolean = false) => {
        try {
            const previewService = container.get<PreviewService>('PreviewService');
            const openDocs = vscode.workspace.textDocuments.filter((d) => d.languageId === 'markdown');
            for (const doc of openDocs) {
                const docUri = doc.uri.toString();
                if (!previewService.transportActive(docUri)) {
                    continue;
                }

                let shouldRefresh = false;
                if (!changedUri) {
                    // Global trigger (configuration)
                    shouldRefresh = true;
                } else {
                    const changedPath = changedUri.fsPath;
                    const ext = path.extname(changedPath).toLowerCase();

                    if (ext === '.md') {
                        shouldRefresh = (doc.uri.toString() === changedUri.toString());
                    } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'].includes(ext)) {
                        const imgName = path.basename(changedPath);
                        shouldRefresh = doc.getText().includes(imgName);
                    } else if (ext === '.css' || ext === '.html') {
                        const docFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
                        const changedFolder = vscode.workspace.getWorkspaceFolder(changedUri);
                        if (docFolder && changedFolder) {
                            shouldRefresh = (docFolder.uri.toString() === changedFolder.uri.toString());
                        } else {
                            shouldRefresh = true;
                        }
                    }
                }

                if (shouldRefresh) {
                    const markdownDoc = await buildMarkdownDocument(doc.uri);
                    await previewService.updatePreview(markdownDoc, force);
                }
            }
        } catch (err) {
            logger.error('Failed to refresh active previews.', err);
        }
    };

    // Watch configuration changes
    const changeConfigSubscription = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('markdownPdf')) {
            await refreshActivePreviews(undefined, true);
        }
    });

    // Dedicated file system watchers for images
    const imageWatcher = vscode.workspace.createFileSystemWatcher('**/*.{png,jpg,jpeg,gif,svg,webp,avif}');
    imageWatcher.onDidChange((uri) => refreshActivePreviews(uri, true));
    imageWatcher.onDidCreate((uri) => refreshActivePreviews(uri, true));
    imageWatcher.onDidDelete((uri) => refreshActivePreviews(uri, true));

    // Watch closed documents: log cleanup without killing active browser session
    const closeDocSubscription = vscode.workspace.onDidCloseTextDocument((document) => {
        if (document.languageId !== 'markdown') {
            return;
        }
        logger.info(`Editor closed for document: ${document.uri.toString()}`);
    });

    // Watch custom CSS file changes specifically (including those outside workspace)
    const watchCustomCSS = () => {
        const getCustomCssPath = () => {
            const rawPath = vscode.workspace.getConfiguration('markdownPdf').get<string>('customCSSPath') || '';
            if (!rawPath.trim()) return '';
            if (path.isAbsolute(rawPath)) return rawPath;
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                return path.resolve(workspaceFolders[0].uri.fsPath, rawPath);
            }
            return '';
        };
        let currentPath = getCustomCssPath();
        let watcher: vscode.FileSystemWatcher | null = null;

        const rebuildWatcher = () => {
            if (watcher) {
                watcher.dispose();
                watcher = null;
            }
            if (currentPath) {
                watcher = vscode.workspace.createFileSystemWatcher(currentPath);
                watcher.onDidChange((uri) => refreshActivePreviews(uri, true));
                watcher.onDidCreate((uri) => refreshActivePreviews(uri, true));
                watcher.onDidDelete((uri) => refreshActivePreviews(uri, true));
            }
        };

        rebuildWatcher();

        // Listen to config changes to rebuild custom CSS watcher if path changes
        const configSub = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('markdownPdf.customCSSPath')) {
                currentPath = getCustomCssPath();
                rebuildWatcher();
            }
        });
        context.subscriptions.push(configSub);
        context.subscriptions.push(new vscode.Disposable(() => watcher?.dispose()));
    };

    watchCustomCSS();

    context.subscriptions.push(openInBrowserCmd);
    context.subscriptions.push(changeDocSubscription);
    context.subscriptions.push(changeConfigSubscription);
    context.subscriptions.push(closeDocSubscription);
    context.subscriptions.push(imageWatcher);
    context.subscriptions.push(configService);

    logger.info('Markdown PDF extension activated successfully.');
}

export async function deactivate(): Promise<void> {
    logger.info('Markdown PDF extension deactivating…');
    await BrowserSocketTransport.shutdown();
    previewProvider?.dispose();
    logger.dispose();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMarkdownFile(uri?: vscode.Uri, languageId?: string): boolean {
    if (!uri) return false;
    if (languageId === 'markdown') return true;
    const ext = path.extname(uri.fsPath).toLowerCase();
    return ['.md', '.markdown', '.mdown', '.mkd'].includes(ext);
}

/**
 * Resolves a Uri from the command argument (context-menu click),
 * the active editor, or prompts the user to pick a file.
 */
async function resolveMarkdownUri(uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
    // Context-menu or editor/title click provides uri directly
    if (uri && isMarkdownFile(uri)) {
        return uri;
    }

    // Fallback: active editor
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc && (activeDoc.languageId === 'markdown' || isMarkdownFile(activeDoc.uri))) {
        return activeDoc.uri;
    }

    // Fallback: quick-pick from workspace markdown files
    const files = await vscode.workspace.findFiles('**/*.{md,markdown,mdown,mkd}', '**/node_modules/**', 20);
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
    const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());

    let source: string;
    if (openDoc) {
        source = openDoc.getText();
    } else if (uri.scheme === 'untitled') {
        source = '';
    } else {
        try {
            source = await fs.promises.readFile(filePath, 'utf-8');
        } catch {
            throw new Error(`File not found or inaccessible: ${filePath}`);
        }
    }

    const baseName = uri.scheme === 'untitled'
        ? (openDoc?.fileName || 'Untitled')
        : (path.basename(filePath, path.extname(filePath)) || 'Untitled');

    return { source, filePath, uri, baseName };
}
