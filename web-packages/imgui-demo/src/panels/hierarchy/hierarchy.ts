import { VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { Selection } from '../../core/selection';
import { projectWorkspace } from '../../core/project/project-workspace';
import { sceneWorkspace } from '../../core/scene-document/scene-workspace';
import type { SceneDocument } from '../../core/scene-document/scene-document';
import { GalaceanEffects } from '../../ge';
import { ImGui } from '../../imgui';
import { searchBar } from '../../widgets/search-bar';
import { drawCreateItemMenu } from '../../widgets/create-item-menu';
import { drawEditorArrow } from '../../widgets/editor-arrow';
import { drawEditorIcon } from '../../widgets/editor-icons';
import { editorMenuSection, editorPopup, withEditorMenuStyle, beginEditorMenu, endEditorMenu, editorMenuItem } from '../../widgets/editor-menu';
import { EditorWindow } from '../editor-window';
import { Scene } from '../scene/scene';
import { editorRowColors, InteractionColors as I } from '../theme/editor-interaction';
import { HierarchyActions } from './hierarchy-actions';
import { itemKey, OutlinerModel } from './hierarchy-model';
import type { OutlinerNode, OutlinerOptions } from './hierarchy-model';
import { FOLDER_TINT, OUTLINER_SIZE as L, outlinerButton, outlinerHint, outlinerText } from './hierarchy-style';

const PAYLOAD = 'OutlinerItems';
const PREFERENCES = 'effects-editor.hierarchy.v2';

interface ItemPayload { document: SceneDocument, ids: string[] }
interface PressedRow { id: string, deferred: boolean, dragged: boolean, arrow: boolean }
type DropZone = 'before' | 'inside' | 'after';

@editorWindow()
export class Hierarchy extends EditorWindow {
  private document?: SceneDocument;
  private actions?: HierarchyActions;
  private model?: OutlinerModel;
  private releaseState?: () => void;
  private expanded = new Set(['world']);
  private selectedFolders = new Set<string>();
  private anchor?: string;
  private focused?: string;
  private applyingSelection = false;
  private pendingReveal?: string;
  private search: [string] = [''];
  private searchFocused = false;
  private focusSearch = false;
  private rename?: string;
  private renameText: [string] = [''];
  private focusRename = false;
  private pressed?: PressedRow;
  private hoveredRow = false;
  private listFocused = false;
  private contextRows: string[] = [];
  private openContext = false;
  private columnUpdate = true;
  private visibilityDrag?: { visible: boolean, visited: Set<string> };
  private hoverDrop?: { id: string, since: number, frame: number };
  private dropHint?: { text: string, frame: number };
  private options: OutlinerOptions = {
    autoFrame: true, showInternal: false, onlySelected: false, hideInvisible: false,
    showVisibility: true, showType: true, typeFilter: '', sort: 'hierarchy', descending: false,
  };

  @menuItem('Window/Hierarchy')
  static showWindow (): void { EditorWindow.getWindow(Hierarchy).open(); }

  constructor () {
    super(); this.title = 'Hierarchy'; this.open();
    this.setWindowFlags(ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
    try {
      const stored = window.localStorage.getItem(PREFERENCES);
      const data = JSON.parse(stored ?? window.localStorage.getItem('effects-editor.outliner.v1') ?? '{}');

      for (const key of ['autoFrame', 'showInternal', 'onlySelected', 'hideInvisible', 'showVisibility', 'showType', 'descending'] as const) {
        if (typeof data[key] === 'boolean') { this.options[key] = data[key]; }
      }
      if (stored && ['hierarchy', 'label', 'type', 'visibility'].includes(data.sort)) { this.options.sort = data.sort; }
    } catch (error) { console.warn('Unable to read hierarchy preferences.', error); }
  }

  override draw (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));
    ImGui.PushStyleVar(ImGui.StyleVar.ScrollbarSize, 12);
    ImGui.PushStyleColor(ImGui.Col.WindowBg, I.recessed);
    ImGui.PushStyleColor(ImGui.Col.ScrollbarBg, I.recessed);
    ImGui.PushStyleColor(ImGui.Col.ScrollbarGrab, I.secondary);
    ImGui.PushStyleColor(ImGui.Col.ScrollbarGrabHovered, I.hover);
    ImGui.PushStyleColor(ImGui.Col.ScrollbarGrabActive, I.muted);
    super.draw();
    ImGui.PopStyleColor(5); ImGui.PopStyleVar(3);
  }

  override onSelectionChange (): void {
    if (this.applyingSelection || !this.document) { return; }
    if (Selection.changeSource !== 'history') { this.selectedFolders.clear(); }
    if (this.options.autoFrame) { this.revealSelection(); }
  }

  override onUndoRedo (): void { this.rename = undefined; this.pressed = undefined; this.revealSelection(); }

  override flushEdits (): void {
    if (this.rename) { this.finishRename(false); }
    this.finishVisibility();
  }

  protected override onEnable (): void { window.addEventListener('keydown', this.cancelBrowserShortcut, true); }

  protected override onDisable (): void {
    this.listFocused = false; this.flushEdits();
    window.removeEventListener('keydown', this.cancelBrowserShortcut, true);
  }

  private readonly cancelBrowserShortcut = (event: KeyboardEvent): void => {
    if (this.listFocused && !ImGui.GetIO().WantTextInput && (event.ctrlKey || event.metaKey) &&
      !event.isComposing && ['KeyA', 'KeyD', 'KeyF'].includes(event.code)) { event.preventDefault(); }
  };

  protected override onGUI (): void {
    const document = sceneWorkspace.current;
    const composition = GalaceanEffects.player.getCompositions()[0];

    if (document !== this.document) { this.bind(document); }
    this.buildModel();
    if (this.rename && !this.model?.rows.some(node => node.id === this.rename)) { this.finishRename(false); }
    const origin = ImGui.GetCursorScreenPos(), size = ImGui.GetContentRegionAvail();

    this.drawToolbar();
    if (!document || !composition || !this.model) {
      ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 12, origin.y + this.toolbarHeight + 16)); ImGui.TextDisabled('Open a scene to view its items.');

      return;
    }
    const footer = ImGui.GetFontSize() + 18;

    this.drawTree(Math.max(60, size.y - this.toolbarHeight - footer));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + size.y - footer));
    this.drawStatus(size.x, footer);
    this.drawContextMenu(); this.keyboard();
    if (!ImGui.IsMouseDown(ImGui.MouseButton.Left)) { this.pressed = undefined; this.finishVisibility(); }
  }

  private bind (document?: SceneDocument): void {
    this.releaseState?.(); this.document = document;
    this.actions = document ? new HierarchyActions(document) : undefined;
    this.expanded = new Set(['world']); this.selectedFolders.clear(); this.anchor = undefined; this.focused = undefined;
    if (document) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(this.expansionKey()) ?? 'null');

        if (Array.isArray(saved) && saved.every(id => typeof id === 'string')) { this.expanded = new Set(saved); }
      } catch (error) { console.warn('Unable to read outliner expansion state.', error); }
    }
    this.rename = undefined; this.search[0] = ''; this.pendingReveal = undefined;
    if (document) {
      this.releaseState = document.registerEditorState({
        read: () => ({ folders: [...this.selectedFolders], anchor: this.anchor, focused: this.focused }),
        restore: state => { this.selectedFolders = new Set(state.folders); this.anchor = state.anchor; this.focused = state.focused; },
      });
    }
  }

  private buildModel (): void {
    const document = this.document;

    if (!document) {
      this.model = undefined;

      return;
    }
    const selected = this.selectedKeys();

    this.model = new OutlinerModel(document, document.composition, this.search[0], this.options, this.expanded, selected);
    if (this.pendingReveal) {
      let changed = false;

      for (let node = this.model.nodes.get(this.pendingReveal)?.parent; node; node = node.parent) {
        if (!this.expanded.has(node.id)) { this.expanded.add(node.id); changed = true; }
      }
      if (changed) { this.saveExpanded(); }
      this.model = new OutlinerModel(document, document.composition, this.search[0], this.options, this.expanded, selected);
    }
    for (const id of this.selectedFolders) { if (!this.model.nodes.has(id)) { this.selectedFolders.delete(id); } }
  }

  private selectedKeys (): Set<string> {
    const keys = new Set(this.selectedFolders), document = this.document;

    if (document) {
      for (const object of Selection.getSelectedObjects()) {
        if (object === document.composition) { keys.add('world'); } else if (object instanceof VFXItem && object.composition === document.composition) { keys.add(itemKey(document, object)); }
      }
    }

    return keys;
  }

  private selectedRows (): OutlinerNode[] {
    const model = this.model;

    return model ? [...this.selectedKeys()].flatMap(id => model.nodes.get(id) ? [model.nodes.get(id)!] : []) : [];
  }

  private select (ids: string[], anchor = ids.at(-1)): void {
    const model = this.model, document = this.document;

    if (!model || !document) { return; }
    document.observeEditor('Select objects', () => {
      this.applyingSelection = true;
      try {
        this.selectedFolders = new Set(ids.filter(id => model.nodes.get(id)?.kind === 'folder'));
        this.anchor = anchor; this.focused = ids.at(-1);
        Selection.setObjects(ids.flatMap<object>(id => {
          const node = model.nodes.get(id);

          return node?.item ? [node.item] : node?.kind === 'world' ? [document.composition] : [];
        }));
      } finally { this.applyingSelection = false; }
    });
  }

  private clickRow (node: OutlinerNode): void {
    const io = ImGui.GetIO(), keys = this.selectedKeys(), additive = io.KeyCtrl || io.KeySuper;

    if (io.KeyShift && this.anchor && this.model) {
      const rows = this.model.rows, first = rows.findIndex(row => row.id === this.anchor), last = rows.indexOf(node);
      const range = rows.slice(Math.min(Math.max(0, first), last), Math.max(first, last) + 1).map(row => row.id);

      this.select(additive ? [...new Set([...keys, ...range])] : range, this.anchor); this.focused = node.id;
    } else if (additive) {
      if (keys.has(node.id)) { keys.delete(node.id); } else { keys.add(node.id); }
      this.select([...keys], node.id);
    } else { this.select([node.id]); }
  }

  private drawToolbar (): void {
    const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;
    const fieldHeight = Math.max(22, ImGui.GetFontSize() + 6);
    const buttonY = p.y + 8 + (fieldHeight - 24) / 2;

    ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + this.toolbarHeight), ImGui.GetColorU32(I.panel));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(4, 3));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x + 8, p.y + 8));
    if (this.focusSearch) { ImGui.SetKeyboardFocusHere(); this.focusSearch = false; }
    searchBar('##OutlinerSearch', this.search, { hint: 'Search...', width: Math.max(40, width - 68), rounding: fieldHeight / 2 });
    this.searchFocused = ImGui.IsAnyItemActive() && ImGui.GetIO().WantTextInput;
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x + width - 56, buttonY));
    if (outlinerButton('##NewFolder', 'newFolder', 'Create a folder containing the current selection', !!this.document)) { this.newFolder(); }
    ImGui.SameLine(0, 0);
    if (outlinerButton('##OutlinerOptions', 'settings', 'Hierarchy settings')) { ImGui.OpenPopup('##OutlinerSettings'); }
    editorPopup('##OutlinerSettings', () => this.settingsMenu());
    ImGui.PopStyleVar();
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + this.toolbarHeight));
  }

  private get toolbarHeight (): number { return Math.max(22, ImGui.GetFontSize() + 6) + 12; }

  private drawTree (height: number): void {
    withEditorMenuStyle(() => this.drawTreeContent(height));
  }

  private drawTreeContent (height: number): void {
    const model = this.model!, p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;
    const rowHeight = Math.max(L.row, ImGui.GetFontSize());

    this.hoveredRow = false;
    ImGui.PushStyleVar(ImGui.StyleVar.CellPadding, new ImGui.Vec2(0, 0));
    ImGui.PushStyleColor(ImGui.Col.TableHeaderBg, I.header);
    ImGui.PushStyleColor(ImGui.Col.TableBorderLight, I.recessed);
    const flags = ImGui.TableFlags.ScrollY | ImGui.TableFlags.Resizable | ImGui.TableFlags.Reorderable | ImGui.TableFlags.Hideable |
      ImGui.TableFlags.NoPadOuterX;

    if (ImGui.BeginTable('##OutlinerTree', 3, flags, new ImGui.Vec2(0, height))) {
      ImGui.TableSetupColumn('Visibility', ImGui.TableColumnFlags.WidthFixed | ImGui.TableColumnFlags.NoResize | ImGui.TableColumnFlags.NoSort | ImGui.TableColumnFlags.NoReorder, L.gutter);
      ImGui.TableSetupColumn('Item Label', ImGui.TableColumnFlags.WidthStretch | ImGui.TableColumnFlags.NoHide, 5);
      ImGui.TableSetupColumn('Type', ImGui.TableColumnFlags.WidthStretch, 2);
      ImGui.TableSetupScrollFreeze(0, 1);
      if (this.columnUpdate) {
        ImGui.TableSetColumnEnabled(0, this.options.showVisibility); ImGui.TableSetColumnEnabled(2, this.options.showType); this.columnUpdate = false;
      }
      ImGui.TableNextRow(ImGui.TableRowFlags.Headers, L.header);
      for (let column = 0; column < 3; column++) {
        if (!ImGui.TableSetColumnIndex(column)) { continue; }
        this.drawColumnHeader(column);
      }
      const visible = (ImGui.TableGetColumnFlags(0) & ImGui.TableColumnFlags.IsEnabled) !== 0;
      const type = (ImGui.TableGetColumnFlags(2) & ImGui.TableColumnFlags.IsEnabled) !== 0;

      if (visible !== this.options.showVisibility || type !== this.options.showType) { this.options.showVisibility = visible; this.options.showType = type; this.saveOptions(); }
      this.listFocused = ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows) && !this.searchFocused;
      const keys = this.selectedKeys(), ancestors = new Set<string>();

      for (const key of keys) { for (let node = model.nodes.get(key)?.parent; node; node = node.parent) { ancestors.add(node.id); } }
      const clipper = new ImGui.ListClipper();

      clipper.Begin(model.rows.length, rowHeight);
      const reveal = model.rows.findIndex(node => node.id === this.pendingReveal || node.id === this.rename);

      if (reveal >= 0) { clipper.IncludeItemByIndex(reveal); }
      while (clipper.Step()) {
        for (let index = clipper.DisplayStart; index < clipper.DisplayEnd; index++) {
          const node = model.rows[index];

          ImGui.PushID(node.id); ImGui.TableNextRow(ImGui.TableRowFlags.None, rowHeight);
          ImGui.TableSetColumnIndex(1);
          const row = ImGui.GetCursorScreenPos(), mouse = ImGui.GetMousePos();
          const hovered = ImGui.IsWindowHovered(ImGui.HoveredFlags.AllowWhenBlockedByActiveItem) && mouse.y >= row.y && mouse.y < row.y + rowHeight && mouse.x >= p.x && mouse.x < p.x + width - ImGui.GetStyle().ScrollbarSize;
          const selected = keys.has(node.id);
          const colors = editorRowColors({ selected, hovered, focused: this.listFocused, parentHighlighted: ancestors.has(node.id), alternate: index % 2 !== 0 });

          this.hoveredRow ||= hovered;
          ImGui.TableSetBgColor(ImGui.TableBgTarget.RowBg0, ImGui.GetColorU32(colors.background));
          const gutter = ImGui.TableSetColumnIndex(0);

          if (gutter) { this.drawVisibility(node, rowHeight, selected, hovered); }
          ImGui.TableSetColumnIndex(1);
          const labelX = ImGui.GetCursorScreenPos().x;
          let dropping = this.drawLabel(node, rowHeight, colors.foreground);

          if (ImGui.TableSetColumnIndex(2)) {
            const start = ImGui.GetCursorScreenPos(), available = ImGui.GetContentRegionAvail().x;

            ImGui.InvisibleButton('##TypeCell', new ImGui.Vec2(Math.max(1, available), rowHeight));
            this.rowInteraction(node, false); this.dragSource(node); dropping ??= this.dropTarget(node);
            outlinerText(node.type, start.x + 5, start.y + (rowHeight - ImGui.GetFontSize()) / 2, available - 9, selected ? colors.foreground : I.muted, this.search[0]);
          }
          if (dropping === 'inside') { ImGui.TableSetBgColor(ImGui.TableBgTarget.RowBg1, ImGui.GetColorU32(I.selectedInactive)); } else if (dropping) {
            const draw = ImGui.GetWindowDrawList(), x = labelX + 6 + node.depth * L.indent + 16;
            const y = row.y + (dropping === 'before' ? 1 : rowHeight - 1);
            const color = ImGui.GetColorU32(I.primary);

            draw.PushClipRect(new ImGui.Vec2(p.x, p.y + L.header), new ImGui.Vec2(p.x + width - ImGui.GetStyle().ScrollbarSize, p.y + height), false);
            draw.AddLine(new ImGui.Vec2(x, y), new ImGui.Vec2(p.x + width - ImGui.GetStyle().ScrollbarSize - 2, y), color, 2);
            draw.AddCircleFilled(new ImGui.Vec2(x, y), 3, color);
            draw.PopClipRect();
          }
          if (this.pendingReveal === node.id || this.rename === node.id && this.focusRename) { ImGui.SetScrollHereY(0.5); this.pendingReveal = undefined; }
          ImGui.PopID();
        }
      }
      clipper.End(); clipper.delete();
      this.drawEmptyArea(p.x, width, rowHeight, model.rows.length === 0);
      ImGui.EndTable();
    }
    ImGui.PopStyleColor(2); ImGui.PopStyleVar();
  }

  private drawColumnHeader (column: number): void {
    const start = ImGui.GetCursorScreenPos(), label = column === 1 ? 'Item Label' : 'Type';

    ImGui.TableHeader('##HierarchyColumn' + column);
    const max = ImGui.GetItemRectMax(), draw = ImGui.GetWindowDrawList();
    const hovered = ImGui.IsItemHovered();

    if (ImGui.IsItemClicked(ImGui.MouseButton.Left)) {
      const sort = column === 0 ? 'visibility' : column === 1 ? 'label' : 'type';

      if (this.options.sort === sort && this.options.descending) {
        this.options.sort = 'hierarchy'; this.options.descending = false;
      } else {
        this.options.descending = this.options.sort === sort; this.options.sort = sort;
      }
      this.saveOptions();
    }
    draw.PushClipRect(start, new ImGui.Vec2(max.x, start.y + L.header), true);
    draw.AddRectFilled(start, new ImGui.Vec2(max.x, start.y + L.header), ImGui.GetColorU32(hovered ? I.secondary : I.header));
    if (column) {
      const sorted = this.options.sort === (column === 1 ? 'label' : 'type');
      const labelWidth = Math.min(ImGui.CalcTextSize(label).x, Math.max(0, max.x - start.x - (sorted ? 24 : 8)));

      outlinerText(label, start.x + 4, start.y + (L.header - 2 - ImGui.GetFontSize()) / 2, labelWidth, I.foreground);
      if (sorted) { drawEditorIcon(this.options.descending ? 'sortDescending' : 'sortAscending', start.x + 8 + labelWidth, start.y + (L.header - 14) / 2, 12, I.foreground); }
      if (ImGui.IsItemHovered(ImGui.HoveredFlags.DelayNormal)) { outlinerHint(label); }
    } else {
      drawEditorIcon('view', start.x + 4, start.y + (L.header - 18) / 2, 16, this.options.sort === 'visibility' ? I.foregroundHover : I.foreground);
      if (hovered) { outlinerHint('Sort by visibility', this.options.sort === 'visibility' ? this.options.descending ? 'Visible items first' : 'Hidden items first' : 'Click to sort visible and hidden items.'); }
    }
    draw.AddLine(new ImGui.Vec2(max.x - 1, start.y), new ImGui.Vec2(max.x - 1, start.y + L.header), ImGui.GetColorU32(I.recessed));
    draw.AddRectFilled(new ImGui.Vec2(start.x, start.y + L.header - 2), new ImGui.Vec2(max.x, start.y + L.header), ImGui.GetColorU32(I.recessed));
    draw.PopClipRect();
  }

  private drawLabel (node: OutlinerNode, rowHeight: number, tint: ImGui.Vec4): DropZone | undefined {
    const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;
    const arrowX = p.x + 6 + node.depth * L.indent, iconX = arrowX + 16, labelX = iconX + 22;
    const y = p.y + (rowHeight - L.icon) / 2;
    const open = this.expanded.has(node.id) || !!this.model?.filtering;

    ImGui.InvisibleButton('##LabelCell', new ImGui.Vec2(Math.max(1, width), rowHeight));
    const mouse = ImGui.GetMousePos(), arrow = node.children.length > 0 && mouse.x >= arrowX && mouse.x < arrowX + 16;
    const hovered = ImGui.IsItemHovered();

    if (this.rename !== node.id) { this.rowInteraction(node, arrow); this.dragSource(node); }
    const dropping = this.dropTarget(node);

    if (node.children.length) { drawEditorArrow(arrowX, y, 16, open ? 'down' : 'right', hovered && arrow ? I.foregroundHover : this.selectedKeys().has(node.id) ? I.foreground : I.muted); }
    drawEditorIcon(node.kind === 'folder' ? open ? 'folderOpen' : 'folder' : node.icon, iconX, y, L.icon, node.kind === 'folder' ? FOLDER_TINT : tint);
    if (this.rename === node.id) {
      ImGui.SetCursorScreenPos(new ImGui.Vec2(labelX - 3, p.y));
      ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(3, Math.max(1, (rowHeight - ImGui.GetFontSize()) / 2)));
      ImGui.SetNextItemWidth(Math.max(30, p.x + width - labelX));
      if (this.focusRename) { ImGui.SetKeyboardFocusHere(); this.focusRename = false; }
      const enter = ImGui.InputText('##Rename', this.renameText, 512, ImGui.InputTextFlags.AutoSelectAll | ImGui.InputTextFlags.EnterReturnsTrue);
      const cancel = ImGui.IsKeyPressed(ImGui.Key.Escape, false);

      if (cancel || enter || ImGui.IsItemDeactivated()) { this.finishRename(cancel); }
      ImGui.PopStyleVar();
      ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + rowHeight));
    } else {
      const color = node.item && !node.item.isActive ? I.muted : tint;

      outlinerText(node.label, labelX, p.y + (rowHeight - ImGui.GetFontSize()) / 2, p.x + width - labelX - 5, color, this.search[0]);
      if (hovered && !ImGui.IsMouseDown(ImGui.MouseButton.Left) && ImGui.IsItemHovered(ImGui.HoveredFlags.DelayNormal)) {
        outlinerHint(node.label, node.type);
      }
    }

    return dropping;
  }

  private rowInteraction (node: OutlinerNode, arrow: boolean): void {
    if (ImGui.IsItemClicked(ImGui.MouseButton.Left)) {
      const io = ImGui.GetIO(), selected = this.selectedKeys().has(node.id);

      this.pressed = { id: node.id, deferred: selected && !io.KeyShift && !io.KeyCtrl && !io.KeySuper, dragged: false, arrow };
      if (arrow) { this.toggle(node, io.KeyShift); } else if (!this.pressed.deferred) { this.clickRow(node); }
    }
    const pressed = this.pressed;

    if (pressed?.id === node.id && pressed.deferred && !pressed.arrow && !pressed.dragged && ImGui.IsItemHovered() && ImGui.IsMouseReleased(ImGui.MouseButton.Left)) { this.clickRow(node); this.pressed = undefined; }
    if (ImGui.IsItemHovered() && !arrow && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left)) {
      if (node.kind === 'folder') { this.toggle(node, false); } else { this.focusScene(); }
    }
    if (ImGui.IsItemClicked(ImGui.MouseButton.Right)) {
      if (!this.selectedKeys().has(node.id)) { this.select([node.id]); }
      this.contextRows = [...this.selectedKeys()]; this.openContext = true;
    }
  }

  private drawVisibility (node: OutlinerNode, rowHeight: number, selected: boolean, hovered: boolean): void {
    if (node.kind === 'world' || node.kind === 'item' && !node.editable) { return; }
    const p = ImGui.GetCursorScreenPos(), items = this.model!.elements([node]);
    const visible = items.length === 0 || items.some(item => item.isVisible);

    ImGui.InvisibleButton('##Visibility', new ImGui.Vec2(L.gutter, rowHeight));
    if (ImGui.IsItemClicked(ImGui.MouseButton.Left) && items.length) {
      this.visibilityDrag = { visible: !visible, visited: new Set() };
      const targets = selected ? this.model!.elements(this.selectedRows()) : items;

      this.actions?.setVisible(targets, !visible); this.visibilityDrag.visited.add(node.id);
      this.document?.setScopeActive(this, true);
    }
    const mouse = ImGui.GetMousePos();

    if (this.visibilityDrag && ImGui.IsMouseDown(ImGui.MouseButton.Left) && hovered && mouse.x >= p.x && mouse.x < p.x + L.gutter && !this.visibilityDrag.visited.has(node.id)) {
      this.actions?.setVisible(items, this.visibilityDrag.visible); this.visibilityDrag.visited.add(node.id);
    }
    if (!visible || selected || hovered) {
      drawEditorIcon(visible ? 'view' : 'hidden', p.x + 4, p.y + (rowHeight - L.icon) / 2, L.icon,
        ImGui.IsItemHovered() ? I.foregroundHover : selected ? I.foregroundHover : I.foreground);
    }
    if (ImGui.IsItemHovered()) { outlinerHint(visible ? 'Hide in editor. Drag to hide more items.' : 'Show in editor. Drag to show more items.'); }
  }

  private finishVisibility (): void {
    if (!this.visibilityDrag) { return; }
    this.visibilityDrag = undefined; this.document?.setScopeActive(this, false);
  }

  private dragSource (node: OutlinerNode): void {
    if (!node.editable || this.rename || this.pressed?.arrow || !ImGui.BeginDragDropSource()) { return; }
    if (this.pressed) { this.pressed.dragged = true; }
    const rows = this.selectedKeys().has(node.id) ? this.selectedRows().filter(row => row.editable) : [node];

    ImGui.SetDragDropPayload(PAYLOAD, { document: this.document!, ids: rows.map(row => row.id) } satisfies ItemPayload);
    const p = ImGui.GetCursorScreenPos();

    drawEditorIcon(node.kind === 'folder' ? 'folderOpen' : node.icon, p.x, p.y + 2, 20, node.kind === 'folder' ? FOLDER_TINT : I.foreground);
    ImGui.Dummy(new ImGui.Vec2(20, 24)); ImGui.SameLine(0, 8);
    ImGui.Text(rows.length === 1 ? node.label : rows.length + ' items');
    if (this.dropHint && this.dropHint.frame >= ImGui.GetFrameCount() - 1) { ImGui.TextDisabled(this.dropHint.text); }
    ImGui.EndDragDropSource();
  }

  private dropTarget (node: OutlinerNode): DropZone | undefined {
    if (!ImGui.BeginDragDropTarget()) { return; }
    const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax(), mouse = ImGui.GetMousePos();
    const edge = Math.max(3, Math.min(10, (max.y - min.y) * 0.25));
    const zone: DropZone = node.kind === 'item' && node.editable ? mouse.y < min.y + edge ? 'before' : mouse.y > max.y - edge ? 'after' : 'inside' : 'inside';
    const flags = ImGui.DragDropFlags.AcceptBeforeDelivery | ImGui.DragDropFlags.AcceptNoDrawDefaultRect;
    const payload = ImGui.AcceptDragDropPayload<ItemPayload>(PAYLOAD, flags);
    const data = payload?.Data;
    const rows = data && data.document === this.document ? data.ids.flatMap(id => this.model!.nodes.get(id) ? [this.model!.nodes.get(id)!] : []) : [];
    const valid = !!rows.length && !!(zone === 'inside' ? this.actions?.canMove(rows, node) : this.actions?.canReorder(rows, node));

    if (data) {
      if (valid) {
        if (zone === 'inside') {
          const frame = ImGui.GetFrameCount();

          if (this.hoverDrop?.id !== node.id || this.hoverDrop.frame < frame - 1) { this.hoverDrop = { id: node.id, since: ImGui.GetTime(), frame }; }
          this.hoverDrop.frame = frame;
          if (ImGui.GetTime() - this.hoverDrop.since > 0.6 && !this.expanded.has(node.id)) { this.expanded.add(node.id); this.saveExpanded(); }
        } else { this.hoverDrop = undefined; }
        this.dropHint = { frame: ImGui.GetFrameCount(), text: zone === 'inside' ? 'Move into ' + node.label :
          'Place ' + zone + ' ' + node.label + (this.options.sort !== 'hierarchy' ? '\nSwitches to Hierarchy Order.' : '') };
        const delivered = ImGui.AcceptDragDropPayload<ItemPayload>(PAYLOAD, ImGui.DragDropFlags.AcceptNoDrawDefaultRect);

        if (delivered) {
          if (zone === 'inside') { this.actions?.move(this.model!, rows, node); this.expanded.add(node.id); this.saveExpanded(); } else if (this.actions?.reorder(this.model!, rows, node, zone)) {
            this.options.sort = 'hierarchy'; this.options.descending = false; this.saveOptions(); this.pendingReveal = rows[0].id;
          }
          this.hoverDrop = undefined;
        }
      } else { ImGui.SetMouseCursor(ImGui.MouseCursor.NotAllowed); }
    }
    ImGui.EndDragDropTarget();

    return valid ? zone : undefined;
  }

  private drawEmptyArea (x: number, width: number, rowHeight: number, empty: boolean): void {
    ImGui.TableNextRow(); ImGui.TableSetColumnIndex(1);
    const p = ImGui.GetCursorScreenPos(), available = Math.max(rowHeight, ImGui.GetContentRegionAvail().y);

    ImGui.InvisibleButton('##EmptyOutliner', new ImGui.Vec2(Math.max(1, ImGui.GetContentRegionAvail().x), available));
    this.dropTarget(this.model!.world);
    const mouse = ImGui.GetMousePos(), inArea = mouse.x >= x && mouse.x < x + width && mouse.y >= p.y && ImGui.IsWindowHovered();

    if (inArea && !this.hoveredRow) {
      if (ImGui.IsMouseClicked(ImGui.MouseButton.Left) && !ImGui.GetIO().KeyCtrl && !ImGui.GetIO().KeySuper) { this.select([]); }
      if (ImGui.IsMouseClicked(ImGui.MouseButton.Right)) { this.contextRows = []; this.openContext = true; }
    }
    if (empty) { outlinerText('No matching items', p.x + 8, p.y + 12, width - 24, I.muted); }
  }

  private toggle (node: OutlinerNode, recursive: boolean): void {
    const open = !this.expanded.has(node.id);
    const nodes = recursive ? [node, ...this.model!.descendants(node)] : [node];

    nodes.forEach(node => { if (open && node.children.length) { this.expanded.add(node.id); } else { this.expanded.delete(node.id); } });
    this.saveExpanded();
  }

  private startRename (node: OutlinerNode): void {
    if (!node.editable) { return; }
    this.rename = node.id; this.renameText[0] = node.label; this.focusRename = true; this.pendingReveal = node.id;
  }

  private finishRename (cancel: boolean): void {
    const node = this.rename && this.model?.nodes.get(this.rename);
    const name = this.renameText[0].trim();

    this.rename = undefined; this.focusRename = false;
    if (!cancel && node && name) { this.actions?.rename(node, name); }
  }

  private newFolder (): void {
    if (!this.model || !this.actions) { return; }
    const id = this.actions.createFolder(this.model, this.selectedRows(), id => {
      this.applyingSelection = true;
      try { this.selectedFolders = new Set([id]); this.anchor = id; this.focused = id; Selection.clear(); } finally { this.applyingSelection = false; }
    });

    if (id) {
      this.expanded.add(id); this.saveExpanded();
      this.buildModel();
      const node = this.model.nodes.get(id);

      if (node) { this.startRename(node); }
    }
  }

  private focusScene (): void {
    const scene = EditorWindow.getWindow(Scene);

    scene?.open();
    if (this.selectedRows().some(node => node.kind === 'world')) { scene?.frameAll(); } else { scene?.frameSelection(); }
  }

  private revealSelection (): void {
    const item = Selection.getSelectedObjects().filter((object): object is VFXItem => object instanceof VFXItem).at(-1);

    if (item && this.document && item.composition === this.document.composition) { this.pendingReveal = itemKey(this.document, item); }
  }

  private keyboard (): void {
    if (!this.model || !this.listFocused || this.searchFocused || this.rename || ImGui.GetIO().WantTextInput || ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup)) { return; }
    const io = ImGui.GetIO(), modifier = io.KeyCtrl || io.KeySuper;
    const rows = this.model.rows;
    const current = Math.max(0, rows.findIndex(node => node.id === this.focused));
    const selected = this.selectedRows();

    if (modifier && ImGui.IsKeyPressed(ImGui.Key.A, false)) { this.select(rows.filter(row => row.kind !== 'world').map(row => row.id)); }
    if (modifier && ImGui.IsKeyPressed(ImGui.Key.F, false)) { this.focusSearch = true; }
    if (modifier && ImGui.IsKeyPressed(ImGui.Key.D, false)) { this.actions?.duplicate(this.model, selected); }
    if (ImGui.IsKeyPressed(ImGui.Key.F2, false) && selected.length === 1) { this.startRename(selected[0]); }
    if (!modifier && ImGui.IsKeyPressed(ImGui.Key.F, false)) { this.focusScene(); }
    if (ImGui.IsKeyPressed(ImGui.Key.Delete, false)) { this.actions?.remove(this.model, selected.filter(node => node.editable)); }
    if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { this.select([]); }
    let next = -1;

    if (ImGui.IsKeyPressed(ImGui.Key.DownArrow)) { next = Math.min(rows.length - 1, current + 1); }
    if (ImGui.IsKeyPressed(ImGui.Key.UpArrow)) { next = Math.max(0, current - 1); }
    if (ImGui.IsKeyPressed(ImGui.Key.Home)) { next = 0; }
    if (ImGui.IsKeyPressed(ImGui.Key.End)) { next = rows.length - 1; }
    if (rows[next]) { this.clickRow(rows[next]); this.focused = rows[next].id; this.pendingReveal = rows[next].id; }
    const node = rows[current];

    if (!node) { return; }
    if (ImGui.IsKeyPressed(ImGui.Key.LeftArrow)) {
      if (this.expanded.has(node.id) && node.children.length) { this.toggle(node, io.KeyShift); } else if (node.parent) { this.select([node.parent.id]); this.pendingReveal = node.parent.id; }
    }
    if (ImGui.IsKeyPressed(ImGui.Key.RightArrow) && node.children.length) {
      if (!this.expanded.has(node.id)) { this.toggle(node, io.KeyShift); } else { this.select([node.children[0].id]); this.pendingReveal = node.children[0].id; }
    }
  }

  private drawContextMenu (): void {
    if (this.openContext) { ImGui.OpenPopup('##OutlinerContext'); this.openContext = false; }
    editorPopup('##OutlinerContext', () => this.contextMenuContent());
  }

  private contextMenuContent (): void {
    const nodes = this.contextRows.flatMap(id => this.model?.nodes.get(id) ? [this.model.nodes.get(id)!] : []);
    const editable = nodes.filter(node => node.editable);
    const items = this.model!.elements(editable.filter(node => node.kind === 'item'));

    editorMenuSection('Create');
    if (beginEditorMenu('Add Item', !!this.document)) {
      drawCreateItemMenu(nodes.length === 1 && nodes[0].editable ? nodes[0] : undefined);
      endEditorMenu();
    }
    editorMenuSection('Selection', true);
    if (editorMenuItem('Focus Selection', 'F', false, !!items.length)) { this.focusScene(); }
    if (editorMenuItem('Select Descendants', '', false, nodes.some(node => node.children.length))) { this.select([...new Set(nodes.flatMap(node => this.model!.descendants(node).map(child => child.id)))]); }
    editorMenuSection('Edit', true);
    if (editorMenuItem('Rename', 'F2', false, nodes.length === 1 && !!editable.length)) { this.startRename(editable[0]); }
    if (editorMenuItem('Duplicate', 'Ctrl+D', false, !!items.length)) { this.actions?.duplicate(this.model!, editable); }
    if (editorMenuItem('Delete', 'Delete', false, !!editable.length)) { this.actions?.remove(this.model!, editable); }
    editorMenuSection('Organization', true);
    if (editorMenuItem('Create Folder', '', false, !!this.document)) { this.newFolder(); }
    if (beginEditorMenu('Move To', !!editable.length)) {
      for (const target of [...this.model!.nodes.values()].filter(node => node.kind === 'world' || node.kind === 'folder')) {
        if (editorMenuItem(target.kind === 'world' ? 'Scene Root' : this.folderPath(target), '', false, this.actions!.canMove(editable, target))) { this.actions?.move(this.model!, editable, target); }
      }
      endEditorMenu();
    }
    if (editorMenuItem('Detach', '', false, items.some(item => item.parent !== this.document!.composition.sceneRoot))) { this.actions?.move(this.model!, editable, this.model!.world); }
    editorMenuSection('Visibility', true);
    const targets = this.model!.elements(nodes);

    if (editorMenuItem('Show', '', false, !!targets.length)) { this.actions?.setVisible(targets, true); }
    if (editorMenuItem('Hide', '', false, !!targets.length)) { this.actions?.setVisible(targets, false); }
    if (editorMenuItem('Show All', '', false, !!this.model!.items.length)) { this.actions?.setVisible(this.model!.items, true); }
    if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { ImGui.CloseCurrentPopup(); }
  }

  private folderPath (node: OutlinerNode): string { return node.parent?.folder ? this.folderPath(node.parent) + '/' + node.label : node.label; }

  private settingsMenu (): void {
    editorMenuSection('Hierarchy');
    if (editorMenuItem('Expand All')) { this.model?.nodes.forEach(node => { if (node.children.length) { this.expanded.add(node.id); } }); this.saveExpanded(); }
    if (editorMenuItem('Collapse All')) { this.expanded.clear(); this.saveExpanded(); }
    if (editorMenuItem('Always Frame Selection', '', this.options.autoFrame)) { this.options.autoFrame = !this.options.autoFrame; this.saveOptions(); }
    editorMenuSection('Sort', true);
    for (const [sort, label] of [['hierarchy', 'Hierarchy Order'], ['label', 'Item Label'], ['type', 'Type'], ['visibility', 'Visibility']] as const) {
      if (editorMenuItem(label, '', this.options.sort === sort)) { this.options.sort = sort; this.options.descending = false; this.saveOptions(); }
    }
    if (editorMenuItem('Descending', '', this.options.descending && this.options.sort !== 'hierarchy', this.options.sort !== 'hierarchy')) { this.options.descending = !this.options.descending; this.saveOptions(); }
    editorMenuSection('Show', true);
    for (const [key, label] of [['onlySelected', 'Only Selected'], ['hideInvisible', 'Hide Invisible Items'], ['showInternal', 'Show Runtime Objects']] as const) {
      if (editorMenuItem(label, '', this.options[key])) { this.options[key] = !this.options[key]; this.saveOptions(); }
    }
    if (beginEditorMenu('Filter by Type')) {
      if (editorMenuItem('All Types', '', !this.options.typeFilter)) { this.options.typeFilter = ''; }
      const types = [...new Set([...this.model?.nodes.values() ?? []].filter(node => node.editable && node.kind === 'item').map(node => node.type))].sort();

      for (const type of types) { if (editorMenuItem(type, '', this.options.typeFilter === type)) { this.options.typeFilter = type; } }
      endEditorMenu();
    }
    editorMenuSection('Columns', true);
    for (const [key, label] of [['showVisibility', 'Visibility'], ['showType', 'Type']] as const) {
      if (editorMenuItem(label, '', this.options[key])) { this.options[key] = !this.options[key]; this.columnUpdate = true; this.saveOptions(); }
    }
  }

  private drawStatus (width: number, height: number): void {
    const p = ImGui.GetCursorScreenPos(), model = this.model!, count = model.items.length;
    const selected = this.selectedRows().filter(node => node.kind !== 'world').length;
    const text = model.filtering ? `${model.matchedCount} of ${count} items` : `${count} ${count === 1 ? 'item' : 'items'}`;

    ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + height), ImGui.GetColorU32(I.header));
    outlinerText(text + (selected ? ` (${selected} selected)` : ''), p.x + 14, p.y + 9, width - 28, model.filtering && !model.matchedCount ? I.muted : I.foreground);
    ImGui.Dummy(new ImGui.Vec2(width, height));
  }

  private expansionKey (): string {
    return 'effects-editor.outliner.expanded.' + projectWorkspace.current?.id + ':' + this.document?.composition.id;
  }

  private saveExpanded (): void {
    if (!this.document) { return; }
    try { window.localStorage.setItem(this.expansionKey(), JSON.stringify([...this.expanded])); } catch (error) { console.warn('Unable to save outliner expansion state.', error); }
  }

  private saveOptions (): void {
    try { window.localStorage.setItem(PREFERENCES, JSON.stringify(this.options)); } catch (error) { console.warn('Unable to save outliner preferences.', error); }
  }
}
