import type { GLType, PlayerConfig } from '@galacean/effects';
import { AssetManager, Player } from '@galacean/effects';
import { TestPlayer } from './test-player';
import { loadScript } from '../utilities';

const params = new URLSearchParams(location.search);
const oldVersion = params.get('version') || '2.9.0';

// true: 从本地 public/old-dist 加载对照版本；false: 从 CDN 加载
const useLocalBuild = true;

const playerOptions: PlayerConfig = {
  env: 'editor',
  renderOptions: {
    willCaptureImage: true,
  },
  pixelRatio: 2,
  manualRender: true,
};

export class TestController {
  renderFramework = 'webgl';
  oldPlayer: TestPlayer;
  newPlayer: TestPlayer;

  constructor (
    public is3DCase = false,
  ) { }

  async createPlayers (
    width: number,
    height: number,
    renderFramework: GLType,
  ) {
    await this.loadOldPlayer(oldVersion);
    await this.loadOldPlugin('model', oldVersion);
    await this.loadOldPlugin('rich-text', oldVersion);
    await this.loadOldPlugin('spine', oldVersion);
    await this.loadOldPlugin('orientation-transformer', oldVersion);

    this.renderFramework = renderFramework;
    const legacyGe = window.ge;

    if (legacyGe?.Player && legacyGe?.AssetManager) {
      this.oldPlayer = new TestPlayer(
        width, height, legacyGe.Player, playerOptions, renderFramework, legacyGe.AssetManager, true, this.is3DCase
      );
      this.newPlayer = new TestPlayer(
        width, height, Player, playerOptions, renderFramework, AssetManager, false, this.is3DCase
      );
      console.info('[Test] Create all players.');
    } else {
      console.info('[Test] Create player error: window.ge.Player is undefined.');
    }
  }

  async loadOldPlayer (version: string) {
    const url = useLocalBuild
      ? '/old-dist/effects/dist/index.min.js'
      : `https://unpkg.com/@galacean/effects@${version}/dist/index.min.js`;

    return loadScript(url);
  }

  async loadOldPlugin (name: string, version: string) {
    const url = useLocalBuild
      ? `/old-dist/effects-plugin-${name}/dist/index.min.js`
      : `https://unpkg.com/@galacean/effects-plugin-${name}@${version}/dist/index.min.js`;

    return loadScript(url);
  }

  disposePlayers () {
    this.oldPlayer.dispose();
    this.newPlayer.dispose();
  }
}
