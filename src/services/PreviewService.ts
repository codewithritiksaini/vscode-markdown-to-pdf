import { MarkdownDocument } from '../types';
import { RenderingEngine } from '../core/RenderingEngine';
import { Transport } from '../core/Transport';
import { EventBus } from './EventBus';

export class PreviewService {
    constructor(
        private readonly engine: RenderingEngine,
        private readonly transport: Transport,
        private readonly eventBus: EventBus
    ) {}

    async openInBrowser(doc: MarkdownDocument): Promise<void> {
        this.eventBus.publish('preview:started', { docUri: doc.uri.toString() });

        try {
            const renderResult = await this.engine.render(doc);
            const transportResult = await this.transport.send(renderResult);

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
}
