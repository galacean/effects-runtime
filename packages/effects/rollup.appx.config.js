/**
 * 小程序产物编译配置
 */
import inject from '@rollup/plugin-inject';

const module = "@galacean/appx-adapter";
const commonAdapterList = [
  "btoa",
  "URL",
  "Blob",
  "window",
  "atob",
  "devicePixelRatio",
  "document",
  "Element",
  "Event",
  "EventTarget",
  "HTMLCanvasElement",
  "HTMLElement",
  "HTMLMediaElement",
  "HTMLVideoElement",
  "Image",
  "navigator",
  "Node",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "screen",
  "XMLHttpRequest",
  "performance",
  "WebGLRenderingContext",
  "WebGL2RenderingContext",
  "ImageData",
  "location",
  "OffscreenCanvas",
  "URLSearchParams"
];
const adapterList = {
  // weapp: [...commonAdapterList],
  alipay: [...commonAdapterList],
}
export default [
  'weapp',
  'alipay'
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
