import type { AnimationClip, spec } from '@galacean/effects';
import {
  AnimationGraphAsset, Player, SpriteComponent, Texture,
} from '@galacean/effects';
import {
  AssetsCache, ContentDatabase, ContentDatabaseEvent, EditorContent, type JsonAssetFile, generateAssetScene,
} from '../../../../imgui-demo/src/editor/content';
import { JsonSceneCooker } from '../../../../imgui-demo/src/editor/cooker';

const { expect } = chai;
const IDLE_CLIP_ID = '11111111111141118111111111111111';
const WALK_CLIP_ID = '22222222222242228222222222222222';
const ANIMATION_GRAPH_ID = '33333333333343338333333333333333';
const TEXTURE_ID = '44444444444444448444444444444444';
const CHECKER_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAABrElEQVR4nO3asQmAMBRF0Uxi7waCs7uXnQ4RJMg9xa9PArd847juZ+a2/Zw6/lp/rH4AXwB8AfAFwBcAXwB8AfAFwBcAXwB8AfAFwBcAXwB8AfA/CeDvH+DP+QKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wKI+wYhcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8AcV8Acd8gJO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4LIO4bhMR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9AcR9g5C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4L4C4bxAS9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9wUQ9w1C4r4A4r4A4r4A4r4A4r4A4r4A4r4A4r4A4r4A4r4A4r4A4r4A4r4A4r4A4v4LLROoRPKt46sAAAAASUVORK5CYII=';

const textureAssetFile: JsonAssetFile = {
  ID: TEXTURE_ID,
  TypeName: 'Texture',
  EngineBuild: 1,
  Data: {
    name: 'EditorFixtureChecker',
    source: CHECKER_DATA_URL,
    target: 3553,
    flipY: true,
    wrapS: 33071,
    wrapT: 33071,
    minFilter: 9729,
    magFilter: 9729,
  },
};

class TestFileHandle {
  readonly kind = 'file';

  constructor (readonly name: string, private content: string) {
  }

  getFile (): Promise<File> {
    return Promise.resolve({
      lastModified: 0,
      name: this.name,
      text: () => Promise.resolve(this.content),
    } as File);
  }

  createWritable (): Promise<FileSystemWritableFileStream> {
    return Promise.resolve({
      write: (data: unknown) => {
        this.content = typeof data === 'string' ? data : String(data);

        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    } as unknown as FileSystemWritableFileStream);
  }
}

class TestDirectoryHandle {
  readonly kind = 'directory';
  private readonly entries = new Map<string, TestDirectoryHandle | TestFileHandle>();

  constructor (readonly name: string) {
  }

  values (): IterableIterator<TestDirectoryHandle | TestFileHandle> {
    return this.entries.values();
  }

  getDirectoryHandle (
    name: string,
    options?: FileSystemGetDirectoryOptions,
  ): Promise<FileSystemDirectoryHandle> {
    const entry = this.entries.get(name);

    if (entry instanceof TestDirectoryHandle) {
      return Promise.resolve(entry as unknown as FileSystemDirectoryHandle);
    }
    if (!options?.create) {
      return Promise.reject(new Error(`Directory '${name}' does not exist.`));
    }

    const directory = new TestDirectoryHandle(name);

    this.entries.set(name, directory);

    return Promise.resolve(directory as unknown as FileSystemDirectoryHandle);
  }

  getFileHandle (
    name: string,
    options?: FileSystemGetFileOptions,
  ): Promise<FileSystemFileHandle> {
    const entry = this.entries.get(name);

    if (entry instanceof TestFileHandle) {
      return Promise.resolve(entry as unknown as FileSystemFileHandle);
    }
    if (!options?.create) {
      return Promise.reject(new Error(`File '${name}' does not exist.`));
    }

    const file = new TestFileHandle(name, '');

    this.entries.set(name, file);

    return Promise.resolve(file as unknown as FileSystemFileHandle);
  }

