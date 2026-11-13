import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import '@galacean/effects-plugin-ffd';
import '@galacean/effects-plugin-gui';
import '@galacean/effects-plugin-ktx2';
import '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-multimedia';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-rich-text';
import '@galacean/effects-plugin-spine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*IErLSZ4kVt8AAAAARoAAAAgAelB4AQ';
const container = document.getElementById('J-container')!;
const player = new Player({ container });

player.loadScene(json).catch(console.error);
