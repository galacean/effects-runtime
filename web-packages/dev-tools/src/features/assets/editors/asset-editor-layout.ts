import { ImGui } from '../../../platform/imgui';
import { assetText } from '../../../ui/asset-view/asset-view';
import { drawEditorIcon } from '../../../ui/icons/editor-icons';
import { PropertyGrid, PropertyGridState } from '../../../ui/property-editor/property-grid';
import { InteractionColors as C } from '../../../ui/theme/editor-interaction';
import { beginEditorMenu, editorMenuItem, endEditorMenu, withEditorMenuStyle } from '../../../ui/widgets/editor-menu';
import { searchBar } from '../../../ui/widgets/search-bar';
import { splitter } from '../../../ui/widgets/splitter';
import { toolbarButton, toolbarSeparator } from '../../../ui/widgets/toolbar-button';
import { editorTooltip } from '../../../ui/widgets/editor-tooltip';

const footerHeight = 32;
const footerGap = 2;

export class AssetEditorLayout {
  inspectorWidth = 340;
  readonly search: [string] = [''];
  readonly grid = new PropertyGridState();

  constructor () { this.grid.minimumValueWidth = 140; this.grid.columnRatio = 0.46; }

  reset (): void { this.inspectorWidth = 340; this.search[0] = ''; }
}

export interface AssetEditorActions {
  save?: () => void,
  revert?: () => void,
  browse?: () => void,
  reimport?: () => void,
  compile?: () => void,
  close?: () => void,
  dirty?: boolean,
  busy?: boolean,
}

export function beginAssetEditorStyle (): void {
  ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
  ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(4, 4));
  ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(7, 4));
  ImGui.PushStyleColor(ImGui.Col.WindowBg, C.panel);
  ImGui.PushStyleColor(ImGui.Col.ChildBg, C.panel);
}

export function endAssetEditorStyle (): void { ImGui.PopStyleColor(2); ImGui.PopStyleVar(3); }

export function constrainAssetEditor (width = 1120, height = 720): void {
  const display = ImGui.GetIO().DisplaySize;

  ImGui.SetNextWindowSizeConstraints(new ImGui.Vec2(Math.min(680, display.x - 24), Math.min(420, display.y - 24)), new ImGui.Vec2(display.x - 24, display.y - 24));
  ImGui.SetNextWindowSize(new ImGui.Vec2(Math.min(width, display.x - 40), Math.min(height, display.y - 40)), ImGui.Cond.FirstUseEver);
}

export function assetEditorMenu (layout: AssetEditorLayout, actions: AssetEditorActions): void {
  const origin = ImGui.GetCursorScreenPos(), position = ImGui.GetWindowPos(), size = ImGui.GetWindowSize(), draw = ImGui.GetWindowDrawList();
  const min = new ImGui.Vec2(position.x, Math.min(origin.y, position.y + ImGui.GetFontSize())), max = new ImGui.Vec2(position.x + size.x, position.y + size.y);

  draw.PushClipRect(min, max, false); draw.AddRectFilled(min, max, ImGui.GetColorU32(C.panel)); draw.PopClipRect();
  withEditorMenuStyle(() => {
    if (!ImGui.BeginMenuBar()) { return; }
    if (beginEditorMenu('File', true, true)) {
      if (editorMenuItem('Save', 'Ctrl+S', false, !!actions.save && !!actions.dirty && !actions.busy)) { actions.save?.(); }
      if (actions.revert && editorMenuItem('Revert', '', false, !!actions.dirty && !actions.busy)) { actions.revert(); }
      ImGui.Separator();
      if (editorMenuItem('Close', '', false, !actions.busy)) { actions.close?.(); }
      endEditorMenu();
    }
    if (beginEditorMenu('Asset', true, true)) {
      if (editorMenuItem('Find in Content Browser', '', false, !!actions.browse)) { actions.browse?.(); }
      if (actions.reimport && editorMenuItem('Reimport', '', false, !actions.busy)) { actions.reimport(); }
      if (actions.compile && editorMenuItem('Compile', '', false, !actions.busy)) { actions.compile(); }
      endEditorMenu();
    }
    if (beginEditorMenu('Window', true, true)) {
      if (editorMenuItem('Reset Layout')) { layout.reset(); }
      endEditorMenu();
    }
    ImGui.EndMenuBar();
  });
}

