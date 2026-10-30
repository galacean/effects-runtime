import { editorTooltip } from '../../../ui/widgets/editor-tooltip';
import { toolbarButton } from '../../../ui/widgets/toolbar-button';
import { EffectsObject, Material, Shader, Sprite, Texture, VFXItem } from '@galacean/effects';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { ImGui } from '../../../platform/imgui/index';
import { drawAssetIcon } from '../../../ui/icons/asset-icons';
import type { PropertyHeaderIcon } from '../../../ui/property-editor/property-grid';
import { PROPERTY_COLORS as C } from '../../../ui/property-editor/property-grid';
import { InteractionColors as I } from '../../../ui/theme/editor-interaction';
import { drawEditorChevron } from '../../../ui/widgets/editor-arrow';
import { beginEditorPopup, editorMenuItem, endEditorPopup } from '../../../ui/widgets/editor-menu';
import { searchBar } from '../../../ui/widgets/search-bar';
import { sceneWorkspace } from '../../scene/scene-workspace';
import { assetLibrary } from '../asset-library';
import { openContentAsset, openRuntimeAsset, openTextureAsset, revealContentAsset, selectedContentAssets } from '../editors/asset-editor-registry';
import { getSpriteThumbnail } from '../preview/sprite-thumbnail';
import { drawTexturePreview, getOrCreateTexturePreview } from '../preview/texture-preview';
import type { ContentAssetDrag } from './asset-drag';
import { CONTENT_ASSET_PAYLOAD } from './asset-drag';

const searches = new Map<number, [string]>();
const assetKinds = { Texture: 'texture', Material: 'material', Shader: 'shader', Sprite: 'sprite' } as const;

function openReference (reference: object): void {
  if (reference instanceof VFXItem) {
    EditorSelection.select(reference);

    return;
  }
  if (reference instanceof Texture && assetLibrary.entry(reference.getInstanceId())?.kind === 'texture' && openTextureAsset(reference.getInstanceId())) { return; }
  if (reference instanceof EffectsObject && assetLibrary.entry(reference.getInstanceId()) && openContentAsset(reference.getInstanceId())) { return; }
  openRuntimeAsset(reference);
}

function actionButton (id: string, action: 'use' | 'browse', enabled: boolean, hint: string): boolean {
  return toolbarButton(id, { icon: action === 'use' ? 'useSelected' : 'browseContent', width: 24, height: 22, enabled, hint });
}

