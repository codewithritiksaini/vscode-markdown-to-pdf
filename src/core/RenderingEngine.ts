import { MarkdownDocument } from '../types';
import { RenderResult } from './RenderResult';
import { PipelineStep, RenderedDocument, ResolvedAssetsDocument, GeneratedHtml } from '../services/Pipeline';

export interface RenderingEngine {
    render(doc: MarkdownDocument): Promise<RenderResult>;
}

export class DefaultRenderingEngine implements RenderingEngine {
    constructor(
        private readonly renderer: PipelineStep<MarkdownDocument, RenderedDocument>,
        private readonly resolver: PipelineStep<RenderedDocument, ResolvedAssetsDocument>,
        private readonly templateStep: PipelineStep<ResolvedAssetsDocument, GeneratedHtml>
    ) {}

    async render(doc: MarkdownDocument): Promise<RenderResult> {
        const rendered = await this.renderer.execute(doc);
        const resolved = await this.resolver.execute(rendered);
        const htmlGenerated = await this.templateStep.execute(resolved);

        return {
            document: doc,
            html: resolved.html,
            rawAst: null,
            assets: [],
            metadata: {
                outline: [],
                customCSS: '',
                htmlContent: htmlGenerated.htmlContent,
            },
        };
    }
}
