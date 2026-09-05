import * as fs from 'fs';
import { PipelineStep, ResolvedAssetsDocument, GeneratedHtml } from './Pipeline';
import { configService } from '../configService';
import { getHighlightThemeCss } from './ThemeService';

export interface TemplateEngine {
    build(bodyHtml: string, title: string, customCSS: string): Promise<string>;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export class TemplateStep implements PipelineStep<ResolvedAssetsDocument, GeneratedHtml> {
    constructor(private readonly engine: TemplateEngine) { }

    async execute(input: ResolvedAssetsDocument): Promise<GeneratedHtml> {
        const customCSS = await configService.getCustomCSSContent();
        const htmlContent = await this.engine.build(input.html, input.document.baseName, customCSS);

        return { document: input.document, htmlContent, customCSS };
    }
}

export class DefaultTemplateEngine implements TemplateEngine {
    private cachedHtmlTemplate: string | null = null;
    private cachedCssTemplate: string | null = null;

    constructor(
        private readonly htmlTemplatePath: string,
        private readonly cssTemplatePath: string
    ) { }

    private async getTemplates(): Promise<{ htmlTemplate: string; cssTemplate: string }> {
        if (!this.cachedHtmlTemplate) {
            this.cachedHtmlTemplate = await fs.promises.readFile(this.htmlTemplatePath, 'utf-8');
        }
        if (!this.cachedCssTemplate) {
            this.cachedCssTemplate = await fs.promises.readFile(this.cssTemplatePath, 'utf-8');
        }
        return {
            htmlTemplate: this.cachedHtmlTemplate,
            cssTemplate: this.cachedCssTemplate,
        };
    }

    /**
     * Wrap every top-level &lt;table&gt; in a .table-wrapper scroll container.
     *
     * Uses a depth-tracking tag scanner instead of a regex so that:
     *  - Nested &lt;table&gt; elements inside a table do NOT produce double-wrapped
     *    or mis-split output (a variable-length lookbehind regex would crash V8).
     *  - The full outer table (from &lt;table to &lt;/table&gt;) is captured correctly.
     */
    private wrapTables(html: string): string {
        const out: string[] = [];
        let pos = 0;
        let depth = 0;
        let tableStart = -1;

        while (pos < html.length) {
            const lt = html.indexOf('<', pos);
            if (lt === -1) {
                // No more tags — flush remaining content
                out.push(html.slice(pos));
                break;
            }

            // ---- Opening <table[ >] ----
            if (html.startsWith('<table', lt) && /[\s>/]/.test(html[lt + 6] ?? '')) {
                if (depth === 0) {
                    out.push(html.slice(pos, lt)); // content before this table
                    tableStart = lt;
                }
                depth++;
                const gt = html.indexOf('>', lt);
                pos = gt === -1 ? lt + 1 : gt + 1;
                continue;
            }

            // ---- Closing </table> ----
            if (html.startsWith('</table>', lt)) {
                if (depth > 0) {
                    depth--;
                    if (depth === 0 && tableStart !== -1) {
                        const tableEnd = lt + 8; // '</table>'.length
                        out.push('<div class="table-wrapper">');
                        out.push(html.slice(tableStart, tableEnd));
                        out.push('</div>');
                        tableStart = -1;
                        pos = tableEnd;
                        continue;
                    }
                }
                pos = lt + 8;
                continue;
            }

            // ---- Any other tag ----
            const gt = html.indexOf('>', lt);
            const tagEnd = gt === -1 ? lt + 1 : gt + 1;
            if (depth === 0) {
                // Outside a table: push content (text + tag) verbatim
                out.push(html.slice(pos, tagEnd));
            }
            pos = tagEnd;
        }

        // Unclosed table (shouldn't happen with markdown-it output)
        if (tableStart !== -1) {
            out.push(html.slice(tableStart));
        }

        return out.join('');
    }

    /** Invalidate the in-memory template cache so the next render re-reads from disk. */
    public clearTemplateCache(): void {
        this.cachedHtmlTemplate = null;
        this.cachedCssTemplate = null;
    }

    async build(bodyHtml: string, title: string, customCSS: string): Promise<string> {
        const { htmlTemplate, cssTemplate } = await this.getTemplates();
        const safeTitle = escapeHtml(title);
        const wrappedBody = this.wrapTables(bodyHtml);

        const config = configService.get();
        const themeCss = getHighlightThemeCss(config.highlightTheme);
        const margins = config.margins || { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' };
        const pageSize = config.pageSize || 'A4';
        const hideHeaderCss = config.includeHeaderFooter ? '' : '.page-header { display: none !important; }';

        const printPageCss = `
${themeCss}

@media print {
  @page {
    size: ${pageSize};
    margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
  }
  ${hideHeaderCss}
}
`;

        const combinedStyle = `${cssTemplate}\n${printPageCss}`;

        return htmlTemplate
            .replace(/\{\{TITLE\}\}/g, () => safeTitle)
            .replace(/\{\{STYLE\}\}/g, () => combinedStyle)
            .replace(/\{\{CUSTOM_CSS\}\}/g, () => customCSS)
            .replace(/\{\{BODY\}\}/g, () => wrappedBody);
    }
}
