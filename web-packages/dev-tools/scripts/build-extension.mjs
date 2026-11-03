import { build } from 'vite';
import { copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'dist/chrome');

await build({
  configFile: resolve(root, 'vite.config.js'),
  root: resolve(root, 'chrome-extension'),
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    target: 'chrome120',
    rollupOptions: {
      input: {
        devtools: resolve(root, 'chrome-extension/devtools.html'),
        panel: resolve(root, 'chrome-extension/panel.html'),
      },
    },
  },
});
for (const [name, entry] of [
  ['agent', 'src/chrome-extension/bridge/runtime-agent.ts'],
  ['content', 'src/chrome-extension/entry/content.ts'],
]) {
  await build({
    root,
    configFile: false,
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: false,
      target: 'chrome120',
      lib: { entry: resolve(root, entry), name: 'EffectsDevtoolsAgent', formats: ['iife'], fileName: () => name + '.js' },
    },
  });
}
await copyFile(resolve(root, 'chrome-extension/manifest.json'), resolve(outDir, 'manifest.json'));
await copyFile(resolve(root, 'public/Alibaba-PuHuiTi-Regular.ttf'), resolve(outDir, 'Alibaba-PuHuiTi-Regular.ttf'));
console.info('Load the unpacked extension from ' + outDir);
