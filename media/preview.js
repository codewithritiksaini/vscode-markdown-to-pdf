/**
 * preview.js  –  Webview-side script.
 *
 * Security rules:
 *  - No eval, no innerHTML assignment from extension host.
 *  - Communicates ONLY via acquireVsCodeApi().postMessage.
 *  - Runs inside VS Code Webview sandbox (no DOM access to host).
 */

(function () {
    'use strict';

    // Acquire the VS Code API handle (may only be called once per Webview lifetime).
    const vscode = acquireVsCodeApi();

    // ---------------------------------------------------------------------------
    // Element references – all IDs set in previewProvider.ts HTML template
    // ---------------------------------------------------------------------------
    const downloadBtn = /** @type {HTMLButtonElement} */ (document.getElementById('download-btn'));
    const btnLabel = /** @type {HTMLSpanElement}   */ (document.getElementById('btn-label'));
    const spinner = /** @type {HTMLSpanElement}   */ (document.getElementById('spinner'));
    const statusText = /** @type {HTMLSpanElement}   */ (document.getElementById('status-text'));

    // ---------------------------------------------------------------------------
    // State helpers
    // ---------------------------------------------------------------------------

    function setGenerating() {
        downloadBtn.disabled = true;
        btnLabel.textContent = 'Generating…';
        spinner.classList.remove('hidden');
        setStatus('Generating PDF, please wait…', 'neutral');
    }

    function setReady(savedPath) {
        downloadBtn.disabled = false;
        btnLabel.textContent = 'Download PDF';
        spinner.classList.add('hidden');
        const short = savedPath.length > 50 ? '…' + savedPath.slice(-47) : savedPath;
        setStatus('✅ Saved: ' + short, 'success');
    }

    function setError(message) {
        downloadBtn.disabled = false;
        btnLabel.textContent = 'Download PDF';
        spinner.classList.add('hidden');
        setStatus('❌ ' + message, 'error');
    }

    function setStatus(text, type) {
        statusText.textContent = text;
        statusText.className = 'status-text' + (type !== 'neutral' ? ' ' + type : '');
    }

    // ---------------------------------------------------------------------------
    // User action: click Download PDF
    // ---------------------------------------------------------------------------

    downloadBtn.addEventListener('click', function () {
        setGenerating();
        vscode.postMessage({ type: 'downloadPdf' });
    });

    // ---------------------------------------------------------------------------
    // Messages received FROM the extension host
    // ---------------------------------------------------------------------------

    window.addEventListener('message', function (event) {
        const message = event.data;

        switch (message.type) {

            case 'pdfGenerating':
                setGenerating();
                break;

            case 'pdfReady':
                setReady(message.savedPath || 'Unknown location');
                break;

            case 'pdfError':
                setError(message.error || 'Unknown error');
                break;

            case 'themeChanged':
                document.documentElement.setAttribute('data-theme', message.theme);
                document.body.className = message.theme === 'dark' ? 'vscode-dark' : 'vscode-light';
                vscode.postMessage({ type: 'log', level: 'info', message: 'Theme changed to ' + message.theme });
                break;

            default:
                vscode.postMessage({ type: 'log', level: 'warn', message: 'Unknown message type: ' + message.type });
                break;
        }
    });

    // ---------------------------------------------------------------------------
    // Signal ready to extension host
    // ---------------------------------------------------------------------------

    vscode.postMessage({ type: 'ready' });

})();
