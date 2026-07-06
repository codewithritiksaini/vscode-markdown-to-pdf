import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PipelineStep, GeneratedHtml, GeneratedFile } from './Pipeline';

export class TempFileManagerStep implements PipelineStep<GeneratedHtml, GeneratedFile> {
    constructor(private readonly fileManager: TempFileManager) {}

    async execute(context: GeneratedHtml): Promise<GeneratedFile> {
        const tempFilePath = await this.fileManager.writeTempFile(context.htmlContent, context.document.baseName);
        return { document: context.document, tempFilePath };
    }
}

export class TempFileManager {
    async writeTempFile(htmlContent: string, baseName: string): Promise<string> {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `md-preview-${baseName}-${Date.now()}.html`);
        await fs.promises.writeFile(tmpFile, htmlContent, 'utf-8');
        return tmpFile;
    }
}
