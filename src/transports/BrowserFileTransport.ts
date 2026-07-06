import { Transport } from '../core/Transport';
import { RenderResult } from '../core/RenderResult';
import { PipelineStep, GeneratedFile, GeneratedHtml } from '../services/Pipeline';

export class BrowserFileTransport implements Transport {
    constructor(
        private readonly fileManager: PipelineStep<GeneratedHtml, GeneratedFile>,
        private readonly launcher: PipelineStep<GeneratedFile, any>
    ) {}

    async send(result: RenderResult): Promise<string> {
        const htmlGenerated: GeneratedHtml = {
            document: result.document,
            htmlContent: result.metadata.htmlContent,
        };

        const fileGenerated = await this.fileManager.execute(htmlGenerated);
        await this.launcher.execute(fileGenerated);
        return fileGenerated.tempFilePath;
    }
}
