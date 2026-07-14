import { exec } from 'child_process';
import { PipelineStep, GeneratedFile, BrowserLaunchRequest } from './Pipeline';
import { logger } from '../logger';

export class BrowserLauncherStep implements PipelineStep<GeneratedFile, BrowserLaunchRequest> {
    constructor(private readonly launcher: BrowserLauncher) {}

    async execute(context: GeneratedFile): Promise<BrowserLaunchRequest> {
        await this.launcher.launch(context.tempFilePath);
        return context;
    }
}

export class BrowserLauncher {
    launch(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const fileUrl = (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('file://'))
                ? filePath
                : `file://${filePath}`;

            if (process.platform === 'darwin') {
                exec(`open "${fileUrl}"`, (err) => err ? reject(err) : resolve());
                return;
            }

            if (process.platform === 'win32') {
                exec(`start "" "${fileUrl}"`, (err) => err ? reject(err) : resolve());
                return;
            }

            const browsers = [
                'google-chrome',
                'google-chrome-stable',
                'chromium-browser',
                'chromium',
                'firefox',
                'xdg-open',
            ];

            const env = { ...process.env, DISPLAY: process.env['DISPLAY'] ?? ':0' };

            function tryNext(index: number): void {
                if (index >= browsers.length) {
                    const msg = 'No browser found. Install Chrome or Firefox.';
                    logger.error(msg);
                    reject(new Error(msg));
                    return;
                }

                const browser = browsers[index];
                const cmd = `${browser} "${fileUrl}" &`;

                exec(cmd, { env }, (err) => {
                    if (err) {
                        logger.info(`Browser "${browser}" not found, trying next…`);
                        tryNext(index + 1);
                    } else {
                        logger.info(`Opened with: ${browser} → ${fileUrl}`);
                        resolve();
                    }
                });
            }

            tryNext(0);
        });
    }
}