export function assetEditorToolbar (actions: AssetEditorActions, extra?: () => void): void {
  const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x, draw = ImGui.GetWindowDrawList();

  draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + 42), ImGui.GetColorU32(C.panel));
  draw.AddLine(new ImGui.Vec2(p.x, p.y + 41), new ImGui.Vec2(p.x + width, p.y + 41), ImGui.GetColorU32(C.outline));
  ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x + 8, p.y + 5));
  if (toolbarButton('##SaveAsset', { icon: 'save', label: 'Save', height: 32, iconSize: 20, enabled: !!actions.save && !!actions.dirty && !actions.busy, hint: 'Save this asset (Ctrl+S)' })) { actions.save?.(); }
  ImGui.SameLine(0, 6);
  if (toolbarButton('##BrowseAsset', { icon: 'browseContent', label: 'Browse', height: 32, iconSize: 20, enabled: !!actions.browse, hint: 'Find this asset in Content Browser' })) { actions.browse?.(); }
  if (actions.reimport || actions.compile || actions.revert) { toolbarSeparator(32, 8); }
  if (actions.reimport && toolbarButton('##ReimportAsset', { icon: 'import', label: 'Reimport', height: 32, iconSize: 20, enabled: !actions.busy, hint: 'Replace the source image' })) { actions.reimport(); }
  if (actions.compile && toolbarButton('##CompileAsset', { icon: 'check', label: 'Compile', height: 32, iconSize: 20, enabled: !actions.busy, hint: 'Compile the current shader source' })) { actions.compile(); }
  if (actions.revert) {
    if (actions.reimport || actions.compile) { ImGui.SameLine(0, 6); }
    if (toolbarButton('##RevertAsset', { icon: 'reset', height: 32, iconSize: 18, enabled: !!actions.dirty && !actions.busy, hint: 'Discard unsaved changes' })) { actions.revert(); }
  }
  if (extra) { toolbarSeparator(32, 8); extra(); }
  ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + 42)); ImGui.Dummy(new ImGui.Vec2(width, 0));
}

export function assetEditorPanelHeader (label: string, icon: 'view' | 'settings' | 'shader' = 'view'): void {
  const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x, draw = ImGui.GetWindowDrawList();
  const tabWidth = Math.min(width, ImGui.CalcTextSize(label).x + 44);

  draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + 29), ImGui.GetColorU32(C.recessed));
  draw.AddRectFilled(new ImGui.Vec2(p.x + 3, p.y + 3), new ImGui.Vec2(p.x + tabWidth, p.y + 29), ImGui.GetColorU32(C.panel), 3);
  drawEditorIcon(icon, p.x + 10, p.y + 8, 16, C.foreground);
  assetText(label, p.x + 31, p.y + 5, ImGui.GetColorU32(C.foreground));
  ImGui.Dummy(new ImGui.Vec2(width, 29));
}

export function assetEditorPanels (layout: AssetEditorLayout, viewport: () => void, inspector: () => void, title = 'Viewport'): void {
  const origin = ImGui.GetCursorScreenPos(), available = ImGui.GetContentRegionAvail();
  const height = Math.max(50, available.y - footerHeight - footerGap);
  const minimum = Math.min(280, available.x * 0.4), maximum = Math.max(minimum, available.x - 220);
  const side = Math.max(minimum, Math.min(maximum, layout.inspectorWidth));

  ImGui.BeginChild('##AssetViewportPanel', new ImGui.Vec2(Math.max(120, available.x - side - 3), height), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
  assetEditorPanelHeader(title, title === 'Source' ? 'shader' : 'view'); viewport(); ImGui.EndChild();
  ImGui.SameLine(0, 0);
  layout.inspectorWidth = splitter('##AssetInspectorSplitter', side, { length: height, min: minimum, max: maximum, invert: true, thickness: 3 });
  ImGui.SameLine(0, 0);
  ImGui.BeginChild('##AssetInspectorPanel', new ImGui.Vec2(0, height), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar);
  assetEditorPanelHeader('Inspector', 'settings');
  ImGui.SetCursorPosX(8); searchBar('##AssetInspectorSearch', layout.search, { hint: 'Search Inspector', width: Math.max(30, ImGui.GetContentRegionAvail().x - 8) });
  ImGui.BeginChild('##AssetInspectorRows', new ImGui.Vec2(0, 0));
  PropertyGrid.begin(layout.grid, layout.search[0]); inspector(); PropertyGrid.end();
  ImGui.EndChild(); ImGui.EndChild();
  ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + available.y - footerHeight));
}

export function assetEditorFooter (path: string, status = '', error = ''): void {
  const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x, draw = ImGui.GetWindowDrawList();

  draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + footerHeight), ImGui.GetColorU32(C.panel));
  draw.AddLine(p, new ImGui.Vec2(p.x + width, p.y), ImGui.GetColorU32(C.outline));
  const statusWidth = status ? Math.min(width * 0.45, ImGui.CalcTextSize(status).x + 16) : 0;
  const textY = p.y + (footerHeight - ImGui.GetFontSize()) / 2;

  assetText(error ? error.split('\n')[0] : path, p.x + 8, textY, ImGui.GetColorU32(error ? new ImGui.Vec4(1, 0.42, 0.35, 1) : C.muted), width - statusWidth - 16);
  if (status) { assetText(status, p.x + width - statusWidth + 4, textY, ImGui.GetColorU32(C.muted), statusWidth - 8); }
  ImGui.Dummy(new ImGui.Vec2(width, footerHeight));
  if (error && ImGui.IsItemHovered()) { editorTooltip(error); }
}
