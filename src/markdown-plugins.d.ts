// Type declaration for markdown-it-task-lists (no @types package available)
declare module 'markdown-it-task-lists' {
    import MarkdownIt from 'markdown-it';
    interface TaskListOptions {
        enabled?: boolean;
        label?: boolean;
        labelAfter?: boolean;
    }
    function taskLists(md: MarkdownIt, options?: TaskListOptions): void;
    export = taskLists;
}

// Type declaration for markdown-it-anchor
declare module 'markdown-it-anchor' {
    import MarkdownIt from 'markdown-it';

    interface PermalinkOptions {
        class?: string;
        symbol?: string;
        renderHref?: (slug: string) => string;
        placement?: 'before' | 'after';
        ariaHidden?: boolean;
    }

    interface AnchorOptions {
        level?: number | number[];
        slugify?: (str: string) => string;
        permalink?: ((slug: string, opts: PermalinkOptions, state: unknown, idx: number) => void) | false;
        renderPermalink?: (slug: string, opts: AnchorOptions, state: unknown, idx: number) => void;
        permalinkClass?: string;
        permalinkSymbol?: string;
        permalinkBefore?: boolean;
        permalinkHref?: (slug: string) => string;
        callback?: (token: unknown, info: { title: string; slug: string }) => void;
    }

    namespace anchor {
        namespace permalink {
            function linkInsideHeader(opts?: PermalinkOptions): (slug: string, opts: AnchorOptions, state: unknown, idx: number) => void;
            function linkAfterHeader(opts?: PermalinkOptions): (slug: string, opts: AnchorOptions, state: unknown, idx: number) => void;
            function ariaHidden(opts?: PermalinkOptions): (slug: string, opts: AnchorOptions, state: unknown, idx: number) => void;
        }
    }

    function anchor(md: MarkdownIt, options?: AnchorOptions): void;
    export = anchor;
}

declare module '*.css' {
    const content: string;
    export default content;
}
