import type { Asset, Scene, VFXItem } from '@galacean/effects';
import {
  AssetManager, CompositionComponent, Fake3DComponent, Player, PrecompositionManager, Sprite, SpriteComponent, TextureSourceType, spec,
} from '@galacean/effects';

const { expect } = chai;
const ref = (id: string) => ({ id });

function createScene () {
  const template = {
    id: 'template', name: 'Template', duration: 5, endBehavior: spec.EndBehavior.freeze,
    components: [ref('comp')], children: [ref('inside')],
  };
  const item = {
    id: 'inside', name: 'inside', dataType: spec.DataType.VFXItemData, type: spec.ItemType.null,
    duration: 5, endBehavior: spec.EndBehavior.freeze, components: [],
  };

  return {
    version: '3.9', compositionId: 'main',
    compositions: [template, { ...template, id: 'main', components: [], children: ['left', 'right'].map(ref) }],
    items: [item, ...['left', 'right'].map(id => ({ ...item, id, name: id, refId: template.id }))],
    components: [{
      id: 'comp', dataType: spec.DataType.CompositionComponent, item: ref(template.id), timelineAsset: ref('timeline'),
      sceneBindings: [{ key: ref('local-track'), value: ref('inside') }],
    }],
    miscs: [
      { id: 'timeline', dataType: 'TimelineAsset', tracks: [ref('local-track')] },
      { id: 'local-track', dataType: 'ObjectBindingTrack', children: [], clips: [] },
    ],
    images: [], textures: [],
  };
}

function bindings (root: VFXItem) {
  const component = root.getComponent(CompositionComponent);
  const [localTrack] = component.timelineAsset!.tracks;

  expect(component.item).to.equal(root);

  return { localTrack, local: component.getBinding(localTrack) as VFXItem };
}

