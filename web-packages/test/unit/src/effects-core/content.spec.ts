import {
  Asset, EffectsObject, Engine, effectsClass, spec,
} from '@galacean/effects';
import {
  AssetsCache, ContentDatabase, EditorContent, type JsonAssetFile,
} from '../../../../imgui-demo/src/editor/content';
import { JsonSceneCooker } from '../../../../imgui-demo/src/editor/cooker';

const { expect } = chai;
const TEST_ASSET_TYPE = 'ContentTestAsset';
const TEST_OBJECT_TYPE = 'ContentTestObject';

interface TestAssetData extends spec.EffectsObjectData {
  value?: number,
  dependency?: spec.DataPath,
  waitForDependency?: boolean,
}

@effectsClass(TEST_ASSET_TYPE)
class ContentTestAsset extends Asset {
  readonly deserialized: Promise<void>;
  value = 0;
  dependency?: ContentTestAsset;
  waitForDependency = false;
  private resolveDeserialized!: () => void;

  constructor (engine: Engine) {
    super(engine);
    this.deserialized = new Promise(resolve => {
      this.resolveDeserialized = resolve;
    });
  }

  override fromData (data: TestAssetData): void {
    super.fromData(data);
    this.value = data.value ?? 0;
    this.waitForDependency = data.waitForDependency ?? false;
    this.dependency = data.dependency
      ? this.engine.findObject<ContentTestAsset>(data.dependency)
      : undefined;
    this.resolveDeserialized();
  }

  protected override loadAsset (): void | Promise<void> {
    if (!this.waitForDependency || !this.dependency || this.dependency.isLoaded) {
      return;
    }

    return this.dependency.waitForLoaded();
  }
}

@effectsClass(TEST_OBJECT_TYPE)
class ContentTestObject extends EffectsObject {
  value = 0;

  override fromData (data: TestAssetData): void {
    super.fromData(data);
    this.value = data.value ?? 0;
  }
}

class MemoryContentDatabase extends ContentDatabase {
  private readonly jsonFiles = new Map<string, JsonAssetFile>();
  private readonly fileBarriers = new Map<string, Promise<void>>();

  constructor (...files: Array<{ path: string, asset: JsonAssetFile }>) {
    super(new AssetsCache());
    for (const file of files) {
      this.jsonFiles.set(file.path, file.asset);
      this.assetsCache.registerAsset({
        id: file.asset.ID,
        typeName: file.asset.TypeName,
        path: file.path,
        lastModified: 1,
      });
    }
  }

  setFileBarrier (path: string, barrier: Promise<void>): void {
    this.fileBarriers.set(path, barrier);
  }

  override async getFileHandle (path: string): Promise<FileSystemFileHandle | undefined> {
    const asset = this.jsonFiles.get(path);

    if (!asset) {
      return undefined;
    }

    return {
      kind: 'file',
      name: path.split('/').pop()!,
      getFile: async () => {
        await this.fileBarriers.get(path);

        return new File([JSON.stringify(asset)], path, { type: 'application/json' });
      },
    } as FileSystemFileHandle;
  }
}

