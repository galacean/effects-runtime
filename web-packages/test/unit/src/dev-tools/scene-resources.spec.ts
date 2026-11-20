import type { Composition, spec } from '@galacean/effects';
import { Engine, Material, Player, RendererComponent, Scene, Texture, TextureSourceType } from '@galacean/effects';
import { EditorRuntimeSession } from '../../../../dev-tools/src/platform/effects-runtime/editor-runtime-session';
import { isPersistentResource, resourceCandidates, resourceIdentity } from '../../../../dev-tools/src/features/assets/model/resource-identity';
import { AssetReferenceControl } from '../../../../dev-tools/src/features/assets/ui/asset-reference-field';
import { assetReferenceClipboard } from '../../../../dev-tools/src/features/assets/ui/asset-picker';
import { SceneDocument } from '../../../../dev-tools/src/features/scene/document/scene-document';
import { sceneWorkspace } from '../../../../dev-tools/src/features/scene/scene-workspace';
import { SceneSerializer } from '../../../../dev-tools/src/features/scene/serialization/scene-serializer';

const { expect } = chai;
const materialId = 'authored-material';

class ReferenceControl extends AssetReferenceControl {
  choose (id: string): void { this.chooseAsset(id); }
  menuActions () { return this.caption.actions(); }
}

function createScene (): Scene {
  const scene = new Scene({
    version: '3.9', compositionId: 'scene',
    compositions: [{ id: 'scene', name: 'scene', duration: 5, endBehavior: 5, children: [], components: [] }],
    items: [], images: [], textures: [], components: [], geometries: [], animations: [], shaders: [], miscs: [],
    materials: [{ id: materialId, dataType: 'Material', name: 'Scene Material', floats: { value: 1 }, textures: {},
      ints: {}, vector4s: {}, colors: {}, stringTags: {} }],
  } as unknown as spec.JSONScene, { autoplay: false });

  scene.prepareDefinitions();

  return scene;
}

