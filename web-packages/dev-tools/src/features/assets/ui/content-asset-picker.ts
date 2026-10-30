import { editorTooltip } from '../../../ui/widgets/editor-tooltip';
import type { EffectsObject } from '@galacean/effects';
import { ImGui } from '../../../platform/imgui/index';
import { PROPERTY_COLORS } from '../../../ui/property-editor/property-grid';
import { drawAssetIcon } from '../../../ui/icons/asset-icons';
import { drawEditorChevron } from '../../../ui/widgets/editor-arrow';
import { beginEditorPopup, endEditorPopup } from '../../../ui/widgets/editor-menu';
import { searchBar } from '../../../ui/widgets/search-bar';
import { toolbarButton } from '../../../ui/widgets/toolbar-button';
import { assetLibrary } from '../asset-library';
import { revealContentAsset, selectedContentAssets } from '../editors/asset-editor-registry';
import type { AssetKind } from '../model/asset-types';
import type { ContentAssetDrag } from './asset-drag';
import { CONTENT_ASSET_PAYLOAD } from './asset-drag';
import { ASSET_PRESENTATION } from './asset-presentation';

const searches = new Map<number, [string]>();

/** Select a project resource without instantiating or changing scene objects. */
export function contentAssetPicker (kind: Exclude<AssetKind, 'folder' | 'scene'>, current: string | undefined, width: number, choose: (id?: string) => void, emptyLabel = 'None', allowEmpty = true): boolean {
  const presentation = ASSET_PRESENTATION[kind], origin = ImGui.GetCursorScreenPos();
  const entry = current ? assetLibrary.entry(current) : undefined;
  const selected = selectedContentAssets().find(id => assetLibrary.entry(id)?.kind === kind && !assetLibrary.entry(id)?.deletedAt);
  let changed = false;
  const assign = (id?: string) => { if (id !== current) { choose(id); changed = true; } };
  const compatible = (id?: string) => id && assetLibrary.entry(id)?.kind === kind && !assetLibrary.entry(id)?.deletedAt;
  const stacked = width < 180;
  const fieldWidth = Math.max(40, stacked ? width : width - 52);

  ImGui.BeginGroup();
  ImGui.PushStyleColor(ImGui.Col.Button, PROPERTY_COLORS.input); ImGui.PushStyleColor(ImGui.Col.ButtonHovered, PROPERTY_COLORS.input);
  if (ImGui.Button('##Asset', new ImGui.Vec2(fieldWidth, ImGui.GetFrameHeight()))) { ImGui.OpenPopup('##ContentPicker'); }
  ImGui.PopStyleColor(2);
  const draw = ImGui.GetWindowDrawList(), height = ImGui.GetFrameHeight();

  drawAssetIcon(presentation.icon, origin.x + 5, origin.y + (height - 16) / 2, 16);
  draw.PushClipRect(new ImGui.Vec2(origin.x + 26, origin.y), new ImGui.Vec2(origin.x + fieldWidth - 21, origin.y + height), true);
  draw.AddText(new ImGui.Vec2(origin.x + 26, origin.y + (height - ImGui.GetFontSize()) / 2), ImGui.GetColorU32(ImGui.Col.Text), entry?.name ?? (current ? 'Missing ' + presentation.label : emptyLabel));
  draw.PopClipRect(); drawEditorChevron(origin.x + fieldWidth - 18, origin.y + (height - 14) / 2, 14, PROPERTY_COLORS.text);
  if (entry) { editorTooltip(assetLibrary.pathText(entry.parentId) + '/' + entry.name); }
  if (stacked) { ImGui.SetCursorPosX(ImGui.GetCursorPosX() + Math.max(0, width - 48)); } else { ImGui.SameLine(0, 2); }
  if (toolbarButton('##UseSelected', { icon: 'useSelected', width: 24, height, enabled: !!selected, hint: 'Use selected asset' })) { assign(selected); }
  ImGui.SameLine(0, 0);
  if (toolbarButton('##Browse', { icon: 'browseContent', width: 24, height, enabled: !!entry && !entry.deletedAt, hint: 'Browse to asset' }) && entry) { revealContentAsset(entry.id); }
  ImGui.EndGroup();
  if (ImGui.BeginDragDropTarget()) {
    const payload = ImGui.AcceptDragDropPayload<ContentAssetDrag>(CONTENT_ASSET_PAYLOAD);
    const id = payload?.Data?.ids.length === 1 ? payload.Data.ids[0] : undefined;
    const legacy = ImGui.AcceptDragDropPayload<EffectsObject>(presentation.label);
    const legacyId = legacy?.Data?.getInstanceId();

    if (compatible(id)) { assign(id); } else if (compatible(legacyId)) { assign(legacyId); }
    ImGui.EndDragDropTarget();
  }
  if (ImGui.IsPopupOpen('##ContentPicker')) { ImGui.SetNextWindowSize(new ImGui.Vec2(340, 0), ImGui.Cond.Appearing); }
  if (beginEditorPopup('##ContentPicker')) {
    const id = ImGui.GetID('##Search');

    if (!searches.has(id) || ImGui.IsWindowAppearing()) { searches.set(id, ['']); }
    const search = searches.get(id)!;

    searchBar('##Search', search, { hint: 'Search ' + presentation.label + ' assets' });
    ImGui.BeginChild('##Results', new ImGui.Vec2(0, 200));
    if (allowEmpty && ImGui.Selectable(emptyLabel + '##None', !current)) { assign(); ImGui.CloseCurrentPopup(); }
    for (const asset of assetLibrary.entries.filter(asset => asset.kind === kind && !asset.deletedAt && asset.name.toLowerCase().includes(search[0].trim().toLowerCase()))) {
      if (ImGui.Selectable(asset.name + '##' + asset.id, current === asset.id)) { assign(asset.id); ImGui.CloseCurrentPopup(); }
    }
    ImGui.EndChild();
    if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { ImGui.CloseCurrentPopup(); }
    endEditorPopup();
  }

  return changed;
}
