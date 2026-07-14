import { MarkdownDocument } from '../types';
import { RenderingEngine } from '../core/RenderingEngine';
import { Transport } from '../core/Transport';
import { EventBus } from './EventBus';
import { logger } from '../logger';

export class PreviewService {
    private readonly lastRenderedSource = new Map<string, string>();
    private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
    private readonly activeRevisions = new Map<string, number>();

    constructor(
        private readonly engine: RenderingEngine,
        private readonly transport: Transport,
        private readonly fallbackTransport: Transport,
        private readonly eventBus: EventBus
    ) {}

    async openInBrowser(doc: MarkdownDocument): Promise<void> {
        this.eventBus.publish('preview:started', { docUri: doc.uri.toString() });

        try {
            const renderResult = await this.engine.render(doc);
            let transportResult: any;

            try {
                transportResult = await this.transport.send(renderResult);
            } catch (err) {
                logger.warn(`Primary transport failed, falling back to file transport: ${err}`);
                transportResult = await this.fallbackTransport.send(renderResult);
            }

            this.eventBus.publish('preview:finished', {
                docUri: doc.uri.toString(),
                tempFilePath: typeof transportResult === 'string' ? transportResult : '',
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.eventBus.publish('preview:failed', {
                docUri: doc.uri.toString(),
                error: errorMsg,
            });
            throw err;
        }
    }

    async updatePreview(doc: MarkdownDocument, force: boolean = false): Promise<void> {
        const docUri = doc.uri.toString();
        if (this.transport.isActive && this.transport.isActive(docUri)) {
            if (!force) {
                const lastSource = this.lastRenderedSource.get(docUri);
                if (lastSource === doc.source) {
                    return;
                }
            }

            const currentRevision = (this.activeRevisions.get(docUri) ?? 0) + 1;
            this.activeRevisions.set(docUri, currentRevision);

            const existingTimer = this.debounceTimers.get(docUri);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(async () => {
                this.debounceTimers.delete(docUri);
                try {
                    if (this.activeRevisions.get(docUri) !== currentRevision) {
                        return;
                    }

                    this.lastRenderedSource.set(docUri, doc.source);
                    const renderResult = await this.engine.render(doc);
                    
                    if (this.activeRevisions.get(docUri) !== currentRevision) {
                        return;
                    }

                    await this.transport.send(renderResult);
                } catch (err) {
                    logger.error(`Live update failed for ${docUri}: ${err}`);
                }
            }, 100);

            this.debounceTimers.set(docUri, timer);
        }
    }

    transportActive(docUri: string): boolean {
        return !!(this.transport.isActive && this.transport.isActive(docUri));
    }

    closePreviewSession(docUri: string): void {
        logger.info(`Cleaning up preview session for ${docUri}`);
        this.lastRenderedSource.delete(docUri);
        this.activeRevisions.delete(docUri);
        const timer = this.debounceTimers.get(docUri);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(docUri);
        }
        if (this.transport.closeSession) {
            this.transport.closeSession(docUri);
        }
    }
}
