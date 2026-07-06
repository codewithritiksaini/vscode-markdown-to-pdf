import { MarkdownDocument } from '../types';

export interface PipelineStep<TIn, TOut> {
    execute(input: TIn): Promise<TOut> | TOut;
}

// ---------------------------------------------------------------------------
// Pipeline Immutable Stage Interfaces
// ---------------------------------------------------------------------------

export interface RenderedDocument {
    readonly document: MarkdownDocument;
    readonly html: string;
}

export interface ResolvedAssetsDocument {
    readonly document: MarkdownDocument;
    readonly html: string;
}

export interface GeneratedHtml {
    readonly document: MarkdownDocument;
    readonly htmlContent: string;
}

export interface GeneratedFile {
    readonly document: MarkdownDocument;
    readonly tempFilePath: string;
}

export interface BrowserLaunchRequest {
    readonly document: MarkdownDocument;
    readonly tempFilePath: string;
}

// ---------------------------------------------------------------------------
// Preview Pipeline Coordinator
// ---------------------------------------------------------------------------

export class PreviewPipeline {
    constructor(
        private readonly renderer: PipelineStep<MarkdownDocument, RenderedDocument>,
        private readonly resolver: PipelineStep<RenderedDocument, ResolvedAssetsDocument>,
        private readonly templateStep: PipelineStep<ResolvedAssetsDocument, GeneratedHtml>,
        private readonly fileManager: PipelineStep<GeneratedHtml, GeneratedFile>,
        private readonly launcher: PipelineStep<GeneratedFile, BrowserLaunchRequest>
    ) {}

    async run(doc: MarkdownDocument): Promise<BrowserLaunchRequest> {
        const rendered = await this.renderer.execute(doc);
        const resolved = await this.resolver.execute(rendered);
        const htmlGenerated = await this.templateStep.execute(resolved);
        const fileGenerated = await this.fileManager.execute(htmlGenerated);
        return await this.launcher.execute(fileGenerated);
    }
}
