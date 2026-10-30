import { ShaderCompileResultStatus, spec } from '@galacean/effects';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ImGui } from '../../../platform/imgui/index';
import { drawAssetIcon } from '../../../ui/icons/asset-icons';
import { PropertyFields as Fields } from '../../../ui/property-editor/property-fields';
import { PROPERTY_COLORS as C, PropertyGrid, PropertyGridState } from '../../../ui/property-editor/property-grid';
import { toolbarButton } from '../../../ui/widgets/toolbar-button';
import { checkerboard, contentWindowBackground } from '../../content-browser/content-style';
import { assetLibrary as library } from '../asset-library';
import type { AssetObject, AssetObjectData } from '../model/asset-types';
import { isObjectAsset } from '../model/asset-types';
import { validateObjectAsset } from '../model/object-asset-data';
import type { AssetThumbnailCache } from '../preview/asset-thumbnail-cache';
import { spriteRegionPreview } from '../preview/sprite-thumbnail';
import { drawTexturePreview, imageTexturePreview } from '../preview/texture-preview';
import { ASSET_PRESENTATION } from '../ui/asset-presentation';
import { contentAssetPicker } from '../ui/content-asset-picker';
import { setFocusedAssetSave } from './asset-editor-registry';
import { materialProperties } from './material-details';

export class ContentObjectAssetEditor {
  private draft?: AssetObject;
  private baseline = '';
  private project = '';
  private opened = false;
  private focus = false;
  private loading = false;
  private saving?: Promise<void>;
  private generation = 0;
  private error = '';
  private status = '';
  private pending?: string;
  private pendingReady = false;
  private shaderProperties?: string;
  private readonly grid = new PropertyGridState();

  constructor (private readonly thumbnails: AssetThumbnailCache) { library.registerSaveHandler(() => this.save()); }

  get dirty (): boolean { return !!this.draft && JSON.stringify(this.draft) !== this.baseline; }
  isDirty (id: string): boolean { return this.draft?.id === id && this.dirty; }

  open (id: string): void {
    if (this.loading || this.saving) { return; }
    if (this.draft?.id === id && this.opened) {
      this.focus = true;

      return;
    }
    if (this.dirty) {
      this.pending = id;

      return;
    }
    void this.load(id);
  }

  close (): void {
    this.generation++; this.opened = false; this.draft = undefined; this.pending = undefined; this.pendingReady = false;
    this.project = ''; this.baseline = ''; this.shaderProperties = undefined; this.error = ''; this.status = ''; this.loading = false;
    setFocusedAssetSave();
  }

  private async load (id: string): Promise<void> {
    const project = library.projectId, generation = ++this.generation;

    this.loading = true;
    try {
      const payload = await library.storage.payload(id, project);

      if (generation !== this.generation || project !== library.projectId) { return; }
      if (!payload || !isObjectAsset(payload) || library.entry(id)?.deletedAt) { throw new Error('This asset is no longer available.'); }
      validateObjectAsset(payload);
      this.draft = structuredClone(payload); this.baseline = JSON.stringify(this.draft);
      this.project = project; this.opened = true; this.focus = true; this.error = ''; this.status = '';
      await this.loadShaderProperties();
    } catch (error) { this.showError(error); library.report(error); } finally { if (generation === this.generation) { this.loading = false; } }
  }

  private get data (): AssetObjectData { return this.draft!.objects.find(object => object.id === this.draft!.id)!; }

  private async loadShaderProperties (): Promise<void> {
    this.shaderProperties = undefined;
    if (this.draft?.kind !== 'material') { return; }
    const id = this.data.shader.id, generation = this.generation;
    const owned = this.draft.objects.find(object => object.id === id);
    const payload = owned ? undefined : await library.storage.payload(id, this.project);

    if (generation !== this.generation || this.project !== library.projectId || this.draft?.kind !== 'material' || this.data.shader.id !== id) { return; }
    this.shaderProperties = owned?.properties ?? (payload && isObjectAsset(payload) ? payload.objects.find(object => object.id === id)?.properties : undefined);
  }

