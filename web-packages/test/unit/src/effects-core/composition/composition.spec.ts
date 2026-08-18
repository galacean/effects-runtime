import { CanvasLayer, Composition, generateGUID, Player, SubViewport, Viewport, Window } from '@galacean/effects';

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

  it('creates and owns an isolated viewport for every composition', () => {
    const engine = player.engine;
    const first = new Composition(engine);
    const second = new Composition(engine);

    expect(first.viewport).not.equals(engine.viewport);
    expect(second.viewport).not.equals(engine.viewport);
    expect(first.viewport).not.equals(second.viewport);
    expect(engine.viewport).instanceOf(Window);
    expect(engine.viewport.item).equals(engine.root);
    expect(engine.viewport.parent).equals(null);
    expect(first.viewport).instanceOf(SubViewport);
    expect(second.viewport).instanceOf(SubViewport);
    expect(first.root.parent).equals(engine.root);
    expect(second.root.parent).equals(engine.root);
    expect(first.viewport.parent).equals(engine.viewport);
    expect(second.viewport.parent).equals(engine.viewport);
    expect(first.viewport.item).equals(first.root);
    expect(second.viewport.item).equals(second.root);
    expect(first.root.getComponent(Viewport)).equals(first.viewport);
    expect(second.root.getComponent(Viewport)).equals(second.viewport);
    expect(first.sceneRoot.getViewport()).equals(first.viewport);
    expect(second.sceneRoot.getViewport()).equals(second.viewport);
    expect(engine.getViewportsInRenderOrder()).includes(first.viewport);
    expect(engine.getViewportsInRenderOrder()).includes(second.viewport);
    expect(first.pluginRoot.getComponent(CanvasLayer)).equals(undefined);

    first.setIndex(10);
    second.setIndex(-5);
    expect(first.viewport.outputOrder).equals(10);
    expect(second.viewport.outputOrder).equals(-5);
    expect(engine.getViewportsInRenderOrder()).deep.equals([second.viewport, first.viewport]);

    const renderOutput: string[] = [];

    first.renderContent = () => renderOutput.push('first');
    second.renderContent = () => renderOutput.push('second');
    engine.viewport.render();
    expect(renderOutput).deep.equals(['second', 'first']);

    renderOutput.length = 0;
    first.render();
    expect(renderOutput).deep.equals(['first']);

    first.interactive = false;
    expect(first.viewport.inputDisabled).equals(true);
    first.interactive = true;
    expect(first.viewport.inputDisabled).equals(false);

    const firstViewport = first.viewport;
    const secondViewport = second.viewport;

    first.dispose();
    second.dispose();
    expect(firstViewport.isDisposed).equals(true);
    expect(secondViewport.isDisposed).equals(true);
    expect(engine.viewport.isDisposed).equals(false);
    expect(engine.getViewportsInRenderOrder()).deep.equals([]);
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
