import { RenderResult } from './RenderResult';

export interface Transport {
    send(result: RenderResult, forceLaunch?: boolean): Promise<any>;
    isActive?(docUri: string): boolean;
    closeSession?(docUri: string): void;
    dispose?(): void;
}
