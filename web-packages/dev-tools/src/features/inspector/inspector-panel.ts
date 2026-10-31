import { EditorSearchField } from '../../ui/controls/search-field';
import { Component, Composition, EffectsObject, MaskableGraphic, Material, RendererComponent, Sprite, SpriteRotation, Texture, VFXItem, spec, math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { InputEventKey } from '@galacean/effects';
import type { Label, Control, LineEdit } from '@galacean/effects-plugin-gui';
import { UIControl } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem, resolveDetailsCustomization } from '../../framework/registry/editor-registry';
import { EditorSelection } from '../../framework/selection/editor-selection';
import { EditorWindow } from '../../framework/windows/editor-window';
import { append, column, expand, label, margin, row } from '../../ui/controls/layout';
import { EditorMenuButton } from '../../ui/controls/menu';
import { EditorTextField } from '../../ui/controls/text-field';
import { EditorIconButton, EditorIconControl } from '../../ui/icons/control-icons';
import { DefaultObjectDetails, propertyLabel } from '../../ui/property-editor/default-object-details';
import { PropertySheet, propertyBinding } from '../../ui/property-editor/property-sheet';
import type { PropertyGroup } from '../../ui/property-editor/property-sheet';
import { editorBox, editorColors as C } from '../../ui/theme/control-theme';
import { buildMaterialProperties } from '../assets/editors/material-details';
import { AssetPreviewControl } from '../assets/preview/asset-preview-control';
import { getEditorRotation } from '../scene/operations/editor-transform';
import { sceneWorkspace } from '../scene/scene-workspace';
import type { SceneDocument } from '../scene/document/scene-document';
import { inspectedObjectIcon } from './inspected-object-icons';
import { DebugInspector } from './debug-inspector';
import { buildControlLayout } from './layout-details';

const END_BEHAVIORS = [spec.EndBehavior.destroy, spec.EndBehavior.forward, spec.EndBehavior.freeze, spec.EndBehavior.restart];

class ObjectNameEdit extends EditorTextField {
  committed?: () => void;
  private original = '';
  override onGotFocus (): void { this.original = this.text; super.onGotFocus(); }
  acceptName (): void { this.original = this.text; this.committed?.(); }
  override onLostFocus (): void { super.onLostFocus(); this.committed?.(); }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape') { this.text = this.original; this.releaseFocus(); event.accept(); } else { super.onKeyDown(event); }
  }
}
@editorPanel()
export class InspectorPanel extends EditorWindow {
  private lockedObject?: object;
  private activeObject?: object;
  private activeStructure = '';
  private document?: SceneDocument;
  private sheet?: PropertySheet;
  private name?: ObjectNameEdit;
  private icon?: EditorIconControl;
  private lock?: EditorIconButton;
  private search?: LineEdit;
  private empty?: Control;
  private header?: Control;
  private toolbar?: Control;
  private debugMode = false;
  private showAdvanced = false;
  private searching = false;
  private scaleLocked = false;
  private readonly defaultEditor = new DefaultObjectDetails();
  private readonly debugInspector = new DebugInspector();
  private unsubscribeWorkspace?: () => void;
  private unsubscribeDocument?: () => void;
  private readonly editing = new Set<Control>();

  @menuItem('Window/Inspector')
  static showWindow (): void { EditorWindow.getWindow(InspectorPanel).open(); }

  constructor () { super(); this.title = 'Inspector'; this.open(); }

