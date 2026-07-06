/**
 * PdfService – manages a singleton Puppeteer browser instance for PDF generation.
 *
 * Design decisions:
 *  - Lazy init: browser is launched only on first PDF request.
 *  - Restart on crash: the "disconnected" event triggers a clean-up so the
 *    next call recreates the browser automatically.
 *  - No memory leaks: each request opens one Page, closes it after use.
 *  - Extension deactivation: dispose() force-closes Chromium.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { Browser, Page, PDFOptions } from 'puppeteer-core';
import { logger } from '../logger';
import { PdfOptions } from '../types';

// ---------------------------------------------------------------------------
// Chromium resolver
// ---------------------------------------------------------------------------

/**
 * Find a usable Chromium / Chrome binary.
 * Priority:
 *  1. PUPPETEER_EXECUTABLE_PATH env var (user override)
 *  2. Common system paths on Linux / macOS / Windows
 */
function findChromiumPath(): string {
    if (process.env['PUPPETEER_EXECUTABLE_PATH']) {
        return process.env['PUPPETEER_EXECUTABLE_PATH'];
    }

    const candidates: string[] = [];

    switch (process.platform) {
        case 'linux':
            candidates.push(
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/snap/bin/chromium',
            );
            break;
        case 'darwin':
            candidates.push(
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
            );
            break;
        case 'win32':
            candidates.push(
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
            );
            break;
    }

    for (const c of candidates) {
        if (fs.existsSync(c)) { return c; }
    }

    throw new Error(
        'No Chromium/Chrome executable found. Install Chrome or set the ' +
        'PUPPETEER_EXECUTABLE_PATH environment variable to its path.',
    );
}

// ---------------------------------------------------------------------------
// PdfService
// ---------------------------------------------------------------------------

export class PdfService {
    /** Singleton browser; null when not yet launched or after crash/dispose. */
    private browser: Browser | null = null;
    /** Prevent concurrent launches. */
    private launchPromise: Promise<Browser> | null = null;

    /** Lazily returns a running Browser instance. */
    private async getBrowser(): Promise<Browser> {
        if (this.browser) { return this.browser; }

        // Coalesce concurrent requests to a single launch.
        if (!this.launchPromise) {
            this.launchPromise = this.launchBrowser();
        }

        try {
            this.browser = await this.launchPromise;
            return this.browser;
        } finally {
            this.launchPromise = null;
        }
    }

    private async launchBrowser(): Promise<Browser> {
        const executablePath = findChromiumPath();
        logger.info(`Launching Chromium: ${executablePath}`);

        // Dynamic require so puppeteer-core is not imported at activation time.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const puppeteer = await import('puppeteer-core');

        const browser: Browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--force-color-profile=srgb',          // accurate colours in PDF
                '--disable-features=IsolateOrigins',
            ],
        });

        // Auto-clean state if Chromium crashes or is killed externally.
        browser.on('disconnected', () => {
            logger.warn('Puppeteer browser disconnected – will relaunch on next request.');
            this.browser = null;
        });

        logger.info('Puppeteer browser launched successfully.');
        return browser;
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Render `htmlContent` to a PDF file at `options.outputPath`.
     * Opens a fresh Page per call and closes it when done.
     */
    async generatePdf(htmlContent: string, options: PdfOptions): Promise<void> {
        const browser = await this.getBrowser();
        const page: Page = await browser.newPage();

        try {
            // Set viewport for consistent rendering
            await page.setViewport({ width: 1280, height: 900 });

            // Load HTML directly; base URL set to avoid CSP issues from puppeteer
            await page.setContent(htmlContent, {
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 30_000,
            });

            // Build PDF options for Puppeteer
            const pdfOptions: PDFOptions = {
                path: options.outputPath,
                format: options.pageSize as 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | 'Tabloid',
                margin: {
                    top: options.margins.top,
                    bottom: options.margins.bottom,
                    left: options.margins.left,
                    right: options.margins.right,
                },
                printBackground: options.printBackground,
            };

            if (options.includeHeaderFooter) {
                pdfOptions.displayHeaderFooter = true;
                pdfOptions.headerTemplate = options.headerTemplate;
                pdfOptions.footerTemplate = options.footerTemplate;
            } else {
                pdfOptions.displayHeaderFooter = false;
            }

            await page.pdf(pdfOptions);
            logger.info(`PDF written to: ${options.outputPath}`);
        } finally {
            // Always close the page to free memory.
            await page.close().catch((e) => logger.warn(`Page close error: ${String(e)}`));
        }
    }

    /** Release the browser. Called from extension deactivate(). */
    async dispose(): Promise<void> {
        if (this.browser) {
            logger.info('Closing Puppeteer browser on deactivate.');
            await this.browser.close().catch((e) => logger.warn(`Browser close error: ${String(e)}`));
            this.browser = null;
        }
    }
}

// Singleton shared across the extension.
export const pdfService = new PdfService();
