import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { BrowserFilePicker } from '../../../platform/browser-files/file-dialog';
import { append, expand } from '../../../ui/controls/layout';
import { assetLibrary } from '../asset-library';
import type { AssetEntry } from '../model/asset-types';
import { AssetThumbnailCache } from '../preview/asset-thumbnail-cache';
import { ImagePreviewViewport } from '../preview/image-preview-viewport';
import { imageTexturePreview } from '../preview/texture-preview';
import { revealContentAsset } from './asset-editor-registry';
import { AssetEditorLayout } from './asset-editor-layout';

export class TextureAssetEditor extends EditorWindow {
  protected override dockingRole = 'document' as const;
  private asset?: string;
  private project = '';
  private error = '';
  private displayedEntry?: AssetEntry;
  private layout!: AssetEditorLayout;
  private viewport!: ImagePreviewViewport;
  private readonly thumbnails = new AssetThumbnailCache();
  private readonly picker = new BrowserFilePicker();

  constructor (private readonly windowId: string, asset: string, project: string) {
    super(); this.title = 'Texture Editor'; this.initialSize.set(1120, 720);
    this.asset = asset; this.project = project; this.tabIcon = 'texture';
  }
  override get layoutId (): string { return this.windowId; }
  protected override createContent (engine: Engine): Control {
    this.layout = new AssetEditorLayout(engine, () => {
      const entry = this.asset ? assetLibrary.entry(this.asset) : undefined;

      return { browse: entry ? () => revealContentAsset(entry.id) : undefined, reimport: entry ? () => this.reimport(entry) : undefined, close: () => this.close(), busy: assetLibrary.busy };
    });
    this.viewport = append(this.layout.viewport, expand(new ImagePreviewViewport(engine)));
    this.viewport.source = () => {
      const image = this.asset ? this.thumbnails.get(this.asset, true) : undefined;

      return image ? { preview: imageTexturePreview(image), width: image.width, height: image.height } : undefined;
    };
    this.rebuild();

    return this.layout;
  }
  override update (): void {
    const entry = this.asset ? assetLibrary.entry(this.asset) : undefined;

    if (this.project && this.project !== assetLibrary.projectId || entry?.deletedAt) { this.close(); this.asset = undefined; }
    if (this.layout && entry) {
      if (entry !== this.displayedEntry) { this.rebuild(true); }
      this.title = entry.name + ' — Texture Editor'; this.layout.footer.text = this.error || assetLibrary.pathText(entry.parentId) + '/' + entry.name + '   ·   Texture 2D';
    }
  }
  private rebuild (preserveView = false): void {
    if (!this.layout) { return; }
    if (!preserveView) { this.viewport.reset(); this.layout.search.text = ''; }
    this.layout.inspector.clear();
    const entry = this.asset ? assetLibrary.entry(this.asset) : undefined;

    this.displayedEntry = entry;
    if (!entry) { return; }
    const sheet = this.layout.inspector, info = sheet.section('texture', 'Texture Information');

    info.readOnly('Imported', () => (entry.width ?? 0) + ' × ' + (entry.height ?? 0));
    info.readOnly('Displayed', () => Math.round((entry.width ?? 0) * this.viewport.zoom) + ' × ' + Math.round((entry.height ?? 0) * this.viewport.zoom));
    info.readOnly('Format', () => entry.mime?.replace('image/', '').toUpperCase() ?? 'Image');
    info.readOnly('Resource Size', () => ((entry.width ?? 0) * (entry.height ?? 0) * 4 / 1024).toFixed(1) + ' KiB');
    const source = sheet.section('source', 'Source');

    source.readOnly('Name', () => entry.name); source.readOnly('Source File', () => entry.sourceName ?? entry.name);
    source.readOnly('File Size', () => ((entry.size ?? 0) / 1024).toFixed(1) + ' KiB');
    source.readOnly('Asset Path', () => assetLibrary.pathText(entry.parentId) + '/' + entry.name);
    const preview = sheet.section('preview', 'Preview');

    preview.readOnly('Zoom', () => Math.round(this.viewport.zoom * 100) + '%');
    preview.boolean('Desaturate', { read: () => this.viewport.display.desaturate, write: value => this.viewport.display.desaturate = value });
    preview.boolean('Draw Border', { read: () => this.viewport.border, write: value => this.viewport.border = value });
    const backgrounds = ['checker', 'dark', 'light'] as const;

    preview.choice('Background', { read: () => backgrounds.indexOf(this.viewport.background), write: value => this.viewport.background = backgrounds[value] }, ['Checkered', 'Dark', 'Light']);
    sheet.filter(this.layout.search.text);
  }
  private reimport (entry: AssetEntry): void {
    const project = assetLibrary.projectId;

    this.picker.choose('image/*', files => {
      if (project !== assetLibrary.projectId) { return; }
      void assetLibrary.importImages(files.slice(0, 1), entry.parentId, entry.id).then(ids => {
        if (project !== assetLibrary.projectId) { return; }
        if (ids?.length) { this.thumbnails.clear(); this.error = ''; this.rebuild(); } else { this.error = assetLibrary.error || 'The source image could not be imported.'; }
      });
    });
  }
  override dispose (): void { this.picker.dispose(); this.thumbnails.clear(); super.dispose(); }
}
