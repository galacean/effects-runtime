const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../../..');
const destination = path.join(root, 'web-packages/test/dist/baseline');
const artifacts = [
  ['packages/effects/dist/index.min.js', 'effects.js'],
  ...['model', 'rich-text', 'spine', 'orientation-transformer'].map(name => [
    `plugin-packages/${name}/dist/index.min.js`, `${name}.js`,
  ]),
];

console.log('正在构建帧对比产物（pnpm build）...');
const build = spawnSync('pnpm', ['build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (build.error || build.status !== 0) {
  console.error('构建失败，未更新帧对比基准。', build.error?.message || build.signal || '');
  process.exit(build.status || 1);
}

// 先检查所有产物，避免缺失文件时只更新一部分基准。
const missing = artifacts.filter(([source]) => !fs.existsSync(path.join(root, source)));

if (missing.length > 0) {
  console.error('构建后仍缺少以下产物，未更新帧对比基准：');
  for (const [source] of missing) {
    console.error(`  ${source}`);
  }
  process.exitCode = 1;
} else {
  fs.mkdirSync(destination, { recursive: true });
  for (const [source, filename] of artifacts) {
    fs.copyFileSync(path.join(root, source), path.join(destination, filename));
    console.log(`${source} -> web-packages/test/dist/baseline/${filename}`);
  }
  console.log('帧对比基准已更新，URL 加 local=true 即可使用。');
}
