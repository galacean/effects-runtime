import type { Composition } from '@galacean/effects';
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';

const container = document.getElementById('J-container');

const sceneUrls = [
  'https://mdn.alipayobjects.com/mars/afts/file/A*T--xQLRquWIAAAAAQDAAAAgAelB4AQ',
  'https://mdn.alipayobjects.com/mars/afts/file/A*0bhFRY1b4_oAAAAAQDAAAAgAelB4AQ',
  'https://mdn.alipayobjects.com/mars/afts/file/A*S65MSZtdKdMAAAAAQDAAAAgAelB4AQ',
];

(async () => {
  try {
    const player = new Player({ container });
    let prev: Composition | undefined;

    for (const url of sceneUrls) {
      const composition = await player.loadScene(url);

      prev?.dispose();
      prev = composition;

      await new Promise<void>(resolve => {
        composition.on('end', () => resolve());
      });
    }

    prev?.dispose();
  } catch (e) {
    console.error('biz', e);
  }
})();