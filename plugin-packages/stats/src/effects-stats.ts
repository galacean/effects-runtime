import type { Player } from '@galacean/effects';
import { StatsComponent } from './stats-component';

export interface EffectsStatsOptions {
  debug?: boolean,
}

export class EffectsStats {
  /**
   * 播放器对象
   */
  player: Player;
  static options: EffectsStatsOptions;
  constructor (player: Player, options: EffectsStatsOptions = { debug: true }) {

    const json = {
      'playerVersion': {
        'web': '2.0.0-alpha.29',
        'native': '0.0.1.202311221223',
      },
      'images': [],
      'fonts': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': '2',
          'name': 'stats',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 2,
          'previewSize': [750, 1624],
          'items': [
            {
              'id': '05e1c616baf34cc084968a05703719cd',
            },
          ],
          'camera': {
            'fov': 60,
            'far': 40,
            'near': 0.1,
            'clipMode': 1,
            'position': [0, 0, 8],
            'rotation': [0, 0, 0],
          },
          'sceneBindings': [
          ],
        },
      ],
      'components': [
      ],
      'geometries': [],
      'materials': [],
      'items': [
        {
          'id': '05e1c616baf34cc084968a05703719cd',
          'name': 'component',
          'duration': 99999,
          'type': '1',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          'renderLevel': 'B+',
          'components': [
          ],
          'transform': {
            'position': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'eulerHint': {
              'x': 0,
              'y': 0,
              'z': 0,
            },
            'anchor': {
              'x': 0,
              'y': 0,
            },
            'size': {
              'x': 1.2,
              'y': 1.2,
            },
            'scale': {
              'x': 1,
              'y': 1,
              'z': 1,
            },
          },
          'dataType': 'VFXItemData',
        },
      ],
      'shaders': [],
      'bins': [],
      'textures': [],
      'animations': [],
      'compositionId': '2',
    };

    EffectsStats.options = options;
    this.player = player;
    player.loadScene(json).then(composition => {
      const component = composition.getItemByName('component')!;

      component.addComponent(StatsComponent);
    }).catch(e => {
      throw new Error(`Failed to load scene: ${e.message}`);
    });
  }

}
