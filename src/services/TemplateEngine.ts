import * as fs from 'fs';
import { PipelineStep, ResolvedAssetsDocument, GeneratedHtml } from './Pipeline';
import { configService } from '../configService';

export interface TemplateEngine {
    build(bodyHtml: string, title: string, customCSS: string): Promise<string>;
}

export class TemplateStep implements PipelineStep<ResolvedAssetsDocument, GeneratedHtml> {
    constructor(private readonly engine: TemplateEngine) {}

    async execute(input: ResolvedAssetsDocument): Promise<GeneratedHtml> {
        const customCSS = await configService.getCustomCSSContent();
        const htmlContent = await this.engine.build(input.html, input.document.baseName, customCSS);

        return { document: input.document, htmlContent };
    }
}

export class DefaultTemplateEngine implements TemplateEngine {
    constructor(
        private readonly htmlTemplatePath: string,
        private readonly cssTemplatePath: string
    ) {}

    async build(bodyHtml: string, title: string, customCSS: string): Promise<string> {
        const htmlTemplate = await fs.promises.readFile(this.htmlTemplatePath, 'utf-8');
        const cssTemplate = await fs.promises.readFile(this.cssTemplatePath, 'utf-8');

        return htmlTemplate
            .replace(/\{\{TITLE\}\}/g, title)
            .replace(/\{\{STYLE\}\}/g, cssTemplate)
            .replace(/\{\{CUSTOM_CSS\}\}/g, customCSS)
            .replace(/\{\{BODY\}\}/g, bodyHtml);
    }
}
