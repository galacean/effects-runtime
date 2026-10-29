import { drawEditorIcon } from '../../ui/icons/editor-icons';
import { inspectedObjectHeaderIcon, inspectedObjectIcon } from './inspected-object-icons';
import { Component, EffectsObject, MaskableGraphic, Material, RendererComponent, Sprite, SpriteRotation, Texture, VFXItem, spec } from '@galacean/effects';
import { UIControl } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem, resolveDetailsCustomization } from '../../framework/registry/editor-registry';
import { EditorSelection } from '../../framework/selection/editor-selection';
import { EditorWindow } from '../../framework/windows/editor-window';
import { ImGui } from '../../platform/imgui/index';
import { drawObjectIcon, objectIconButton } from '../../ui/icons/object-icons';
import { DefaultObjectDetails, propertyLabel } from '../../ui/property-editor/default-object-details';
import { PropertyFields as Fields } from '../../ui/property-editor/property-fields';
import { PROPERTY_COLORS as C, PropertyGrid, PropertyGridState } from '../../ui/property-editor/property-grid';
import { beginEditorPopup, editorMenuItem, editorMenuSection, endEditorPopup } from '../../ui/widgets/editor-menu';
import { searchBar } from '../../ui/widgets/search-bar';
import { drawMaterialProperties, materialSearchTerms } from '../assets/editors/material-details';
import { getSpriteThumbnail } from '../assets/preview/sprite-thumbnail';
import { getOrCreateTexturePreview } from '../assets/preview/texture-preview';
import type { SceneDocument } from '../scene/document/scene-document';
import { getEditorRotation } from '../scene/operations/editor-transform';
import { sceneWorkspace } from '../scene/scene-workspace';
import { DebugInspector } from './debug-inspector';
import { LAYOUT_TERMS, drawControlLayout } from './layout-details';

const TRANSFORM_TERMS = ['Location', 'Position', 'Rotation', 'Scale', 'Size', 'X', 'Y', 'Z'];
const END_BEHAVIORS = [spec.EndBehavior.destroy, spec.EndBehavior.forward, spec.EndBehavior.freeze, spec.EndBehavior.restart];
const HEADER_ICONS = {
  object: drawObjectIcon.bind(undefined, 'object'),
  layout: (x: number, y: number, size: number) => drawEditorIcon('sceneComponent', x, y, size, C.text),
  material: drawObjectIcon.bind(undefined, 'material'),
  transform: drawObjectIcon.bind(undefined, 'transform'),
};

@editorPanel()
export class InspectorPanel extends EditorWindow {
  private lockedObject?: object;
  private activeObject?: object;
  private readonly grid = new PropertyGridState();
  private readonly debugGrid = new PropertyGridState();
  private readonly search: [string] = [''];
  private readonly nameBuffer: [string] = [''];
  private readonly defaultEditor = new DefaultObjectDetails();
  private readonly debugInspector = new DebugInspector();
  private debugMode = false;
  private showAdvanced = false;
  private scaleLocked = false;
  private editingName = false;
  private scrollToTop = false;
  private document?: SceneDocument;

  @menuItem('Window/Inspector')
  static showWindow (): void { EditorWindow.getWindow(InspectorPanel).open(); }

