import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Transport } from '../core/Transport';
import { RenderResult } from '../core/RenderResult';
import { BrowserLauncher } from '../services/BrowserLauncher';
import { logger } from '../logger';

export class BrowserSocketTransport implements Transport {
    private static server: http.Server | null = null;
    private static wss: WebSocketServer | null = null;
    private static serverStartedPromise: Promise<number> | null = null;
    private static heartbeatInterval: NodeJS.Timeout | null = null;
    private static extensionPath: string = '';

    private static clients = new Map<string, Set<WebSocket>>();
    private static htmlCache = new Map<string, string>();
    private static fragmentCache = new Map<string, string>();
    private static titleCache = new Map<string, string>();
    private static customCssCache = new Map<string, string>();
    private static sequenceNumbers = new Map<string, number>();
    private static openedFiles = new Set<string>();
    private static cleanupTimers = new Map<string, NodeJS.Timeout>();
    private static sessionTokens = new Map<string, string>();

    constructor(private readonly launcher: BrowserLauncher, extensionPath: string) {
        BrowserSocketTransport.extensionPath = extensionPath;
        BrowserSocketTransport.ensureServerStarted().catch((err) => {
            logger.error('Failed to start Live Preview server during initialization:', err);
        });
    }

    private static ensureServerStarted(): Promise<number> {
        if (BrowserSocketTransport.serverStartedPromise) {
            return BrowserSocketTransport.serverStartedPromise;
        }

        BrowserSocketTransport.serverStartedPromise = new Promise<number>((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                const host = req.headers.host || '';
                // Host header validation against DNS rebinding
                if (!host.startsWith('127.0.0.1:') && !host.startsWith('localhost:')) {
                    res.writeHead(403, { 'Content-Type': 'text/plain' });
                    res.end('Forbidden');
                    return;
                }

                const urlObj = new URL(req.url ?? '', `http://${req.headers.host}`);

                // Serve static JS client script from extension path
                if (urlObj.pathname === '/preview.js') {
                    try {
                        const jsPath = path.join(BrowserSocketTransport.extensionPath, 'templates', 'preview.js');
                        const jsContent = await fs.promises.readFile(jsPath, 'utf-8');
                        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                        res.end(jsContent);
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Failed to load preview runtime script');
                    }
                    return;
                }

                const fileId = urlObj.searchParams.get('file');
                const token = urlObj.searchParams.get('token');

                if (!fileId) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Missing file parameter');
                    return;
                }

                const expectedToken = BrowserSocketTransport.sessionTokens.get(fileId);
                if (!token || !expectedToken || token !== expectedToken) {
                    logger.warn(`Security: Rejected HTTP request with invalid session token for ${fileId}`);
                    res.writeHead(403, { 'Content-Type': 'text/plain' });
                    res.end('Forbidden: Invalid or missing session token');
                    return;
                }

                const cachedHtml = BrowserSocketTransport.htmlCache.get(fileId);
                if (!cachedHtml) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Preview not found or expired');
                    return;
                }

                // Inject only the small loader script
                const wsScript = `<script src="/preview.js"></script>`;
                const htmlWithScript = cachedHtml.replace('</body>', `${wsScript}</body>`);

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(htmlWithScript);
            });

            const wss = new WebSocketServer({ noServer: true });

            server.on('upgrade', (request, socket, head) => {
                const host = request.headers.host || '';
                if (!host.startsWith('127.0.0.1:') && !host.startsWith('localhost:')) {
                    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    socket.destroy();
                    return;
                }

                // Origin validation: Prevent Cross-Site WebSocket Hijacking (CSWSH)
                const origin = request.headers.origin;
                if (origin) {
                    try {
                        const originUrl = new URL(origin);
                        if (originUrl.hostname !== '127.0.0.1' && originUrl.hostname !== 'localhost') {
                            logger.warn(`Security: Rejected WebSocket upgrade from untrusted origin: ${origin}`);
                            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                            socket.destroy();
                            return;
                        }
                    } catch {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                        socket.destroy();
                        return;
                    }
                }

                const urlObj = new URL(request.url ?? '', `http://localhost`);
                if (urlObj.pathname === '/ws') {
                    const fileId = urlObj.searchParams.get('file');
                    const token = urlObj.searchParams.get('token');
                    const expectedToken = BrowserSocketTransport.sessionTokens.get(fileId || '');

                    if (!fileId || !token || !expectedToken || token !== expectedToken) {
                        logger.warn(`Security: Rejected WebSocket upgrade due to invalid session token`);
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                        socket.destroy();
                        return;
                    }

                    wss.handleUpgrade(request, socket, head, (ws) => {
                        wss.emit('connection', ws, request);
                    });
                } else {
                    socket.destroy();
                }
            });

            wss.on('connection', (ws, request) => {
                const urlObj = new URL(request.url ?? '', `http://localhost`);
                const fileId = urlObj.searchParams.get('file');
                if (!fileId) {
                    ws.close();
                    return;
                }

                logger.info(`WebSocket client connected for session: ${fileId}`);

                // Cancel cleanup timer on client reconnect
                const existingTimer = BrowserSocketTransport.cleanupTimers.get(fileId);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                    BrowserSocketTransport.cleanupTimers.delete(fileId);
                    logger.info(`Reconnection detected, cancelled session cleanup for: ${fileId}`);
                }

                const wsAny = ws as any;
                wsAny.isAlive = true;
                ws.on('pong', () => {
                    wsAny.isAlive = true;
                });

                if (!BrowserSocketTransport.clients.has(fileId)) {
                    BrowserSocketTransport.clients.set(fileId, new Set());
                }
                BrowserSocketTransport.clients.get(fileId)!.add(ws);

                // Immediate initial rendering state push to client on reconnect
                const cachedHtml = BrowserSocketTransport.htmlCache.get(fileId);
                if (cachedHtml) {
                    const title = BrowserSocketTransport.titleCache.get(fileId) ?? '';
                    const fragment = BrowserSocketTransport.fragmentCache.get(fileId) ?? '';
                    const customCSS = BrowserSocketTransport.customCssCache.get(fileId) ?? '';
                    const seq = BrowserSocketTransport.sequenceNumbers.get(fileId) ?? 0;

                    const payload = JSON.stringify({
                        type: 'update',
                        title: title,
                        html: fragment,
                        customCSS: customCSS,
                        seq: seq
                    });
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(payload);
                    }
                }

                // Log forwarding from browser console to extension logger
                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message.toString());
                        if (data.type === 'log') {
                            if (data.level === 'error') {
                                logger.error(`[Browser Client Error] ${data.message}`);
                            } else {
                                logger.info(`[Browser Client Log] ${data.message}`);
                            }
                        }
                    } catch {
                        // ignore malformed packets
                    }
                });

                ws.on('close', () => {
                    logger.info(`WebSocket client disconnected for session: ${fileId}`);
                    const set = BrowserSocketTransport.clients.get(fileId);
                    if (set) {
                        set.delete(ws);
                        if (set.size === 0) {
                            BrowserSocketTransport.clients.delete(fileId);
                            // Schedule 5-second graceful session state cleanup
                            const timer = setTimeout(() => {
                                BrowserSocketTransport.cleanupTimers.delete(fileId);
                                const currentSet = BrowserSocketTransport.clients.get(fileId);
                                if (!currentSet || currentSet.size === 0) {
                                    logger.info(`Session closed permanently: ${fileId}`);
                                    BrowserSocketTransport.htmlCache.delete(fileId);
                                    BrowserSocketTransport.fragmentCache.delete(fileId);
                                    BrowserSocketTransport.titleCache.delete(fileId);
                                    BrowserSocketTransport.customCssCache.delete(fileId);
                                    BrowserSocketTransport.openedFiles.delete(fileId);
                                    BrowserSocketTransport.sequenceNumbers.delete(fileId);
                                    BrowserSocketTransport.sessionTokens.delete(fileId);
                                }
                            }, 5000);
                            BrowserSocketTransport.cleanupTimers.set(fileId, timer);
                        }
                    }
                });
            });

            server.on('error', (err) => {
                logger.error('Live Preview server error:', err);
                BrowserSocketTransport.serverStartedPromise = null;
                reject(err);
            });

            // Heartbeat check interval to remove dead websocket clients
            BrowserSocketTransport.heartbeatInterval = setInterval(() => {
                BrowserSocketTransport.wss?.clients.forEach((ws) => {
                    const wsAny = ws as any;
                    if (wsAny.isAlive === false) {
                        logger.info('Terminating inactive WebSocket client connection due to missed heartbeat');
                        ws.terminate();
                        return;
                    }
                    wsAny.isAlive = false;
                    try {
                        ws.ping();
                    } catch {
                        ws.terminate();
                    }
                });
            }, 15000);

            // Ephemeral port selection
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    logger.info(`Live Preview server listening on port ${addr.port}`);
                    resolve(addr.port);
                } else {
                    reject(new Error('Failed to retrieve server port'));
                }
            });

            BrowserSocketTransport.server = server;
            BrowserSocketTransport.wss = wss;
        });

        return BrowserSocketTransport.serverStartedPromise;
    }

    async send(result: RenderResult, forceLaunch: boolean = false): Promise<void> {
        const fileId = result.document.uri.toString();

        // 1. Update the caches and ensure security token exists
        if (!BrowserSocketTransport.sessionTokens.has(fileId)) {
            BrowserSocketTransport.sessionTokens.set(fileId, crypto.randomBytes(16).toString('hex'));
        }
        const token = BrowserSocketTransport.sessionTokens.get(fileId)!;

        BrowserSocketTransport.htmlCache.set(fileId, result.metadata.htmlContent);
        BrowserSocketTransport.titleCache.set(fileId, result.document.baseName);
        BrowserSocketTransport.customCssCache.set(fileId, result.metadata.customCSS || '');
        BrowserSocketTransport.fragmentCache.set(fileId, result.html);

        const currentSeq = (BrowserSocketTransport.sequenceNumbers.get(fileId) ?? 0) + 1;
        BrowserSocketTransport.sequenceNumbers.set(fileId, currentSeq);

        // 2. Broadcast render result to active clients
        const clients = BrowserSocketTransport.clients.get(fileId);
        if (clients && clients.size > 0) {
            logger.info(`Broadcasting live update to ${clients.size} client(s) for session: ${fileId} (seq: ${currentSeq})`);
            const payload = JSON.stringify({
                type: 'update',
                title: result.document.baseName,
                html: result.html,
                customCSS: result.metadata.customCSS || '',
                seq: currentSeq
            });
            for (const ws of clients) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            }
        }

        // 3. Await server port resolution
        const port = await BrowserSocketTransport.ensureServerStarted();

        // 4. Launch default browser session once or when forceLaunch is requested
        if (forceLaunch || !BrowserSocketTransport.openedFiles.has(fileId)) {
            logger.info(`Launching browser preview session for: ${fileId} (forceLaunch: ${forceLaunch})`);
            BrowserSocketTransport.openedFiles.add(fileId);
            const previewUrl = `http://127.0.0.1:${port}/?file=${encodeURIComponent(fileId)}&token=${encodeURIComponent(token)}`;
            await this.launcher.launch(previewUrl);
        }
    }

    isActive(docUri: string): boolean {
        return BrowserSocketTransport.openedFiles.has(docUri);
    }

    closeSession(docUri: string): void {
        logger.info(`Explicitly closing session cleanup: ${docUri}`);
        
        const cleanupTimer = BrowserSocketTransport.cleanupTimers.get(docUri);
        if (cleanupTimer) {
            clearTimeout(cleanupTimer);
            BrowserSocketTransport.cleanupTimers.delete(docUri);
        }

        const clients = BrowserSocketTransport.clients.get(docUri);
        if (clients) {
            for (const ws of clients) {
                try {
                    ws.close();
                } catch {
                    // ignore
                }
            }
            BrowserSocketTransport.clients.delete(docUri);
        }
        BrowserSocketTransport.htmlCache.delete(docUri);
        BrowserSocketTransport.fragmentCache.delete(docUri);
        BrowserSocketTransport.titleCache.delete(docUri);
        BrowserSocketTransport.customCssCache.delete(docUri);
        BrowserSocketTransport.openedFiles.delete(docUri);
        BrowserSocketTransport.sequenceNumbers.delete(docUri);
        BrowserSocketTransport.sessionTokens.delete(docUri);
    }

    dispose(): void {
        // Shared server resources are shut down on extension deactivate
    }

    public static shutdown(): Promise<void> {
        logger.info('Shutting down Live Preview server and closing connections');
        
        if (BrowserSocketTransport.heartbeatInterval) {
            clearInterval(BrowserSocketTransport.heartbeatInterval);
            BrowserSocketTransport.heartbeatInterval = null;
        }

        return new Promise((resolve) => {
            // Close active client WebSockets
            for (const clientSet of BrowserSocketTransport.clients.values()) {
                for (const ws of clientSet) {
                    try {
                        ws.close();
                    } catch {
                        // ignore
                    }
                }
            }
            
            // Cancel any remaining cleanup timers
            for (const timer of BrowserSocketTransport.cleanupTimers.values()) {
                clearTimeout(timer);
            }
            BrowserSocketTransport.cleanupTimers.clear();

            BrowserSocketTransport.clients.clear();
            BrowserSocketTransport.htmlCache.clear();
            BrowserSocketTransport.fragmentCache.clear();
            BrowserSocketTransport.titleCache.clear();
            BrowserSocketTransport.customCssCache.clear();
            BrowserSocketTransport.openedFiles.clear();
            BrowserSocketTransport.sequenceNumbers.clear();
            BrowserSocketTransport.sessionTokens.clear();
            BrowserSocketTransport.serverStartedPromise = null;

            if (BrowserSocketTransport.wss) {
                BrowserSocketTransport.wss.close();
                BrowserSocketTransport.wss = null;
            }
            if (BrowserSocketTransport.server) {
                BrowserSocketTransport.server.close(() => {
                    BrowserSocketTransport.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
