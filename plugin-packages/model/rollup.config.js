import { getBanner, getPlugins } from '../../scripts/rollup-config-helper';
import appxConfig from './rollup.appx.config';

const pkg = require('./package.json');
const globals = {
  '@galacean/effects': 'ge',
};
const external = Object.keys(globals);
const banner = getBanner(pkg);
const plugins = getPlugins(pkg, { external });

export default () => {
  return [
    {
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
        name: 'ge.modelPlugin',
        banner,
        globals,
        sourcemap: true,
      },
      external,
      plugins: getPlugins(pkg, { min: true, external }),
    }, {
      input: 'src/loader.ts',
      output: [{
        file: 'dist/loader.mjs',
        format: 'es',
        banner,
        sourcemap: true,
      }],
      external,
      plugins,
    },
    ...appxConfig.map(config => ({ ...config, plugins: config.plugins.concat(plugins) }))
  ];
};
