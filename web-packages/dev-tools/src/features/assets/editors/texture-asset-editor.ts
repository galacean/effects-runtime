import { BrowserFilePicker } from '../../../platform/browser-files/file-dialog';
import { ImGui } from '../../../platform/imgui';
import { PropertyFields as Fields } from '../../../ui/property-editor/property-fields';
import { PropertyGrid } from '../../../ui/property-editor/property-grid';
import { assetLibrary } from '../asset-library';
import type { AssetEntry } from '../model/asset-types';
import type { AssetThumbnailCache } from '../preview/asset-thumbnail-cache';
import { ImagePreviewViewport } from '../preview/image-preview-viewport';
import { imageTexturePreview } from '../preview/texture-preview';
import { revealContentAsset } from './asset-editor-registry';
import { AssetEditorLayout, assetEditorFooter, assetEditorMenu, assetEditorPanels, assetEditorToolbar,
  beginAssetEditorStyle, constrainAssetEditor, endAssetEditorStyle } from './asset-editor-layout';

export class TextureAssetEditor {
  private asset?: string;
  private opened = false;
  private focus = false;
  private project = '';
  private error = '';
  private readonly layout = new AssetEditorLayout();
  private readonly viewport = new ImagePreviewViewport();
  private readonly picker = new BrowserFilePicker();

  constructor (private readonly thumbnails: AssetThumbnailCache) { }

  open (id: string): void {
    if (this.asset !== id) { this.viewport.reset(); this.layout.search[0] = ''; }
    this.asset = id; this.opened = true; this.focus = true; this.project = assetLibrary.projectId; this.error = '';
  }

  close (): void { this.opened = false; this.asset = undefined; this.picker.dispose(); }

  draw (): void {
    const entry = this.asset ? assetLibrary.entry(this.asset) : undefined;

    if (this.project && this.project !== assetLibrary.projectId || entry?.deletedAt) { this.close(); }
    if (!this.opened || !entry) { return; }
    beginAssetEditorStyle(); constrainAssetEditor();
    if (this.focus) { ImGui.SetNextWindowFocus(); this.focus = false; }
    if (ImGui.Begin(entry.name + ' — Texture Editor###ContentTextureEditor', value => {
      if (value === false) { this.close(); }

      return this.opened;
    }, ImGui.WindowFlags.MenuBar | ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse)) {
      const actions = { browse: () => revealContentAsset(entry.id), reimport: () => this.reimport(entry), close: () => this.close(), busy: assetLibrary.busy };
      const image = this.thumbnails.get(entry.id, true);

      assetEditorMenu(this.layout, actions); assetEditorToolbar(actions);
      assetEditorPanels(this.layout, () => {
        this.viewport.draw(image ? { preview: imageTexturePreview(image), width: image.width, height: image.height } : undefined);
      }, () => {
        PropertyGrid.category('TextureInformation', 'Texture Information', ['Imported', 'Displayed', 'Format', 'Resource Size'], () => {
          Fields.Text('Imported', (entry.width ?? image?.width ?? 0) + ' × ' + (entry.height ?? image?.height ?? 0));
          Fields.Text('Displayed', image ? Math.round(image.width * this.viewport.zoom) + ' × ' + Math.round(image.height * this.viewport.zoom) : 'Loading');
          Fields.Text('Format', entry.mime?.replace('image/', '').toUpperCase() ?? 'Image');
          Fields.Text('Resource Size', image ? (image.width * image.height * 4 / 1024).toFixed(1) + ' KiB' : '—');
        });
        PropertyGrid.category('Source', 'Source', ['Name', 'File', 'File Size', 'Path'], () => {
          Fields.Text('Name', entry.name); Fields.Text('Source File', entry.sourceName ?? entry.name);
          Fields.Text('File Size', ((entry.size ?? 0) / 1024).toFixed(1) + ' KiB');
          Fields.Text('Asset Path', assetLibrary.pathText(entry.parentId) + '/' + entry.name);
        });
        PropertyGrid.category('Preview', 'Preview', ['Zoom', 'Background', 'Border', 'Desaturate'], () => {
          Fields.Text('Zoom', Math.round(this.viewport.zoom * 100) + '%');
          Fields.Property('Desaturate', () => ImGui.Checkbox('##Desaturate', value => this.viewport.display.desaturate = value ?? this.viewport.display.desaturate));
          Fields.Property('Draw Border', () => ImGui.Checkbox('##Border', value => this.viewport.border = value ?? this.viewport.border));
          const backgrounds = ['checker', 'dark', 'light'] as const;

          Fields.ComboField('Background', value => {
            if (value !== undefined) { this.viewport.background = backgrounds[value]; }

            return backgrounds.indexOf(this.viewport.background);
          }, ['Checkered', 'Dark', 'Light']);
        });
      });
      assetEditorFooter(assetLibrary.pathText(entry.parentId) + '/' + entry.name, 'Texture 2D', this.error);
    }
    ImGui.End(); endAssetEditorStyle();
  }

  private reimport (entry: AssetEntry): void {
    const project = assetLibrary.projectId;

    this.picker.choose('image/*', files => {
      if (project !== assetLibrary.projectId) { return; }
      void assetLibrary.importImages(files.slice(0, 1), entry.parentId, entry.id).then(ids => {
        if (project !== assetLibrary.projectId) { return; }
        if (ids?.length) { this.thumbnails.clear(); this.error = ''; } else { this.error = assetLibrary.error || 'The source image could not be imported.'; }
      });
    });
  }
}
