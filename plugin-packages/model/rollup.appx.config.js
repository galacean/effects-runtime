/**
 * 小程序产物编译配置
 */
export default [
  'alipay',
  'weapp'
].map(platform => {
  const paths = { '@galacean/effects': `@galacean/effects/${platform}` };

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
    plugins: [],
  };
});
