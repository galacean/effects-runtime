import fs from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

import { componentsDir } from '@advjs/gui/node';
import Components from 'unplugin-vue-components/vite';
import UnoCSS from 'unocss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import glslInner from '../../scripts/rollup-plugin-glsl-inner';

// https://vitejs.dev/config/
// @ts-expect-error mode
export default defineConfig(({ mode }) => {
  const development = mode === 'development';

  return {
    define: {
      __VERSION__: 0,
      __DEBUG__: !!development,
    },

    plugins: [
      vue(),

      UnoCSS(),

      Components({
        include: [/\.vue/],
        dirs: [
          'src/components',
          componentsDir,
        ],
      }),

      glslInner(),

      tsconfigPaths(),
    ],
  };
});