  async save (): Promise<void> {
    if (this.saving) { return this.saving; }
    if (!this.dirty || !this.draft) { return; }
    const draft = structuredClone(this.draft), generation = this.generation;

    this.saving = (async () => {
      try {
        if (this.project !== library.projectId) { throw new Error('This asset belongs to a project that is no longer open.'); }
        validateObjectAsset(draft);
        for (const shader of draft.objects.filter(object => object.dataType === spec.DataType.Shader)) {
          const shaderLibrary = EditorRuntimeSession.player?.engine.displayServer.renderingDevice.getShaderLibrary();

          if (!shaderLibrary) { throw new Error('The renderer is not ready to compile this shader.'); }
          const variant = shaderLibrary.createShader({ vertex: shader.vertex, fragment: shader.fragment, name: library.entry(draft.id)?.name, shared: true });

          if (!variant.initialized) { variant.initialize(); }
          if (variant.compileResult?.status !== ShaderCompileResultStatus.success) { throw new Error(variant.compileResult?.error || 'The shader could not be compiled.'); }
        }
        if (await library.saveObject(draft, EditorRuntimeSession.player?.engine) !== true) { throw new Error(library.error || 'The asset could not be saved.'); }
        if (generation === this.generation) { this.baseline = JSON.stringify(this.draft); this.error = ''; this.status = 'Saved'; }
      } catch (error) { this.showError(error); throw error; }
    })().finally(() => this.saving = undefined);

    return this.saving;
  }

  private showError (error: unknown): void { this.error = error instanceof Error ? error.message : String(error); this.status = ''; }
  private saveFromToolbar = async (): Promise<void> => { try { await this.save(); } catch { /* The editor keeps the draft and displays the error. */ } };

