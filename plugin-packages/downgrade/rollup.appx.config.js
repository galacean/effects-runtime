/**
 * 小程序产物编译配置
 */
import inject from '@rollup/plugin-inject';

const module = '@galacean/appx-adapter';
const commonAdapterList = [
  'window'
];
const adapterList = {
  alipay: [...commonAdapterList],
  weapp: [...commonAdapterList],
  douyin: [...commonAdapterList],
}

export default [
  'weapp',
  'alipay',
  'douyin',
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
