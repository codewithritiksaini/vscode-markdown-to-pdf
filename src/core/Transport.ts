import { RenderResult } from './RenderResult';

export interface Transport {
    send(result: RenderResult): Promise<any>;
    isActive?(docUri: string): boolean;
    closeSession?(docUri: string): void;
    dispose?(): void;
}