describe('dev-tools/scene resources', () => {
  let player: Player;
  let composition: Composition;
  let scene: Scene;
  let serializer: SceneSerializer;
  let previousPlayer: Player;
  let previousDocument: SceneDocument | undefined;
  let document: SceneDocument | undefined;
  let control: ReferenceControl | undefined;

  beforeEach(async () => {
    player = new Player({ canvas: globalThis.document.createElement('canvas'), manualRender: true });
    scene = createScene();
    composition = await player.loadScene(scene, { autoplay: false });
    scene = composition.sceneRoot.sourceScene!;
    serializer = new SceneSerializer(composition);
    previousPlayer = EditorRuntimeSession.player;
    previousDocument = sceneWorkspace.current;
  });

  afterEach(() => {
    control?.dispose(); control = undefined;
    document?.dispose(); document = undefined;
    sceneWorkspace.current = previousDocument;
    EditorRuntimeSession.player = previousPlayer;
    player.dispose();
  });

  it('validates scene resources by their authored identity and source scene', () => {
    const material = serializer.object(materialId)!;

    expect(material).to.be.instanceof(Material);
    expect(material.getInstanceId()).not.to.equal(materialId);
    expect(resourceCandidates(player.engine, 'material', scene).map(candidate => candidate.id)).to.include(materialId);
    expect(resourceIdentity(player.engine, material as Material, scene)).to.deep.equal({ id: materialId, kind: 'material', name: 'Scene Material' });
    expect(isPersistentResource(material, player.engine, 'material', scene)).to.equal(true);
    expect(isPersistentResource(material, player.engine, 'material')).to.equal(false);
    expect(isPersistentResource(material, player.engine, 'texture', scene)).to.equal(false);
    const otherScene = createScene();

    otherScene.objectsDataCache.delete(materialId);
    expect(isPersistentResource(material, player.engine, 'material', otherScene)).to.equal(false);
  });

  it('keeps engine, registration and destruction checks when using authored IDs', () => {
    const material = serializer.object(materialId)!;
    const other = new Engine(globalThis.document.createElement('canvas'), { manualRender: true });

    try {
      expect(isPersistentResource(material, other, 'material', scene)).to.equal(false);
    } finally { other.dispose(); }
    material.unregisterObject();
    expect(isPersistentResource(material, player.engine, 'material', scene)).to.equal(false);
    const texture = Texture.create(player.engine, { id: 'authored-texture', sourceType: TextureSourceType.data,
      data: { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) } });

    scene.objectsDataCache.set('authored-texture', { id: 'authored-texture', dataType: 'Texture' } as spec.EffectsObjectData);
    expect(isPersistentResource(texture, player.engine, 'texture', scene), 'scene texture').to.equal(true);
    texture.dispose();
    expect(isPersistentResource(texture, player.engine, 'texture', scene)).to.equal(false);
    expect(isPersistentResource(player.engine.assetServer.whiteTexture, player.engine, 'texture'), 'built-in white texture').to.equal(true);
  });

  it('restores scene material references and properties and captures authored references', () => {
    const renderer = new RendererComponent(player.engine);
    const material = serializer.object(materialId) as Material;

    renderer.item = composition.sceneRoot;
    renderer.definition.id = 'renderer';
    serializer.applyExtras(renderer, { materials: [{ id: materialId }] });
    expect(renderer.material).to.equal(material);
    serializer.applyExtras(material, { material: { floats: { value: 2 } } });
    expect(material.getFloat('value')).to.equal(2);
    const states = serializer.capture([renderer]);

    expect(states.get(renderer)?.extras.materials).to.deep.equal([{ id: materialId }]);
    expect(states.get(material)?.data.id).to.equal(materialId);
    expect(states.get(material)?.extras.material.floats.value).to.equal(2);
    material.setFloat('value', 3);
    serializer.apply(states.get(material)!);
    expect(material.getFloat('value')).to.equal(2);
    renderer.dispose();
  });

  it('rejects materials without a persistent definition during serialization and restoration', () => {
    const temporary = new Material(player.engine);
    const renderer = new RendererComponent(player.engine);

    temporary.setFloat('value', 1);
    expect(() => serializer.read(temporary)).to.throw('Temporary resources cannot be serialized');
    expect(() => serializer.applyExtras(renderer, { materials: [{ id: temporary.getInstanceId() }] })).to.throw('The referenced material is no longer available');
    serializer.applyExtras(temporary, { material: { floats: { value: 2 } } });
    expect(temporary.getFloat('value')).to.equal(1);
    renderer.dispose(); temporary.dispose();
  });

  it('assigns and copies scene-only materials using authored references', () => {
    document = new SceneDocument(composition, scene.jsonScene);
    sceneWorkspace.current = document;
    EditorRuntimeSession.player = player;
    let assigned: object | null = null;

    control = new ReferenceControl(player.engine, { read: () => assigned, write: value => { assigned = value; } }, { expectedType: 'Material' });
    control.choose(materialId);
    expect(assigned).to.be.instanceof(Material);
    expect(assigned).to.equal(document.serializer.object(materialId));
    expect(control.menuActions().find(action => action.label === 'Edit')?.enabled).to.equal(true);
    expect(control.menuActions().find(action => action.label === 'Copy Reference')?.enabled).to.equal(true);
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const previousReference = { ...assetReferenceClipboard };
    let copied = '';

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
    try {
      control.menuActions().find(action => action.label === 'Copy Reference')?.action?.();
      expect(copied).to.equal(materialId);
      expect(assetReferenceClipboard.id).to.equal(materialId);
      assigned = null;
      control.menuActions().find(action => action.label === 'Paste')?.action?.();
      expect(assigned).to.equal(document.serializer.object(materialId));
    } finally {
      Object.assign(assetReferenceClipboard, { id: undefined, asset: undefined, project: undefined }, previousReference);
      if (clipboard) { Object.defineProperty(navigator, 'clipboard', clipboard); } else { Reflect.deleteProperty(navigator, 'clipboard'); }
    }
  });
});
