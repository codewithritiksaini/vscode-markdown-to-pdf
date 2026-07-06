/**
 * previewProviderLegacy.ts – Legacy VS Code Webview panel flow.
 * Isolated here to maintain clean separation.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownDocument, ExtToWebviewMessage, WebviewToExtMessage, PdfOptions } from '../types';
import { markdownService } from '../markdownService';
import { configService } from '../configService';
import { logger } from '../logger';
import { pdfService } from './pdfService';

// Track legacy panels
const activePanels = new Map<string, vscode.WebviewPanel>();

export class PreviewProviderLegacy {
  constructor(private readonly context: vscode.ExtensionContext) { }

  /**
   * Open (or reveal) the preview panel for the given Markdown document.
   */
  async openPreview(doc: MarkdownDocument): Promise<void> {
    const key = doc.uri.toString();

    // Reuse existing panel if already open
    if (activePanels.has(key)) {
      const existing = activePanels.get(key)!;
      existing.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'markdownPdfPreview',
      `PDF Preview – ${doc.baseName}.md`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.dirname(doc.filePath)),
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ],
      },
    );

    activePanels.set(key, panel);

    // Set icon
    const iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.png');
    panel.iconPath = iconPath;

    // Build and set initial content
    await this.updatePanelContent(panel, doc);

    // Handle messages from the Webview
    panel.webview.onDidReceiveMessage(
      async (raw: WebviewToExtMessage) => {
        switch (raw.type) {
          case 'ready':
            logger.info(`Webview ready for: ${doc.filePath}`);
            break;

          case 'downloadPdf':
            await this.handleDownloadPdf(panel, doc);
            break;

          case 'log':
            logger[raw.level](`[Webview] ${raw.message}`);
            break;
        }
      },
      undefined,
      this.context.subscriptions,
    );

    // Clean up when the panel is closed
    panel.onDidDispose(() => {
      activePanels.delete(key);
      logger.info(`Preview panel closed for: ${doc.filePath}`);
    }, undefined, this.context.subscriptions);

    // React to theme changes
    vscode.window.onDidChangeActiveColorTheme((theme) => {
      const isDark = theme.kind === vscode.ColorThemeKind.Dark ||
        theme.kind === vscode.ColorThemeKind.HighContrast;
      this.postMessage(panel, { type: 'themeChanged', theme: isDark ? 'dark' : 'light' });
    }, undefined, this.context.subscriptions);
  }

  private async updatePanelContent(panel: vscode.WebviewPanel, doc: MarkdownDocument): Promise<void> {
    const htmlContent = markdownService.toHtml(doc.source, path.dirname(doc.filePath));
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;

    const customCSS = await configService.getCustomCSSContent();
    panel.webview.html = this.buildWebviewHtml(panel.webview, htmlContent, isDark, customCSS);
  }

  private async handleDownloadPdf(panel: vscode.WebviewPanel, doc: MarkdownDocument): Promise<void> {
    // Prompt user for save location
    const defaultUri = vscode.Uri.file(
      path.join(path.dirname(doc.filePath), `${doc.baseName}.pdf`),
    );

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'PDF Files': ['pdf'] },
      title: 'Save PDF As',
    });

    if (!saveUri) {
      // User cancelled the dialog
      this.postMessage(panel, { type: 'pdfError', error: 'Save cancelled.' });
      return;
    }

    this.postMessage(panel, { type: 'pdfGenerating' });

    try {
      const config = configService.get();
      const customCSS = await configService.getCustomCSSContent();

      // Build a standalone, print-optimised HTML page for Puppeteer
      const htmlContent = markdownService.toHtml(doc.source, path.dirname(doc.filePath));
      const printHtml = this.buildPrintHtml(htmlContent, customCSS);

      const headerTemplate = `
        <div style="font-size:9px;color:#666;width:100%;text-align:center;padding:4px 0;">
          ${doc.baseName}.md
        </div>`;

      const footerTemplate = `
        <div style="font-size:9px;color:#666;width:100%;text-align:center;padding:4px 0;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`;

      const pdfOptions: PdfOptions = {
        pageSize: config.pageSize,
        margins: config.margins,
        includeHeaderFooter: config.includeHeaderFooter,
        headerTemplate,
        footerTemplate,
        printBackground: true,
        outputPath: saveUri.fsPath,
      };

      await pdfService.generatePdf(printHtml, pdfOptions);

      this.postMessage(panel, { type: 'pdfReady', savedPath: saveUri.fsPath });

      vscode.window.showInformationMessage(
        `✅ PDF saved: ${saveUri.fsPath}`,
        'Open Folder',
      ).then((choice) => {
        if (choice === 'Open Folder') {
          vscode.commands.executeCommand('revealFileInOS', saveUri);
        }
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('PDF generation failed.', err);
      this.postMessage(panel, { type: 'pdfError', error: msg });

      vscode.window.showErrorMessage(`❌ PDF generation failed: ${msg}`, 'Show Logs').then((c) => {
        if (c === 'Show Logs') { logger.show(); }
      });
    }
  }

  private postMessage(panel: vscode.WebviewPanel, message: ExtToWebviewMessage): void {
    panel.webview.postMessage(message).then(undefined, (e) => {
      logger.warn(`postMessage failed: ${String(e)}`);
    });
  }

  private buildWebviewHtml(
    webview: vscode.Webview,
    bodyHtml: string,
    isDark: boolean,
    customCSS: string,
  ): string {
    const nonce = this.generateNonce();

    const previewCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.css'),
    );
    const themeCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', isDark ? 'default-dark.css' : 'default-light.css'),
    );
    const previewJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.js'),
    );

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data: blob:`,
      `font-src ${webview.cspSource} data:`,
    ].join('; ');

    return /* html */`<!DOCTYPE html>