  protected override createContent (engine: Engine): Control {
    const content = column(engine);

    this.empty = append(content, margin(engine, label(engine, 'Select an object to view details.', C.muted), 20, 24));
    this.icon = new EditorIconControl(engine, 'object', 18);
    this.name = expand(new ObjectNameEdit(engine), true, false);
    this.name.setThemeStyleBoxOverride('normal', editorBox(C.clear, 5));
    this.name.committed = () => this.commitName(); this.name.on('textSubmitted', () => this.name?.acceptName());
    this.lock = new EditorIconButton(engine, 'unlock');
    this.lock.on('pressed', () => { this.flushEdits(); this.lockedObject = this.lockedObject ? undefined : this.activeObject; this.refreshSelection(); });
    this.header = append(content, margin(engine, row(engine, [this.icon, this.name, this.lock]), 10, 7));
    this.search = expand(new EditorSearchField(engine), true, false); this.search.placeholderText = 'Search...';
    this.search.on('textChanged', value => {
      if (!!value.trim() !== this.searching) { this.searching = !!value.trim(); this.rebuild(); }
      this.sheet?.filter(value);
    });
    const options = new EditorMenuButton(engine, '');

    options.iconName = 'settings'; options.setCustomMinimumSize(24, 24);

    options.actions = () => [
      { label: 'Normal', checked: !this.debugMode, action: () => { this.debugMode = false; this.rebuild(); } },
      { label: 'Debug', checked: this.debugMode, action: () => { this.debugMode = true; this.rebuild(); } },
      { label: '', separator: true },
      { label: 'Expand All', action: () => this.sheet?.expandAll(true) },
      { label: 'Collapse All', action: () => this.sheet?.expandAll(false) },
      { label: 'Show Advanced', checked: this.showAdvanced, enabled: !this.debugMode, action: () => { this.showAdvanced = !this.showAdvanced; this.rebuild(); } },
    ];
    this.toolbar = append(content, margin(engine, row(engine, [this.search, options]), 8, 4));
    this.sheet = append(content, expand(new PropertySheet(engine, {
      change: (title, owner, action) => {
        sceneWorkspace.observe('Edit ' + title, action, [this.activeObject]);
        this.editing.add(owner); sceneWorkspace.current?.setScopeActive(owner, true);
      },
      finish: owner => { this.editing.delete(owner); sceneWorkspace.current?.setScopeActive(owner, false); },
    })));
    this.unsubscribeWorkspace = sceneWorkspace.subscribeDocument(document => this.bindDocument(document));
    this.bindDocument(sceneWorkspace.current); this.rebuild();

    return content;
  }
  private bindDocument (document?: SceneDocument): void {
    if (this.document !== document) {
      this.flushEdits(); this.unsubscribeDocument?.(); this.document = document; this.lockedObject = undefined; this.activeObject = undefined;
      this.unsubscribeDocument = document?.subscribe(() => {
        if (this.lockedObject instanceof VFXItem && !this.lockedObject.composition) { this.lockedObject = undefined; }
        this.refreshSelection();
      });
    }
    this.refreshSelection();
  }
  private refreshSelection (): void {
    const next = this.lockedObject ?? EditorSelection.getSelectedObjects()[0];

    const structure = next instanceof VFXItem ? next.components.map(component => component.getInstanceId() + (component instanceof RendererComponent ? ':' + component.materials.map(material => material?.getInstanceId() + '/' + material?.shader?.getInstanceId()).join(',') : '')).join('|') : '';

    if (this.activeObject !== next || this.activeStructure !== structure) { this.flushEdits(); this.activeObject = next; this.activeStructure = structure; this.rebuild(); }
    this.lock!.iconName = this.lockedObject ? 'lock' : 'unlock';
    if (this.name && !this.name.hasFocus()) { this.name.text = this.objectName(next); }
  }
  private objectName (object?: object): string { return object ? (object as { name?: string }).name || object.constructor.name : ''; }
  private commitName (): void {
    const object = this.activeObject as { name?: string } | undefined, name = this.name?.text.trim();

    if (!object || !name || typeof object.name !== 'string' || name === object.name) { return; }
    sceneWorkspace.observe('Rename object', () => object.name = name, [object]); sceneWorkspace.current?.commit();
  }
  override flushEdits (): void {
    this.commitName(); for (const owner of this.editing) { sceneWorkspace.current?.setScopeActive(owner, false); } this.editing.clear();
  }
  override onSelectionChange (): void { if (this.sheet) { this.refreshSelection(); } }
  override onUndoRedo (): void { if (this.sheet) { this.bindDocument(sceneWorkspace.current); this.rebuild(); } }
  override dispose (): void { this.unsubscribeWorkspace?.(); this.unsubscribeDocument?.(); super.dispose(); }

