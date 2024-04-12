import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { swc, defineRollupSwcOption, minify } from 'rollup-plugin-swc3';
import glslInner from './rollup-plugin-glsl-inner';

export function getPlugins(pkg, options = {}) {
  const { min = false, target, external } = options;
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
    getSWCPlugin({ target }, external),
    resolve(),
    commonjs(),
  ];

  if (min) {
    plugins.push(minify({ sourceMap: true }));
  }

  return plugins;
}

export { glslInner };

export function getSWCPlugin(
  jscOptions = {},
  external = [],
) {
  const jsc = {
    loose: true,
    externalHelpers: true,
    target: 'ES5',
    ...jscOptions,
  }
  const options = {
    exclude: [],
    jsc,
    sourceMaps: true,
  };

  // swc 会把 tsconfig 中配置的 paths 当作依赖打进包中，rollup 设置的 external 无效
  // 故此处通过独立的 tsconfig 配置 paths 为空来做
  if (external.length !== 0) {
    options['tsconfig'] = './tsconfig.external.json';
  }

  return swc(
    defineRollupSwcOption(options),
  );
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
