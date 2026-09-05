# Changelog

All notable changes to "Markdown to PDF" are documented here.

## [1.2.0] – 2026-09-05

### Security
- **Shell injection fix**: Replaced `child_process.exec` browser-open calls with `vscode.env.openExternal()` — works safely in WSL, Remote SSH, Dev Containers, and Codespaces.
- **CSWSH / DNS-rebinding protection**: Local HTTP + WebSocket server now requires a per-session cryptographic token and validates `Host`/`Origin` headers on every connection.
- **Path traversal prevention**: Image asset resolver now validates resolved paths against workspace/document boundaries and supports URL-encoded paths (`my%20file.png`).
- **XSS hardening**: Template engine now HTML-escapes filenames before injecting into `<title>` and uses function replacers to prevent `$1`/`$$` mangling of LaTeX and shell code.

### Fixed
- **Syntax highlighting**: Integrated `highlight.js` server-side — code blocks arrive pre-tokenized; no client-side runtime needed.
- **Custom CSS wipe bug**: Custom CSS is now correctly preserved on every live WebSocket keystroke update.
- **PDF page size & margins**: `markdownPdf.pageSize` and `markdownPdf.margins` settings are now dynamically injected as `@page` CSS rules.
- **Workspace-relative CSS paths**: `markdownPdf.customCSSPath` now resolves relative paths against the workspace folder.
- **Untitled document support**: Extension no longer crashes on unsaved `Untitled-*` markdown files.
- **`.markdown` / `.mdown` / `.MD` extension support**: All common Markdown file extensions are now recognised.
- **Table overflow**: Wide tables now scroll horizontally on screen (`overflow-x: auto`) and use `table-layout: fixed` + smaller font in print/PDF so no content is clipped.
- **`wrapTables()` crash fix**: Replaced a V8-crashing variable-length lookbehind regex with a stack-based tag scanner; nested tables are handled correctly.
- **Template cache invalidation**: Changing VS Code settings now clears the template cache so updated CSS/themes take effect immediately.
- **Dark mode table hover**: Hover row highlight is now visible in dark mode.
- **Print table borders**: Table borders are always visible in PDF via explicit `border` properties (not just `box-shadow`).

### Added
- **Dark Mode**: Full dark palette with CSS variables, `prefers-color-scheme` auto-detection, and a floating theme toggle button (☀️ / 🌙).
- **DOM Morphing**: Live preview updates use ID-keyed lookahead reconciliation — inserting a heading no longer re-renders the entire page.
- **Connection status badge**: Live Sync / Reconnecting… / Disconnected indicator in the preview header.
- **In-memory template caching**: Eliminates repeated disk reads on every 100 ms keystroke.

### Removed
- Deleted unused legacy Puppeteer service (`src/legacy/`), duplicate markdown renderer, and stale media assets to reduce package size.

---

## [1.0.0] – 2026-02-26

### Added
- Initial release
- Context menu integration: right-click `.md` files → "Open Markdown as Styled PDF Preview"
- Command palette fallback
- Webview-based in-editor PDF preview with strict Content-Security-Policy
- Fixed bottom "Download PDF" button with loading spinner
- Puppeteer-core based PDF generation (headless Chromium)
- Lazy browser init + crash auto-recovery
- GitHub Flavored Markdown via markdown-it (task lists, tables, linkify, typographer)
- Syntax highlighted code blocks (dark theme)
- Relative image inlining as `data:` URIs
- Light and dark VS Code theme auto-detection
- Configurable page size, margins, header/footer, custom CSS
- VS Code Output Channel logging (`Markdown PDF` channel)
- Clean dispose on extension deactivation (no memory leaks)
