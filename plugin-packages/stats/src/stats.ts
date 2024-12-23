import type { Player, Disposable } from '@galacean/effects';
import { StatsComponent } from './stats-component';

/**
 *
 */
export interface StatsOptions {
  /**
   * @default false
   */
  debug?: boolean,
  /**
   * @default true
   */
  visible?: boolean,
  /**
   * @default document.body
   */
  container?: HTMLElement,
}

const defaultStatsOptions: Required<StatsOptions> = {
  debug: false,
  visible: true,
  container: document.body,
};

const json = {
  'images': [],
  'fonts': [],
  'version': '3.0',
  'shapes': [],
  'plugins': [],
  'type': 'ge',
  'compositions': [{
    'id': '2',
    'name': 'stats',
    'duration': 5,
    'startTime': 0,
    'endBehavior': 2,
    'previewSize': [750, 1624],
    'items': [{
      'id': '05e1c616baf34cc084968a05703719cd',
    }],
    'camera': {
      'fov': 60,
      'far': 40,
      'near': 0.1,
      'clipMode': 1,
      'position': [0, 0, 8],
      'rotation': [0, 0, 0],
    },
    'sceneBindings': [],
  }],
  'components': [],
  'geometries': [],
  'materials': [],
  'items': [{
    'id': '05e1c616baf34cc084968a05703719cd',
    'name': 'component',
    'duration': 99999,
    'type': '1',
    'visible': true,
    'endBehavior': 0,
    'delay': 0,
    'renderLevel': 'B+',
    'components': [],
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
  }],
  'shaders': [],
  'bins': [],
  'textures': [],
  'animations': [],
  'compositionId': '2',
};

/**
 *
 */
export class Stats implements Disposable {
  private component: StatsComponent;

  /**
   *
   * @param player
   * @param options
   */
  constructor (
    public readonly player: Player,
    private readonly options?: StatsOptions,
  ) {
    void this.init();
  }

  async init () {
    try {
      const composition = await this.player.loadScene(json);
      const item = composition.getItemByName('component');

      if (item) {
        item.addComponent(StatsComponent).init({ ...defaultStatsOptions, ...this.options });
        this.component = item.getComponent(StatsComponent);
      }
    } catch (e: any) {
      throw new Error(`Failed to load stats scene: ${e.message}.`);
    }
  }

  hide () {
    this.component?.monitor.hide();
  }

  show () {
    this.component?.monitor.show();
  }

  dispose () {
    this.component?.dispose();
  }
}
