/**
 * 小程序产物编译配置
 */
import inject from '@rollup/plugin-inject';
const module = '@galacean/appx-adapter';
const commonAdapterList = [
  'window',
  'navigator',
  'HTMLElement',
  'HTMLImageElement',
  'HTMLCanvasElement',
  'HTMLVideoElement',
  'document',
  'WebGLRenderingContext',
  'Image',
  'URL',
  'location',
  'XMLHttpRequest',
  'Blob',
  'performance',
  'requestAnimationFrame',
  'cancelAnimationFrame',
];
const adapterList = {
  weapp: [...commonAdapterList],
}
export default [
  'weapp',
].map(platform => {
  const adapterVars = {};
  adapterList[platform].forEach(name => {
    adapterVars[name] = [`${module}/${platform}`, name];
  });
  return {
    input: `src/index.ts`,
    output: [{
      file: `./dist/${platform}.mjs`,
      format: 'es',
      sourcemap: true,
    }, {
      file: `./dist/${platform}.js`,
      format: 'cjs',
      sourcemap: true,
    }],
    plugins: [
      inject(adapterVars),
    ],
  };
});
