# Changelog

All notable changes to "Markdown to PDF" are documented here.

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
