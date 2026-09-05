import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AssetResolverPlugin } from './AssetResolver';
import { logger } from '../logger';

// Helper to perform regex replacement with an async callback safely
async function replaceAsync(
    str: string,
    regex: RegExp,
    asyncFn: (...args: any[]) => Promise<string>
): Promise<string> {
    const promises: Array<Promise<string>> = [];
    str.replace(regex, (...args) => {
        promises.push(asyncFn(...args));
        return '';
    });
    const data = await Promise.all(promises);
    let index = 0;
    return str.replace(regex, () => data[index++]);
}

export class LocalImageAssetResolver implements AssetResolverPlugin {
    async resolve(html: string, baseDir: string): Promise<string> {
        return await replaceAsync(html, /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, async (_match, before, src, after) => {
            if (!src || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
                return `<img${before}src="${src}"${after}>`;
            }

            try {
                // Strip hash and query parameters, then decode URI components (e.g. %20 -> space)
                const cleanSrc = decodeURIComponent(src.split('?')[0].split('#')[0]);
                let absPath: string;

                if (cleanSrc.startsWith('file://')) {
                    absPath = vscode.Uri.parse(cleanSrc).fsPath;
                } else if (path.isAbsolute(cleanSrc)) {
                    absPath = path.normalize(cleanSrc);
                } else {
                    absPath = path.resolve(baseDir, cleanSrc);
                }

                // Security check: restrict image resolution to baseDir or open workspace folders
                const workspaceRoots = (vscode.workspace.workspaceFolders || []).map((f) => path.resolve(f.uri.fsPath));
                const allowedRoots = [path.resolve(baseDir), ...workspaceRoots];
                const isInsideAllowed = allowedRoots.some((root) => {
                    const rel = path.relative(root, absPath);
                    return !rel.startsWith('..') && !path.isAbsolute(rel);
                });

                if (!isInsideAllowed) {
                    logger.warn(`Security: Blocked local asset resolution outside safe boundaries: ${absPath}`);
                    return `<img${before}src="${src}"${after}>`;
                }

                try {
                    await fs.promises.access(absPath, fs.constants.F_OK);
                } catch {
                    logger.warn(`Image not found: ${absPath}`);
                    return `<img${before}src="${src}"${after}>`;
                }

                const ext = path.extname(absPath).slice(1).toLowerCase();
                const mimeMap: Record<string, string> = {
                    png: 'image/png',
                    jpg: 'image/jpeg',
                    jpeg: 'image/jpeg',
                    gif: 'image/gif',
                    svg: 'image/svg+xml',
                    webp: 'image/webp',
                    avif: 'image/avif',
                    bmp: 'image/bmp',
                    ico: 'image/x-icon',
                };
                const mime = mimeMap[ext] ?? 'image/png';
                
                const buffer = await fs.promises.readFile(absPath);
                const b64 = buffer.toString('base64');
                return `<img${before}src="data:${mime};base64,${b64}"${after}>`;
            } catch (err) {
                logger.error(`Failed to inline image "${src}".`, err);
                return `<img${before}src="${src}"${after}>`;
            }
        });
    }
}
