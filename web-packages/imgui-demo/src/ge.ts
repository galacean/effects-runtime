import type { spec } from '@galacean/effects';
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-gui';
import '@galacean/effects-plugin-ffd';
import '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-rich-text';
import '@galacean/effects-plugin-spine';
import { EditorContent } from './editor/content';
import { ImGui_Impl } from './imgui';
import { SceneDocument } from './editor/scene/scene-document';
import { Selection } from './core/selection';
import { initialScene as initScene } from './asset/initial-scene';

export class GalaceanEffects {
  static player: Player;
  static editorContent: EditorContent;
  static document?: SceneDocument;
  static isDocumentDirty (): boolean { return this.document?.isDirty ?? false; }
  static sceneError = '';
  static isPlaying = false;
  static busy = false;

  static getHierarchyComposition () {
    const document = this.document;
    const root = document?.root;

    return root ? { id: root.getInstanceId(), root } : undefined;
  }

  static async openDocument (data: spec.JSONScene | string, name = 'scene.json', handle?: FileSystemFileHandle): Promise<void> {
    if (this.busy) {throw new Error('Please wait for the current scene operation.');}
    const previous = this.document;
    const backup = previous ? { data: previous.snapshot(), name: previous.name, handle: previous.fileHandle, dirty: previous.isDirty } : undefined;

    this.busy = true;
    try {
      Selection.clear();
      previous?.dispose();
      this.document = undefined;
      this.player.destroyCurrentCompositions();
      const next = await SceneDocument.open(this.player.engine, data, name);

      this.document = next;
      next.fileHandle = handle;
      next.show();
      this.player.tick(0);
      this.player.ticker?.start();
      this.isPlaying = false;
      this.sceneError = '';
    } catch (error) {
      this.document?.dispose();
      this.document = undefined;
      this.player.destroyCurrentCompositions();
      this.isPlaying = false;
      if (backup) {
        this.document = await SceneDocument.open(this.player.engine, backup.data, backup.name);
        this.document.fileHandle = backup.handle;
        if (backup.dirty) {this.document.markModified();}
        this.document.show();
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }

  static async setPlaying (play = false): Promise<void> {
    if (this.busy || play === this.isPlaying || !this.document) {return;}
    this.document.setPlaying(play);
    this.isPlaying = play;
    this.player.tick(0);
  }

  static reportSceneError (error: unknown): void {
    if (error instanceof DOMException && error.name === 'AbortError') {return;}
    this.sceneError = error instanceof Error ? error.message : String(error);
  }

  static async chooseScene (): Promise<void> {
    if (this.busy) {return;}
    if (this.document?.isDirty && !window.confirm('Discard unsaved scene changes and open another scene?')) {return;}
    if (typeof window.showOpenFilePicker === 'function') {
      const [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'Scene JSON', accept: { 'application/json': ['.json'] } }] });
      const file = await handle.getFile();

      await this.openDocument(JSON.parse(await file.text()), file.name, handle);

      return;
    }
    const input = window.document.createElement('input');

    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];

      if (file) {
        void file.text().then(text => this.openDocument(JSON.parse(text), file.name)).catch(error => this.reportSceneError(error));
      }
    };
    input.click();
  }

  static async saveDocument (saveAs = false): Promise<void> {
    const document = this.document;

    if (!document) {throw new Error('Open a scene before saving.');}
    const revision = document.currentRevision;
    const snapshot = document.serialize();
    let handle = saveAs ? undefined : document.fileHandle;

    if (!handle && typeof window.showSaveFilePicker === 'function') {
      handle = await window.showSaveFilePicker({ suggestedName: document.name, types: [{ description: 'Scene JSON', accept: { 'application/json': ['.json'] } }] });
    }
    if (handle) {
      await document.save(handle);
      await this.editorContent.contentDatabase.refresh();

      return;
    } else {
      const url = URL.createObjectURL(new Blob([snapshot], { type: 'application/json' }));
      const link = window.document.createElement('a');

      link.href = url;
      link.download = document.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    document.markSaved(revision);
  }

  static sceneRendederTexture: WebGLTexture;
  static async initialize () {
    const container = document.getElementById('J-container');
    // const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*oF1NRJG7GU4AAAAAAAAAAAAADlB4AQ'; // 春促\

    GalaceanEffects.player = new Player({ container, env: 'editor' });

    GalaceanEffects.player.ticker?.add(GalaceanEffects.updateRenderTexture);
    GalaceanEffects.editorContent = new EditorContent(GalaceanEffects.player.renderer.engine);
    GalaceanEffects.player.renderer.engine.content = GalaceanEffects.editorContent;
    await GalaceanEffects.openDocument(initScene, 'init.scene.json');
  }

  static updateRenderTexture () {
    if (GalaceanEffects.player.getCompositions().length === 0) {
      return;
    }
    const gl = ImGui_Impl.gl;

    if (gl) {
      if (!GalaceanEffects.sceneRendederTexture) {
        const tex = gl.createTexture();

        if (tex) {
          GalaceanEffects.sceneRendederTexture = tex;
        }
      }
    }

    if (GalaceanEffects.sceneRendederTexture && gl) {
      gl.bindTexture(gl.TEXTURE_2D, GalaceanEffects.sceneRendederTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, GalaceanEffects.player.canvas);
    }
  }
}
