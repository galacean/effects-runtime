import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
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
  'three': 'THREE',
};
const plugins = [
  replace({
    preventAssignment: true,
    values: defines,
  }),
  glslInner(),
  typescript({ tsconfig: '../../tsconfig.bundle.json' }),
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
    external: ['three'],
    plugins,
  }, {
    input: 'src/index.ts',
    output: {
      file: pkg.brower,
      format: 'umd',
      name: 'ge.three',
      banner,
      globals,
      sourcemap: true,
    },
    external: ['three'],
    plugins: plugins.concat(
      terser()
    ),
  }];
};
