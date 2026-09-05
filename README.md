# Markdown Preview in Browser

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/codewithritiksaini/vscode-markdown-to-pdf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/blob/main/LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-codewithritiksaini%2Fvscode--markdown--to--pdf-181717.svg?logo=github)](https://github.com/codewithritiksaini/vscode-markdown-to-pdf)

Open any Markdown (`.md`) file as a beautifully styled, live HTML preview in your default web browser — with real-time WebSocket sync, dark mode, syntax highlighting, and pixel-perfect **Print to PDF** support.

---

## ✨ Features

- ⚡ **Real-Time Live Preview** — Instant WebSocket sync as you type. Smart DOM morphing preserves scroll positions and media states — no full page reload.
- 🌙 **Dark Mode** — Full dark palette with `prefers-color-scheme` auto-detection and a floating ☀️/🌙 toggle button.
- 🎨 **Modern Card Layout & Typography** — Inter and JetBrains Mono fonts, smooth gradients, and GitHub-flavored formatting.
- 🖨️ **Print & Export to PDF** — Native `window.print()` with dedicated print CSS — wide tables fit the page, headings never orphan, code blocks wrap cleanly.
- 💻 **macOS-Style Code Blocks** — Dark-themed blocks with traffic-light controls (🔴🟡🟢) and server-side `highlight.js` syntax highlighting (no client runtime needed).
- 📊 **Wide Table Support** — Tables scroll horizontally on screen; `table-layout: fixed` ensures no content is clipped in PDF exports.
- 🖼️ **Local Image Inlining** — Automatic Base64 embedding of local images so previews and PDFs work anywhere.
- ⚙️ **Custom CSS** — Inject your own stylesheet to fully personalize the preview output.
- 🔒 **Secure Local Server** — Per-session crypto tokens, `Host`/`Origin` header validation, and path-traversal protection on every connection.
- 🌐 **Remote-Ready** — Works in WSL, Remote SSH, Dev Containers, and GitHub Codespaces via `vscode.env.openExternal`.

---

## 🚀 Quick Start

### 1. Context Menu (Explorer or Editor)
- Right-click any `.md` file → **"Open Markdown Preview in Browser"**
- Or click the 🌐 globe icon in the editor title bar.

### 2. Command Palette
1. Open any `.md` file in VS Code.
2. Press `Ctrl+Shift+P` / `Cmd+Shift+P`.
3. Type **"Open Markdown Preview in Browser"** and press Enter.

### 3. Print to PDF
- Click **"Print / Save as PDF"** at the bottom-right of the browser preview.
- Or press `Ctrl+P` / `Cmd+P` inside the preview browser tab.

> **Supported file extensions**: `.md`, `.markdown`, `.mdown`, `.mkd` (case-insensitive)

---

## ⚙️ Configuration

Go to `Settings` → `Extensions` → `Markdown PDF`, or edit `settings.json`:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `markdownPdf.pageSize` | `string` | `"A4"` | PDF page size — `A4`, `Letter`, `Legal`, `Tabloid`, `A3`, `A5` |
| `markdownPdf.margins` | `object` | `{ top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }` | PDF page margins |
| `markdownPdf.customCSSPath` | `string` | `""` | Absolute or workspace-relative path to a custom `.css` file |
| `markdownPdf.includeHeaderFooter` | `boolean` | `true` | Show filename header in the preview |
| `markdownPdf.highlightTheme` | `string` | `"github"` | Code highlight theme: `github`, `monokai`, `dracula`, `solarized-light`, `atom-one-dark` |

---

## 📦 Installation

### From VSIX (manual)

```bash
# Install in VS Code
code --install-extension markdown-to-pdf-1.2.0.vsix
```

Or: **Extensions panel** → `···` menu → **Install from VSIX…**

### From Source

```bash
git clone https://github.com/codewithritiksaini/vscode-markdown-to-pdf.git
cd vscode-markdown-to-pdf
npm install
npm run package        # builds markdown-to-pdf-1.2.0.vsix
```

---

## 🔗 Links

- **GitHub**: [codewithritiksaini/vscode-markdown-to-pdf](https://github.com/codewithritiksaini/vscode-markdown-to-pdf)
- **Issues**: [Report a Bug / Feature Request](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/issues)
- **Changelog**: [CHANGELOG.md](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/blob/main/CHANGELOG.md)

---

## 📄 License

Distributed under the MIT License. See [LICENSE](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/blob/main/LICENSE) for details.

Developed with ❤️ by [codewithritiksaini](https://github.com/codewithritiksaini).
