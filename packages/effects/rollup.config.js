import { getBanner, getPlugins } from '../../scripts/rollup-config-helper';
import appxConfig from './rollup.appx.config';

const pkg = require('./package.json');
const banner = getBanner(pkg);
const plugins = getPlugins(pkg);

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
      plugins,
    }, {
      input: 'src/index.ts',
      output: {
        file: pkg.browser,
        format: 'umd',
        name: 'ge',
        banner,
        sourcemap: true,
      },
      plugins: getPlugins(pkg, { min: true }),
    },
    ...appxConfig.map(config => ({ ...config, plugins: plugins.concat(config.plugins) }))
  ];
};
