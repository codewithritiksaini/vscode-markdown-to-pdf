const esbuild = require('esbuild');

const production = process.argv.includes('--production');

esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: [
        'vscode',          // VS Code API — provided by the host, never bundled
    ],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !production,
    minify: production,
    treeShaking: true,
    // puppeteer-core uses dynamic require internally — mark binary as external
    // but the JS layer is bundled fine.
    logLevel: 'info',
}).catch(() => process.exit(1));
