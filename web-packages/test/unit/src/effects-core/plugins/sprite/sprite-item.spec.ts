import { Texture, generateGUID } from '@galacean/effects';
import { Player, SpriteComponent } from '@galacean/effects';

const { expect } = chai;

describe('core/plugins/sprite/item', () => {
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
  it('sprite set color ', async () => {
    const itemID = generateGUID();
    const componentID = generateGUID();
    const compositionID = generateGUID();
    const imageId = generateGUID();
    const json = {
      'images': [ // Fix: Replace single quote with double quote
        {
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original',
          'id': imageId,
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
          sceneBindings: [],
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
          'source': {
            id: imageId,
          },
          'flipY': true,
        },
      ],
    };
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteItem = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);

    spriteItem?.setColor([0.3, 0.2, 0.2, 1]);

    expect(spriteItem?.color.toArray()).to.eql([0.3, 0.2, 0.2, 1], 'color');

    const material = spriteItem?.material;
    const color = material?.getColor('_Color')?.toArray();

    expect(color).to.eql([0.3, 0.2, 0.2, 1], 'color');
  });

  // 图片设置
  it('sprite set texture', async () => {
    const itemID = generateGUID();
    const componentID = generateGUID();
    const compositionID = generateGUID();
    const imageID = generateGUID();
    const json = {
      'images': [ // Fix: Replace single quote with double quote
        {
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original',
          'renderLevel': 'B+',
          'id': imageID,
        },
      ],
      'spines': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          sceneBindings: [],
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
          'source': {
            id: imageID,
          },
          'flipY': true,
        },
      ],
    };
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteItem = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);

    spriteItem?.setColor([0.3, 0.2, 0.2, 1]);

    const testTexture = await Texture.fromImage('https://gw.alipayobjects.com/mdn/rms_2e421e/afts/img/A*fRtNTKrsq3YAAAAAAAAAAAAAARQnAQ', player.renderer.engine);

    spriteItem?.setTexture(testTexture);
    const material = spriteItem?.material;
    const texture = material?.getTexture('_MainTex');

    expect(texture?.id).to.eql(testTexture.id, 'texture id');
  });

  // 显示隐藏设置
  it('sprite set visible ', async () => {
    const itemID = generateGUID();
    const componentID = generateGUID();
    const compositionID = generateGUID();
    const imageID = generateGUID();
    const json = {
      'images': [ // Fix: Replace single quote with double quote
        {
          'url': 'https://mdn.alipayobjects.com/mars/afts/img/A*MeN0T6slLYEAAAAAAAAAAAAADlB4AQ/original',
          'renderLevel': 'B+',
          'id': imageID,
        },
      ],
      'spines': [],
      'version': '3.0',
      'shapes': [],
      'plugins': [],
      'type': 'ge',
      'compositions': [
        {
          sceneBindings: [],
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
          'globalVolume': {
            // 'useHDR': true,
            // 'useBloom': 1,
            // 'threshold': 0.8,
            // 'bloomIntensity': 1,
            // 'brightness': 1.5,
            // 'saturation': 1,
            // 'contrast': 1,
            // 'useToneMapping': 1,
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
          'source': {
            id: imageID,
          },
          'flipY': true,
        },
      ],
    };
    const comp = await player.loadScene(json);

    player.gotoAndPlay(0.01);

    const spriteItem = comp.getItemByName('sprite_1')!.getComponent(SpriteComponent);

    spriteItem?.setVisible(false);
    player.gotoAndPlay(0.01);
    const visible = spriteItem?.getVisible();

    expect(visible).to.eql(false, 'visible');
  });
});
