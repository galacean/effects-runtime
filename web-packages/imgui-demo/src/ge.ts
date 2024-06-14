import { Player } from '@galacean/effects';

export class GalaceanEffects {
  static player: Player;
  static initialize () {
    const container = document.getElementById('J-container');
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*oF1NRJG7GU4AAAAAAAAAAAAADlB4AQ';

    GalaceanEffects.player = new Player({
      container,
    });

    void GalaceanEffects.player.loadScene(json);
  }
}