export function drawAssetReferenceField (object: object, property: string, width: number, expectedType?: string, readOnly = false, icon?: PropertyHeaderIcon, onAssetDrop?: (texture: Texture) => void): boolean {
  const target = object as Record<string, any>, reference = target[property];
  const payloadType = expectedType ?? reference?.constructor.name ?? 'EffectsObject';
  const type = reference instanceof Texture || payloadType === Texture.name || payloadType === 'Texture' ? 'Texture' :
    reference instanceof Sprite || payloadType === Sprite.name || payloadType === 'Sprite' ? 'Sprite' :
      reference instanceof Material || payloadType === Material.name || payloadType === 'Material' ? 'Material' :
        reference instanceof Shader || payloadType === Shader.name || payloadType === 'Shader' ? 'Shader' : payloadType;
  const kind = assetKinds[type as keyof typeof assetKinds];
  const assetReference = !!kind;
  const engine = EditorRuntimeSession.player.engine;
  const entry = reference instanceof EffectsObject ? assetLibrary.entry(reference.getInstanceId()) : undefined;
  const caption = entry?.name || reference?.name || (reference ? type : 'None');
  const referenceHint = entry ? assetLibrary.pathText(entry.parentId) + '/' + entry.name : '';
  const selectedAsset = selectedContentAssets().find(id => assetLibrary.entry(id)?.kind === kind && !assetLibrary.entry(id)?.deletedAt);
  const canBrowse = !!entry && !entry.deletedAt;
  let changed = false;

  const assignAsset = (id: string) => {
    if (!kind || assetLibrary.entry(id)?.kind !== kind || assetLibrary.entry(id)?.deletedAt) { return; }
    const cached = assetLibrary.asset(engine, id);

    if (cached?.isRegistered && !(cached instanceof Texture && cached.isDestroyed)) {
      target[property] = cached; changed = true;

      return;
    }
    const selection = [...EditorSelection.getSelectedObjects()], document = sceneWorkspace.current, project = assetLibrary.projectId;

    void assetLibrary.loadAsset(engine, id).then(loaded => {
      const current = EditorSelection.getSelectedObjects();

      if (document !== sceneWorkspace.current || project !== assetLibrary.projectId || selection.length !== current.length || selection.some((item, index) => item !== current[index])) { return; }
      if (onAssetDrop && loaded instanceof Texture) { onAssetDrop(loaded); } else { sceneWorkspace.observe('Assign ' + kind, () => target[property] = loaded, [...selection, object]); }
    }).catch(error => { if (project === assetLibrary.projectId) { assetLibrary.report(error); } });
  };

  ImGui.BeginGroup();
  const origin = ImGui.GetCursorScreenPos();
  const thumbnail = reference instanceof Texture || reference instanceof Sprite || reference instanceof Material;
  const thumbnailWidth = thumbnail ? 60 : 0;

  if (thumbnail) {
    const size = 54, draw = ImGui.GetWindowDrawList();
    const visible = ImGui.IsRectVisible(origin, new ImGui.Vec2(origin.x + size, origin.y + size));
    const spritePreview = visible && reference instanceof Sprite ? getSpriteThumbnail(reference) : undefined;
    const preview = visible && reference instanceof Texture ? getOrCreateTexturePreview(reference, () => target[property]) : spritePreview;

    ImGui.InvisibleButton('##Thumbnail', new ImGui.Vec2(size, size));
    const hovered = ImGui.IsItemHovered();

    if (hovered && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left)) { openReference(reference); }
    draw.AddRectFilled(origin, new ImGui.Vec2(origin.x + size, origin.y + size), ImGui.GetColorU32(C.input), 3);
    draw.AddRect(origin, new ImGui.Vec2(origin.x + size, origin.y + size), ImGui.GetColorU32(hovered ? I.hover : I.outline), 3);
    if (preview) {
      const texture = reference instanceof Texture ? reference : (reference as Sprite).texture;
      const imageWidth = Math.max(1, spritePreview?.width ?? texture.width);
      const imageHeight = Math.max(1, spritePreview?.height ?? texture.height);
      const scale = Math.min((size - 6) / imageWidth, (size - 6) / imageHeight), w = imageWidth * scale, h = imageHeight * scale;
      const min = new ImGui.Vec2(origin.x + (size - w) / 2, origin.y + (size - h) / 2);

      drawTexturePreview(preview, min, new ImGui.Vec2(min.x + w, min.y + h));
    } else if (visible) { drawAssetIcon(kind ?? 'material', origin.x + 3, origin.y + 3, size - 6); }
    if (referenceHint) { editorTooltip(referenceHint); }
    ImGui.SameLine(0, 6);
  }
  const p = ImGui.GetCursorScreenPos(), captionWidth = Math.max(30, width - thumbnailWidth);

  ImGui.PushStyleColor(ImGui.Col.Button, I.input); ImGui.PushStyleColor(ImGui.Col.ButtonHovered, I.input);
  const clicked = ImGui.Button('##Reference', new ImGui.Vec2(captionWidth, ImGui.GetFrameHeight()));
  const hovered = ImGui.IsItemHovered(), draw = ImGui.GetWindowDrawList();

  draw.AddRect(p, new ImGui.Vec2(p.x + captionWidth, p.y + ImGui.GetFrameHeight()), ImGui.GetColorU32(hovered ? I.hover : I.outline), 3);
  if (icon) { icon(p.x + 6, p.y + (ImGui.GetFrameHeight() - 16) / 2, 16); }
  const left = p.x + (icon ? 28 : 7);

  draw.PushClipRect(new ImGui.Vec2(left, p.y), new ImGui.Vec2(p.x + captionWidth - 20, p.y + ImGui.GetFrameHeight()), true);
  draw.AddText(new ImGui.Vec2(left, p.y + (ImGui.GetFrameHeight() - ImGui.GetFontSize()) / 2), ImGui.GetColorU32(I.foreground), caption);
  draw.PopClipRect(); drawEditorChevron(p.x + captionWidth - 18, p.y + (ImGui.GetFrameHeight() - 14) / 2, 14, hovered ? I.foregroundHover : I.foreground);
  ImGui.PopStyleColor(2);
  if (clicked) { ImGui.OpenPopup('##AssetPicker'); }
  if (referenceHint) { editorTooltip(referenceHint); }
  if (assetReference) {
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + ImGui.GetFrameHeight() + 3));
    if (actionButton('##UseSelected', 'use', !readOnly && !!selectedAsset, 'Use selected asset from Content Browser') && selectedAsset) { assignAsset(selectedAsset); }
    ImGui.SameLine(0, 2);
    if (actionButton('##BrowseAsset', 'browse', canBrowse, canBrowse ? 'Browse to asset in Content Browser' : 'This reference is stored in the scene') && entry) { revealContentAsset(entry.id); }
  }

  if (ImGui.IsPopupOpen('##AssetPicker')) { ImGui.SetNextWindowSize(new ImGui.Vec2(Math.min(380, ImGui.GetIO().DisplaySize.x - 24), 0), ImGui.Cond.Appearing); }
  if (beginEditorPopup('##AssetPicker')) {
    if (editorMenuItem('Edit', '', false, !!reference)) { openReference(reference); }
    if (editorMenuItem('Copy Reference', '', false, !!reference)) { ImGui.SetClipboardText(entry ? assetLibrary.pathText(entry.parentId) + '/' + entry.name : reference instanceof EffectsObject ? reference.getInstanceId() : caption); }
    if (canBrowse && editorMenuItem('Browse to Asset')) { revealContentAsset(entry.id); }
    if (!readOnly) {
      ImGui.Separator();
      const id = ImGui.GetID('##AssetSearch');

      if (!searches.has(id) || ImGui.IsWindowAppearing()) { searches.set(id, ['']); }
      const search = searches.get(id)!;

      searchBar('##AssetSearch', search, { hint: 'Search ' + type + ' assets' });
      ImGui.BeginChild('##ReferenceAssets', new ImGui.Vec2(0, 220));
      const query = search[0].trim().toLowerCase();
      let count = 0;

      if (kind) {
        for (const asset of assetLibrary.entries.filter(asset => asset.kind === kind && !asset.deletedAt && asset.name.toLowerCase().includes(query))) {
          if (ImGui.Selectable(asset.name + '##' + asset.id, entry?.id === asset.id)) { assignAsset(asset.id); ImGui.CloseCurrentPopup(); }
          count++;
        }
      }
      const constructors: Record<string, typeof EffectsObject> = { Texture, Sprite, Material, Shader };
      const constructor = constructors[type];

      if (constructor) {
        for (const asset of Object.values(engine.effectsObjectServer.objectInstance)) {
          const assetName = (asset as { name?: string })?.name || asset?.constructor.name;

          if (!(asset instanceof constructor) || assetLibrary.entry(asset.getInstanceId()) || asset instanceof Texture && (asset.isDestroyed || EditorRuntimeSession.device.isSceneTexture(asset)) || !assetName.toLowerCase().includes(query)) { continue; }
          if (ImGui.Selectable(assetName + '##' + asset.getInstanceId(), reference === asset)) { target[property] = asset; changed = true; ImGui.CloseCurrentPopup(); }
          count++;
        }
      }
      if (!count) { ImGui.TextDisabled('No compatible assets found.'); }
      ImGui.EndChild();
    }
    if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { ImGui.CloseCurrentPopup(); }
    endEditorPopup();
  }
  ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + Math.max(thumbnail ? 54 : 0, ImGui.GetFrameHeight() + (assetReference ? 25 : 0))));
  ImGui.Dummy(new ImGui.Vec2(width, 0)); ImGui.EndGroup();
  if (!readOnly && ImGui.BeginDragDropTarget()) {
    const payload = ImGui.AcceptDragDropPayload(type);

    if (payload?.Data) { target[property] = payload.Data; changed = true; }
    if (payloadType !== type) {
      const legacy = ImGui.AcceptDragDropPayload(payloadType);

      if (legacy?.Data) { target[property] = legacy.Data; changed = true; }
    }
    if (kind) {
      const asset = ImGui.AcceptDragDropPayload<ContentAssetDrag>(CONTENT_ASSET_PAYLOAD);
      const id = asset?.Data?.ids.length === 1 ? asset.Data.ids[0] : undefined;

      if (id && assetLibrary.entry(id)?.kind === kind) { assignAsset(id); }
    }
    ImGui.EndDragDropTarget();
  }

  return changed;
}
