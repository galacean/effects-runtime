import { ShaderCompileResultStatus, spec, math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { EditorTextArea } from '../../../ui/controls/text-field';
import { GLShaderLibrary } from '@galacean/effects-webgl';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { append, disposeChildren, expand } from '../../../ui/controls/layout';
import { EditorDialog } from '../../../ui/controls/dialog';
import { EditorTabs } from '../../../ui/controls/tabs';
import { EditorIconButton } from '../../../ui/icons/control-icons';
import { assetLibrary as library } from '../asset-library';
import type { AssetObject, AssetObjectData } from '../model/asset-types';
import { isObjectAsset } from '../model/asset-types';
import { validateObjectAsset } from '../model/object-asset-data';
import { AssetThumbnailCache } from '../preview/asset-thumbnail-cache';
import { spriteRegionPreview } from '../preview/sprite-thumbnail';
import { materialPreviews } from '../preview/material-preview';
import { MaterialPreviewViewport } from '../preview/material-preview-widget';
import { ImagePreviewViewport } from '../preview/image-preview-viewport';
import { getOrCreateTexturePreview, imageTexturePreview } from '../preview/texture-preview';
import { ContentAssetPicker } from '../ui/content-asset-picker';
import { ASSET_PRESENTATION } from '../ui/asset-presentation';
import { revealContentAsset, setFocusedAssetSave } from './asset-editor-registry';
import { materialProperties } from './material-details';
import { AssetEditorLayout } from './asset-editor-layout';

export class ContentObjectAssetEditor extends EditorWindow {
  protected override dockingRole = 'document' as const;
  private draft?: AssetObject;
  private baseline = '';
  private project = '';
  private loading = false;
  private saving?: Promise<void>;
  private generation = 0;
  private error = '';
  private status = '';
  private shaderProperties?: string;
  private layout!: AssetEditorLayout;
  private materialViewport?: MaterialPreviewViewport;
  private imageViewport?: ImagePreviewViewport;
  private sourceTexture = false;
  private unsaved!: EditorDialog;
  private readonly thumbnails = new AssetThumbnailCache();
  private readonly sourceToggle: EditorIconButton[] = [];
  private readonly releaseSaveHandler: () => void;

  constructor (private readonly windowId: string, private readonly assetId: string, private readonly projectId: string) {
    super(); this.title = 'Content Asset Editor'; this.initialSize.set(1120, 720);
    this.releaseSaveHandler = library.registerSaveHandler(() => this.save());
  }
  override get layoutId (): string { return this.windowId; }
  get dirty (): boolean { return !!this.draft && JSON.stringify(this.draft) !== this.baseline; }
  isDirty (id: string): boolean { return this.project === library.projectId && this.draft?.id === id && this.dirty; }
  private get data (): AssetObjectData { return this.draft!.objects.find(object => object.id === this.draft!.id)!; }

  override close (): void {
    if (this.loading || this.saving) { return; }
    if (this.dirty) { this.confirmDiscard(() => this.forceClose()); } else { this.forceClose(); }
  }
  private forceClose (): void {
    this.generation++; super.close(); this.draft = undefined; this.project = ''; this.baseline = '';
    this.shaderProperties = undefined; this.error = ''; this.status = ''; this.loading = false; setFocusedAssetSave();
  }
  protected override createContent (engine: Engine): Control {
    this.layout = new AssetEditorLayout(engine, () => ({
      save: () => { void this.saveFromToolbar(); }, dirty: this.dirty, busy: this.loading || !!this.saving,
      revert: this.draft ? () => this.confirmDiscard(() => { void this.load(this.draft!.id); }) : undefined,
      browse: this.draft ? () => revealContentAsset(this.draft!.id) : undefined,
      compile: this.draft?.kind === 'shader' ? () => this.compile() : undefined, close: () => this.close(),
    }));
    this.unsaved = new EditorDialog(engine);
    void this.load(this.assetId);

    return this.layout;
  }
  override update (): void {
    if (!this.layout) { return; }
    if (this.projectId !== library.projectId || library.entry(this.assetId)?.deletedAt) { this.forceClose(); }
    if (this.hasFocus()) { setFocusedAssetSave(this.saveFromToolbar); }
    const entry = library.entry(this.assetId);

    this.tabIcon = entry ? ASSET_PRESENTATION[entry.kind].menuIcon : undefined;
    this.title = entry ? entry.name + (this.dirty ? '*' : '') + ' — ' + ASSET_PRESENTATION[entry.kind].label + ' Editor' : 'Content Asset Editor';
    this.layout.footer.text = this.error || (entry ? library.pathText(entry.parentId) + '/' + entry.name + (this.dirty ? ' *' : '') + '   ·   ' + this.status : '');
    if (this.draft && this.materialViewport) { this.draft.previewMesh = this.materialViewport.view.primitive === 'sphere' ? undefined : this.materialViewport.view.primitive; }
  }
  private async load (id: string): Promise<void> {
    const project = this.projectId, generation = ++this.generation;

    this.loading = true;
    try {
      const payload = await library.storage.payload(id, project);

      if (generation !== this.generation || project !== library.projectId) { return; }
      if (!payload || !isObjectAsset(payload) || library.entry(id)?.deletedAt) { throw new Error('This asset is no longer available.'); }
      validateObjectAsset(payload); this.draft = structuredClone(payload);
      if (this.draft.previewMesh === 'sphere') { delete this.draft.previewMesh; }
      this.baseline = JSON.stringify(this.draft); this.project = project; this.error = ''; this.status = '';
      await this.loadShaderProperties();
      if (generation === this.generation) { this.rebuild(); this.open(); }
    } catch (error) { this.showError(error); library.report(error); } finally { if (generation === this.generation) { this.loading = false; } }
  }
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
        if (generation === this.generation) { this.baseline = JSON.stringify(draft); this.error = ''; this.status = 'Saved'; }
      } catch (error) { this.showError(error); throw error; }
    })().finally(() => this.saving = undefined);

    return this.saving;
  }

  private showError (error: unknown): void { this.error = error instanceof Error ? error.message : String(error); this.status = ''; }
  private saveFromToolbar = async (): Promise<void> => { try { await this.save(); } catch { /* The editor keeps the draft and displays the error. */ } };

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

  private rebuild (): void {
    if (!this.layout || !this.draft) { return; }
    this.layout.viewportTitle = this.draft.kind === 'shader' ? 'Source' : 'Viewport';
    this.layout.inspector.clear(); disposeChildren(this.layout.viewport); this.sourceToggle.splice(0).forEach(button => button.dispose());
    this.materialViewport = undefined; this.imageViewport = undefined; this.layout.search.text = '';
    const engine = this.layout.engine, data = this.data, draft = this.draft, sheet = this.layout.inspector;

    if (draft.kind === 'shader') {
      const tabs = append(this.layout.viewport, expand(new EditorTabs(engine)));
      const info = sheet.section('shader', 'Shader');

      info.readOnly('Name', () => library.entry(draft.id)?.name ?? 'Shader'); info.readOnly('Language', () => 'GLSL');
      info.readOnly('Vertex Lines', () => String(data.vertex.split('\n').length)); info.readOnly('Fragment Lines', () => String(data.fragment.split('\n').length));
      const properties = sheet.section('properties', 'Exposed Parameters');
      const refreshProperties = (): void => {
        properties.clear();
        for (const property of materialProperties(data.properties, {})) { properties.readOnly(property.label, () => property.type); }
        sheet.filter(sheet.query);
      };

      for (const [key, title] of [['vertex', 'Vertex'], ['fragment', 'Fragment'], ['properties', 'Properties']] as const) {
        const source = new EditorTextArea(engine);

        source.text = data[key] ?? '';
        source.on('textChanged', value => { data[key] = value; if (key === 'properties') { refreshProperties(); } });
        tabs.addTab(title, source);
      }
      refreshProperties();
      const compilation = sheet.section('compilation', 'Compilation');

      compilation.readOnly('Status', () => this.error ? 'Failed' : this.dirty ? 'Modified' : this.status || 'Ready');
      compilation.readOnly('Error', () => this.error.split('\n')[0]);
    } else if (draft.kind === 'material') {
      this.materialViewport = append(this.layout.viewport, expand(new MaterialPreviewViewport(engine)));
      this.materialViewport.view.primitive = draft.previewMesh ?? 'sphere'; this.materialViewport.resetCamera();
      this.materialViewport.source = request => materialPreviews.draft(draft, 512, request);
      this.buildMaterial(); this.materialViewport.buildInspector(sheet.section('preview', 'Previewing'));
    } else {
      this.imageViewport = append(this.layout.viewport, expand(new ImagePreviewViewport(engine)));
      this.imageViewport.source = () => this.spritePreview();
      this.imageViewport.overlay = (canvas, rect) => {
        if (!this.sourceTexture) { return; }
        const [u, v, w, h] = data.rect, rw = data.rotation ? h : w, rh = data.rotation ? w : h;

        canvas.drawRect(rect.x + u * rect.width, rect.y + (1 - v - rh) * rect.height, rw * rect.width, rh * rect.height, new math.Color(.97, .69, .18, 1), 2);
      };
      const toggle = append(this.layout.toolbar, new EditorIconButton(engine, 'texture', 'Source Texture'));

      toggle.toggleMode = true; toggle.setPressedNoSignal(this.sourceTexture); toggle.on('toggled', value => { this.sourceTexture = value; this.imageViewport?.reset(); }); this.sourceToggle.push(toggle);
      this.buildSprite();
    }
  }
  private buildMaterial (): void {
    const sheet = this.layout.inspector, data = this.data, group = sheet.section('material', 'Material');
    const owned = this.draft!.objects.find(object => object.dataType === spec.DataType.Shader);

    group.add('Shader', new ContentAssetPicker(sheet.engine, 'shader', {
      read: () => owned?.id === data.shader.id ? undefined : data.shader.id,
      write: id => {
        if (!id && !owned) { return; }
        data.shader = { id: id ?? owned!.id };
        void this.loadShaderProperties().then(() => this.rebuild()).catch(error => this.showError(error));
      },
    }, owned ? 'Default Sprite Shader' : 'Select Shader', !!owned));
    const renderTypes = [spec.RenderType.Opaque, spec.RenderType.Transparent], faces = [spec.RenderFace.Front, spec.RenderFace.Back, spec.RenderFace.Both];

    group.choice('Surface Type', { read: () => Math.max(0, renderTypes.indexOf(data.stringTags.RenderType)), write: value => data.stringTags.RenderType = renderTypes[value] }, ['Opaque', 'Transparent']);
    group.choice('Render Face', { read: () => Math.max(0, faces.indexOf(data.stringTags.RenderFace)), write: value => data.stringTags.RenderFace = faces[value] }, ['Front', 'Back', 'Both']);
    const parameters = sheet.section('parameters', 'Parameters');

    for (const property of materialProperties(this.shaderProperties, { floats: data.floats, colors: data.colors, vector4s: data.vector4s, textures: data.textures })) {
      const { name, label, type } = property;

      if (type === 'Color') {
        parameters.color(label, { read: () => {
          const c = data.colors[name] ?? { r: 1, g: 1, b: 1, a: 1 };

          return new math.Color(c.r, c.g, c.b, c.a);
        },
        write: value => data.colors[name] = { r: value.r, g: value.g, b: value.b, a: value.a } });
      } else if (type === '2D') {
        parameters.add(label, new ContentAssetPicker(sheet.engine, 'texture', {
          read: () => data.textures[name]?.texture?.id === spec.BuiltinObjectGUID.WhiteTexture ? undefined : data.textures[name]?.texture?.id,
          write: id => data.textures[name] = { ...data.textures[name], texture: { id: id ?? spec.BuiltinObjectGUID.WhiteTexture } },
        }, 'White'));
      } else if (type === 'Float' || type === 'Int') {
        const values = type === 'Int' ? data.ints : data.floats;

        parameters.number(label, { read: () => values[name] ?? (Number(property.fallback) || 0), write: value => values[name] = type === 'Int' ? Math.round(value) : value },
          { step: type === 'Int' ? 1 : .01, min: property.range?.[0], max: property.range?.[1] });
      } else if (type === 'Vector') {
        parameters.vector(label, { read: () => {
          const v = data.vector4s[name] ?? { x: 0, y: 0, z: 0, w: 0 };

          return [v.x, v.y, v.z, v.w];
        },
        write: ([x, y, z, w]) => data.vector4s[name] = { x, y, z, w } }, 4);
      }
    }
  }
  private buildSprite (): void {
    const group = this.layout.inspector.section('sprite', 'Sprite'), data = this.data;

    group.add('Texture', new ContentAssetPicker(group.engine, 'texture', { read: () => data.texture?.id,
      write: id => { if (id) { data.texture = { id }; } else { delete data.texture; } } }, 'White'));
    ['U', 'V', 'Width', 'Height'].forEach((title, index) => group.number(title, {
      read: () => data.rect[index],
      write: value => {
        const other = index < 2 ? (data.rotation ? 3 - index : index + 2) : (data.rotation ? 3 - index : index - 2);

        data.rect[index] = Math.min(1 - data.rect[other], Math.max(index > 1 ? .000001 : 0, Math.min(1, value)));
      },
    }, { step: .001, min: 0, max: 1, precision: 4 }));
    group.choice('Rotation', {
      read: () => data.rotation,
      write: value => {
        data.rotation = value; const width = value ? 3 : 2, height = value ? 2 : 3;

        data.rect[width] = Math.min(1 - data.rect[0], data.rect[width]); data.rect[height] = Math.min(1 - data.rect[1], data.rect[height]);
      },
    }, ['None', '90°']);
  }
  private spritePreview () {
    const data = this.data, image = data.texture?.id ? this.thumbnails.get(data.texture.id, true) : undefined;
    const base = image ? imageTexturePreview(image) : getOrCreateTexturePreview(EditorRuntimeSession.player.engine.assetServer.whiteTexture);

    if (!base) { return; }
    const width = image?.width ?? 1, height = image?.height ?? 1, rotated = data.rotation === 1;

    return this.sourceTexture ? { preview: base, width, height } : { preview: spriteRegionPreview(base, data.rect, data.rotation),
      width: (rotated ? height : width) * data.rect[2], height: (rotated ? width : height) * data.rect[3] };
  }
  private confirmDiscard (next: () => void): void {
    if (!this.content) { return; }
    this.unsaved.show(this.content, 'Unsaved Asset Changes', body => this.unsaved.message(body, 'Save changes to ' + (this.draft && library.entry(this.draft.id)?.name || 'this asset') + '?'), [
      { label: 'Save', primary: true, action: async () => {
        try { await this.save(); } catch { return; }
        this.unsaved.close(); next();
      } },
      { label: 'Discard', action: () => { this.unsaved.close(); next(); } },
      { label: 'Cancel', action: () => this.unsaved.close() },
    ]);
  }
  override dispose (): void { this.generation++; this.releaseSaveHandler(); this.unsaved?.dispose(); this.thumbnails.clear(); super.dispose(); }
}
