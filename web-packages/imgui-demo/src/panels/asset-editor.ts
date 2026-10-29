import { EffectsObject, Material, Sprite, Texture } from '@galacean/effects';
import { editorWindow } from '../core/decorators';
import { setRuntimeAssetOpener } from '../core/content-library/asset-editor';
import { sceneWorkspace } from '../core/scene-document/scene-workspace';
import type { SceneDocument } from '../core/scene-document/scene-document';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import { PropertyGrid, PropertyGridState, PROPERTY_COLORS as C } from '../widgets/property-grid';
import { EditorGUILayout as Fields } from '../widgets/editor-gui-layout';
import { getOrCreateTexturePreview } from '../widgets/texture-preview';
import { getSpriteThumbnail } from '../widgets/sprite-thumbnail';
import { drawMaterialProperties } from './inspector/material-inspector';
import { drawAssetIcon } from '../widgets/asset-icons';
import { GalaceanEffects } from '../ge';

@editorWindow()
export class AssetEditor extends EditorWindow {
  private asset?: object;
  private document?: SceneDocument;
  private focus = false;
  private readonly grid = new PropertyGridState();

  constructor () {
    super(); this.title = 'Asset Editor'; this.initialSize = new ImGui.Vec2(660, 560);
    setRuntimeAssetOpener(asset => {
      this.asset = asset; this.document = sceneWorkspace.current; this.focus = true;
      this.title = ((asset as { name?: string }).name || asset.constructor.name) + ' — ' +
        (asset instanceof Material ? 'Material' : asset instanceof Texture ? 'Texture' : asset.constructor.name) + ' Editor###Asset Editor';
      this.open();
    });
  }

  override draw (): void {
    if (this.document !== sceneWorkspace.current) { this.close(); this.asset = undefined; }
    if (this.focus) { ImGui.SetNextWindowFocus(); this.focus = false; }
    ImGui.PushStyleColor(ImGui.Col.WindowBg, C.background);
    sceneWorkspace.observe('Edit asset properties', () => super.draw(), [this.asset]);
    if (!ImGui.IsAnyItemActive()) { sceneWorkspace.current?.setScopeActive(this, false); }
    ImGui.PopStyleColor();
  }

  protected override onGUI (): void {
    const asset = this.asset;

    if (!asset) { return; }
    const position = ImGui.GetWindowPos(), size = ImGui.GetWindowSize(), draw = ImGui.GetWindowDrawList();

    draw.AddRectFilled(new ImGui.Vec2(position.x + 1, ImGui.GetCursorScreenPos().y), new ImGui.Vec2(position.x + size.x - 1, position.y + size.y - 1), ImGui.GetColorU32(C.background));
    ImGui.Text((asset as { name?: string }).name || asset.constructor.name); ImGui.Separator();
    if (asset instanceof Texture || asset instanceof Sprite) {
      const preview = asset instanceof Sprite ? getSpriteThumbnail(asset) : getOrCreateTexturePreview(asset);

      if (preview) { ImGui.Image(preview.tex, new ImGui.Vec2(180, 180), preview.uv0, preview.uv1); }
    } else if (asset instanceof Material) {
      const p = ImGui.GetCursorScreenPos();

      drawAssetIcon('material', p.x, p.y, 96); ImGui.Dummy(new ImGui.Vec2(96, 104));
    }
    PropertyGrid.begin(this.grid, '');
    ImGui.PushID(asset instanceof EffectsObject ? asset.getInstanceId() : asset.constructor.name);
    try {
      if (asset instanceof Material) {
        PropertyGrid.category('Material', 'Material', [], () => drawMaterialProperties(asset));
      } else if (asset instanceof Texture || asset instanceof Sprite) {
        const texture = asset instanceof Sprite ? asset.texture : asset;

        PropertyGrid.category('Image', asset.constructor.name, [], () => {
          Fields.Text('Width', texture.width + ' px'); Fields.Text('Height', texture.height + ' px');
          if (asset instanceof Sprite) { Fields.ObjectField('Texture', asset, 'texture', 'Texture', true); }
        });
      } else { Fields.Text('Type', asset.constructor.name); }
    } finally { ImGui.PopID(); PropertyGrid.end(); }
    if (ImGui.IsAnyItemActive()) { sceneWorkspace.current?.setScopeActive(this, true); }
  }

  override flushEdits (): void { sceneWorkspace.current?.setScopeActive(this, false); }
  override onUndoRedo (): void {
    if (this.document !== sceneWorkspace.current) {
      this.close(); this.asset = undefined;

      return;
    }
    if (this.asset instanceof EffectsObject) {
      this.asset = GalaceanEffects.player.engine.effectsObjectServer.objectInstance[this.asset.getInstanceId()];
      if (!this.asset) { this.close(); }
    }
  }
  protected override onDisable (): void { this.flushEdits(); }
}
