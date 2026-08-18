import { Player, spec, TextComponent, type FancyConfig } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*USLUS5p9X0IAAAAAQoAAAAgAelB4AQ';
const container = document.getElementById('J-container');

/**
 * Virtual Runtime payload for the RichText fancy path.
 * The Runtime receives one complete markup string; this object is only a
 * browser-side test fixture, not editor state or a JSON loader.
 */
const virtualRichTextOptions = {
  text: '普通<b>重点</b>说明<i>重点</i>',
  fontFamily: 'Arial',
  fontSize: 42,
  textColor: [1, 1, 1, 1] as spec.vec4,
  textAlign: spec.TextAlignment.left,
  textVerticalAlign: spec.TextVerticalAlign.middle,
  textOverflow: spec.TextOverflow.visible,
  lineHeight: 52,
  wrapEnabled: true,
  maxTextWidth: 680,
  maxTextHeight: 330,
  autoResize: spec.TextSizeMode.fixed,
  fancyConfig: {
    layers: [
      {
        kind: 'single-stroke' as const,
        category: 'base' as const,
        params: { color: [0, 0, 0, 1] as spec.vec4, width: 2, unit: 'px' as const },
      },
      {
        kind: 'solid-fill' as const,
        category: 'base' as const,
        params: { color: [1, 1, 1, 1] as spec.vec4 },
      },
    ],
    rangeStacks: [
      {
        name: 'emphasis',
        layers: [
          {
            kind: 'single-stroke' as const,
            category: 'base' as const,
            params: { color: [1, 0, 0, 1] as spec.vec4, width: 5, unit: 'px' as const },
          },
          {
            kind: 'solid-fill' as const,
            category: 'base' as const,
            params: { color: [1, 1, 0, 1] as spec.vec4 },
          },
        ],
      },
    ],
    // Parser ranges: 普通 / 重点 / 说明 / 重点.
    rangeOverrides: [null, 1, null, 1],
  } satisfies FancyConfig,
};

(async () => {
  try {
    const player = new Player({
      container,
    });
    const composition = await player.loadScene(json, {
      variables: {
        'richText_15': '富文本：\n【<color=#e92929ff>Auto Height</color>】\n【<i>右对齐</i>】\n【<color=#add633ff>尺寸适配</color>】\n【<b><color=#cd15f4ff>居中对齐</color></b>】\n【<size=60>字号60</size>】',
      },
    });
    const item19 = composition.getItemByName('text_19')?.getComponent(TextComponent);
    const item10 = composition.getItemByName('richText_10')?.getComponent(RichTextComponent);
    const item8 = composition.getItemByName('richText_8')?.getComponent(RichTextComponent);

    item19?.setOutlineColor([0, 255, 0, 0.5]);
    item10?.setTextColor([255, 255, 0, 1]);
    item8?.setTextColor([255, 0, 0, 1]);
    item8?.setOverflow(spec.TextOverflow.visible);
    item8?.setTextAlign(spec.TextAlignment.left);
    item8?.updateWithOptions(virtualRichTextOptions);
  } catch (e) {
    console.error('biz', e);
  }
})();
