import type { Engine } from '@galacean/effects';
import { EffectsObject, Material, Shader, Sprite, Texture, math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { EditorTextArea } from '../../../ui/controls/text-field';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { append, disposeChildren, expand, label } from '../../../ui/controls/layout';
import { EditorTabs } from '../../../ui/controls/tabs';
import type { SceneDocument } from '../../scene/document/scene-document';
import { sceneWorkspace } from '../../scene/scene-workspace';
import { assetLibrary } from '../asset-library';
import { ImagePreviewViewport } from '../preview/image-preview-viewport';
import { materialPreviews } from '../preview/material-preview';
import { MaterialPreviewViewport } from '../preview/material-preview-widget';
import { getSpriteThumbnail } from '../preview/sprite-thumbnail';
import { getOrCreateTexturePreview } from '../preview/texture-preview';
import { revealContentAsset, setFocusedAssetSave } from './asset-editor-registry';
import { AssetEditorLayout } from './asset-editor-layout';
import { buildMaterialProperties } from './material-details';

export class RuntimeAssetEditor extends EditorWindow {
  protected override dockingRole = 'document' as const;
  private asset?: object;
  private document?: SceneDocument;
  private layout!: AssetEditorLayout;
  private readonly editing = new Set<Control>();

  constructor (private readonly windowId: string, asset: object, document?: SceneDocument) {
    super(); this.title = 'Asset Editor'; this.initialSize = new math.Vector2(1120, 720);
    this.asset = asset; this.document = document;
  }
  override get layoutId (): string { return this.windowId; }
  protected override createContent (engine: Engine): Control {
    this.layout = new AssetEditorLayout(engine, () => {
      const entry = this.asset instanceof EffectsObject ? assetLibrary.entry(this.asset.getInstanceId()) : undefined;

      return { save: () => { void sceneWorkspace.save(); }, dirty: !!sceneWorkspace.current?.dirty,
        browse: entry ? () => revealContentAsset(entry.id) : undefined, close: () => this.close(), busy: sceneWorkspace.busy };
    }, {
      change: (title, owner, action) => {
        sceneWorkspace.observe(title, action, [this.asset]); this.editing.add(owner); sceneWorkspace.current?.setScopeActive(owner, true);
      },
      finish: owner => { this.editing.delete(owner); sceneWorkspace.current?.setScopeActive(owner, false); },
    });
    this.rebuild();

    return this.layout;
  }
  override update (): void {
    if (this.document !== sceneWorkspace.current) { this.close(); this.asset = undefined; }
    this.tabIcon = this.asset instanceof Texture ? 'texture' : this.asset instanceof Shader ? 'shader' : this.asset instanceof Sprite ? 'sprite' : 'materialAsset';
    this.title = this.asset ? ((this.asset as { name?: string }).name || this.asset.constructor.name) + ' — Asset Editor' : 'Asset Editor';
    if (this.isActive() && this.hasFocus()) { setFocusedAssetSave(async () => { await sceneWorkspace.save(); }); }
  }
  private rebuild (): void {
    if (!this.layout) { return; }
    this.layout.inspector.clear(); disposeChildren(this.layout.viewport);
    const asset = this.asset, engine = this.layout.engine;

    if (!asset) { return; }
    this.layout.viewportTitle = asset instanceof Shader ? 'Source' : 'Viewport';
    if (asset instanceof Material) {
      const preview = append(this.layout.viewport, expand(new MaterialPreviewViewport(engine)));

      preview.view.primitive = assetLibrary.entry(asset.getInstanceId())?.previewMesh ?? 'sphere'; preview.resetCamera();
      preview.source = request => materialPreviews.runtime(asset, 512, request);
      buildMaterialProperties(this.layout.inspector.section('material', 'Material'), asset);
      preview.buildInspector(this.layout.inspector.section('preview', 'Previewing'));
    } else if (asset instanceof Texture || asset instanceof Sprite) {
      const preview = append(this.layout.viewport, expand(new ImagePreviewViewport(engine)));
      const texture = asset instanceof Sprite ? asset.texture : asset;

      preview.source = () => {
        const image = asset instanceof Sprite ? getSpriteThumbnail(asset) : getOrCreateTexturePreview(asset);

        return image ? { preview: image, width: 'width' in image ? Number(image.width) : texture.width, height: 'height' in image ? Number(image.height) : texture.height } : undefined;
      };
      const image = this.layout.inspector.section('image', asset.constructor.name);

      image.readOnly('Width', () => texture.width + ' px'); image.readOnly('Height', () => texture.height + ' px');
      if (asset instanceof Sprite) {
        image.reference('Texture', { read: () => asset.texture, write: () => {} }, 'Texture', true);
        image.readOnly('UV Rect', () => asset.rect.map(value => value.toFixed(3)).join(', ')); image.readOnly('Rotation', () => asset.rotation ? '90°' : 'None');
      }
    } else if (asset instanceof Shader) {
      const tabs = append(this.layout.viewport, expand(new EditorTabs(engine)));

      for (const [key, title] of [['vertex', 'Vertex'], ['fragment', 'Fragment']] as const) {
        const text = new EditorTextArea(engine);

        text.text = asset.shaderData[key]; text.editable = false; tabs.addTab(title, text);
      }
    } else { append(this.layout.viewport, label(engine, asset.constructor.name)); }
    const info = this.layout.inspector.section('asset', 'Asset');

    info.readOnly('Name', () => (asset as { name?: string }).name || asset.constructor.name); info.readOnly('Type', () => asset.constructor.name);
    if (asset instanceof EffectsObject) { info.readOnly('ID', () => asset.getInstanceId()); }
    this.layout.footer.text = 'Scene Resource   ·   ' + asset.constructor.name;
  }
  override flushEdits (): void { this.editing.forEach(owner => sceneWorkspace.current?.setScopeActive(owner, false)); this.editing.clear(); }
  override onUndoRedo (): void {
    this.flushEdits();
    if (this.document !== sceneWorkspace.current) {
      this.close(); this.asset = undefined;

      return;
    }
    if (this.asset instanceof EffectsObject) {
      this.asset = EditorRuntimeSession.player.engine.effectsObjectServer.objectInstance[this.asset.getInstanceId()];
      if (!this.asset) { this.close(); }
    }
    this.rebuild();
  }
  protected override onDisable (): void { this.flushEdits(); }
}
