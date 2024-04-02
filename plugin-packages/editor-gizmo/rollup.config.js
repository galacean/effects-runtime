import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { swc, defineRollupSwcOption, minify } from 'rollup-plugin-swc3';
import glslInner from '../../scripts/rollup-plugin-glsl-inner';

const pkg = require('./package.json');
const banner = `/*!
 * Name: ${pkg.name}
 * Description: ${pkg.description}
 * Author: ${pkg.author}
 * Contributors: ${pkg.contributors.map(c => c.name).join(',')}
 * Version: v${pkg.version}
 */
`;

const defines = {
  __VERSION__: JSON.stringify(pkg.version),
  __DEBUG__: false,
};
const globals = {
  '@galacean/effects': 'ge',
};
const external = Object.keys(globals);
const plugins = [
  replace({
    preventAssignment: true,
    values: defines,
  }),
  glslInner(),
  swc(
    defineRollupSwcOption({
      exclude: [],
      jsc: {
        loose: true,
        externalHelpers: true,
        target: 'es5',
      },
      sourceMaps: true,
    }),
  ),
  resolve(),
  commonjs(),
];

export default (commandLineArgs) => {
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
      name: 'ge.editorGizmoPlugin',
      banner,
      globals,
      sourcemap: true,
    },
    external,
    plugins: plugins.concat(
      minify({ sourceMap: true })
    ),
  }];
};
