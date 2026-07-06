import { MarkdownDocument } from '../types';

export interface ResolvedAsset {
    readonly id: string;
    readonly type: 'image' | 'stylesheet' | 'script' | 'font';
    readonly mimeType: string;
    readonly data: string;
}

export interface RenderResult {
    readonly document: MarkdownDocument;
    readonly html: string;
    readonly rawAst?: any;
    readonly assets: ResolvedAsset[];
    readonly metadata: {
        readonly outline: Array<{ heading: string; line: number; level: number }>;
        readonly customCSS: string;
        readonly htmlContent: string; // The wrapped HTML page string ready for rendering/transmission
        readonly [key: string]: any;
    };
}
