import type { Shader } from '@galacean/effects';
import { EffectsObject, Material, Texture, spec } from '@galacean/effects';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { sceneWorkspace } from '../../scene/scene-workspace';
import { assetLibrary } from '../asset-library';
import type { AssetEntry, AssetObject } from '../model/asset-types';
import { MaterialPreviewRenderer, type MaterialPreviewInput } from './material-preview-renderer';
import { texturePreviewCache, type PreviewRequest, type RenderedPreview } from './texture-preview-cache';
import { frameMaterialPreview, thumbnailMaterialView, type MaterialPreviewSettings } from './material-preview-settings';

export interface MaterialPreviewRequest extends PreviewRequest { view?: MaterialPreviewSettings }

interface PreviewState { key: string, input: MaterialPreviewInput }
interface DraftState { key: string, shader?: spec.ShaderData, textures?: Record<string, Texture>, error?: string }

class MaterialPreviews {
  private project = '';
  private document = sceneWorkspace.current;
  private states = new WeakMap<object, Map<number, PreviewState>>();
  private drafts = new WeakMap<AssetObject, DraftState>();
  private requests = new WeakMap<AssetEntry, { loading: boolean, error?: string }>();
  private objectKeys = new WeakMap<object, number>();
  private nextKey = 0;

  beginFrame (): void {
    if (this.project !== assetLibrary.projectId || this.document !== sceneWorkspace.current) {
      texturePreviewCache.clear(this);
      this.states = new WeakMap(); this.drafts = new WeakMap(); this.requests = new WeakMap();
      this.project = assetLibrary.projectId; this.document = sceneWorkspace.current;
    }
  }

  runtime (material: Material, size = 96, request: MaterialPreviewRequest = {}): RenderedPreview | undefined {
    if (!material.isRegistered || material.isDestroyed || !material.shader) { return; }
    const data = material.toData();
    const textureVersions = Object.values(data.textures).map(value => this.textureVersion(value.texture as unknown as Texture));
    const version = JSON.stringify([data, material.shader.shaderData, material.enabledMacros, material.blending,
      material.blendFunction, material.blendEquation, material.culling, material.cullFace, textureVersions], (key, value) => {
      if (key === '_Time' || key === 'uTime') { return; }

      return value instanceof EffectsObject ? { id: value.getInstanceId() } : value;
    });

    return this.request(material, { data, shader: material.shader.shaderData, version, material }, size, request);
  }

  asset (id: string, size = 128, request: MaterialPreviewRequest = {}): RenderedPreview | undefined {
    const engine = EditorRuntimeSession.player?.engine, entry = assetLibrary.entry(id);

    if (!engine || !entry || entry.kind !== 'material' || entry.deletedAt) { return; }
    const material = assetLibrary.asset(engine, id);

    if (material instanceof Material) { return this.runtime(material, size, request); }
    let state = this.requests.get(entry);

    if (!state) { state = { loading: false }; this.requests.set(entry, state); }
    if (!state.loading && !state.error) {
      const pending = state;

      pending.loading = true;
      void assetLibrary.loadAsset(engine, id).catch(error => pending.error = String(error)).then(() => pending.loading = false);
    }
  }

  draft (draft: AssetObject, size = 512, request: MaterialPreviewRequest = {}): RenderedPreview | undefined {
    if (draft.kind !== 'material') { return; }
    const data = this.data(draft);
    const key = JSON.stringify([this.project, data.shader.id, data.textures, assetLibrary.revision], (_, value) => value instanceof EffectsObject ? { id: value.getInstanceId() } : value);
    let state = this.drafts.get(draft);

    if (!state || state.key !== key) {
      state = { key }; this.drafts.set(draft, state);
      const pending = state;

      void this.loadDraft(draft, pending).catch(error => pending.error = error instanceof Error ? error.message : String(error));
    }
    if (!state.shader || !state.textures) { return; }
    const resolved = state.textures;
    const textures = Object.fromEntries(Object.entries(data.textures).map(([name, value]) => [name, { ...value, texture: resolved[name] }]));
    const input = { ...data, textures } as unknown as spec.MaterialData;
    const version = JSON.stringify([key, data, state.shader, Object.values(resolved).map(texture => this.textureVersion(texture))]);

    return this.request(draft, { data: input, shader: state.shader, version }, size, request);
  }

  draftError (draft: AssetObject): string | undefined { return this.drafts.get(draft)?.error; }

  private async loadDraft (draft: AssetObject, state: DraftState): Promise<void> {
    const engine = EditorRuntimeSession.player.engine, data = this.data(draft);
    const owned = draft.objects.find(object => object.id === data.shader.id);
    const shader = owned ?? (await assetLibrary.loadAsset(engine, data.shader.id) as Shader).shaderData;
    const textures = await Promise.all(Object.entries(data.textures).map(async ([name, value]) => {
      const id = value.texture.id;
      const texture = id === spec.BuiltinObjectGUID.WhiteTexture ? engine.assetServer.whiteTexture : await assetLibrary.loadTexture(engine, id);

      return [name, texture] as const;
    }));

    state.shader = shader as spec.ShaderData; state.textures = Object.fromEntries(textures);
  }

  private data (draft: AssetObject): spec.MaterialData { return draft.objects.find(object => object.id === draft.id)! as unknown as spec.MaterialData; }

  private request (owner: object, input: MaterialPreviewInput, size: number, request: MaterialPreviewRequest): RenderedPreview {
    let states = this.states.get(owner);

    if (!states) { states = new Map(); this.states.set(owner, states); }
    let state = states.get(size);

    if (!state) { state = { key: String(++this.nextKey), input }; states.set(size, state); }
    const mesh = input.material ? assetLibrary.entry(input.material.getInstanceId())?.previewMesh : undefined;

    const view = request.view ?? { ...thumbnailMaterialView, primitive: mesh ?? 'sphere' };

    if (!request.view) { frameMaterialPreview(view); }
    state.input = { ...input, view };
    const source = state;
    const options = (request.priority ?? 0) > 0 || assetLibrary.preferences.realtimeThumbnails ? request : { ...request, realtime: false };

    return texturePreviewCache.render(this, source.key, input.version + JSON.stringify(state.input.view),
      () => new MaterialPreviewRenderer(EditorRuntimeSession.player.engine, size, size, () => source.input), options);
  }

  private objectKey (object: object): number {
    let key = this.objectKeys.get(object);

    if (!key) { key = ++this.nextKey; this.objectKeys.set(object, key); }

    return key;
  }

  private textureVersion (texture: Texture): unknown {
    if (!(texture instanceof Texture)) { return; }
    const source = texture.source;
    const pixels = 'image' in source ? source.image : 'data' in source ? source.data : source;

    return [texture.getInstanceId(), texture.isDestroyed, this.objectKey(pixels ?? source), assetLibrary.entry(texture.getInstanceId())?.updatedAt];
  }
}

export const materialPreviews = new MaterialPreviews();
