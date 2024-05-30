/**
 * 小程序产物编译配置
 */
import inject from '@rollup/plugin-inject';

const module = '@galacean/appx-adapter';
const commonAdapterList = [
  'window',
  'document',
  'navigator'
];
const adapterList = {
  alipay: [...commonAdapterList],
}

export default [
  'alipay'
].map(platform => {
  const adapterVars = {};
  const paths = { '@galacean/effects': `@galacean/effects/${platform}`};

  adapterList[platform].forEach(name => {
    adapterVars[name] = [`${module}/${platform}`, name];
  });

  return {
    input: `src/index.ts`,
    output: [{
      file: `./dist/${platform}.mjs`,
      format: 'es',
      sourcemap: true,
      paths,
    }, {
      file: `./dist/${platform}.js`,
      format: 'cjs',
      sourcemap: true,
      paths,
    }],
    external: ['@galacean/effects'],
    plugins: [
      inject(adapterVars),
    ],
  };
});
