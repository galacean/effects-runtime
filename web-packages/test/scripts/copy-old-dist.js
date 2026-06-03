const { cpSync, mkdirSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..', '..', '..');
const dest = resolve(__dirname, '..', 'public', 'old-dist');

const packages = [
  { src: 'packages/effects', name: 'effects' },
  { src: 'plugin-packages/model', name: 'effects-plugin-model' },
  { src: 'plugin-packages/rich-text', name: 'effects-plugin-rich-text' },
  { src: 'plugin-packages/spine', name: 'effects-plugin-spine' },
  { src: 'plugin-packages/orientation-transformer', name: 'effects-plugin-orientation-transformer' },
];

for (const pkg of packages) {
  const srcDir = resolve(root, pkg.src, 'dist');
  const destDir = resolve(dest, pkg.name, 'dist');

  mkdirSync(destDir, { recursive: true });
  cpSync(srcDir, destDir, { recursive: true });
  console.log(`Copied ${pkg.src}/dist -> public/old-dist/${pkg.name}/dist`);
}
