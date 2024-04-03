import { getBanner, getPlugins } from '../../scripts/rollup-config-helper';

const pkg = require('./package.json');
const banner = getBanner(pkg);
const plugins = getPlugins(pkg);
const globals = {
  '@galacean/effects': 'ge',
};
const external = Object.keys(globals);

export default () => {
  return [{
    input: 'src/index.ts',
    output: [{
      file: pkg.module,
      format: 'es',
      banner,
      globals,
      sourcemap: true,
    }, {
      file: pkg.main,
      format: 'cjs',
      banner,
      globals,
      sourcemap: true,
    }],
    external,
    plugins,
  }, {
    input: 'src/index.ts',
    output: {
      file: pkg.brower,
      format: 'umd',
      name: 'ge.modelPlugin',
      banner,
      globals,
      sourcemap: true,
    },
    external,
    plugins: getPlugins(pkg, { min: true }),
  }, {
    input: 'src/loader.ts',
    output: [{
      file: 'dist/loader.mjs',
      format: 'es',
      banner,
      globals,
      sourcemap: true,
    }],
    external,
    plugins,
  }];
};
