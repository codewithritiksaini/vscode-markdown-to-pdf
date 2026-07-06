import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import anchor from 'markdown-it-anchor';
import { PipelineStep, RenderedDocument } from './Pipeline';
import { MarkdownDocument } from '../types';

export class MarkdownRenderer implements PipelineStep<MarkdownDocument, RenderedDocument> {
    private readonly md: MarkdownIt;

    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
            breaks: false,
            highlight: (str: string, lang: string): string => {
                const escaped = str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                return `<pre class="hljs"><code class="language-${lang || 'plaintext'}">${escaped}</code></pre>`;
            },
        });

        this.md.use(taskLists, { enabled: true, label: true });
        this.md.use(anchor, { permalink: anchor.permalink.linkInsideHeader() });
    }

    execute(doc: MarkdownDocument): RenderedDocument {
        const html = this.md.render(doc.source);
        return { document: doc, html };
    }
}
