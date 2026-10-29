import { ImGui } from '../../platform/imgui/index';
import { drawEditorIcon } from '../icons/editor-icons';
import { InteractionColors as I } from '../theme/editor-interaction';
import { drawEditorArrow } from '../widgets/editor-arrow';

const color = (hex: string) => new ImGui.Vec4(
  parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, 1,
);

export const PROPERTY_COLORS = {
  background: I.panel, header: I.header, nestedHeader: color('292929'), hover: I.hover,
  input: I.input, inputBorder: I.outline, line: color('191919'), text: I.foreground,
  headerText: color('DDDDDD'),
  muted: I.muted, selected: I.selectedInactive, accent: I.primary, reset: color('C8C8C8'),
  axes: [color('E34B42'), color('83BA36'), color('4C9FE6'), color('B7B7B7')],
};

export class PropertyGridState {
  columnRatio = 0.38;
  defaultExpanded?: boolean;
  readonly expanded = new Map<string | number, boolean>();
  readonly searchExpanded = new Map<string | number, boolean>();
  searchDefaultExpanded = true;
  private query = '';

  prepare (query: string): void {
    if (this.query !== query) {
      this.query = query;
      this.searchExpanded.clear(); this.searchDefaultExpanded = true;
    }
  }

  expandAll (expanded: boolean): void {
    this.defaultExpanded = expanded;
    this.expanded.forEach((_, key) => this.expanded.set(key, expanded));
    this.searchDefaultExpanded = expanded;
    this.searchExpanded.forEach((_, key) => this.searchExpanded.set(key, expanded));
  }
}

export interface PropertyRowAction {
  draw: (x: number, y: number, size: number) => void,
  click: () => void,
  hint: string,
}

export type PropertyHeaderIcon = (x: number, y: number, size: number) => void;

export interface PropertyHeaderOptions {
  icon?: PropertyHeaderIcon,
}

/** Shared name/value columns and filtering for property editors. */
export class PropertyGrid {
  private static context?: {
    state: PropertyGridState,
    terms: string[],
    path: string[],
    matchAll: boolean,
    depth: number,
    groups: boolean[],
  };

  static get active (): boolean { return !!this.context; }
  static get filtering (): boolean { return !!this.context?.terms.length; }

  static begin (state: PropertyGridState, query: string): void {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    state.prepare(normalizedQuery);
    this.context = { state, terms: normalizedQuery.split(/\s+/).filter(Boolean), path: [], matchAll: false, depth: 0, groups: [] };
  }

  static end (): void { this.context = undefined; }

  static matches (...labels: string[]): boolean {
    const context = this.context;

    if (!context || context.matchAll) { return true; }
    const text = [...context.path, ...labels].join(' ').toLocaleLowerCase();

    return context.terms.every(term => text.includes(term));
  }

  static category (id: string, label: string, terms: string[], draw: () => void, options?: PropertyHeaderOptions): boolean {
    const context = this.context;

    if (!context || !this.matches(label, ...terms)) { return false; }
    ImGui.PushID(id);
    const open = this.header(id, label, false, true, options);

    if (open) {
      const previous = context.matchAll;

      context.matchAll ||= this.matches(label);
      context.path.push(label);
      draw();
      context.path.pop(); context.matchAll = previous;
    }
    ImGui.PopID();

    return true;
  }

  static beginGroup (label: string, defaultOpen: boolean): boolean {
    const context = this.context!;

    ImGui.PushID(label);
    const open = this.header(context.path.join('/') + '/' + label, label.split('##')[0], true, defaultOpen);

    context.groups.push(open);
    if (open) { context.depth++; context.path.push(label.split('##')[0]); }

    return open;
  }

  static endGroup (): void {
    const context = this.context!;

    if (context.groups.pop()) { context.depth--; context.path.pop(); }
    ImGui.PopID();
  }

  private static header (id: string | number, label: string, nested: boolean, defaultOpen = true, options: PropertyHeaderOptions = {}): boolean {
    const context = this.context!;
    const origin = ImGui.GetCursorScreenPos();
    const width = ImGui.GetContentRegionAvail().x, height = nested ? 26 : 30;
    const { icon } = options;
    const indent = nested ? 12 + context.depth * 10 : 4;
    const iconOffset = indent + 20;
    const labelOffset = iconOffset + (icon ? 22 : 0);
    const expansion = this.filtering ? context.state.searchExpanded : context.state.expanded;
    const defaultExpanded = this.filtering ? context.state.searchDefaultExpanded : context.state.defaultExpanded ?? defaultOpen;
    let open = expansion.get(id) ?? defaultExpanded;

    if (ImGui.InvisibleButton('##Header', new ImGui.Vec2(width, height))) { open = !open; expansion.set(id, open); }
    const dl = ImGui.GetWindowDrawList(), hovered = ImGui.IsItemHovered();

    dl.AddRectFilled(origin, new ImGui.Vec2(origin.x + width, origin.y + height), ImGui.GetColorU32(hovered ? PROPERTY_COLORS.hover : nested ? PROPERTY_COLORS.nestedHeader : PROPERTY_COLORS.header));
    dl.AddLine(new ImGui.Vec2(origin.x, origin.y + height - 1), new ImGui.Vec2(origin.x + width, origin.y + height - 1), ImGui.GetColorU32(PROPERTY_COLORS.line));
    drawEditorArrow(origin.x + indent, origin.y + (height - 16) / 2, 16, open ? 'down' : 'right', PROPERTY_COLORS.text);
    if (icon) { icon(origin.x + iconOffset, origin.y + (height - 16) / 2, 16); }
    dl.PushClipRect(origin, new ImGui.Vec2(origin.x + width - 8, origin.y + height), true);
    dl.AddText(new ImGui.Vec2(origin.x + labelOffset, origin.y + (height - ImGui.GetFontSize()) / 2), ImGui.GetColorU32(PROPERTY_COLORS.headerText), label);
    dl.PopClipRect();
    if (hovered && ImGui.CalcTextSize(label).x > width - labelOffset - 8) { ImGui.SetTooltip(label); }

    return open;
  }

