/**
 * Logger – thin wrapper around a VS Code OutputChannel.
 * Provides levelled logging (info / warn / error) and timestamps.
 * The channel is created lazily on first use.
 */

import * as vscode from 'vscode';

// ---------------------------------------------------------------------------

class Logger {
    private channel: vscode.OutputChannel | null = null;

    private getChannel(): vscode.OutputChannel {
        if (!this.channel) {
            this.channel = vscode.window.createOutputChannel('Markdown PDF');
        }
        return this.channel;
    }

    private format(level: string, message: string): string {
        const ts = new Date().toISOString();
        return `[${ts}] [${level.padEnd(5)}] ${message}`;
    }

    info(message: string): void {
        this.getChannel().appendLine(this.format('INFO', message));
    }

    warn(message: string): void {
        this.getChannel().appendLine(this.format('WARN', message));
    }

    error(message: string, err?: unknown): void {
        const detail = err instanceof Error ? ` | ${err.message}\n${err.stack ?? ''}` : '';
        this.getChannel().appendLine(this.format('ERROR', message + detail));
    }

    /** Show the output channel in the UI. */
    show(): void {
        this.getChannel().show(true);
    }

    dispose(): void {
        this.channel?.dispose();
        this.channel = null;
    }
}

// Singleton instance shared across all modules.
export const logger = new Logger();