describe('Content', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = Engine.create(document.createElement('canvas'), { manualRender: true });
  });

  afterEach(() => {
    engine.dispose();
  });

  it('does not load from getAsset and deduplicates loadAsync', async () => {
    const id = 'content-test-asset';

    engine.addEffectsObjectData({ id, dataType: TEST_ASSET_TYPE, value: 42 } as unknown as TestAssetData);

    expect(engine.content.getAsset(id)).equals(undefined);

    const first = engine.content.loadAsync<ContentTestAsset>(id, ContentTestAsset);
    const second = engine.content.loadAsync<ContentTestAsset>(id, ContentTestAsset);

    expect(first).equals(second);
    expect(first?.value).equals(42);
    expect(first?.isLoaded).equals(true);
    expect(await engine.content.load(id, ContentTestAsset)).equals(first);
  });

  it('registers placeholders before resolving cyclic dependencies', () => {
    engine.addEffectsObjectData({
      id: 'asset-a', dataType: TEST_ASSET_TYPE, dependency: { id: 'asset-b' },
    } as unknown as TestAssetData);
    engine.addEffectsObjectData({
      id: 'asset-b', dataType: TEST_ASSET_TYPE, dependency: { id: 'asset-a' },
    } as unknown as TestAssetData);

    const assetA = engine.content.loadAsync<ContentTestAsset>('asset-a');
    const assetB = engine.content.getAsset<ContentTestAsset>('asset-b');

    expect(assetA?.dependency).equals(assetB);
    expect(assetB?.dependency).equals(assetA);
    expect(engine.content.getAssets(ContentTestAsset).length).equals(2);
  });

  it('keeps non-asset scene objects outside the Content pool', () => {
    const id = 'content-test-object';

    engine.addEffectsObjectData({ id, dataType: TEST_OBJECT_TYPE, value: 7 } as unknown as TestAssetData);

    const object = engine.findObject<ContentTestObject>({ id });

    expect(object).instanceOf(ContentTestObject);
    expect(object.value).equals(7);
    expect(engine.content.getAsset(id)).equals(undefined);
  });

  it('creates and explicitly unloads virtual assets', () => {
    const asset = engine.content.createVirtualAsset(ContentTestAsset);
    const id = asset.getInstanceId();

    expect(engine.content.getAsset(id)).equals(asset);
    expect(asset.isLoaded).equals(true);

    engine.content.unloadAsset(asset);

    expect(engine.content.getAsset(id)).equals(undefined);
    expect(engine.objectInstance[id]).equals(undefined);
  });

  it('loads an external JsonAsset after assigning EditorContent directly', async () => {
    const id = 'external-content-test-asset';
    const path = 'Content/external-content-test-asset.json';
    const database = new MemoryContentDatabase({
      path,
      asset: {
        ID: id,
        TypeName: TEST_ASSET_TYPE,
        EngineBuild: 1,
        Data: { value: 99 },
      },
    });
    const editorContent = new EditorContent(engine, database.assetsCache, database);

    engine.content = editorContent;

    const placeholder = engine.content.loadAsync<ContentTestAsset>(path, ContentTestAsset);
    let loadedAsset: Asset | undefined;

    placeholder?.once('loaded', asset => {
      loadedAsset = asset;
    });

    expect(placeholder).instanceOf(ContentTestAsset);
    expect(placeholder?.isLoaded).equals(false);
    expect(placeholder?.isLoadFailed).equals(false);
    expect(await engine.content.load(id, ContentTestAsset)).equals(placeholder);
    expect(placeholder?.value).equals(99);
    expect(placeholder?.isLoaded).equals(true);
    expect(loadedAsset).equals(placeholder);
  });

  it('waits for the current loading task before reloading the same asset', async () => {
    const id = 'reloaded-content-test-asset';
    const path = 'Content/reloaded-content-test-asset.json';
    let releaseFile!: () => void;
    const fileBarrier = new Promise<void>(resolve => {
      releaseFile = resolve;
    });
    const database = new MemoryContentDatabase({
      path,
      asset: {
        ID: id,
        TypeName: TEST_ASSET_TYPE,
        EngineBuild: 1,
        Data: { value: 100 },
      },
    });
    const content = new EditorContent(engine, database.assetsCache, database);

    database.setFileBarrier(path, fileBarrier);
    engine.content = content;

    const asset = content.loadAsync<ContentTestAsset>(id, ContentTestAsset)!;
    let loadedCount = 0;

    asset.on('loaded', () => {
      loadedCount++;
    });
    const firstReload = content.reloadAsset(asset);
    const secondReload = content.reloadAsset(asset);

    expect(asset.isLoaded).equals(false);
    expect(asset.isLoadFailed).equals(false);
    releaseFile();

    expect(await firstReload).equals(asset);
    expect(await secondReload).equals(asset);

    expect(asset.value).equals(100);
    expect(asset.isLoaded).equals(true);
    expect(loadedCount).equals(3);
  });

  it('settles cancellation after the running load exits', async () => {
    const id = 'canceled-content-test-asset';
    const path = 'Content/canceled-content-test-asset.json';
    let releaseFile!: () => void;
    const fileBarrier = new Promise<void>(resolve => {
      releaseFile = resolve;
    });
    const database = new MemoryContentDatabase({
      path,
      asset: {
        ID: id,
        TypeName: TEST_ASSET_TYPE,
        EngineBuild: 1,
        Data: { value: 123 },
      },
    });
    const content = new EditorContent(engine, database.assetsCache, database);

    database.setFileBarrier(path, fileBarrier);
    engine.content = content;

    const asset = content.loadAsync<ContentTestAsset>(id, ContentTestAsset)!;
    let didSettle = false;
    const loading = asset.waitForLoaded().then(
      () => undefined,
      error => error as Error,
    ).finally(() => {
      didSettle = true;
    });

    asset.dispose();
    await Promise.resolve();

    expect(didSettle).equals(false);
    expect(content.getAsset(id)).equals(undefined);

    releaseFile();

    const error = await loading;

    expect(error?.name).equals('AssetLoadCanceledError');
    expect(asset.value).equals(0);
  });

  it('findObject falls back to external Content and waits for hard asset dependencies', async () => {
    const dependencyId = 'external-content-test-dependency';
    const rootId = 'external-content-test-root';
    const dependencyPath = 'Content/external-content-test-dependency.json';
    let releaseDependency!: () => void;
    const dependencyBarrier = new Promise<void>(resolve => {
      releaseDependency = resolve;
    });
    const database = new MemoryContentDatabase(
      {
        path: dependencyPath,
        asset: {
          ID: dependencyId,
          TypeName: TEST_ASSET_TYPE,
          EngineBuild: 1,
          Data: { value: 7 },
        },
      },
      {
        path: 'Content/external-content-test-root.json',
        asset: {
          ID: rootId,
          TypeName: TEST_ASSET_TYPE,
          EngineBuild: 1,
          Data: {
            value: 9,
            dependency: { id: dependencyId },
            waitForDependency: true,
          },
        },
      },
    );
    const content = new EditorContent(engine, database.assetsCache, database);

    database.setFileBarrier(dependencyPath, dependencyBarrier);
    engine.content = content;

    const root = engine.findObject<ContentTestAsset>({ id: rootId });
    let didLoadRoot = false;
    const loadingRoot = content.load(rootId, ContentTestAsset).then(asset => {
      didLoadRoot = true;

      return asset;
    });

    expect(root).instanceOf(ContentTestAsset);
    expect(root?.isLoaded).equals(false);
    expect(root?.isLoadFailed).equals(false);
    await root.deserialized;
    expect(root?.value).equals(9);
    expect(root?.dependency?.isLoaded).equals(false);
    expect(root?.dependency?.isLoadFailed).equals(false);
    expect(root?.isLoaded).equals(false);
    expect(root?.isLoadFailed).equals(false);
    expect(didLoadRoot).equals(false);

    releaseDependency();

    expect(await loadingRoot).equals(root);
    expect(root?.isLoaded).equals(true);
    expect(root?.dependency?.isLoaded).equals(true);
    expect(root?.dependency?.value).equals(7);
  });

  it('cooks DataPath references without treating GUID-like text as references', async () => {
    const referencedId = '11111111111111111111111111111111';
    const textOnlyId = '22222222222222222222222222222222';
    const database = new MemoryContentDatabase(
      {
        path: 'Content/referenced-content-test-asset.json',
        asset: {
          ID: referencedId,
          TypeName: TEST_ASSET_TYPE,
          EngineBuild: 1,
          Data: { value: 5 },
        },
      },
      {
        path: 'Content/text-only-content-test-asset.json',
        asset: {
          ID: textOnlyId,
          TypeName: TEST_ASSET_TYPE,
          EngineBuild: 1,
          Data: { value: 6 },
        },
      },
    );
    const editorContent = new EditorContent(engine, database.assetsCache, database);

    engine.content = editorContent;

    const source = {
      version: spec.JSONSceneVersion.LATEST,
      playerVersion: {},
      type: 'ge',
      compositions: [],
      images: [],
      plugins: [],
      items: [],
      components: [],
      materials: [],
      shaders: [],
      geometries: [],
      animations: [],
      miscs: [{
        id: 'reference-holder',
        dataType: TEST_OBJECT_TYPE,
        stringReference: textOnlyId,
        dataPathReference: { id: referencedId },
      }],
    } as unknown as spec.JSONScene;
    const cooked = await new JsonSceneCooker(editorContent).cook(source);
    const holder = cooked.miscs.find(data => data.id === 'reference-holder') as unknown as Record<string, unknown>;
    const cookedAsset = cooked.miscs.find(data => data.id === referencedId);
    const textOnlyAsset = cooked.miscs.find(data => data.id === textOnlyId);

    expect(holder.stringReference).equals(textOnlyId);
    expect(holder.dataPathReference).deep.equals({ id: referencedId });
    expect(cookedAsset?.id).equals(referencedId);
    expect(textOnlyAsset).equals(undefined);
  });
});
