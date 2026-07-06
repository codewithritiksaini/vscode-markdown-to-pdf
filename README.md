# Markdown Preview in Browser – VS Code Extension

Open any `.md` file as a beautifully styled HTML preview right in your browser! With premium typography, mac OS-style code blocks, and native "Print to PDF" support.

---

## Features

| Feature | Details |
|---|---|
| **Beautiful Typography** | Uses Google Fonts (Inter, JetBrains Mono) |
| **Browser Native** | Opens instantly in your default browser (Chrome, Firefox, etc.) |
| **Print to PDF** | Use your browser's native `Ctrl+P` → Save as PDF for pixel-perfect exports |
| **macOS Code Blocks** | Premium code blocks featuring traffic light dots (🔴🟡🟢) |
| **Lightweight** | No heavy dependencies (Puppeteer removed!) – bundle size is under 250KB |
| **Auto Cleanup** | Temporary preview files auto-delete themselves after 30 seconds |

---

## Usage

### Context Menu (Recommended)
1. Right-click any `.md` file in the **Explorer** panel
2. Choose **"Open Markdown Preview in Browser"**
3. Your default browser will open with a styled preview!
4. To save as PDF, just press `Ctrl+P` (or `Cmd+P`) in the browser and choose **Save as PDF** ✅

### Command Palette
1. Open a `.md` file in the editor
2. Press `Ctrl+Shift+P` → type **"Open Markdown Preview in Browser"**

---

## Installation

### From VSIX (recommended during development)

```bash
# 1. Install dependencies
npm install

# 2. Compile and package using esbuild & vsce
npm run package
# → produces markdown-to-pdf-1.1.0.vsix

# 3a. Install in VS Code
code --install-extension markdown-to-pdf-1.1.0.vsix

# 3b. Install in Antigravity / Cursor / Windsurf
antigravity --install-extension markdown-to-pdf-1.1.0.vsix
```

### From Marketplace (once published)
Search **"Markdown Preview in Browser"** by `codewithritiksaini` in the Extensions panel.

---

## Technical Details & Architecture

- **Zero-config PDF generation**: By relying on the browser's native print engine, you get 100% accurate CSS rendering and crisp PDFs without bundling heavy headless browsers.
- **esbuild integration**: Dependencies are bundled seamlessly for maximum performance in all environments (including extension hosts that restrict node_modules).
- **Graceful File Cleanup**: `fs.unlink` automatically cleans up the generated `/tmp/md-preview-xxx.html` files 30 seconds after they open.

```text
src/
  extension.ts        – Activation, command registration, lifecycle
  previewProvider.ts  – HTML generation via markdown-it, browser launch via target child_process
  markdownService.ts  – markdown-it: GFM, task lists, image inlining
  configService.ts    – Setup and settings reader
  logger.ts           – OutputChannel wrapper
```

---

## License

MIT © codewithritiksaini