describe('core/composition/runtime instance IDs', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
  });

  afterEach(() => {
    player.dispose();
  });

  it('binds precomposition tracks inside each scene instance', async () => {
    const scene = createScene();
    const [first, second] = await player.loadScene([scene, scene], { autoplay: false });
    const leftRoot = first.getItemByName('left')!;
    const rightRoot = first.getItemByName('right')!;
    const left = bindings(leftRoot);
    const right = bindings(rightRoot);
    const otherRoot = second.getItemByName('left')!;
    const other = bindings(otherRoot);

    expect(left.local.parent).to.equal(leftRoot);
    expect(right.local.parent).to.equal(rightRoot);
    expect(other.local.parent).to.equal(otherRoot);
    expect(left.localTrack).not.to.equal(right.localTrack);
    expect(left.local.definition.id).to.equal('inside');
    expect(new Set([left.local, right.local, other.local].map(item => item.getInstanceId())).size).to.equal(3);
    expect(player.engine.effectsObjectServer.objectsCache.inside).to.be.undefined;
    expect(scene).to.deep.equal(createScene());
  });

  it('returns a precomposition the caller can mount', async () => {
    const composition = await player.loadScene(createScene(), { autoplay: false });
    const scene = { ...createScene(), compositionId: 'template' } as unknown as spec.JSONScene;
    const prefab = await AssetManager.loadPrecomposition(scene, { autoplay: false });
    const root = PrecompositionManager.instantiate(prefab, composition);
    const parent = composition.getItemByName('right')!;
    const { local } = bindings(root);

    expect(root.parent).to.be.undefined;
    expect(local.parent).to.equal(root);

    root.setParent(parent);

    expect(root.parent).to.equal(parent);
    expect(bindings(root).local).to.equal(local);
  });

  it('duplicates a precomposition placement with its own data and bindings', async () => {
    const scene = createScene();
    const [inside, left] = scene.items;
    const [template, main] = scene.compositions;
    const group = { ...inside, id: 'group', name: 'group', children: [ref(left.id)] };
    const placement = {
      ...left,
      parentId: group.id,
      duration: 2,
      visible: false,
      transform: {
        position: { x: 3, y: 0, z: 0 }, eulerHint: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
      },
      components: [ref('placement-component')],
      children: [ref('extra')],
    };
    const extra = { ...inside, id: 'extra', name: 'extra', parentId: placement.id };
    const composition = await player.loadScene({
      ...scene,
      compositions: [template, { ...main, children: [ref(group.id)] }],
      items: [inside, group, placement, extra],
      components: [...scene.components, { id: 'placement-component', dataType: 'Fake3DComponent', item: ref(placement.id) }],
    }, { autoplay: false });
    const original = composition.getItemByName(placement.name)!;
    const { local } = bindings(original);
    const localId = local.getInstanceId();
    const originalComponent = original.getComponent(Fake3DComponent);
    const originalExtra = original.find(extra.name)!;
    const copy = original.duplicate();
    const copiedComponent = copy.getComponent(Fake3DComponent);
    const copiedExtra = copy.find(extra.name)!;
    const { local: copiedLocal } = bindings(copy);

    expect(original.parent).to.equal(composition.getItemByName(group.name));
    expect(copy.parent).to.equal(composition.sceneRoot);
    expect(copy.getInstanceId()).not.to.equal(original.getInstanceId());
    expect(copy.name).to.equal(placement.name);
    expect(copy.duration).to.equal(2);
    expect(copy.transform.position.x).to.equal(3);
    expect(copy.isVisible).to.equal(true);
    expect(copy.getComponent(CompositionComponent).enabled).to.equal(true);
    expect(copiedComponent.item).to.equal(copy);
    expect(copiedComponent).not.to.equal(originalComponent);
    expect(copiedExtra.parent).to.equal(copy);
    expect(copiedExtra.getInstanceId()).not.to.equal(originalExtra.getInstanceId());
    expect(copiedLocal.parent).to.equal(copy);
    expect(copiedLocal.getInstanceId()).not.to.equal(localId);

    copy.dispose();

    expect(local.isRegistered).to.equal(true);
    expect(local.getInstanceId()).to.equal(localId);
    expect(bindings(original).local).to.equal(local);
  });

  it('reuses assets within one instance and creates separate assets for each precomposition', async () => {
    const textureId = 'scene-texture';
    const spriteId = 'shared-sprite';
    const jsonScene = createScene();
    const [inside, ...placements] = jsonScene.items;
    const components = ['sprite-component', 'second-sprite-component'];
    const scene: Scene = {
      jsonScene: {
        ...jsonScene,
        compositions: jsonScene.compositions.map(composition => composition.id === jsonScene.compositionId ?
          { ...composition, children: [ref(inside.id), ...composition.children] } : composition),
        items: [{ ...inside, components: components.map(ref) }, ...placements],
        components: [...jsonScene.components, ...components.map(id => ({ id, dataType: spec.DataType.SpriteComponent,
          item: ref('inside'), sprite: ref(spriteId), options: { startColor: [1, 1, 1, 1] } }))],
        miscs: [...jsonScene.miscs, { id: spriteId, dataType: 'Sprite', texture: ref(textureId) }],
      } as unknown as spec.JSONScene,
      bins: [], images: [], videos: [], audios: [], storage: {}, timeInfos: {}, url: '',
      textureOptions: [{ id: textureId, dataType: spec.DataType.Texture, sourceType: TextureSourceType.data,
        data: { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) } }],
    };
    const composition = await player.loadScene(scene, { autoplay: false });
    const rootSprite = composition.sceneRoot.find('inside')!.getComponent(SpriteComponent).sprite;
    const spritesIn = (name: string) => bindings(composition.getItemByName(name)!).local.getComponents(SpriteComponent).map(component => component.sprite);
    const [left, leftAgain] = spritesIn('left');
    const [right] = spritesIn('right');
    const { effectsObjectServer } = player.engine;
    const { sceneRoot } = composition;
    const findStandaloneSprite = () => effectsObjectServer.withDeserializationContext({
      root: sceneRoot, scene: sceneRoot.sourceScene, idsMapping: new Map(), sceneAssets: new Set<Asset>(),
    }, () => effectsObjectServer.findObject(ref(spriteId), Sprite));
    const standalone = findStandaloneSprite();
    const another = findStandaloneSprite();

    expect(left).to.equal(leftAgain);
    expect(new Set([rootSprite, left, right, standalone, another]).size).to.equal(5);
    expect(new Set([rootSprite, left, right, standalone, another].map(sprite => sprite.texture)).size).to.equal(5);
    expect(rootSprite.texture).to.equal(composition.textures[0]);
    expect(left.definition.id).to.equal(spriteId);
    expect(left.getInstanceId()).not.to.equal(spriteId);
    expect(left.texture.definition.id).to.equal(textureId);

    composition.getItemByName('left')!.dispose();

    expect(left.texture.isDestroyed).to.equal(true);
    expect(right.texture.isDestroyed).to.equal(false);
    expect(rootSprite.texture.isDestroyed).to.equal(false);

    composition.dispose();

    expect(rootSprite.texture.isDestroyed).to.equal(true);
    expect(right.texture.isDestroyed).to.equal(true);
    expect(standalone.texture.isDestroyed).to.equal(false);
    for (const sprite of [standalone, another]) {
      sprite.texture.dispose();
      sprite.dispose();
    }
  });
});
