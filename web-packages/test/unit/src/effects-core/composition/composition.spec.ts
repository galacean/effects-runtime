import { Composition, generateGUID, Player, UICanvas } from '@galacean/effects';

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

  it('creates and owns an isolated UICanvas for every composition', () => {
    const engine = player.engine;
    const first = new Composition(engine);
    const second = new Composition(engine);

    first.root.awake();
    first.root.beginPlay();
    second.root.awake();
    second.root.beginPlay();

    expect(first.uiCanvas).not.equals(second.uiCanvas);
    expect(first.uiCanvas).instanceOf(UICanvas);
    expect(second.uiCanvas).instanceOf(UICanvas);
    expect(first.root.parent).equals(engine.root);
    expect(second.root.parent).equals(engine.root);
    expect(first.sceneRoot.getComponent(UICanvas)).equals(first.uiCanvas);
    expect(second.sceneRoot.getComponent(UICanvas)).equals(second.uiCanvas);
    expect(engine.windowRoot.canvases.children).includes(first.uiCanvas.rootControl);
    expect(engine.windowRoot.canvases.children).includes(second.uiCanvas.rootControl);

    first.setIndex(10);
    second.setIndex(-5);
    expect(engine.compositions).deep.equals([second, first]);
    expect(first.uiCanvas.order).equals(10);
    expect(second.uiCanvas.order).equals(-5);
    expect(engine.windowRoot.canvases.children.indexOf(second.uiCanvas.rootControl))
      .lessThan(engine.windowRoot.canvases.children.indexOf(first.uiCanvas.rootControl));

    const renderOutput: string[] = [];

    first.renderContent = () => renderOutput.push('first');
    second.renderContent = () => renderOutput.push('second');
    first.render();
    expect(renderOutput).deep.equals(['first']);

    first.interactive = false;
    expect(first.uiCanvas.receivesEvents).equals(false);
    first.interactive = true;
    expect(first.uiCanvas.receivesEvents).equals(true);

    const firstRoot = first.uiCanvas.rootControl;
    const secondRoot = second.uiCanvas.rootControl;

    first.dispose();
    second.dispose();
    expect(firstRoot.isDisposed).equals(true);
    expect(secondRoot.isDisposed).equals(true);
    expect(engine.windowRoot.canvases.children).not.includes(firstRoot);
    expect(engine.windowRoot.canvases.children).not.includes(secondRoot);
    expect(engine.root.children).not.includes(first.root);
    expect(engine.root.children).not.includes(second.root);
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

    expect(comp.items[0].isActive).to.eql(false, 'composition visible');
  });
});
