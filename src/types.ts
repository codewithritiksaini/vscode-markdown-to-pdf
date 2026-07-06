/**
 * Shared type definitions for the Markdown to PDF extension.
 */

import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Margin settings for the generated PDF. */
export interface PdfMargins {
    top: string;
    bottom: string;
    left: string;
    right: string;
}

/** Full extension configuration resolved from workspace settings. */
export interface ExtensionConfig {
    pageSize: string;
    margins: PdfMargins;
    customCSSPath: string;
    includeHeaderFooter: boolean;
    highlightTheme: string;
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

/** Options forwarded to Puppeteer when printing to PDF. */
export interface PdfOptions {
    pageSize: string;
    margins: PdfMargins;
    includeHeaderFooter: boolean;
    headerTemplate: string;
    footerTemplate: string;
    printBackground: boolean;
    outputPath: string;
}

// ---------------------------------------------------------------------------
// Webview message protocol
// ---------------------------------------------------------------------------

/** Messages sent FROM the Webview to the extension host. */
export type WebviewToExtMessage =
    | { type: 'ready' }
    | { type: 'downloadPdf' }
    | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string };

/** Messages sent FROM the extension host TO the Webview. */
export type ExtToWebviewMessage =
    | { type: 'pdfGenerating' }
    | { type: 'pdfReady'; savedPath: string }
    | { type: 'pdfError'; error: string }
    | { type: 'themeChanged'; theme: 'light' | 'dark' };

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

export interface MarkdownDocument {
    /** Raw Markdown source text. */
    source: string;
    /** Absolute path to the .md file on disk. */
    filePath: string;
    /** VS Code URI of the file. */
    uri: vscode.Uri;
    /** Filename without extension, used as default PDF name. */
    baseName: string;
}

// ---------------------------------------------------------------------------
// Pipeline Context
// ---------------------------------------------------------------------------

export interface RenderContext {
    document: MarkdownDocument;
    html: string;
}

