# Markdown Preview in Browser

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/codewithritiksaini/vscode-markdown-to-pdf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/blob/main/LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-codewithritiksaini%2Fvscode--markdown--to--pdf-181717.svg?logo=github)](https://github.com/codewithritiksaini/vscode-markdown-to-pdf)

Open any Markdown (`.md`) file as a beautifully styled, dynamic HTML live preview in your default web browser — featuring Google Fonts, card layouts, real-time WebSocket sync, and pixel-perfect **Print to PDF** support.

---

## ✨ Features

- ⚡ **Real-Time Live Preview**: Instant WebSocket synchronization as you type in VS Code with smart DOM morphing (preserves scroll positions and media states).
- 🎨 **Modern Card Layout & Typography**: Designed with Inter and JetBrains Mono fonts, smooth gradients, and GitHub-flavored formatting.
- 🖨️ **Print & Export to PDF**: Native browser `window.print()` support with dedicated print styling — long code blocks and tables wrap neatly without getting clipped.
- 💻 **macOS-Style Code Blocks**: Dark themed code blocks with traffic light window controls (🔴🟡🟢) and syntax highlighting support.
- 🖼️ **Local Image Inlining**: Automatic Base64 inlining for local image paths, ensuring your preview and exported PDFs load images safely anywhere.
- ⚙️ **Custom CSS Support**: Inject your own custom stylesheets to personalize preview output.
- 🪶 **Ultra Lightweight**: Pure esbuild bundle under 250KB with zero heavy headless browser (Puppeteer) dependencies.

---

## 🚀 Quick Start & Usage

### 1. Context Menu (Explorer or Editor)
- Right-click any `.md` file in the **Explorer** panel or **Editor context menu**.
- Click **"Open Markdown Preview in Browser"** (or click the 🌐 globe icon in the editor title bar).

### 2. Command Palette
1. Open any `.md` file in VS Code.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
3. Type and select **"Open Markdown Preview in Browser"**.

### 3. Print to PDF
- Click the **"Print / Save as PDF"** button at the bottom-right of the browser preview window, or press `Ctrl+P` / `Cmd+P` to save as a PDF.

---

## ⚙️ Configuration

Customize the extension settings under `Settings` → `Extensions` → `Markdown PDF` or in your `settings.json`:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `markdownPdf.pageSize` | `string` | `"A4"` | Page size for PDF output (`A4`, `Letter`, `Legal`, `Tabloid`, `A3`, `A5`). |
| `markdownPdf.margins` | `object` | `{ top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }` | Page margins for PDF generation. |
| `markdownPdf.customCSSPath` | `string` | `""` | Absolute path or workspace-relative path to a custom `.css` file. |
| `markdownPdf.includeHeaderFooter` | `boolean` | `true` | Include document headers and footers. |
| `markdownPdf.highlightTheme` | `string` | `"github"` | Code block syntax highlighting theme. |

---

## 📦 Installation

### Install from `.vsix` Package

```bash
# Package extension into .vsix
npm run package

# Install in VS Code
code --install-extension markdown-to-pdf-1.1.0.vsix

# Install in Antigravity / Cursor / Windsurf
antigravity --install-extension markdown-to-pdf-1.1.0.vsix
```

---

## 🔗 Repository & Community

- **GitHub Repository**: [codewithritiksaini/vscode-markdown-to-pdf](https://github.com/codewithritiksaini/vscode-markdown-to-pdf)
- **Issue Tracker**: [Report a Bug / Feature Request](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/issues)
- **Changelog**: See [CHANGELOG.md](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/blob/main/CHANGELOG.md) for version updates.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](https://github.com/codewithritiksaini/vscode-markdown-to-pdf/blob/main/LICENSE) for more details.

Developed with ❤️ by [codewithritiksaini](https://github.com/codewithritiksaini).
