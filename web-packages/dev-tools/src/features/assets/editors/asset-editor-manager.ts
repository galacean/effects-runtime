import { EffectsObject } from '@galacean/effects';
import type { EditorWindow } from '../../../framework/windows/editor-window';
import { sceneWorkspace } from '../../scene/scene-workspace';
import { assetLibrary } from '../asset-library';
import { setContentAssetOpener, setRuntimeAssetOpener, setTextureAssetOpener } from './asset-editor-registry';
import { ContentObjectAssetEditor } from './content-object-asset-editor';
import { RuntimeAssetEditor } from './runtime-asset-editor';
import { TextureAssetEditor } from './texture-asset-editor';

export class AssetEditorManager {
  private readonly editors = new Map<string, EditorWindow>();
  private readonly identities = new WeakMap<object, number>();
  private nextIdentity = 0;

  constructor (private readonly mount: (editor: EditorWindow, alongside?: string) => void) {
    setContentAssetOpener(id => {
      const project = assetLibrary.projectId, key = 'asset:' + project + ':' + id;

      this.open(key, () => new ContentObjectAssetEditor(key, id, project));
    }, id => [...this.editors.values()].some(editor => editor instanceof ContentObjectAssetEditor && editor.isDirty(id)));
    setTextureAssetOpener(id => {
      const project = assetLibrary.projectId, key = 'texture:' + project + ':' + id;

      this.open(key, () => new TextureAssetEditor(key, id, project));
    });
    setRuntimeAssetOpener(asset => {
      const document = sceneWorkspace.current;
      const key = 'runtime:' + (document ? this.identity(document) : 'none') + ':' + (asset instanceof EffectsObject ? asset.getInstanceId() : this.identity(asset));

      this.open(key, () => new RuntimeAssetEditor(key, asset, document));
    });
  }

  collectClosed (): EditorWindow[] {
    const closed: EditorWindow[] = [];

    for (const [id, editor] of this.editors) {
      if (!editor.isOpened()) { this.editors.delete(id); closed.push(editor); }
    }

    return closed;
  }

  dispose (): void { setContentAssetOpener(); setTextureAssetOpener(); setRuntimeAssetOpener(); this.editors.clear(); }

  private open (id: string, create: () => EditorWindow): void {
    let editor = this.editors.get(id);

    if (!editor) {
      const alongside = [...this.editors.values()].reverse().find(editor => editor.isOpened())?.layoutId;

      editor = create(); this.editors.set(id, editor); this.mount(editor, alongside);
    }
    editor.open();
  }

  private identity (object: object): number {
    let id = this.identities.get(object);

    if (id === undefined) { this.identities.set(object, id = ++this.nextIdentity); }

    return id;
  }
}
