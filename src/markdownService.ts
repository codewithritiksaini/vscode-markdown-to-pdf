/**
 * MarkdownService – converts raw Markdown to a self-contained HTML string.
 *
 * Features:
 *  - GitHub Flavored Markdown via markdown-it + plugins
 *  - Task list checkboxes
 *  - Relative image paths inlined as data: URIs for CSP safety
 *  - highlight.js code-block class applied for syntax highlighting
 *  - Anchor ids on headings for TOC/navigation
 */

import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import anchor from 'markdown-it-anchor';
import { logger } from './logger';

// ---------------------------------------------------------------------------

/** Build a markdown-it instance configured for GFM-like output. */
function createRenderer(): MarkdownIt {
    const md = new MarkdownIt({
        html: true,       // allow inline HTML in source
        linkify: true,    // auto-linkify URLs
        typographer: true,// smart quotes / em-dashes
        breaks: false,
        highlight: (str: string, lang: string): string => {
            // Emit a fenced block with data-lang attribute; actual highlighting
            // is handled by highlight.js loaded in the Webview.
            const escaped = str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            return `<pre class="hljs"><code class="language-${lang || 'plaintext'}">${escaped}</code></pre>`;
        },
    });

    // GitHub-style task lists  [ ] / [x]
    md.use(taskLists, { enabled: true, label: true });

    // Add id anchors to headings for internal links
    md.use(anchor, { permalink: anchor.permalink.linkInsideHeader() });

    return md;
}

// ---------------------------------------------------------------------------

/** Resolve relative image src values to data: URIs so they work in Webview + PDF. */
function inlineImages(html: string, baseDir: string): string {
    return html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/gi, (_match, before, src, after) => {
        // Skip already-inlined or remote images
        if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
            return `<img${before}src="${src}"${after}>`;
        }

        try {
            const absPath = path.isAbsolute(src) ? src : path.resolve(baseDir, src);

            if (!fs.existsSync(absPath)) {
                logger.warn(`Image not found: ${absPath}`);
                return `<img${before}src="${src}"${after}>`;
            }

            const ext = path.extname(absPath).slice(1).toLowerCase();
            const mimeMap: Record<string, string> = {
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                gif: 'image/gif',
                svg: 'image/svg+xml',
                webp: 'image/webp',
            };
            const mime = mimeMap[ext] ?? 'image/png';
            const b64 = fs.readFileSync(absPath).toString('base64');
            return `<img${before}src="data:${mime};base64,${b64}"${after}>`;
        } catch (err) {
            logger.error(`Failed to inline image "${src}".`, err);
            return `<img${before}src="${src}"${after}>`;
        }
    });
}

// ---------------------------------------------------------------------------

export class MarkdownService {
    private readonly md: MarkdownIt;

    constructor() {
        this.md = createRenderer();
    }

    /**
     * Convert Markdown source to an HTML fragment (no <html>/<head> wrapper).
     * Images are inlined as data: URIs relative to `baseDir`.
     */
    toHtml(source: string, baseDir: string): string {
        const raw = this.md.render(source);
        return inlineImages(raw, baseDir);
    }
}

// Singleton shared across the extension.
export const markdownService = new MarkdownService();
