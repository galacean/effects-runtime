import { ShaderCompileResultStatus, spec } from '@galacean/effects';
import { GLShaderLibrary } from '@galacean/effects-webgl';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ImGui } from '../../../platform/imgui/index';
import { PropertyFields as Fields } from '../../../ui/property-editor/property-fields';
import { PropertyGrid } from '../../../ui/property-editor/property-grid';
import { toolbarButton } from '../../../ui/widgets/toolbar-button';
import { assetLibrary as library } from '../asset-library';
import type { AssetObject, AssetObjectData } from '../model/asset-types';
import { isObjectAsset } from '../model/asset-types';
import { validateObjectAsset } from '../model/object-asset-data';
import type { AssetThumbnailCache } from '../preview/asset-thumbnail-cache';
import { spriteRegionPreview } from '../preview/sprite-thumbnail';
import { materialPreviews } from '../preview/material-preview';
import { MaterialPreviewViewport } from '../preview/material-preview-widget';
import { ImagePreviewViewport } from '../preview/image-preview-viewport';
import { getOrCreateTexturePreview, imageTexturePreview } from '../preview/texture-preview';
import { ASSET_PRESENTATION } from '../ui/asset-presentation';
import { contentAssetPicker } from '../ui/content-asset-picker';
import { revealContentAsset, setFocusedAssetSave } from './asset-editor-registry';
import { materialProperties } from './material-details';
import { AssetEditorLayout, assetEditorFooter, assetEditorMenu, assetEditorPanels, assetEditorToolbar,
  beginAssetEditorStyle, constrainAssetEditor, endAssetEditorStyle } from './asset-editor-layout';

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
  private readonly layout = new AssetEditorLayout();
  private readonly materialViewport = new MaterialPreviewViewport();
  private readonly imageViewport = new ImagePreviewViewport();
  private sourceTexture = false;

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
      this.draft = structuredClone(payload);
      if (this.draft.previewMesh === 'sphere') { delete this.draft.previewMesh; }
      this.baseline = JSON.stringify(this.draft);
      this.materialViewport.view.primitive = this.draft.previewMesh ?? 'sphere'; this.materialViewport.resetCamera();
      this.layout.search[0] = ''; this.imageViewport.reset();
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
        this.compileShaders(draft);
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
    const presentation = ASSET_PRESENTATION[draft.kind], display = ImGui.GetIO().DisplaySize;

    beginAssetEditorStyle(); constrainAssetEditor();
    if (this.focus) { ImGui.SetNextWindowFocus(); this.focus = false; }
    ImGui.SetNextWindowPos(new ImGui.Vec2(display.x / 2, display.y / 2), ImGui.Cond.Appearing, new ImGui.Vec2(0.5, 0.5));
    if (ImGui.Begin(entry.name + (this.dirty ? '*' : '') + ' — ' + presentation.label + ' Editor###ContentObjectAssetEditor', next => {
      if (next === false && !this.loading && !this.saving) { this.requestClose(); }

      return this.opened;
    }, ImGui.WindowFlags.MenuBar | ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse | (this.dirty ? ImGui.WindowFlags.UnsavedDocument : 0))) {
      if (this.pending || ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows)) { setFocusedAssetSave(this.saveFromToolbar); }
      const actions = {
        save: () => { void this.saveFromToolbar(); }, revert: () => { void this.load(draft.id); },
        browse: () => revealContentAsset(entry.id), close: () => this.requestClose(),
        compile: draft.kind === 'shader' ? () => this.compile() : undefined, dirty: this.dirty, busy: !!this.saving || this.loading,
      };

      assetEditorMenu(this.layout, actions);
      assetEditorToolbar(actions, draft.kind === 'sprite' ? () => {
        if (toolbarButton('##SpriteView', { label: 'Sprite', checked: !this.sourceTexture, height: 32 })) { this.sourceTexture = false; this.imageViewport.reset(); }
        ImGui.SameLine(0, 4);
        if (toolbarButton('##SpriteSourceView', { label: 'Source Texture', checked: this.sourceTexture, height: 32 })) { this.sourceTexture = true; this.imageViewport.reset(); }
      } : undefined);
      ImGui.BeginDisabled(actions.busy);
      assetEditorPanels(this.layout, () => {
        if (draft.kind === 'material') { this.materialViewport.draw(request => materialPreviews.draft(draft, 512, request), materialPreviews.draftError(draft)); } else if (draft.kind === 'sprite') { this.drawSpritePreview(); } else { this.drawShader(); }
      }, () => {
        if (draft.kind === 'material') { this.drawMaterial(); this.materialViewport.drawInspector(); } else if (draft.kind === 'sprite') { this.drawSprite(); } else { this.drawShaderInspector(); }
      }, draft.kind === 'shader' ? 'Source' : 'Viewport');
      ImGui.EndDisabled();
      if (draft.kind === 'material' && (draft.previewMesh ?? 'sphere') !== this.materialViewport.view.primitive) {
        if (this.materialViewport.view.primitive === 'sphere') { delete draft.previewMesh; } else { draft.previewMesh = this.materialViewport.view.primitive; }
      }
      assetEditorFooter(library.pathText(entry.parentId) + '/' + entry.name,
        this.saving ? 'Saving...' : this.dirty ? 'Unsaved Changes' : this.status || presentation.label, this.error);
    }
    ImGui.End(); this.drawUnsavedDialog(); endAssetEditorStyle();
  }

  private requestClose (): void {
    if (this.dirty) { this.pending = 'close'; this.focus = true; } else { this.opened = false; }
  }

  private compile (): void {
    if (!this.draft) { return; }
    try { this.compileShaders(this.draft); this.error = ''; this.status = 'Compile Succeeded'; } catch (error) { this.showError(error); }
  }

  private compileShaders (draft: AssetObject): void {
    const shaders = draft.objects.filter(object => object.dataType === spec.DataType.Shader);
    const device = EditorRuntimeSession.player?.engine.displayServer.renderingDevice;

    if (!device || device.contextWasLost) { throw new Error('The renderer is not ready to compile this shader.'); }
    const shaderLibrary = new GLShaderLibrary(EditorRuntimeSession.device);
    let error: string | undefined;

    for (const shader of shaders) {
      const variant = shaderLibrary.createShader({ vertex: shader.vertex, fragment: shader.fragment, name: library.entry(draft.id)?.name, shared: true });

      variant.unregisterObject(); shaderLibrary.compileShader(variant);
      if (variant.compileResult?.status !== ShaderCompileResultStatus.success) {
        error = variant.compileResult?.error || 'The shader could not be compiled.';

        break;
      }
    }
    shaderLibrary.dispose();
    if (error) { throw new Error(error); }
  }

  private drawShaderInspector (): void {
    const data = this.data;

    PropertyGrid.category('Shader', 'Shader', ['Name', 'Language', 'Vertex', 'Fragment'], () => {
      Fields.Text('Name', library.entry(this.draft!.id)?.name ?? 'Shader'); Fields.Text('Language', 'GLSL');
      Fields.Text('Vertex Lines', String(data.vertex.split('\n').length)); Fields.Text('Fragment Lines', String(data.fragment.split('\n').length));
    });
    PropertyGrid.category('Properties', 'Exposed Parameters', ['Properties', 'Parameters', ...materialProperties(data.properties, {}).map(property => property.label)], () => {
      const properties = materialProperties(data.properties, {});

      if (!properties.length) { Fields.Text('Parameters', 'None'); }
      for (const property of properties) { Fields.Text(property.label, property.type); }
    });
    PropertyGrid.category('Compilation', 'Compilation', ['Status', 'Error'], () => {
      Fields.Text('Status', this.error ? 'Failed' : this.dirty ? 'Modified' : this.status || 'Ready');
      if (this.error) { Fields.Text('Error', this.error.split('\n')[0]); }
    });
  }

  private drawShader (): void {
    const data = this.data;

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

    PropertyGrid.category('Material', 'Material', ['Shader', 'Surface Type', 'Render Face'], () => {
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
    PropertyGrid.category('Parameters', 'Parameters', materialProperties(this.shaderProperties,
      { floats: data.floats, colors: data.colors, vector4s: data.vector4s, textures: data.textures }).map(property => property.label), () => {
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

    PropertyGrid.category('Sprite', 'Sprite', ['Texture', 'U', 'V', 'Width', 'Height', 'Rotation'], () => {
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
    const data = this.data;
    const image = data.texture?.id ? this.thumbnails.get(data.texture.id, true) : undefined;
    const white = EditorRuntimeSession.player.engine.assetServer.whiteTexture;
    const base = image ? imageTexturePreview(image) : getOrCreateTexturePreview(white);

    if (!base) {
      this.imageViewport.draw();

      return;
    }
    const width = image?.width ?? 1, height = image?.height ?? 1;
    const rotated = data.rotation === 1;

    if (this.sourceTexture) {
      this.imageViewport.draw({ preview: base, width, height }, rect => {
        const [u, v, w, h] = data.rect;
        const regionWidth = rotated ? h : w, regionHeight = rotated ? w : h;
        const min = new ImGui.Vec2(rect.x + u * rect.width, rect.y + (1 - v - regionHeight) * rect.height);

        ImGui.GetWindowDrawList().AddRect(min, new ImGui.Vec2(min.x + regionWidth * rect.width, min.y + regionHeight * rect.height), ImGui.COL32(247, 177, 45, 255), 0, 0, 2);
      });
    } else {
      this.imageViewport.draw({ preview: spriteRegionPreview(base, data.rect, data.rotation),
        width: (rotated ? height : width) * data.rect[2], height: (rotated ? width : height) * data.rect[3] });
    }
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
