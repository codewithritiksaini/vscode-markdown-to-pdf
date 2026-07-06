import * as path from 'path';
import { PipelineStep, RenderedDocument, ResolvedAssetsDocument } from './Pipeline';

export interface AssetResolverPlugin {
    resolve(html: string, baseDir: string): Promise<string> | string;
}

export class AssetResolver implements PipelineStep<RenderedDocument, ResolvedAssetsDocument> {
    private readonly plugins: AssetResolverPlugin[] = [];

    registerPlugin(plugin: AssetResolverPlugin): void {
        this.plugins.push(plugin);
    }

    async execute(input: RenderedDocument): Promise<ResolvedAssetsDocument> {
        const baseDir = path.dirname(input.document.filePath);
        let html = input.html;

        for (const plugin of this.plugins) {
            html = await plugin.resolve(html, baseDir);
        }

        return { document: input.document, html };
    }
}