  private rebuild (): void {
    const sheet = this.sheet, object = this.activeObject;

    if (!sheet) { return; }
    sheet.clear(); this.empty!.visible = !object; this.header!.visible = this.toolbar!.visible = sheet.visible = !!object;
    if (!object) { return; }
    this.name!.text = this.objectName(object); this.name!.editable = typeof (object as { name?: string }).name === 'string';
    this.icon!.iconName = inspectedObjectIcon(object);
    this.search!.placeholderText = this.debugMode ? 'Search Debug Properties' : 'Search...';
    if (object instanceof VFXItem) {
      if (this.debugMode) { this.buildDebug(object, 'Debug:Object', 'VFXItem'); } else { this.buildItemFields(object); }
      this.buildTransform(sheet.section('Transform', 'Transform', true, 'transform'), object);
      if (!this.debugMode) {
        const control = object.getComponent(UIControl)?.control;

        if (control) { buildControlLayout(sheet.section('Layout', 'Layout', true, 'sceneComponent'), control); }
      }
      for (const component of object.components) {
        const type = typeof component.definition.dataType === 'string' ? component.definition.dataType : component.constructor.name;

        if (this.debugMode) { this.buildDebug(component, 'Debug:' + component.getInstanceId(), type); continue; }
        const group = sheet.section('Component:' + component.getInstanceId(), propertyLabel(type), true, inspectedObjectIcon(component));
        const editor = resolveDetailsCustomization(component.constructor) ?? this.defaultEditor;

        group.boolean('Enabled', propertyBinding(component, 'enabled')); editor.target = component; editor.build(group);
      }
      if (!this.debugMode) {
        const renderers = object.components.filter((component): component is RendererComponent => component instanceof RendererComponent);
        const withMaterials = renderers.filter(renderer => renderer.materials.length);

        if (withMaterials.length) {
          const materials = sheet.section('Materials', 'Materials', true, 'material');

          for (const renderer of withMaterials) {
            renderer.materials.forEach((material, index) => {
              const group = materials.group(renderer.getInstanceId() + ':' + index, withMaterials.length > 1 ? propertyLabel(renderer.constructor.name) : 'Element ' + index);

              group.reference('Material', { read: () => renderer.materials[index], write: value => { if (value instanceof Material) { renderer.materials[index] = value; } } }, 'Material', false, false);
              if (material) { buildMaterialProperties(group, material, renderer instanceof MaskableGraphic); }
            });
          }
        }
      }
    } else if (this.debugMode) { this.buildDebug(object, 'Debug:Properties', object.constructor.name); } else { this.buildAsset(object); }
    if (object instanceof EffectsObject && (this.showAdvanced || this.search!.text.trim())) {
      const identifiers = sheet.section('Object', 'Object', true, 'object');

      identifiers.readOnly('ID', () => object.getInstanceId()); identifiers.readOnly('Type', () => object instanceof Composition ? 'Scene' : object.constructor.name);
    }
    sheet.filter(this.search!.text); sheet.vScroll = 0;
  }
  private buildDebug (object: object, id: string, title: string): void {
    this.debugInspector.target = object;
    this.debugInspector.build(this.sheet!.section(id, title, id !== 'Debug:Object', inspectedObjectIcon(object)), object instanceof Component ? ['enabled'] : object instanceof VFXItem ? ['isActive'] : []);
  }
  private buildItemFields (item: VFXItem): void {
    const group = this.sheet!.section('VFXItem', 'VFXItem', true, inspectedObjectIcon(item));

    group.boolean('Active', propertyBinding(item, 'isActive'));
    group.readOnly('Item Type', () => propertyLabel(Object.entries(spec.ItemType).find(([, value]) => String(value) === String(item.type))?.[0] ?? String(item.type)));
    group.reference('Parent', propertyBinding(item, 'parent'), undefined, true);
    group.number('Duration', propertyBinding(item, 'duration'), { min: 0, max: 1e8, suffix: ' s' });
    group.readOnly('Time', () => item.time.toFixed(3) + ' s');
    group.choice('End Behavior', { read: () => Math.max(0, END_BEHAVIORS.indexOf(item.endBehavior)), write: index => { item.endBehavior = END_BEHAVIORS[index]; } }, ['Destroy', 'Forward', 'Freeze', 'Restart']);
    group.number('Render Order', { read: () => item.renderOrder, write: value => { item.renderOrder = Math.round(value); } }, { step: 1, precision: 0 });
  }
  private buildTransform (group: PropertyGroup, item: VFXItem): void {
    const transform = item.transform;

    group.vector('Location', { read: () => transform.position.toArray(), write: values => transform.setPosition(values[0], values[1], values[2]) }, 3,
      { reset: () => transform.setPosition(0, 0, 0), resetVisible: () => transform.position.toArray().some(value => Math.abs(value) > 1e-6) });
    group.vector('Rotation', { read: () => getEditorRotation(transform).toArray(), write: values => transform.setRotation(values[0], values[1], values[2]) }, 3,
      { step: .1, reset: () => transform.setRotation(0, 0, 0), resetVisible: () => getEditorRotation(transform).toArray().some(value => Math.abs(value) > 1e-6) });
    group.vector('Scale', { read: () => transform.scale.toArray(), write: values => {
      const before = transform.scale.toArray(), axis = values.findIndex((value, index) => Math.abs(value - before[index]) > 1e-8);
      const next = this.scaleLocked && axis >= 0 ? before.map(value => before[axis] ? value * values[axis] / before[axis] : values[axis]) : values;

      transform.setScale(next[0], next[1], next[2]);
    } }, 3, {
      reset: () => transform.setScale(1, 1, 1), resetVisible: () => transform.scale.toArray().some(value => Math.abs(value - 1) > 1e-6),
      captionAction: { icon: () => this.scaleLocked ? 'lock' : 'unlock', hint: 'Preserve Scale Proportions', pressed: () => { this.scaleLocked = !this.scaleLocked; } },
    });
    group.vector('Size', { read: () => transform.size.toArray(), write: values => transform.setSize(values[0], values[1]) }, 2,
      { reset: () => transform.setSize(1, 1), resetVisible: () => transform.size.toArray().some(value => Math.abs(value - 1) > 1e-6) });
  }
  private buildAsset (object: object): void {
    if (object instanceof Material) { buildMaterialProperties(this.sheet!.section('Material', 'Material', true, 'material'), object); } else if (object instanceof Texture || object instanceof Sprite) {
      const group = this.sheet!.section('Image', object instanceof Sprite ? 'Sprite' : 'Texture', true, inspectedObjectIcon(object));

      group.add('Preview', new AssetPreviewControl(this.sheet!.engine, () => object, 144));
      group.readOnly(object instanceof Sprite ? 'Texture Width' : 'Width', () => (object instanceof Sprite ? object.texture : object).width + ' px');
      group.readOnly(object instanceof Sprite ? 'Texture Height' : 'Height', () => (object instanceof Sprite ? object.texture : object).height + ' px');
      if (object instanceof Sprite) {
        group.reference('Texture', propertyBinding(object, 'texture'), 'Texture', true);
        group.readOnly('UV Rectangle', () => object.rect.map(value => Number(value.toFixed(3))).join(', '));
        group.readOnly('Rotation', () => object.rotation === SpriteRotation.Rotate90 ? '90°' : 'None');
      }
    } else {
      const group = this.sheet!.section('Properties', propertyLabel(object.constructor.name), true, inspectedObjectIcon(object));

      if (object instanceof Component) { group.boolean('Enabled', propertyBinding(object, 'enabled')); }
      this.defaultEditor.target = object; this.defaultEditor.build(group);
    }
  }
}