  addFile (path: string, content: string): void {
    const separator = path.indexOf('/');

    if (separator === -1) {
      this.entries.set(path, new TestFileHandle(path, content));

      return;
    }

    const directoryName = path.slice(0, separator);
    const remainingPath = path.slice(separator + 1);
    const existing = this.entries.get(directoryName);
    const directory = existing instanceof TestDirectoryHandle
      ? existing
      : new TestDirectoryHandle(directoryName);

    this.entries.set(directoryName, directory);
    directory.addFile(remainingPath, content);
  }
}

function createFixtureProject (): FileSystemDirectoryHandle {
  const projectRoot = new TestDirectoryHandle('effects-editor-content-fixture-project');
  const scene = generateAssetScene(textureAssetFile)!;

  scene.compositions[0].name = 'Editor Fixture Scene';

  const files = [
    {
      path: 'Content/idle.animation-clip.json',
      value: {
        ID: IDLE_CLIP_ID,
        TypeName: 'AnimationClip',
        EngineBuild: 1,
        Data: { duration: 1.25, events: [] },
      },
    },
    {
      path: 'Content/walk.animation-clip.json',
      value: {
        ID: WALK_CLIP_ID,
        TypeName: 'AnimationClip',
        EngineBuild: 1,
        Data: { duration: 2.5, events: [] },
      },
    },
    {
      path: 'Content/test.animation-graph.json',
      value: {
        ID: ANIMATION_GRAPH_ID,
        TypeName: 'AnimationGraphAsset',
        EngineBuild: 1,
        Data: {
          nodeDatas: [],
          graphDataSet: { resources: [{ id: IDLE_CLIP_ID }, { id: WALK_CLIP_ID }] },
          rootNodeIndex: -1,
          controlParameterIDs: ['Speed'],
        },
      },
    },
    { path: 'Content/checker.texture.json', value: textureAssetFile },
    { path: 'Content/test.scene.json', value: scene },
  ];

  for (const file of files) {
    projectRoot.addFile(file.path, JSON.stringify(file.value));
  }

  return projectRoot as unknown as FileSystemDirectoryHandle;
}

async function withTimeout<T> (task: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(`Timed out while ${label}.`)),
      10000,
    );

    void task.then(
      value => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      error => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

describe('EditorContent fixture project', () => {
  it('opens a directly selected local folder as the Content root and emits workspace events', async () => {
    const localFolder = new TestDirectoryHandle('LocalAssets');
    const cache = new AssetsCache();
    const database = new ContentDatabase(cache);
    const events: ContentDatabaseEvent[] = [];

    localFolder.addFile('Nested/checker.texture.json', JSON.stringify(textureAssetFile));
    localFolder.addFile('readme.txt', 'Local content folder');
    database.on(ContentDatabaseEvent.WorkspaceRebuilding, () => events.push(ContentDatabaseEvent.WorkspaceRebuilding));
    database.on(ContentDatabaseEvent.WorkspaceModified, () => events.push(ContentDatabaseEvent.WorkspaceModified));
    database.on(ContentDatabaseEvent.WorkspaceRebuilt, () => events.push(ContentDatabaseEvent.WorkspaceRebuilt));

    await database.initialize(localFolder as unknown as FileSystemDirectoryHandle);

    expect(database.hasWorkspace).equals(true);
    expect(database.workspaceName).equals('LocalAssets');
    expect(database.getAllDirectories()).deep.equals(['Content', 'Content/Nested']);
    expect(database.getAllFiles().map(file => file.path)).deep.equals([
      'Content/Nested/checker.texture.json',
      'Content/readme.txt',
    ]);
    expect(cache.getAssetInfo(TEXTURE_ID)?.path).equals('Content/Nested/checker.texture.json');
    expect(events).deep.equals([
      ContentDatabaseEvent.WorkspaceRebuilding,
      ContentDatabaseEvent.WorkspaceModified,
      ContentDatabaseEvent.WorkspaceRebuilt,
    ]);
  });

  it('loads and visibly renders an editable scene with animation and texture assets', async function () {
    this.timeout(30000);

    const cache = new AssetsCache();
    const database = new ContentDatabase(cache);
    const projectRoot = createFixtureProject();
    let player: Player | undefined;

    try {
      await withTimeout(database.initialize(projectRoot), 'scanning the fixture Content directory');

      expect(cache.getAllAssets()).length(4);
      expect(cache.getAssetInfo('Content/test.scene.json')).equals(undefined);

      const canvas = document.createElement('canvas');

      canvas.width = 256;
      canvas.height = 256;
      player = new Player({ canvas, env: 'editor' });

      const content = new EditorContent(player.renderer.engine, cache, database);

      player.renderer.engine.content = content;

      const graph = await withTimeout(
        content.loadGraph(ANIMATION_GRAPH_ID, AnimationGraphAsset),
        'loading the external asset dependency graph',
      );
      const idleClip = content.getAsset<AnimationClip>(IDLE_CLIP_ID);
      const walkClip = content.getAsset<AnimationClip>(WALK_CLIP_ID);

      expect(graph).instanceOf(AnimationGraphAsset);
      expect(graph?.isLoaded).equals(true);
      expect(graph?.graphDataSet.resources).deep.equals([idleClip, walkClip]);
      expect(idleClip?.duration).equals(1.25);
      expect(walkClip?.duration).equals(2.5);

      const texture = await withTimeout(content.load<Texture>(TEXTURE_ID), 'loading the external texture');

      expect(texture).instanceOf(Texture);
      expect(texture?.isLoaded).equals(true);
      expect((texture?.source as { image?: HTMLCanvasElement }).image).instanceOf(HTMLCanvasElement);

      const sourceScene = generateAssetScene(textureAssetFile)!;
      const cookedScene = await new JsonSceneCooker(content).cook(sourceScene);
      const cookedTexture = cookedScene.textures?.find(data => data.id === TEXTURE_ID) as
        (spec.EffectsObjectData & { image?: unknown }) | undefined;

      expect(cookedTexture).not.equals(undefined);
      expect(cookedTexture?.image).equals(undefined);

      const composition = await withTimeout(
        player.loadScene(cookedScene, { autoplay: true }),
        'loading the cooked editor scene',
      );
      const checkerItem = composition.getItemByName('texture-preview-sprite');

      expect(checkerItem?.getComponent(SpriteComponent).renderer.texture).equals(texture);
      expect(texture?.getWidth()).equals(128);
      expect(texture?.getHeight()).equals(128);

      player.gotoAndStop(0.1);
      player.tick(0);
      expect(composition.renderFrame.renderPasses[0].meshes.length).greaterThan(0);

      const gl = (player.renderer.engine as unknown as { gl: WebGLRenderingContext }).gl;
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);

      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      expect(Array.from(pixels).some(
        (channel, index) => index % 4 !== 3 && channel > 0,
      )).equals(true);

      player.destroyCurrentCompositions();
      expect(content.getAsset(TEXTURE_ID)).equals(undefined);

      (projectRoot as unknown as TestDirectoryHandle).addFile('Content/checker.texture.json', JSON.stringify({
        ...textureAssetFile,
        Data: {
          ...textureAssetFile.Data,
          name: 'EditorFixtureCheckerReopened',
        },
      }));

      const reopenedScene = await new JsonSceneCooker(content).cook(sourceScene);
      const reopenedTexture = content.getAsset<Texture>(TEXTURE_ID);
      const reopenedComposition = await withTimeout(
        player.loadScene(reopenedScene, { autoplay: true }),
        'reopening the cooked editor scene',
      );
      const reopenedItem = reopenedComposition.getItemByName('texture-preview-sprite');

      expect(reopenedTexture).instanceOf(Texture);
      expect(reopenedTexture).not.equals(texture);
      expect(reopenedTexture?.name).equals('EditorFixtureCheckerReopened');
      expect(reopenedItem?.getComponent(SpriteComponent).renderer.texture).equals(reopenedTexture);
      expect(reopenedTexture?.getWidth()).equals(128);
      expect(reopenedTexture?.getHeight()).equals(128);

      player.gotoAndStop(0.1);
      player.tick(0);
      expect(reopenedComposition.renderFrame.renderPasses[0].meshes.length).greaterThan(0);
    } finally {
      player?.dispose();
    }
  });
});
