import { RenderResult } from './RenderResult';

export interface Transport {
    send(result: RenderResult): Promise<any>;
    dispose?(): void;
}
