import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ServiceContainer } from './ServiceContainer';
import { EventBus } from './EventBus';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AssetResolver } from './AssetResolver';
import { LocalImageAssetResolver } from './LocalImageAssetResolver';
import { DefaultTemplateEngine, TemplateStep } from './TemplateEngine';
import { TempFileManager, TempFileManagerStep } from './TempFileManager';
import { BrowserLauncher, BrowserLauncherStep } from './BrowserLauncher';
import { PreviewService } from './PreviewService';
import { DefaultRenderingEngine } from '../core/RenderingEngine';
import { BrowserFileTransport } from '../transports/BrowserFileTransport';
import { BrowserSocketTransport } from '../transports/BrowserSocketTransport';
import { logger } from '../logger';

/**
 * Clean up old markdown temporary files (from previous runs) asynchronously on activation.
 */
async function cleanupOldTempFiles(): Promise<void> {
    try {
        const tmpDir = os.tmpdir();
        const files = await fs.promises.readdir(tmpDir);
        for (const file of files) {
            if (file.startsWith('md-preview-') && file.endsWith('.html')) {
                const filePath = path.join(tmpDir, file);
                await fs.promises.unlink(filePath).catch(() => {});
            }
        }
    } catch {
        logger.warn('Failed to clean up old temporary files.');
    }
}

export function bootstrapContainer(extensionPath: string): ServiceContainer {
    const container = new ServiceContainer();

    // 1. Trigger asynchronous startup cleanup (fire-and-forget)
    cleanupOldTempFiles();

    // 2. Initialize Event Bus and wire up logging + temp file auto-cleanup
    const eventBus = new EventBus();

    eventBus.subscribe('preview:started', ({ docUri }) => {
        logger.info(`Preview started: ${docUri}`);
    });
    eventBus.subscribe('preview:finished', ({ docUri, tempFilePath }) => {
        logger.info(`Preview finished: ${docUri}. Temp file: ${tempFilePath}`);
        // Schedule temp file deletion after 30 seconds (fault-tolerant)
        if (tempFilePath) {
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(tempFilePath);
                    logger.info(`Auto-cleaned temp file: ${tempFilePath}`);
                } catch {
                    // Already deleted or inaccessible — safe to ignore
                }
            }, 30000);
        }
    });
    eventBus.subscribe('preview:failed', ({ docUri, error }) => {
        logger.error(`Preview failed: ${docUri}. Error: ${error}`);
    });

    container.register('EventBus', eventBus);

    // 3. Build the template paths from the extension install root
    const templatesDir = path.join(extensionPath, 'templates');
    const defaultHtmlPath = path.join(templatesDir, 'default.html');
    const defaultCssPath  = path.join(templatesDir, 'default.css');

    // 4. Construct pipeline steps (used by the Rendering Engine)
    const renderer       = new MarkdownRenderer();
    const assetResolver  = new AssetResolver();
    assetResolver.registerPlugin(new LocalImageAssetResolver());
    const templateEngine  = new DefaultTemplateEngine(defaultHtmlPath, defaultCssPath);
    const templateStep    = new TemplateStep(templateEngine);
    container.register('TemplateEngine', templateEngine);

    // 5. Construct transport-layer steps
    const fileManagerStep = new TempFileManagerStep(new TempFileManager());
    const browserLauncher = new BrowserLauncher();
    const launcherStep    = new BrowserLauncherStep(browserLauncher);

    // 6. Assemble the Rendering Engine (pure in-memory: Markdown → HTML fragment → wrapped page)
    const renderingEngine = new DefaultRenderingEngine(renderer, assetResolver, templateStep);

    // 7. Assemble the Transports
    const transport = new BrowserSocketTransport(browserLauncher, extensionPath);
    const fallbackTransport = new BrowserFileTransport(fileManagerStep, launcherStep);

    // 8. Register the coordinator service (depends only on abstract interfaces)
    container.register('PreviewService', new PreviewService(renderingEngine, transport, fallbackTransport, eventBus));

    return container;
}