  draw (): void {
    setFocusedAssetSave();
    if (this.project && this.project !== library.projectId) { this.close(); }
    const draft = this.draft, entry = draft && library.entry(draft.id);

    if (entry?.deletedAt) { this.close(); }
    if (!this.opened || !draft || !entry) { return; }
    const presentation = ASSET_PRESENTATION[draft.kind];
    const display = ImGui.GetIO().DisplaySize;

    if (this.focus) { ImGui.SetNextWindowFocus(); this.focus = false; }
    ImGui.SetNextWindowPos(new ImGui.Vec2(display.x / 2, display.y / 2), ImGui.Cond.Appearing, new ImGui.Vec2(0.5, 0.5));
    ImGui.SetNextWindowSizeConstraints(new ImGui.Vec2(Math.min(440, display.x - 24), 300), new ImGui.Vec2(display.x - 24, display.y - 24));
    ImGui.SetNextWindowSize(new ImGui.Vec2(800, 580), ImGui.Cond.FirstUseEver);
    ImGui.PushStyleColor(ImGui.Col.WindowBg, C.background);
    if (ImGui.Begin(entry.name + (this.dirty ? '*' : '') + ' — ' + presentation.label + ' Editor###ContentObjectAssetEditor', next => {
      if (next === false && !this.loading && !this.saving) { if (this.dirty) { this.pending = 'close'; this.focus = true; } else { this.opened = false; } }

      return this.opened;
    }, ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse | (this.dirty ? ImGui.WindowFlags.UnsavedDocument : 0))) {
      contentWindowBackground();
      if (this.pending || ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows)) { setFocusedAssetSave(this.saveFromToolbar); }
      ImGui.BeginDisabled(!!this.saving || this.loading);
      ImGui.SetCursorPos(new ImGui.Vec2(8, ImGui.GetCursorPosY() + 4));
      if (toolbarButton('##Save', { icon: 'save', label: 'Save', height: 28, enabled: this.dirty, hint: 'Save asset (Ctrl+S)' })) { void this.saveFromToolbar(); }
      ImGui.SameLine(0, 6);
      if (toolbarButton('##Revert', { icon: 'reset', label: 'Revert', height: 28, enabled: this.dirty, hint: 'Discard changes since the last save' })) { void this.load(draft.id); }
      ImGui.SameLine(0, 12); ImGui.AlignTextToFramePadding(); ImGui.TextDisabled(this.saving ? 'Saving...' : this.dirty ? 'Unsaved changes' : this.status || presentation.label);
      ImGui.Separator();
      const footer = this.error ? 100 : 25;

      ImGui.BeginChild('##AssetProperties', new ImGui.Vec2(0, -footer));
      if (draft.kind === 'shader') { this.drawShader(); } else {
        if (draft.kind === 'sprite') { this.drawSpritePreview(); } else {
          const p = ImGui.GetCursorScreenPos();

          drawAssetIcon('material', p.x + 16, p.y + 10, 80); ImGui.Dummy(new ImGui.Vec2(110, 100));
        }
        PropertyGrid.begin(this.grid, '');
        try {
          if (draft.kind === 'material') { this.drawMaterial(); } else { this.drawSprite(); }
        } finally { PropertyGrid.end(); }
      }
      ImGui.EndChild();
      ImGui.EndDisabled();
      if (this.error) {
        ImGui.BeginChild('##AssetError', new ImGui.Vec2(0, 90));
        ImGui.PushTextWrapPos(ImGui.GetContentRegionAvail().x); ImGui.TextColored(new ImGui.Vec4(1, 0.42, 0.35, 1), this.error); ImGui.PopTextWrapPos(); ImGui.EndChild();
      } else { ImGui.TextDisabled(library.pathText(entry.parentId) + '/' + entry.name); }
    }
    ImGui.End(); this.drawUnsavedDialog(); ImGui.PopStyleColor();
  }

  private drawShader (): void {
    const data = this.data;

    ImGui.SetCursorPosX(8); ImGui.TextDisabled('GLSL source');
    if (ImGui.BeginTabBar('##ShaderTabs')) {
      for (const [key, label] of [['vertex', 'Vertex'], ['fragment', 'Fragment'], ['properties', 'Properties']] as const) {
        if (ImGui.BeginTabItem(label)) {
          ImGui.InputTextMultiline('##Source', next => {
            if (next !== undefined) { data[key] = next; }

            return data[key] ?? '';
          }, 262145, new ImGui.Vec2(-1, Math.max(100, ImGui.GetContentRegionAvail().y - 4)), ImGui.InputTextFlags.AllowTabInput);
          ImGui.EndTabItem();
        }
      }
      ImGui.EndTabBar();
    }
  }

  private drawMaterial (): void {
    const data = this.data;

    PropertyGrid.category('Material', 'Material', [], () => {
      Fields.Property('Shader', width => {
        const owned = this.draft!.objects.find(object => object.dataType === spec.DataType.Shader);

        return contentAssetPicker('shader', owned?.id === data.shader.id ? undefined : data.shader.id, width, id => {
          if (id || owned) { data.shader = { id: id ?? owned!.id }; void this.loadShaderProperties().catch(error => this.showError(error)); }
        }, owned ? 'Default Sprite Shader' : 'Select Shader', !!owned);
      });
      const renderTypes = [spec.RenderType.Opaque, spec.RenderType.Transparent], faces = [spec.RenderFace.Front, spec.RenderFace.Back, spec.RenderFace.Both];

      Fields.ComboField('Surface Type', next => {
        if (next !== undefined) { data.stringTags.RenderType = renderTypes[next]; }

        return Math.max(0, renderTypes.indexOf(data.stringTags.RenderType));
      }, ['Opaque', 'Transparent']);
      Fields.ComboField('Render Face', next => {
        if (next !== undefined) { data.stringTags.RenderFace = faces[next]; }

        return Math.max(0, faces.indexOf(data.stringTags.RenderFace));
      }, ['Front', 'Back', 'Both']);
    });
    PropertyGrid.category('Parameters', 'Parameters', [], () => {
      for (const property of materialProperties(this.shaderProperties, { floats: data.floats, colors: data.colors, vector4s: data.vector4s, textures: data.textures })) {
        const { name, label, type } = property;

        ImGui.PushID(name);
        if (type === 'Color') {
          const color = data.colors[name] ?? { r: 1, g: 1, b: 1, a: 1 };

          if (Fields.ColorField(label, color)) { data.colors[name] = color; }
        } else if (type === '2D') {
          const textureId = data.textures[name]?.texture?.id;

          Fields.Property(label, width => contentAssetPicker('texture', textureId === spec.BuiltinObjectGUID.WhiteTexture ? undefined : textureId, width, id => {
            data.textures[name] = { ...data.textures[name], texture: { id: id ?? spec.BuiltinObjectGUID.WhiteTexture } };
          }, 'White'));
        } else if (type === 'Float' || type === 'Int') {
          const values = type === 'Int' ? data.ints : data.floats;

          Fields.NumberField(label, next => {
            if (next !== undefined) { values[name] = type === 'Int' ? Math.round(next) : next; }

            return values[name] ?? (Number(property.fallback) || 0);
          }, 0.01, property.range?.[0] ?? 0, property.range?.[1] ?? 0);
        } else if (type === 'Vector') {
          const vector = data.vector4s[name] ?? { x: 0, y: 0, z: 0, w: 0 };

          if (Fields.Property(label, () => ImGui.DragFloat4('##Vector', vector, 0.01))) { data.vector4s[name] = vector; }
        }
        ImGui.PopID();
      }
    });
  }

  private drawSprite (): void {
    const data = this.data;

    PropertyGrid.category('Sprite', 'Sprite', [], () => {
      Fields.Property('Texture', width => contentAssetPicker('texture', data.texture?.id, width, id => { if (id) { data.texture = { id }; } else { delete data.texture; } }, 'White'));
      for (const [index, label] of ['U', 'V', 'Width', 'Height'].entries()) {
        Fields.NumberField(label, next => {
          if (next !== undefined) {
            const rect = data.rect;

            rect[index] = Math.max(index > 1 ? 0.000001 : 0, Math.min(1, next));
            const other = index < 2 ? (data.rotation ? 3 - index : index + 2) : (data.rotation ? 3 - index : index - 2);

            rect[index] = Math.min(1 - rect[other], rect[index]);
          }

          return data.rect[index];
        }, 0.001, 0, 1, '%.4f');
      }
      Fields.ComboField('Rotation', next => {
        if (next !== undefined) {
          data.rotation = next;
          const width = next ? 3 : 2, height = next ? 2 : 3;

          data.rect[width] = Math.min(1 - data.rect[0], data.rect[width]);
          data.rect[height] = Math.min(1 - data.rect[1], data.rect[height]);
        }

        return data.rotation;
      }, ['None', '90°']);
    });
  }

  private drawSpritePreview (): void {
    const data = this.data, origin = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x, height = 160;
    const image = data.texture?.id ? this.thumbnails.get(data.texture.id, true) : undefined;
    const draw = ImGui.GetWindowDrawList(), x = origin.x + (width - height) / 2, y = origin.y + 8;

    checkerboard(x, y, height - 16, height - 16, 8);
    if (image) {
      const [, , w, h] = data.rect, rotated = data.rotation === 1;
      const imageWidth = (rotated ? image.height : image.width) * w, imageHeight = (rotated ? image.width : image.height) * h;
      const scale = Math.min((height - 16) / imageWidth, (height - 16) / imageHeight);
      const size = new ImGui.Vec2(imageWidth * scale, imageHeight * scale);
      const min = new ImGui.Vec2(x + (height - 16 - size.x) / 2, y + (height - 16 - size.y) / 2);

      drawTexturePreview(spriteRegionPreview(imageTexturePreview(image), data.rect, data.rotation), min, new ImGui.Vec2(min.x + size.x, min.y + size.y));
    } else { draw.AddRectFilled(new ImGui.Vec2(x, y), new ImGui.Vec2(x + height - 16, y + height - 16), ImGui.COL32_WHITE); }
    ImGui.Dummy(new ImGui.Vec2(width, height));
  }

  private drawUnsavedDialog (): void {
    if (this.pending && !ImGui.IsPopupOpen('Unsaved Asset Changes')) { ImGui.OpenPopup('Unsaved Asset Changes'); }
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(12, 10));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 8));
    ImGui.SetNextWindowSize(new ImGui.Vec2(400, 0), ImGui.Cond.Always);
    ImGui.SetNextWindowPos(new ImGui.Vec2(ImGui.GetIO().DisplaySize.x / 2, ImGui.GetIO().DisplaySize.y / 2), ImGui.Cond.Appearing, new ImGui.Vec2(0.5, 0.5));
    if (!ImGui.BeginPopupModal('Unsaved Asset Changes', null, ImGui.WindowFlags.AlwaysAutoResize | ImGui.WindowFlags.NoSavedSettings)) {
      ImGui.PopStyleVar(2);

      return;
    }
    ImGui.Text('Save changes to ' + (library.entry(this.draft!.id)?.name ?? 'this asset') + '?');
    ImGui.BeginDisabled(!!this.saving);
    if (ImGui.Button('Save', new ImGui.Vec2(100, 26))) {
      void this.save().then(() => { this.pendingReady = true; }).catch(() => { this.pending = undefined; });
    }
    ImGui.SameLine();
    if (ImGui.Button('Discard', new ImGui.Vec2(100, 26))) { this.pendingReady = true; }
    ImGui.SameLine();
    if (ImGui.Button('Cancel', new ImGui.Vec2(100, 26)) || ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { this.pending = undefined; }
    ImGui.EndDisabled();
    if (!this.pending || this.pendingReady) { ImGui.CloseCurrentPopup(); }
    ImGui.EndPopup(); ImGui.PopStyleVar(2);
    if (this.pendingReady) { this.pendingReady = false; this.continuePending(); }
  }

  private continuePending (): void {
    const next = this.pending;

    this.pending = undefined;
    if (next === 'close') { this.opened = false; } else if (next) { void this.load(next); }
  }
}
