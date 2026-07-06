import * as fs from 'fs';
import * as path from 'path';
import { AssetResolverPlugin } from './AssetResolver';
import { logger } from '../logger';

// Helper to perform regex replacement with an async callback
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
        return await replaceAsync(html, /<img([^>]*?)src="([^"]+)"([^>]*?)>/gi, async (_match, before, src, after) => {
            if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
                return `<img${before}src="${src}"${after}>`;
            }

            try {
                const absPath = path.isAbsolute(src) ? src : path.resolve(baseDir, src);

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
