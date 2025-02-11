import { generateGUID, SpriteComponent, Texture } from '@galacean/effects';
import { Player } from '@galacean/effects';

const { expect } = chai;

describe('core/components/baseRenderComponent', () => {
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

  // 纹理设置设置
  it('baseRenderComponent setTexture by URL', async () => {
    const itemID = generateGUID();
    const componentID = generateGUID();
    const compositionID = generateGUID();
    const textureID = 'c8e75e0b46a44b9ca6e9c98b9b461f37';
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
              id: textureID,
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
          'id': textureID,
          'dataType': 'Texture',
          'source': { 'id':'b606195723d53983ab64633cddf809c1' },
          'flipY': true,
        },
      ],
    };
    const comp = await player.loadScene(json);
    const component = comp.getItemByName('sprite_1')?.getComponent(SpriteComponent);

    if (!component) {
      throw Error('component is null');
    }
    const oldTexture = component.renderer.texture;

    await component.setTexture('https://mdn.alipayobjects.com/huamei_anctlg/afts/img/jrkZT4T1qxEAAAAAAAAAAAAADqQ2AQFr/original');
    const newTexture = component.renderer.texture;
    const texture = component.material.getTexture('_MainTex');

    expect(oldTexture.id).not.eql(newTexture.id, 'newTexture');
    expect(newTexture.id).to.eql(texture?.id, 'final texture id');
  });

  it('baseRenderComponent setTexture by Texture', async () => {
    const itemID = generateGUID();
    const componentID = generateGUID();
    const compositionID = generateGUID();
    const textureID = 'c8e75e0b46a44b9ca6e9c98b9b461f37';
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
              id: textureID,
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
          'id': textureID,
          'dataType': 'Texture',
          'source': { 'id':'b606195723d53983ab64633cddf809c1' },
          'flipY': true,
        },
      ],
    };
    const comp = await player.loadScene(json);
    const component = comp.getItemByName('sprite_1')?.getComponent(SpriteComponent);

    if (!component) {
      throw Error('component is null');
    }
    const oldTexture = component.renderer.texture;
    const newTexture = await Texture.fromImage('https://mdn.alipayobjects.com/huamei_anctlg/afts/img/jrkZT4T1qxEAAAAAAAAAAAAADqQ2AQFr/original', player.renderer.engine);

    component.setTexture(newTexture);
    const texture = component.material.getTexture('_MainTex');

    expect(oldTexture.id).not.eql(newTexture.id, 'newTexture');
    expect(newTexture.id).to.eql(texture?.id, 'final texture id');
  });
});
