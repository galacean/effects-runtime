import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

import { componentsDir } from '@advjs/gui/node';
import Components from 'unplugin-vue-components/vite';
import UnoCSS from 'unocss/vite';
import GLSL from 'unplugin-glsl/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),

    UnoCSS(),

    // @ts-expect-error vite plugin
    Components({
      include: [/\.vue/],
      dirs: [
        'src/components',
        componentsDir,
      ],
    }),

    GLSL(),
  ],
});
