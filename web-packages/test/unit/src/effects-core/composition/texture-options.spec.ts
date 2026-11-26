import type { Composition, Scene } from '@galacean/effects';
import { Player, Plugin, Texture, glContext, registerPlugin, unregisterPlugin, spec } from '@galacean/effects';

const { expect } = chai;

describe('core/composition/texture-options', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  afterEach(() => {
    player.dispose();
  });

  it('plugin modify textureOptions', async () => {
    const canvas = document.createElement('canvas');

    canvas.width = canvas.height = 1;
    const a = {
      version: '3.9', compositionId: 'scene', plugins: ['test-load-tex-4'],
      images: [{ id: 'image', url: canvas.toDataURL() }],
      textures: [glContext.NEAREST_MIPMAP_NEAREST, glContext.NEAREST_MIPMAP_LINEAR].map((minFilter, index) => ({
        id: 'texture-' + index, dataType: spec.DataType.Texture, source: { id: 'image' }, flipY: true, minFilter,
        name: index === 1 ? 'abc' : 'first',
      })),
      compositions: [{ id: 'scene', name: 'scene', duration: 5, endBehavior: spec.EndBehavior.freeze,
        children: [0, 1].map(index => ({ id: 'item-' + index })) }],
      items: [0, 1].map(index => ({ id: 'item-' + index, name: 'sprite-' + index, dataType: spec.DataType.VFXItemData,
        type: spec.ItemType.sprite, duration: 5, endBehavior: spec.EndBehavior.freeze, components: [{ id: 'component-' + index }] })),
      components: [0, 1].map(index => ({ id: 'component-' + index, dataType: spec.DataType.SpriteComponent,
        item: { id: 'item-' + index }, sprite: { id: 'sprite-' + index }, options: { startColor: [1, 1, 1, 1] } })),
      miscs: [0, 1].map(index => ({ id: 'sprite-' + index, dataType: 'Sprite', texture: { id: 'texture-' + index } })),
    };
    const spy = chai.spy((_value: number) => {});

    registerPlugin('test-load-tex-4', class TestPlugin extends Plugin {
      override onAssetsLoadFinish (scene: Scene) {
        scene.textureOptions[1].magFilter = glContext.LINEAR;
        expect(scene.textureOptions[1].name).to.eql('abc');
        spy(1);
      }

      override onCompositionCreated (composition: Composition) {
        expect(composition.textures.find(texture => texture.name === 'abc')?.source.magFilter).to.eql(glContext.LINEAR);
      }
    });
    let composition: Composition | undefined;

    try {
      composition = await player.loadScene(a, { autoplay: false });
      const texture = composition.textures.find(texture => texture.name === 'abc');

      expect(texture).to.be.instanceof(Texture);
      expect(texture!.source).to.contains({ magFilter: glContext.LINEAR, minFilter: glContext.NEAREST_MIPMAP_LINEAR, name: 'abc' });
      expect(spy).to.has.been.called.with(1);
    } finally {
      composition?.dispose();
      unregisterPlugin('test-load-tex-4');
    }
  });
});
