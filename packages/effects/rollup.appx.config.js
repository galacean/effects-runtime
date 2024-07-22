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
  'btoa',
  'atob',
  'devicePixelRatio',
  'Element',
  'Event',
  'EventTarget',
  'HTMLMediaElement',
  'Node',
  'screen',
  'WebGL2RenderingContext',
  'ImageData',
  'OffscreenCanvas',
  'URLSearchParams',
  'crypto',
];
const adapterList = {
  weapp: [...commonAdapterList],
  alipay: [...commonAdapterList],
  douyin: [...commonAdapterList],
}

export default [
  'weapp',
  'alipay',
  'douyin',
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