<html lang="en" data-theme="${isDark ? 'dark' : 'light'}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PDF Preview</title>
  <link rel="stylesheet" href="${previewCssUri}" />
  <link rel="stylesheet" href="${themeCssUri}" />
  ${customCSS ? `<style nonce="${nonce}">${customCSS}</style>` : ''}
</head>
<body class="${isDark ? 'vscode-dark' : 'vscode-light'}">

  <main id="content" class="markdown-body">
    ${bodyHtml}
  </main>

  <div class="action-bar">
    <div class="action-bar-inner">
      <span id="status-text" class="status-text">Ready to export</span>
      <button id="download-btn" class="btn-download" title="Generate and save PDF">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M7.47 10.78a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0-1.06-1.06L8.75 8.44V1.75a.75.75 0 0 0-1.5 0v6.69L4.78 5.97a.75.75 0 0 0-1.06 1.06l3.75 3.75Z"/>
          <path d="M1.75 13.25a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75Z"/>
        </svg>
        <span id="btn-label">Download PDF</span>
        <span id="spinner" class="spinner hidden" aria-hidden="true"></span>
      </button>
    </div>
  </div>

  <script nonce="${nonce}" src="${previewJsUri}"></script>
</body>
</html>`;
  }

  private buildPrintHtml(bodyHtml: string, customCSS: string): string {
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>Markdown PDF Export</title>
  <style>
    :root { color-scheme: light only; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      background: #ffffff !important;
      color: #24292f !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans',
                   Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #24292f;
      background: #ffffff;
      max-width: 900px;
      margin: 0 auto;
      padding: 32px 40px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      line-height: 1.25;
      margin-top: 24px;
      margin-bottom: 16px;
      color: #1f2328;
    }
    h1 {
      font-size: 2em;
      font-weight: 700;
      padding-bottom: 0.3em;
      border-bottom: 2px solid #d0d7de;
      margin-top: 0;
    }
    h2 {
      font-size: 1.5em;
      padding-bottom: 0.25em;
      border-bottom: 1px solid #d0d7de;
    }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; color: #57606a; }
    p { margin-bottom: 16px; margin-top: 0; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul, ol {
      padding-left: 2em;
      margin-top: 0;
      margin-bottom: 16px;
    }
    li { margin-top: 0.25em; }
    li + li { margin-top: 0.25em; }
    li > ul, li > ol { margin-bottom: 0; margin-top: 4px; }
    .contains-task-list { list-style: none; padding-left: 0; }
    .task-list-item { display: flex; align-items: flex-start; gap: 6px; }
    .task-list-item input[type="checkbox"] { margin-top: 3px; flex-shrink: 0; }
    blockquote {
      padding: 0 1em;
      color: #57606a;
      border-left: 0.25em solid #d0d7de;
      margin: 0 0 16px 0;
    }
    blockquote > :first-child { margin-top: 0; }
    blockquote > :last-child { margin-bottom: 0; }
    code {
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
                   'Liberation Mono', monospace;
      font-size: 85%;
      background-color: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 0.2em 0.4em;
      color: #e01e5a;
      white-space: break-spaces;
    }
    pre {
      margin: 0 0 16px 0;
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: #f6f8fa;
      border-radius: 6px;
      border: 1px solid #d0d7de;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      border: 0;
      border-radius: 0;
      color: #24292f;
      padding: 0;
      font-size: 100%;
      white-space: pre;
      word-break: normal;
    }
    pre.hljs {
      background-color: #f6f8fa;
      color: #24292f;
      border: 1px solid #d0d7de;
    }
    pre.hljs code { color: #24292f; background: transparent; border: 0; padding: 0; }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
      overflow: auto;
      page-break-inside: avoid;
    }
    thead tr {
      background-color: #f6f8fa;
      border-top: 1px solid #d0d7de;
    }
    th, td {
      padding: 6px 13px;
      border: 1px solid #d0d7de;
      text-align: left;
    }
    th {
      font-weight: 600;
      background-color: #f6f8fa;
    }
    tr { background-color: #ffffff; }
    tr:nth-child(2n) { background-color: #f6f8fa; }
    td:first-child, th:first-child { border-left: 1px solid #d0d7de; }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 8px 0;
      border-radius: 4px;
      box-sizing: content-box;
    }
    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #d0d7de;
      border: 0;
    }
    .header-anchor { display: none; }
    @media print {
      body { padding: 0; background: #fff !important; color: #24292f !important; }
      pre { white-space: pre-wrap; word-break: break-word; }
      a { color: #0969da; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      h1, h2, h3 { page-break-after: avoid; }
      img { page-break-inside: avoid; }
    }
    ${customCSS}
  </style>
</head>
<body>
  <article>
    ${bodyHtml}
  </article>
</body>
</html>`;
  }

  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  dispose(): void {
    for (const panel of activePanels.values()) {
      panel.dispose();
    }
    activePanels.clear();
  }
}
