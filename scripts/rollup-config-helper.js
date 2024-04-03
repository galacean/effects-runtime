import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { swc, defineRollupSwcOption, minify } from 'rollup-plugin-swc3';
import glslInner from './rollup-plugin-glsl-inner';

export function getPlugins(pkg, options = {}) {
  const { min = false, target = 'es5' } = options;
  const defines = {
    __VERSION__: JSON.stringify(pkg.version),
    __DEBUG__: false,
  };
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
          target,
        },
        sourceMaps: true,
      }),
    ),
    resolve(),
    commonjs(),
  ];

  if (min) {
    plugins.push(minify({ sourceMap: true }));
  }

  return plugins;
}

export function getBanner(pkg) {
  return `/*!
 * Name: ${pkg.name}
 * Description: ${pkg.description}
 * Author: ${pkg.author}
 * Contributors: ${pkg.contributors.map(c => c.name).join(',')}
 * Version: v${pkg.version}
 */
`;
}

export function onwarn(warning) {
  if (warning.code === 'CIRCULAR_DEPENDENCY') {
    return;
  }

  console.warn(`(!) ${warning.message}`)
}
