import { getBanner, getPlugins } from '../../scripts/rollup-config-helper';

const pkg = require('./package.json');
const globals = {
  '@galacean/effects': 'ge',
};
const external = Object.keys(globals);
const banner = getBanner(pkg);
const plugins = getPlugins(pkg, { useWasm: true, external });

export default () => {
  return [{
    input: 'src/index.ts',
    output: [{
      file: pkg.module,
      format: 'es',
      banner,
      sourcemap: true,
    }, {
      file: pkg.main,
      format: 'cjs',
      banner,
      sourcemap: true,
    }],
    external,
    plugins,
  }, {
    input: 'src/index.ts',
    output: {
      file: pkg.browser,
      format: 'umd',
      name: 'ge.performanceMonitorPlugin',
      banner,
      globals,
      sourcemap: true,
    },
    external,
    plugins: getPlugins(pkg, { min: true, useWasm: true, external }),
  }];
};
