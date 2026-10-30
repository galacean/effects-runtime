import { EffectsObject, Material, Shader, Sprite, Texture } from '@galacean/effects';
import { editorPanel } from '../../../framework/registry/editor-registry';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ImGui } from '../../../platform/imgui';
import { PropertyFields as Fields } from '../../../ui/property-editor/property-fields';
import { PropertyGrid } from '../../../ui/property-editor/property-grid';
import type { SceneDocument } from '../../scene/document/scene-document';
import { sceneWorkspace } from '../../scene/scene-workspace';
import { assetLibrary } from '../asset-library';
import { ImagePreviewViewport } from '../preview/image-preview-viewport';
import { materialPreviews } from '../preview/material-preview';
import { MaterialPreviewViewport } from '../preview/material-preview-widget';
import { getSpriteThumbnail } from '../preview/sprite-thumbnail';
import { getOrCreateTexturePreview } from '../preview/texture-preview';
import { revealContentAsset, setFocusedAssetSave, setRuntimeAssetOpener } from './asset-editor-registry';
import { AssetEditorLayout, assetEditorFooter, assetEditorMenu, assetEditorPanels, assetEditorToolbar,
  beginAssetEditorStyle, constrainAssetEditor, endAssetEditorStyle } from './asset-editor-layout';
import { drawMaterialProperties, materialSearchTerms } from './material-details';

@editorPanel()
export class RuntimeAssetEditor extends EditorWindow {
  private asset?: object;
  private document?: SceneDocument;
  private focus = false;
  private readonly layout = new AssetEditorLayout();
  private readonly materialViewport = new MaterialPreviewViewport();
  private readonly imageViewport = new ImagePreviewViewport();

  constructor () {
    super(); this.title = 'Asset Editor'; this.initialSize = new ImGui.Vec2(1120, 720);
    this.setWindowFlags(ImGui.WindowFlags.MenuBar | ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
    setRuntimeAssetOpener(asset => {
      if (this.asset !== asset) {
        this.materialViewport.view.primitive = asset instanceof EffectsObject ? assetLibrary.entry(asset.getInstanceId())?.previewMesh ?? 'sphere' : 'sphere';
        this.materialViewport.resetCamera();
      }
      this.asset = asset; this.document = sceneWorkspace.current; this.focus = true; this.layout.search[0] = ''; this.imageViewport.reset();
      this.title = ((asset as { name?: string }).name || asset.constructor.name) + ' — ' +
        (asset instanceof Material ? 'Material' : asset instanceof Texture ? 'Texture' : asset.constructor.name) + ' Editor###Asset Editor';
      this.open();
    });
  }

  override draw (): void {
    if (this.document !== sceneWorkspace.current) { this.close(); this.asset = undefined; }
    if (!this.isOpened()) { return; }
    beginAssetEditorStyle(); constrainAssetEditor();
    if (this.focus) { ImGui.SetNextWindowFocus(); this.focus = false; }
    sceneWorkspace.observe('Edit asset properties', () => super.draw(), [this.asset]);
    if (!ImGui.IsAnyItemActive()) { sceneWorkspace.current?.setScopeActive(this, false); }
    endAssetEditorStyle();
  }

  protected override onGUI (): void {
    const asset = this.asset;

    if (!asset) { return; }
    const entry = asset instanceof EffectsObject ? assetLibrary.entry(asset.getInstanceId()) : undefined;
    const actions = { save: () => { void sceneWorkspace.save(); }, dirty: !!sceneWorkspace.current?.dirty,
      browse: entry ? () => revealContentAsset(entry.id) : undefined, close: () => this.close(), busy: sceneWorkspace.busy };

    if (ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows)) { setFocusedAssetSave(async () => { await sceneWorkspace.save(); }); }
    assetEditorMenu(this.layout, actions); assetEditorToolbar(actions);
    assetEditorPanels(this.layout, () => {
      if (asset instanceof Material) { this.materialViewport.draw(request => materialPreviews.runtime(asset, 512, request)); } else if (asset instanceof Texture || asset instanceof Sprite) {
        const preview = asset instanceof Sprite ? getSpriteThumbnail(asset) : getOrCreateTexturePreview(asset);
        const texture = asset instanceof Sprite ? asset.texture : asset;

        this.imageViewport.draw(preview ? { preview, width: 'width' in preview ? Number(preview.width) : texture.width,
          height: 'height' in preview ? Number(preview.height) : texture.height } : undefined);
      } else if (asset instanceof Shader) {
        if (ImGui.BeginTabBar('##RuntimeShaderSource')) {
          for (const [key, label] of [['vertex', 'Vertex'], ['fragment', 'Fragment']] as const) {
            if (ImGui.BeginTabItem(label)) {
              ImGui.InputTextMultiline('##Source', () => asset.shaderData[key], 262145, new ImGui.Vec2(-1, Math.max(50, ImGui.GetContentRegionAvail().y - 4)), ImGui.InputTextFlags.ReadOnly);
              ImGui.EndTabItem();
            }
          }
          ImGui.EndTabBar();
        }
      } else { ImGui.TextDisabled(asset.constructor.name); }
    }, () => {
      if (asset instanceof Material) { PropertyGrid.category('Material', 'Material', materialSearchTerms(asset), () => drawMaterialProperties(asset)); this.materialViewport.drawInspector(); } else if (asset instanceof Texture || asset instanceof Sprite) {
        const texture = asset instanceof Sprite ? asset.texture : asset;

        PropertyGrid.category('Image', asset.constructor.name, ['Width', 'Height', 'Texture', 'UV', 'Rotation'], () => {
          Fields.Text('Width', texture.width + ' px'); Fields.Text('Height', texture.height + ' px');
          if (asset instanceof Sprite) {
            Fields.ObjectField('Texture', asset, 'texture', 'Texture', true);
            Fields.Text('UV Rect', asset.rect.map(value => value.toFixed(3)).join(', ')); Fields.Text('Rotation', asset.rotation ? '90°' : 'None');
          }
        });
      }
      PropertyGrid.category('Asset', 'Asset', ['Name', 'Type', 'ID'], () => {
        Fields.Text('Name', (asset as { name?: string }).name || asset.constructor.name); Fields.Text('Type', asset.constructor.name);
        if (asset instanceof EffectsObject) { Fields.Text('ID', asset.getInstanceId()); }
      });
    }, asset instanceof Shader ? 'Source' : 'Viewport');
    assetEditorFooter(entry ? assetLibrary.pathText(entry.parentId) + '/' + entry.name : 'Scene Resource', asset.constructor.name);
    if (ImGui.IsAnyItemActive()) { sceneWorkspace.current?.setScopeActive(this, true); }
  }

  override flushEdits (): void { sceneWorkspace.current?.setScopeActive(this, false); }

  override onUndoRedo (): void {
    if (this.document !== sceneWorkspace.current) {
      this.close(); this.asset = undefined;

      return;
    }
    if (this.asset instanceof EffectsObject) {
      this.asset = EditorRuntimeSession.player.engine.effectsObjectServer.objectInstance[this.asset.getInstanceId()];
      if (!this.asset) { this.close(); }
    }
  }

  protected override onDisable (): void { this.flushEdits(); }
}
