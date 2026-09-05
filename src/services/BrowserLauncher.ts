import * as vscode from 'vscode';
import { PipelineStep, GeneratedFile, BrowserLaunchRequest } from './Pipeline';
import { logger } from '../logger';

export class BrowserLauncherStep implements PipelineStep<GeneratedFile, BrowserLaunchRequest> {
    constructor(private readonly launcher: BrowserLauncher) {}

    async execute(context: GeneratedFile): Promise<BrowserLaunchRequest> {
        await this.launcher.launch(context.tempFilePath);
        return context;
    }
}

export class BrowserLauncher {
    async launch(filePath: string): Promise<void> {
        let uri: vscode.Uri;
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            uri = vscode.Uri.parse(filePath);
        } else if (filePath.startsWith('file://')) {
            uri = vscode.Uri.parse(filePath);
        } else {
            uri = vscode.Uri.file(filePath);
        }

        logger.info(`Opening preview via vscode.env.openExternal: ${uri.toString()}`);
        const success = await vscode.env.openExternal(uri);
        if (!success) {
            logger.warn(`vscode.env.openExternal reported false for ${uri.toString()}`);
        }
    }
}
