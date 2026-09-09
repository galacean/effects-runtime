import { generateGUID, Player, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/composition', () => {
  let player: Player;

  before(() => {
    const canvas = document.createElement('canvas');
    const renderOptions = {
      canvas,
      pixelRatio: 1,
      manualRender: true,
      interactive: true,
    };

    player = new Player({ ...renderOptions });
  });

  after(() => {
    player && player.dispose();
  });

  // 颜色设置
  it('composition set visible', async () => {
    const itemID = generateGUID();
    const componentID = generateGUID();
    const compositionID = generateGUID();
    const json = {
      'images': [ // Fix: Replace single quote with double quote
        {
          'id':'b606195723d53983ab64633cddf809c1',
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original',
          'renderLevel': 'B+',
        },
      ],
      'spines': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          'id': compositionID,
          'name': '图层设置',
          'duration': 5,
          'startTime': 0,
          'endBehavior': 2,
          'previewSize': [
            0,
            0,
          ],
          'items': [
            {
              id: itemID,
            },
          ],
          'camera': {
            'fov': 60,
            'far': 1000,
            'near': 0.3,
            'clipMode': 0,
            'position': [
              0,
              0,
              8,
            ],
            'rotation': [
              0,
              0,
              0,
            ],
          },
          'sceneBindings':[],
          'globalVolume': {
            'useHDR': true,
            'useBloom': 1,
            'threshold': 0.8,
            'bloomIntensity': 1,
            'brightness': 1.5,
            'saturation': 1,
            'contrast': 1,
            'useToneMapping': 1,
          },
        },
      ],
      'components': [
        {
          options: {

          },
          renderer: {
            renderMode: 1,
            texture: {
              id: 'c8e75e0b46a44b9ca6e9c98b9b461f37',
            },
          },
          item: {
            id: itemID,
          },
          id: componentID,
          dataType: 'SpriteComponent',
        },
      ],
      'items': [
        {
          id: itemID,
          duration: 5,
          type: '1',
          'visible': true,
          'endBehavior': 0,
          'delay': 0,
          name: 'sprite_1',
          dataType: 'VFXItemData',
          components: [
            {
              id: componentID,
            },
          ],
        },
      ],
      'materials': [
      ],
      'shaders': [
      ],
      'geometries': [
      ],
      'renderLevel': 'B+',
      'requires': [],
      'compositionId': compositionID,
      'bins': [],
      'textures': [
        {
          'sourceType': 2,
          'keepImageSource': true,
          'minFilter': 9729,
          'magFilter': 9729,
          'id': 'c8e75e0b46a44b9ca6e9c98b9b461f37',
          'dataType': 'Texture',
          'source': { 'id':'b606195723d53983ab64633cddf809c1' },
          'flipY': true,
        },
      ],
    };
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    comp.setVisible(false);

    expect(comp.items[0].isActive).to.eql(false, 'deactivates composition descendants');
    expect(comp.items[0].isActive).to.eql(false, 'composition visible');
    comp.setVisible(true);
    expect(comp.items[0].isActive).to.eql(true, 'restores composition visibility');
  });

  async function loadPlaybackScene (startTime = 0) {
    player.destroyCurrentCompositions();
    const id = generateGUID();

    return player.loadScene({
      version: '1.5', type: 'mars', compositionId: id,
      compositions: [{
        id, name: 'playback', duration: 2, startTime, endBehavior: spec.EndBehavior.freeze,
        items: [{
          id: '1', name: 'node', type: '3', delay: 0, duration: 5, endBehavior: spec.EndBehavior.freeze,
          content: { options: { startColor: [1, 1, 1, 1] } },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        }],
      }],
      images: [], textures: [], bins: [], plugins: [], shapes: [],
    }, { autoplay: false, reusable: true });
  }

  it('plays from startTime and preserves the position when resuming or playing again', async () => {
    const comp = await loadPlaybackScene(1.3);
    const playEvents: number[] = [];

    comp.on('play', () => playEvents.push(comp.time));
    comp.play();
    expect(comp.time).closeTo(1.3, 0.000001);
    expect(playEvents.length).equals(1);
    comp.gotoAndStop(0.4);
    comp.play();
    expect(comp.time).closeTo(1.7, 0.000001);
    comp.play();
    expect(comp.time).closeTo(1.7, 0.000001);
  });

  it('restarts at startTime while preserving pause and speed', async () => {
    const comp = await loadPlaybackScene(1.3);

    comp.gotoAndStop(0.8);
    comp.setSpeed(2);
    comp.restart();
    expect(comp.time).closeTo(1.3, 0.000001);
    expect(comp.getPaused()).equals(true);
    expect(comp.getSpeed()).equals(2);
    comp.resume();
    comp.update(100);
    expect(comp.time).closeTo(1.5, 0.000001);
    comp.restart();
    expect(comp.time).closeTo(1.3, 0.000001);
    expect(comp.getPaused()).equals(false);
    expect(comp.getSpeed()).equals(2);
  });

  it('plays an ended reusable composition from the beginning', async () => {
    const comp = await loadPlaybackScene();

    comp.gotoAndStop(2.1);
    expect(comp.isEnded).equals(true);
    comp.play();
    expect(comp.time).closeTo(0, 0.000001);
    expect(comp.isEnded).equals(false);
    expect(comp.getPaused()).equals(false);
    comp.update(100);
    expect(comp.time).closeTo(0.1, 0.000001);
  });

});