  constructor () {
    super(); this.title = 'Inspector'; this.open();
    this.initialSize = new ImGui.Vec2(440, 640);
    this.debugGrid.expanded.set('Debug:Object', false);
    this.setWindowFlags(ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
  }

  override draw (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
    ImGui.PushStyleColor(ImGui.Col.WindowBg, C.background);
    const changed = sceneWorkspace.observe('Edit properties', () => super.draw(),
      [this.activeObject, this.lockedObject ?? EditorSelection.getSelectedObjects()[0]]);

    if (changed) { sceneWorkspace.current?.setScopeActive(this, true); }
    if (!ImGui.IsAnyItemActive()) { sceneWorkspace.current?.setScopeActive(this, false); }
    ImGui.PopStyleColor(); ImGui.PopStyleVar();
  }

  override flushEdits (): void {
    if (this.activeObject && this.editingName) {
      sceneWorkspace.observe('Rename object', () => this.commitName(this.activeObject!), [this.activeObject]);
      this.editingName = false;
    }
    sceneWorkspace.current?.setScopeActive(this, false);
  }

  override onUndoRedo (): void {
    this.editingName = false; this.activeObject = undefined;
  }

  override onSelectionChange (): void {
    if (EditorSelection.changeSource === 'history') { this.onUndoRedo(); }
  }

  protected override onGUI (): void {
    if (this.document !== sceneWorkspace.current) { this.document = sceneWorkspace.current; this.lockedObject = undefined; this.activeObject = undefined; this.editingName = false; }
    if (this.lockedObject instanceof VFXItem && !this.lockedObject.composition) { this.lockedObject = undefined; }
    const object = this.lockedObject ?? EditorSelection.getSelectedObjects()[0];

    if (object !== this.activeObject) {
      if (this.activeObject && this.editingName) { this.commitName(this.activeObject); }
      this.activeObject = object; this.editingName = false;
      this.nameBuffer[0] = this.objectName(object); this.scrollToTop = true;
    }
    const colors: [ImGui.Col, ImGui.Vec4][] = [
      [ImGui.Col.Text, C.text], [ImGui.Col.TextDisabled, C.muted], [ImGui.Col.ChildBg, C.background],
      [ImGui.Col.FrameBg, C.input], [ImGui.Col.FrameBgHovered, C.input], [ImGui.Col.FrameBgActive, C.input],
      [ImGui.Col.Border, C.inputBorder], [ImGui.Col.Button, C.header], [ImGui.Col.ButtonHovered, C.hover],
      [ImGui.Col.ButtonActive, C.selected], [ImGui.Col.CheckMark, C.text], [ImGui.Col.Header, C.selected],
    ];
    const clickToInput = ImGui.GetIO().ConfigDragClickToInputText;

    ImGui.GetIO().ConfigDragClickToInputText = true;
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(8, 8));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(7, 3));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemInnerSpacing, new ImGui.Vec2(4, 3));
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 3);
    ImGui.PushStyleVar(ImGui.StyleVar.FrameBorderSize, 1);
    ImGui.PushStyleVar(ImGui.StyleVar.ScrollbarSize, 10);
    colors.forEach(([key, color]) => ImGui.PushStyleColor(key, color));
    try {
      if (!object) {
        ImGui.Dummy(new ImGui.Vec2(0, 24));
        ImGui.SetCursorPosX(20); ImGui.TextDisabled('Select an object to view details.');

        return;
      }
      this.drawNameArea(object);
      this.drawSearch();
      ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
      const visible = ImGui.BeginChild('##InspectorProperties', new ImGui.Vec2(0, 0), ImGui.ChildFlags.None);

      ImGui.PopStyleVar();
      if (visible) {
        if (this.scrollToTop) { ImGui.SetScrollY(0); this.scrollToTop = false; }
        PropertyGrid.begin(this.debugMode ? this.debugGrid : this.grid, this.search[0]);
        ImGui.PushID(object instanceof EffectsObject ? object.getInstanceId() : object.constructor.name);
        try {
          const count = this.drawProperties(object);

          if (!count && PropertyGrid.filtering) {
            ImGui.Dummy(new ImGui.Vec2(0, 16)); ImGui.SetCursorPosX(20); ImGui.TextDisabled('No matching properties.');
          }
        } finally { ImGui.PopID(); PropertyGrid.end(); }
      }
      ImGui.EndChild();
    } finally {
      ImGui.PopStyleColor(colors.length); ImGui.PopStyleVar(7);
      ImGui.GetIO().ConfigDragClickToInputText = clickToInput;
    }
  }

  private objectName (object?: object): string {
    return object ? (object as { name?: string }).name || object.constructor.name : '';
  }

  private commitName (object: object): void {
    const named = object as { name?: string };

    if (typeof named.name === 'string' && this.nameBuffer[0].trim()) { named.name = this.nameBuffer[0].trim(); }
  }

  private componentType (component: Component): string {
    return typeof component.definition.dataType === 'string' ? component.definition.dataType : component.constructor.name;
  }

  private drawNameArea (object: object): void {
    const origin = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    drawEditorIcon(inspectedObjectIcon(object), origin.x + 10, origin.y + 11, 18, C.text);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 34, origin.y + 7));
    const named = object as { name?: string };

    if (typeof named.name === 'string') {
      if (!this.editingName) { this.nameBuffer[0] = named.name; }
      ImGui.PushStyleColor(ImGui.Col.FrameBg, new ImGui.Vec4(0, 0, 0, 0));
      ImGui.PushStyleVar(ImGui.StyleVar.FrameBorderSize, 0);
      ImGui.SetNextItemWidth(Math.max(40, width - 78 - (this.debugMode ? 58 : 0)));
      const commit = ImGui.InputTextWithHint('##ObjectName' + (object instanceof EffectsObject ? object.getInstanceId() : object.constructor.name), object.constructor.name, this.nameBuffer, undefined, ImGui.InputTextFlags.EnterReturnsTrue);

      if (commit || ImGui.IsItemDeactivatedAfterEdit()) { this.commitName(object); }
      this.editingName = ImGui.IsItemActive();
      ImGui.PopStyleVar(); ImGui.PopStyleColor();
    } else { ImGui.AlignTextToFramePadding(); ImGui.Text(this.objectName(object)); }
    if (this.debugMode) {
      const dl = ImGui.GetWindowDrawList();
      const min = new ImGui.Vec2(origin.x + width - 90, origin.y + 10);

      dl.AddRectFilled(min, new ImGui.Vec2(min.x + 48, min.y + 22), ImGui.GetColorU32(C.header), 3);
      dl.AddText(new ImGui.Vec2(min.x + 5, min.y + (22 - ImGui.GetFontSize()) / 2), ImGui.GetColorU32(C.text), 'Debug');
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + width - 34, origin.y + 7));
    if (objectIconButton('##LockInspector', this.lockedObject ? 'lock' : 'unlock', this.lockedObject ? 'Unlock selection' : 'Lock this selection')) {
      this.lockedObject = this.lockedObject ? undefined : object;
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + 42));
    ImGui.Dummy(new ImGui.Vec2(width, 0));
  }

  private drawSearch (): void {
    const origin = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 8, origin.y + 4));
    if (searchBar('##SearchDetails', this.search, { width: Math.max(50, width - 48), hint: this.debugMode ? 'Search Debug Properties' : 'Search Details' })) { this.scrollToTop = true; }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + width - 34, origin.y + 4));
    if (objectIconButton('##DetailsOptions', 'settings', 'View options')) { ImGui.OpenPopup('##DetailsOptionsMenu'); }
    if (ImGui.IsPopupOpen('##DetailsOptionsMenu')) {
      ImGui.SetNextWindowPos(new ImGui.Vec2(origin.x + width - 8, origin.y + 34), ImGui.Cond.Appearing, new ImGui.Vec2(1, 0));
    }
    if (beginEditorPopup('##DetailsOptionsMenu')) {
      const grid = this.debugMode ? this.debugGrid : this.grid;

      editorMenuSection('View Mode');
      if (editorMenuItem('Normal', '', !this.debugMode)) { this.setDebugMode(false); }
      if (editorMenuItem('Debug', '', this.debugMode)) { this.setDebugMode(true); }
      if (ImGui.IsItemHovered()) { ImGui.SetTooltip('Show raw component fields, including internal state, without custom property editors.'); }
      editorMenuSection('Categories', true);
      if (editorMenuItem('Expand All')) { grid.expandAll(true); }
      if (editorMenuItem('Collapse All')) { grid.expandAll(false); }
      editorMenuSection('Display', true);
      if (editorMenuItem('Show Advanced', '', this.showAdvanced, !this.debugMode)) { this.showAdvanced = !this.showAdvanced; }
      endEditorPopup();
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + 36));
    ImGui.Dummy(new ImGui.Vec2(width, 0));
  }

  private setDebugMode (enabled: boolean): void {
    if (this.debugMode === enabled) { return; }
    this.debugMode = enabled; this.scrollToTop = true;
  }

  private drawProperties (object: object): number {
    let count = 0;

    if (object instanceof VFXItem) {
      count += this.debugMode ? this.drawDebugObject(object, 'Debug:Object', 'VFXItem') : this.drawVFXItem(object);
      count += Number(PropertyGrid.category('Transform', 'Transform', TRANSFORM_TERMS, () => this.drawTransform(object), { icon: HEADER_ICONS.transform }));
    }
    count += this.debugMode ? this.drawDebug(object) : object instanceof VFXItem ? this.drawItem(object) : this.drawAsset(object);

    return count;
  }

  private drawDebugObject (target: object, id: string, label: string): number {
    this.debugInspector.target = target;

    return Number(PropertyGrid.category(id, label, this.debugInspector.getSearchTerms(), () => {
      this.debugInspector.target = target;
      this.debugInspector.onInspectorGUI(target instanceof Component ? ['enabled'] : target instanceof VFXItem ? ['isActive'] : []);
    }, { icon: inspectedObjectHeaderIcon(target) }));
  }

  private drawDebug (object: object): number {
    if (!(object instanceof VFXItem)) { return this.drawDebugObject(object, 'Debug:Properties', object.constructor.name); }
    let count = 0;

    for (const component of object.components) {
      count += this.drawDebugObject(component, 'Debug:Component:' + component.getInstanceId(), this.componentType(component));
    }

    return count;
  }

  private drawItem (item: VFXItem): number {
    let count = 0;
    const control = item.getComponent(UIControl)?.control;

    if (control) {
      count += Number(PropertyGrid.category('Layout', 'Layout', LAYOUT_TERMS, () => drawControlLayout(control), { icon: HEADER_ICONS.layout }));
    }
    for (const component of item.components) {
      const editor = resolveDetailsCustomization(component.constructor) ?? this.defaultEditor;

      editor.target = component;
      count += Number(PropertyGrid.category('Component:' + this.componentType(component) + ':' + item.components.indexOf(component), propertyLabel(this.componentType(component)), ['Enabled', ...editor.getSearchTerms()],
        () => { Fields.Checkbox('Enabled', component, 'enabled'); editor.onInspectorGUI(); }, { icon: inspectedObjectHeaderIcon(component) }));
    }
    const renderers = item.components.filter((component): component is RendererComponent => component instanceof RendererComponent);
    const materials = Array.from(new Set(renderers.flatMap(renderer => renderer.materials))).filter(Boolean);

    if (materials.length) {
      const skipColor = renderers.every(renderer => renderer instanceof MaskableGraphic);

      count += Number(PropertyGrid.category('Materials', 'Materials', ['Element', ...materials.flatMap(material => materialSearchTerms(material, skipColor))], () => {
        for (const renderer of renderers) {
          for (let index = 0; index < renderer.materials.length; index++) {
            ImGui.PushID(renderer.getInstanceId() + ':' + index);
            Fields.ObjectField(renderers.length > 1 ? propertyLabel(renderer.constructor.name) : 'Element ' + index, renderer.materials, index.toString(), 'Material', false, HEADER_ICONS.material);
            const material = renderer.materials[index];

            if (material) { drawMaterialProperties(material, renderer instanceof MaskableGraphic); }
            ImGui.PopID();
          }
        }
      }, { icon: HEADER_ICONS.material }));
    }
    count += this.drawIdentifiers(item);

    return count;
  }

  private drawVFXItem (item: VFXItem): number {
    return Number(PropertyGrid.category('VFXItem', 'VFXItem', ['Active', 'Item Type', 'Parent', 'Duration', 'Time', 'End Behavior', 'Render Order'], () => {
      const itemType = Object.entries(spec.ItemType).find(([, value]) => String(value) === String(item.type))?.[0];

      Fields.Checkbox('Active', item, 'isActive');
      Fields.Text('Item Type', propertyLabel(itemType ?? String(item.type)));
      Fields.ObjectField('Parent', item, 'parent', undefined, true, HEADER_ICONS.object);
      Fields.NumberField('Duration', next => {
        if (next !== undefined) { item.duration = Math.max(0, next); }

        return item.duration;
      }, 0.03, 0, 1e8, '%.3f s');
      Fields.Text('Time', item.time.toFixed(3) + ' s');
      Fields.ComboField('End Behavior', next => {
        if (next !== undefined) { item.endBehavior = END_BEHAVIORS[next]; }

        return Math.max(0, END_BEHAVIORS.indexOf(item.endBehavior));
      }, ['Destroy', 'Forward', 'Freeze', 'Restart']);
      Fields.NumberField('Render Order', next => {
        if (next !== undefined && Number.isFinite(next) && Math.round(next) !== item.renderOrder) { item.renderOrder = Math.round(next); }

        return item.renderOrder;
      }, 1, 0, 0, '%.0f');
    }, { icon: inspectedObjectHeaderIcon(item) }));
  }

  private drawTransform (item: VFXItem): void {
    const transform = item.transform;
    const position = transform.position.clone(), rotation = getEditorRotation(transform), scale = transform.scale.clone(), size = transform.size.clone();
    const previous = scale.toArray();
    let resetScale = false;

    if (Fields.Vector3Field('Location', position, undefined, [0, 0, 0])) { transform.setPosition(position.x, position.y, position.z); }
    if (Fields.Vector3Field('Rotation', rotation, undefined, [0, 0, 0])) { transform.setRotation(rotation.x, rotation.y, rotation.z); }
    if (Fields.Vector3Field('Scale', scale, undefined, { values: [1, 1, 1], reset: () => resetScale = true }, {
      draw: (x, y, length) => drawObjectIcon(this.scaleLocked ? 'lock' : 'unlock', x, y, length, this.scaleLocked ? C.text : C.muted),
      click: () => this.scaleLocked = !this.scaleLocked,
      hint: this.scaleLocked ? 'Unlock scale axes' : 'Preserve scale proportions',
    })) {
      if (this.scaleLocked && !resetScale) {
        const current = scale.toArray(), axis = current.findIndex((value, index) => Math.abs(value - previous[index]) > 1e-8);

        if (axis >= 0) {
          const values = previous.map(value => previous[axis] ? value * current[axis] / previous[axis] : current[axis]);

          scale.set(values[0], values[1], values[2]);
        }
      }
      transform.setScale(scale.x, scale.y, scale.z);
    }
    if (Fields.Vector2Field('Size', size, undefined, [1, 1])) { transform.setSize(size.x, size.y); }
  }

  private drawAsset (object: object): number {
    let count = 0;

    if (object instanceof Material) {
      count += Number(PropertyGrid.category('Material', 'Material', materialSearchTerms(object), () => drawMaterialProperties(object), { icon: HEADER_ICONS.material }));
    } else if (object instanceof Texture || object instanceof Sprite) {
      count += Number(PropertyGrid.category('Image', object instanceof Sprite ? 'Sprite' : 'Texture', ['Preview', 'Width', 'Height', 'Texture', 'UV Rectangle', 'Rotation'], () => {
        const texture = object instanceof Sprite ? object.texture : object;
        const preview = object instanceof Sprite ? getSpriteThumbnail(object) : getOrCreateTexturePreview(object);

        if (preview) {
          Fields.Property('Preview', width => ImGui.Image(preview.tex, new ImGui.Vec2(Math.min(width, 144), Math.min(width, 144)), preview.uv0, preview.uv1));
        }
        Fields.Text(object instanceof Sprite ? 'Texture Width' : 'Width', texture.width + ' px');
        Fields.Text(object instanceof Sprite ? 'Texture Height' : 'Height', texture.height + ' px');
        if (object instanceof Sprite) {
          Fields.ObjectField('Texture', object, 'texture', 'Texture', true);
          Fields.Text('UV Rectangle', object.rect.map(value => Number(value.toFixed(3))).join(', '));
          Fields.Text('Rotation', object.rotation === SpriteRotation.Rotate90 ? '90°' : 'None');
        }
      }, { icon: inspectedObjectHeaderIcon(object) }));
    } else {
      this.defaultEditor.target = object;
      count += Number(PropertyGrid.category('Properties', propertyLabel(object.constructor.name), [...this.defaultEditor.getSearchTerms(), ...(object instanceof Component ? ['Enabled'] : [])],
        () => {
          if (object instanceof Component) { Fields.Checkbox('Enabled', object, 'enabled'); }
          this.defaultEditor.onInspectorGUI();
        }, { icon: inspectedObjectHeaderIcon(object) }));
    }
    if (object instanceof EffectsObject) { count += this.drawIdentifiers(object); }

    return count;
  }

  private drawIdentifiers (object: EffectsObject): number {
    if (!this.showAdvanced && !PropertyGrid.filtering) { return 0; }

    return Number(PropertyGrid.category('Object', 'Object', ['ID', 'GUID', 'Type'], () => {
      Fields.Text('ID', object.getInstanceId()); Fields.Text('Type', object.constructor.name);
    }, { icon: HEADER_ICONS.object }));
  }
}
