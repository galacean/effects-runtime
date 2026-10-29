import { editorPanel, menuItem } from '../../../framework/registry/editor-registry';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { EditorWindow } from '../../../framework/windows/editor-window';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ImGui } from '../../../platform/imgui';
import { assetDragPreview, assetTileHeight, paintAssetRow, paintAssetTile } from '../../../ui/asset-view/asset-view';
import { drawEditorIcon } from '../../../ui/icons/editor-icons';
import { ListItemInteraction, ListSelection } from '../../../ui/list-view/list-selection';
import { InteractionColors as I, editorRowColors } from '../../../ui/theme/editor-interaction';
import { searchBar } from '../../../ui/widgets/search-bar';
import { splitter } from '../../../ui/widgets/splitter';
import { openRuntimeAsset } from '../editors/asset-editor-registry';
import type { RuntimeAssetCategory, RuntimeAssetItem } from './runtime-asset-source';
import { RUNTIME_ASSET_CATEGORIES, RuntimeAssetSource } from './runtime-asset-source';

@editorPanel()
export class RuntimeAssetsPanel extends EditorWindow {
  private readonly source = new RuntimeAssetSource();
  private readonly selection = new ListSelection<string>();
  private readonly interaction = new ListItemInteraction<string>();
  private readonly search: [string] = [''];
  private category: RuntimeAssetCategory = 'All';
  private scale = 96;
  private sourcesWidth = 180;

  constructor () {
    super(); this.title = 'Runtime Assets';
    this.setWindowFlags(ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
  }

  @menuItem('Window/Runtime Assets')
  static showWindow (): void { EditorWindow.getWindow(RuntimeAssetsPanel).open(); }

  protected override onDisable (): void { this.interaction.reset(); }

  protected override onGUI (): void {
    const engine = EditorRuntimeSession.player?.engine;

    if (!engine) {
      ImGui.TextDisabled('No engine loaded');

      return;
    }
    const items = this.source.items(engine);
    const byId = new Map(items.map(item => [item.object, item.id]));

    this.selection.replace(EditorSelection.getSelectedObjects().flatMap(object => byId.has(object as RuntimeAssetItem['object']) ? [byId.get(object as RuntimeAssetItem['object'])!] : []));
    searchBar('##RuntimeAssetSearch', this.search, { hint: 'Search assets' });
    const available = ImGui.GetContentRegionAvail(), height = Math.max(30, available.y - 32);

    ImGui.PushStyleColor(ImGui.Col.ChildBg, I.recessed);
    ImGui.BeginChild('##RuntimeAssetSources', new ImGui.Vec2(Math.min(this.sourcesWidth, available.x * 0.4), height), ImGui.ChildFlags.Borders);
    for (const category of RUNTIME_ASSET_CATEGORIES) {
      const count = category === 'All' ? items.length : items.filter(item => item.category === category).length;
      const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;
      const selected = this.category === category;
      const clicked = ImGui.InvisibleButton(category, new ImGui.Vec2(width, 24));
      const colors = editorRowColors({ selected, hovered: ImGui.IsItemHovered(), focused: ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows) });

      ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + 24), ImGui.GetColorU32(colors.background));
      drawEditorIcon('folder', p.x + 4, p.y + 4, 16, colors.foreground);
      ImGui.GetWindowDrawList().AddText(new ImGui.Vec2(p.x + 26, p.y + 3), ImGui.GetColorU32(colors.foreground), category);
      ImGui.GetWindowDrawList().AddText(new ImGui.Vec2(p.x + width - ImGui.CalcTextSize(String(count)).x - 6, p.y + 3), ImGui.GetColorU32(I.muted), String(count));
      if (clicked) { this.category = category; }
    }
    ImGui.EndChild(); ImGui.PopStyleColor(); ImGui.SameLine(0, 0);
    this.sourcesWidth = splitter('##RuntimeAssetSplitter', this.sourcesWidth, { length: height, min: 120, max: Math.max(120, available.x * 0.4) });
    ImGui.SameLine(0, 0);
    const query = this.search[0].trim().toLowerCase();
    const visible = items.filter(item => (this.category === 'All' || this.category === item.category) && (!query || (item.name + ' ' + item.type).toLowerCase().includes(query)));

    ImGui.PushStyleColor(ImGui.Col.ChildBg, I.recessed);
    ImGui.BeginChild('##RuntimeAssetItems', new ImGui.Vec2(0, height));
    const origin = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;
    const list = this.scale <= 40, tileWidth = this.scale + 16, itemHeight = list ? 28 : assetTileHeight(tileWidth, 2);
    const columns = list ? 1 : Math.max(1, Math.floor((width + 8) / (tileWidth + 8)));
    const focused = ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows);

    for (let index = 0; index < visible.length; index++) {
      const item = visible[index], x = origin.x + index % columns * (tileWidth + 8), y = origin.y + Math.floor(index / columns) * (itemHeight + 8);
      const rect = { x, y, width: list ? width : tileWidth, height: itemHeight };

      ImGui.PushID(item.id); ImGui.SetCursorScreenPos(new ImGui.Vec2(x, y));
      ImGui.InvisibleButton('##RuntimeAsset', new ImGui.Vec2(rect.width, rect.height));
      if (ImGui.IsItemVisible()) {
        const hovered = ImGui.IsItemHovered(), state = { selected: this.selection.selected.has(item.id), hovered, focused };

        this.itemInput(item, visible, hovered);
        if (list) { paintAssetRow(item, rect, state); } else { paintAssetTile(item, rect, state); }
        if (hovered && ImGui.IsItemHovered(ImGui.HoveredFlags.DelayNormal)) { ImGui.SetTooltip(item.name + '\n' + item.type + '\n' + item.summary); }
        if (ImGui.BeginDragDropSource()) {
          this.interaction.drag(item.id);
          ImGui.SetDragDropPayload(item.object.constructor.name, item.object);
          assetDragPreview(item, 1); ImGui.EndDragDropSource();
        }
      }
      ImGui.PopID();
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + Math.ceil(visible.length / columns) * (itemHeight + 8)));
    ImGui.Dummy(new ImGui.Vec2(Math.max(1, width), 1));
    ImGui.EndChild(); ImGui.PopStyleColor();
    ImGui.TextDisabled(visible.length + ' of ' + items.length + ' assets'); ImGui.SameLine();
    ImGui.SetNextItemWidth(Math.min(160, ImGui.GetContentRegionAvail().x));
    ImGui.SliderFloat('##RuntimeAssetSize', next => this.scale = next ?? this.scale, 28, 192, '');
  }

  private itemInput (item: RuntimeAssetItem, order: RuntimeAssetItem[], hovered: boolean): void {
    const io = ImGui.GetIO();

    if (ImGui.IsItemClicked(ImGui.MouseButton.Left)) { this.interaction.press(item.id, { additive: io.KeyCtrl || io.KeySuper, range: io.KeyShift }, true); }
    if (ImGui.IsMouseReleased(ImGui.MouseButton.Left)) {
      const modifiers = this.interaction.release(item.id);

      if (modifiers && hovered) {
        this.selection.choose(item.id, order.map(entry => entry.id), modifiers);
        EditorSelection.setObjects(order.filter(entry => this.selection.selected.has(entry.id)).map(entry => entry.object));
      }
    }
    if (hovered && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left)) { openRuntimeAsset(item.object); }
  }
}
