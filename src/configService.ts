/**
 * ConfigService – reads and validates workspace settings for the extension.
 * Provides a single source of truth for all configuration values.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { ExtensionConfig, PdfMargins } from './types';
import { logger } from './logger';

// ---------------------------------------------------------------------------

const SECTION = 'markdownPdf';

const DEFAULTS: ExtensionConfig = {
    pageSize: 'A4',
    margins: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    customCSSPath: '',
    includeHeaderFooter: true,
    highlightTheme: 'github',
};

// ---------------------------------------------------------------------------

export class ConfigService {
    private _config: ExtensionConfig = { ...DEFAULTS };
    private readonly _onConfigChanged = new vscode.EventEmitter<ExtensionConfig>();

    /** Fired whenever VS Code settings for the extension change. */
    readonly onConfigChanged = this._onConfigChanged.event;

    constructor() {
        this.reload();

        // Listen for VS Code settings changes.
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(SECTION)) {
                this.reload();
                this._onConfigChanged.fire(this._config);
            }
        });
    }

    /** Returns the current resolved configuration (immutable snapshot). */
    get(): Readonly<ExtensionConfig> {
        return this._config;
    }

    /** Load custom CSS content from disk if `customCSSPath` is set. */
    async getCustomCSSContent(): Promise<string> {
        const customPath = this._config.customCSSPath.trim();
        if (!customPath) { return ''; }

        try {
            await fs.promises.access(customPath, fs.constants.F_OK);
            return await fs.promises.readFile(customPath, 'utf-8');
        } catch (err) {
            logger.error(`Failed to read custom CSS from "${customPath}".`, err);
            return '';
        }
    }

    private reload(): void {
        const ws = vscode.workspace.getConfiguration(SECTION);

        const rawMargins = ws.get<Partial<PdfMargins>>('margins', DEFAULTS.margins);

        this._config = {
            pageSize: ws.get<string>('pageSize', DEFAULTS.pageSize),
            margins: {
                top: rawMargins.top ?? DEFAULTS.margins.top,
                bottom: rawMargins.bottom ?? DEFAULTS.margins.bottom,
                left: rawMargins.left ?? DEFAULTS.margins.left,
                right: rawMargins.right ?? DEFAULTS.margins.right,
            },
            customCSSPath: ws.get<string>('customCSSPath', DEFAULTS.customCSSPath),
            includeHeaderFooter: ws.get<boolean>('includeHeaderFooter', DEFAULTS.includeHeaderFooter),
            highlightTheme: ws.get<string>('highlightTheme', DEFAULTS.highlightTheme),
        };

        logger.info(`Config loaded: ${JSON.stringify(this._config)}`);
    }

    dispose(): void {
        this._onConfigChanged.dispose();
    }
}

// Singleton shared across the extension.
export const configService = new ConfigService();
