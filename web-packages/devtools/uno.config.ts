import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

const safelist: string[] = [
  'i-vscode-icons-default-file',
  'i-vscode-icons-default-folder',
  'i-vscode-icons-file-type-image',
  'i-vscode-icons-file-type-video',
  'i-vscode-icons-file-type-audio',
  'i-vscode-icons-file-type-pdf2',
  'i-vscode-icons-file-type-word',
  'i-vscode-icons-file-type-excel',
  'i-vscode-icons-file-type-powerpoint',
  'i-vscode-icons-file-type-zip',
  'i-vscode-icons-file-type-markdown',
  'i-vscode-icons-file-type-json',
  'i-vscode-icons-file-type-text',

  'i-vscode-icons-file-type-vue',
  'i-vscode-icons-file-type-js',
  'i-vscode-icons-file-type-typescript',
  'i-vscode-icons-file-type-css',
  'i-vscode-icons-file-type-html',
  'i-vscode-icons-file-type-yaml',
];

export default defineConfig({
  shortcuts: [],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  safelist,
});