  static row (label: string, draw: (width: number) => boolean | void, id = label, reset?: () => void, action?: PropertyRowAction): boolean {
    const context = this.context;

    if (!context || !this.matches(label, id, label === 'Location' ? 'Position' : label === 'ID' ? 'GUID' : '')) { return false; }
    ImGui.PushID(id);
    const origin = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;
    const labelWidth = Math.max(70, Math.min(width * context.state.columnRatio, width - 228));
    const divider = origin.x + labelWidth;
    const valueX = divider + 10;
    const valueWidth = Math.max(40, width - labelWidth - 40);
    const dl = ImGui.GetWindowDrawList();

    dl.ChannelsSplit(2); dl.ChannelsSetCurrent(1);
    ImGui.BeginGroup();
    ImGui.SetCursorScreenPos(new ImGui.Vec2(valueX, origin.y + 4));
    ImGui.PushItemWidth(valueWidth);
    let changed = draw(valueWidth) === true;

    ImGui.PopItemWidth(); ImGui.EndGroup();
    const height = Math.max(30, ImGui.GetItemRectMax().y - origin.y + 4);
    const end = new ImGui.Vec2(origin.x + width, origin.y + height);
    const hovered = ImGui.IsWindowHovered() && ImGui.IsMouseHoveringRect(origin, end);

    dl.ChannelsSetCurrent(0);
    dl.AddRectFilled(origin, end, ImGui.GetColorU32(hovered ? PROPERTY_COLORS.nestedHeader : PROPERTY_COLORS.background));
    dl.AddLine(new ImGui.Vec2(divider, origin.y), new ImGui.Vec2(divider, end.y), ImGui.GetColorU32(PROPERTY_COLORS.line));
    dl.AddLine(new ImGui.Vec2(origin.x, end.y - 1), new ImGui.Vec2(end.x, end.y - 1), ImGui.GetColorU32(PROPERTY_COLORS.line));
    dl.ChannelsSetCurrent(1);
    const textY = origin.y + (Math.min(height, 30) - ImGui.GetFontSize()) / 2;
    const textX = origin.x + 24 + context.depth * 10;
    const textWidth = Math.max(0, divider - textX - (action ? 28 : 5));
    let caption = label;

    if (ImGui.CalcTextSize(caption).x > textWidth) {
      while (caption.length && ImGui.CalcTextSize(caption + '…').x > textWidth) { caption = caption.slice(0, -1); }
      caption += '…';
    }

    dl.PushClipRect(new ImGui.Vec2(origin.x, origin.y), new ImGui.Vec2(divider - (action ? 28 : 5), end.y), true);
    dl.AddText(new ImGui.Vec2(textX, textY), ImGui.GetColorU32(PROPERTY_COLORS.text), caption);
    dl.PopClipRect();
    if (hovered && ImGui.GetMousePos().x < divider && caption !== label) { ImGui.SetTooltip(label); }
    if (action) {
      ImGui.SetCursorScreenPos(new ImGui.Vec2(divider - 25, origin.y + 4));
      if (ImGui.InvisibleButton('##LabelAction', new ImGui.Vec2(22, 22))) { action.click(); }
      action.draw(divider - 22, origin.y + 7, 16);
      if (ImGui.IsItemHovered()) { ImGui.SetTooltip(action.hint); }
    }
    if (reset) {
      ImGui.SetCursorScreenPos(new ImGui.Vec2(end.x - 25, origin.y + 4));
      if (ImGui.InvisibleButton('##Reset', new ImGui.Vec2(22, 22))) { reset(); changed = true; }
      const resetHovered = ImGui.IsItemHovered();

      drawEditorIcon('reset', end.x - 20, origin.y + 9, 12, resetHovered ? PROPERTY_COLORS.text : PROPERTY_COLORS.muted);
      if (resetHovered) { ImGui.SetTooltip('Reset to default'); }
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(divider - 2, origin.y));
    ImGui.InvisibleButton('##ColumnDivider', new ImGui.Vec2(4, height));
    if (ImGui.IsItemActive()) { context.state.columnRatio = Math.max(0.2, Math.min(0.6, (ImGui.GetMousePos().x - origin.x) / width)); }
    if (ImGui.IsItemHovered() || ImGui.IsItemActive()) { ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW); }
    dl.ChannelsMerge();
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, end.y));
    ImGui.Dummy(new ImGui.Vec2(width, 0));
    ImGui.PopID();

    return changed;
  }
}
