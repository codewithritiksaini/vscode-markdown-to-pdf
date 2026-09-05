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
    constructor(private readonly engine: TemplateEngine) {}

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
    ) {}

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

    async build(bodyHtml: string, title: string, customCSS: string): Promise<string> {
        const { htmlTemplate, cssTemplate } = await this.getTemplates();
        const safeTitle = escapeHtml(title);

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
            .replace(/\{\{BODY\}\}/g, () => bodyHtml);
    }
}
