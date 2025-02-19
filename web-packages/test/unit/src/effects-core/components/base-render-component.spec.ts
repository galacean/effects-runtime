import { generateGUID, SpriteComponent, Texture } from '@galacean/effects';
import { Player } from '@galacean/effects';

const { expect } = chai;

describe('core/components/base-render-component', () => {
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
    player.dispose();
  });

  // 纹理设置设置
  it('baseRenderComponent setTexture by URL', async () => {
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*PubBSpHUbjYAAAAAAAAAAAAADlB4AQ';
    const composition = await player.loadScene(json);
    const component = composition.getItemByName('sprite_1')!.getComponent(SpriteComponent);
    const oldTexture = component.renderer.texture;

    await component.setTexture('https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*ySrfRJvfvfQAAAAAAAAAAAAADvV6AQ/original');
    const newTexture = component.renderer.texture;
    const texture = component.material.getTexture('_MainTex');

    expect(oldTexture.id).not.eql(newTexture.id, 'newTexture');
    expect(newTexture.id).to.eql(texture?.id, 'final texture id');
  });

  it('baseRenderComponent setTexture by Texture', async () => {
    const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*PubBSpHUbjYAAAAAAAAAAAAADlB4AQ';
    const composition = await player.loadScene(json);
    const component = composition.getItemByName('sprite_1')!.getComponent(SpriteComponent);
    const oldTexture = component.renderer.texture;
    const newTexture = await Texture.fromImage('https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*ySrfRJvfvfQAAAAAAAAAAAAADvV6AQ/original', player.renderer.engine);

    component.setTexture(newTexture);
    const texture = component.material.getTexture('_MainTex');

    expect(oldTexture.id).not.eql(newTexture.id, 'newTexture');
    expect(newTexture.id).to.eql(texture?.id, 'final texture id');
  });
});
