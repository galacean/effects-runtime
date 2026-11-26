import type { Engine } from '@galacean/effects';
import { VerticalAlignment } from '@galacean/effects-plugin-gui';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import type { HandleMirrorMode } from '@galacean/effects-plugin-editor-gizmo';
import { EditorFloatingToolbar } from '../../../ui/controls/floating-toolbar';
import { append, label } from '../../../ui/controls/layout';
import { EditorMenuButton, type MenuAction } from '../../../ui/controls/menu';
import { EditorViewportToggleButton } from '../../../ui/controls/toolbar';
import { setTooltip } from '../../../ui/controls/tooltip';
import { EditorIconButton, type EditorIcon } from '../../../ui/icons/control-icons';
import { editorColors } from '../../../ui/theme/control-theme';
import type { SceneGizmo } from './scene-gizmo';

/** Contextual editing controls float at the top of the scene viewport. */
export class SceneToolSettingsBar extends EditorFloatingToolbar {
  private readonly title: Label;
  private readonly handles: Label;
  private readonly mirrors: EditorViewportToggleButton[];
  private readonly editNodes: EditorIconButton;
  private readonly editText: EditorIconButton;
  private readonly editChildren: EditorIconButton;
  private readonly addPath: EditorIconButton;
  private readonly lasso: EditorViewportToggleButton;
  private readonly done: EditorIconButton;
  private readonly more: EditorMenuButton;
  private readonly actions = new Map<Control, () => MenuAction>();
  private eligible = new Set<Control>();
  private layoutState = '';
  private finishLabel = 'Done';

  constructor (
    engine: Engine,
    private readonly gizmo: () => SceneGizmo | undefined,
    private readonly focusViewport: () => void,
    finishEditing: () => void,
  ) {
    super(engine);
    this.title = append(this, label(engine, 'Path', editorColors.foregroundHeader));
    this.handles = append(this, label(engine, 'Handles', editorColors.muted));
    this.title.verticalAlignment = this.handles.verticalAlignment = VerticalAlignment.Center;
    this.mirrors = ([
      ['none', 'toolHandlesFree', 'Independent handles'],
      ['angle', 'toolHandlesAligned', 'Mirror handle angle'],
      ['angle-length', 'toolHandlesMirrored', 'Mirror handle angle and length'],
    ] as [HandleMirrorMode, EditorIcon, string][]).map(([mode, icon, tooltip]) => {
      const button = append(this, new EditorViewportToggleButton(engine, icon,
        () => this.gizmo()?.penMirrorMode === mode,
        value => { if (value) { this.gizmo()?.setPenMirrorMode(mode); } this.focusViewport(); }));

      setTooltip(button, tooltip);
      this.actions.set(button, () => ({ label: tooltip, icon, checked: this.gizmo()?.penMirrorMode === mode,
        action: () => { this.gizmo()?.setPenMirrorMode(mode); this.focusViewport(); } }));

      return button;
    });
    this.editNodes = this.button('Edit Nodes', 'toolEditNodes', () => this.gizmo()?.editPath(), 'Edit the selected path nodes (Enter)');
    this.editText = this.button('Edit Text', 'toolEditText', () => this.gizmo()?.editText(), 'Edit the selected text (Enter)');
    this.editChildren = this.button('Edit Children', 'toolEditChildren', () => this.gizmo()?.editChildren(), 'Edit the selected item’s children');
    this.addPath = this.button('Subpath', 'toolAddPath', () => this.gizmo()?.appendPath(), 'Add a subpath to the selected path');
    this.lasso = append(this, new EditorViewportToggleButton(engine, 'toolLasso', () => !!this.gizmo()?.pathLasso, value => {
      this.gizmo()?.setPathLasso(value); this.focusViewport();
    }));
    setTooltip(this.lasso, 'Lasso-select path nodes');
    this.actions.set(this.lasso, () => ({ label: 'Lasso Nodes', icon: 'toolLasso', checked: this.gizmo()?.pathLasso,
      action: () => {
        const g = this.gizmo();

        g?.setPathLasso(!g.pathLasso); this.focusViewport();
      } }));
    this.done = this.button('Done', 'toolFinish', finishEditing, 'Finish the current editing step (Esc)');
    this.more = append(this, new EditorMenuButton(engine, '', () => this.overflowActions()));
    this.more.iconName = 'more';
    this.setSettingsPopup(this.more, this.more.menu);
    setTooltip(this.more, 'More tool settings');
    this.groups = [[this.title], [this.handles, ...this.mirrors], [this.editNodes, this.editText, this.editChildren],
      [this.addPath, this.lasso], [this.done], [this.more]];
  }

  refresh (): void {
    const g = this.gizmo(), path = !!g?.editingPath, mode = g?.handler.getActiveEditMode().id;
    const active = new Set<Control>();

    if (path) {
      [this.title, this.handles, ...this.mirrors, this.done].forEach(control => active.add(control));
      if (g?.editingNodes) { active.add(this.addPath); active.add(this.lasso); }
      this.title.text = 'Path'; this.finishLabel = g?.editingNodes ? 'Done' : 'Finish Path';
    } else if (g?.tool === 'transform') {
      if (mode === 'text-edit' || mode === 'effects-edit') {
        active.add(this.done); this.finishLabel = 'Done';
      } else {
        if (g.canEditPath) { active.add(this.editNodes); }
        if (g.canEditText) { active.add(this.editText); }
        if (g.canEditChildren) { active.add(this.editChildren); }
      }
      if (active.size) { active.add(this.title); }
      this.title.text = g.canEditPath ? 'Path' : g.canEditText ? 'Text' : 'Children';
    }
    this.visible = active.size > 0;
    const state = [path, g?.editingNodes, mode, g?.canEditPath, g?.canEditText, g?.canEditChildren, g?.tool].join(':');

    if (state !== this.layoutState) {
      this.layoutState = state; this.eligible = active;
      this.refreshLayout();
    }
  }

  protected override selectControls (available: number): Set<Control> {
    const visible = new Set(this.eligible);
    const collapse = [this.title, this.handles, this.addPath, this.editChildren, this.lasso, this.editText, this.editNodes, ...this.mirrors];

    this.done.text = available < 240 ? '' : this.finishLabel;
    this.collapseToFit(visible, available, collapse, control => {
      if (this.actions.has(control)) { visible.add(this.more); }
    });

    return visible;
  }

  private button (text: string, icon: EditorIcon, action: () => void, tooltip: string): EditorIconButton {
    const button = append(this, new EditorIconButton(this.engine, icon, text));
    const activate = (): void => { action(); this.focusViewport(); };

    button.on('pressed', activate); setTooltip(button, tooltip);
    this.actions.set(button, () => ({ label: button.text, icon, action: activate }));

    return button;
  }

  private overflowActions (): MenuAction[] {
    return this.groups.flat().filter(control => this.eligible.has(control) && !control.visible && this.actions.has(control))
      .map(control => this.actions.get(control)!());
  }
}
