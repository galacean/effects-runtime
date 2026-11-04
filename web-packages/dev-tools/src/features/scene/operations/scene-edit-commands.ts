import { VFXItem } from '@galacean/effects';
import type { InputEventKey } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { LineEdit, TextEdit } from '@galacean/effects-plugin-gui';
import { EditorSelection } from '../../../framework/selection/editor-selection';
import type { MenuAction } from '../../../ui/controls/menu';
import { sceneWorkspace } from '../scene-workspace';
import { SceneItemOperations } from './scene-item-operations';
import type { SceneItemCopy } from './scene-item-operations';

class SceneEditCommands {
  private clipboard?: SceneItemCopy;
  private systemCopyText?: string;
  private readonly scopes = new Set<Control>();

  bind (scope: Control): () => void {
    if (!this.scopes.size) {
      for (const name of ['copy', 'cut', 'paste'] as const) { document.addEventListener(name, this.clipboardEvent); }
    }
    this.scopes.add(scope);

    return () => {
      this.scopes.delete(scope);
      if (!this.scopes.size) {
        for (const name of ['copy', 'cut', 'paste'] as const) { document.removeEventListener(name, this.clipboardEvent); }
      }
    };
  }

  get enabled (): boolean { return !!sceneWorkspace.current && !sceneWorkspace.busy && !sceneWorkspace.current.restoring; }
  get selectedItems (): VFXItem[] {
    const document = sceneWorkspace.current;

    return document ? EditorSelection.getSelectedObjects().filter((object): object is VFXItem => object instanceof VFXItem &&
      object.composition === document.composition && !!object.definition.id && object !== document.composition.sceneRoot && object !== document.composition.root) : [];
  }

  copy (cut = false, event?: ClipboardEvent): void {
    if (!this.enabled || !this.selectedItems.length) { return; }
    sceneWorkspace.flushEdits();
    const operations = new SceneItemOperations(sceneWorkspace.current!), items = this.selectedItems;

    this.clipboard = operations.copy(items);
    const text = JSON.stringify(this.clipboard);

    if (event?.clipboardData) { event.clipboardData.setData('text/plain', text); } else if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => this.copyThroughEvent(text));
    } else { this.copyThroughEvent(text); }
    if (cut) { operations.remove(items, undefined, 'Cut items'); }
  }

  async paste (): Promise<void> {
    if (!this.enabled) { return; }
    const document = sceneWorkspace.current;
    let data = this.clipboard;

    if (navigator.clipboard?.readText) {
      try { data = this.parse(await navigator.clipboard.readText()); } catch { /* The local clipboard remains available when browser access is denied. */ }
    }
    if (data && document === sceneWorkspace.current && this.enabled) { new SceneItemOperations(document!).paste(data); }
  }
  duplicate (): void { if (this.enabled) { new SceneItemOperations(sceneWorkspace.current!).duplicate(this.selectedItems); } }
  remove (): void { if (this.enabled && this.selectedItems.length) { new SceneItemOperations(sceneWorkspace.current!).remove(this.selectedItems); } }
  selectAll (): void {
    const document = sceneWorkspace.current;

    if (!document || !this.enabled) { return; }
    document.observeEditor('Select objects', () => EditorSelection.setObjects(document.composition.items.filter(item =>
      !!item.definition.id && item !== document.composition.sceneRoot && item !== document.composition.root)));
    document.commit();
  }

  shortcut (event: InputEventKey): boolean {
    if (!this.enabled || event.echo || event.altPressed || this.editingText()) { return false; }
    const code = event.physicalKeycode || event.keycode, modifier = event.ctrlPressed || event.metaPressed;

    // Native clipboard events carry the actual system clipboard and preserve text editing.
    if (modifier && ['KeyC', 'KeyX', 'KeyV'].includes(code)) { return true; }
    if (modifier && code === 'KeyD') { this.duplicate(); } else if (modifier && code === 'KeyA') { this.selectAll(); } else if (!modifier && (code === 'Delete' || code === 'Backspace')) { this.remove(); } else { return false; }
    event.accept();

    return true;
  }

  actions (): MenuAction[] {
    const selected = this.enabled && !!this.selectedItems.length;

    return [
      { label: 'Cut', shortcut: 'Ctrl+X', enabled: selected, action: () => this.copy(true) },
      { label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', enabled: selected, action: () => this.copy() },
      { label: 'Paste', icon: 'paste', shortcut: 'Ctrl+V', enabled: this.enabled && !!this.clipboard, action: () => { void this.paste().catch(error => sceneWorkspace.report(error)); } },
      { label: 'Duplicate', shortcut: 'Ctrl+D', enabled: selected, action: () => this.duplicate() },
      { label: 'Delete', shortcut: 'Delete', enabled: selected, action: () => this.remove() },
    ];
  }

  private editingText (): boolean {
    if (document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement) { return true; }
    const scope = this.scopes.values().next().value as Control | undefined;
    const focused = scope?.root?.guiGetFocusOwner();

    return focused instanceof LineEdit || focused instanceof TextEdit;
  }
  private focused (): boolean {
    for (const scope of this.scopes) {
      for (let focus = scope.root?.guiGetFocusOwner(); focus; focus = focus.parent) { if (focus === scope) { return true; } }
    }

    return false;
  }
  private parse (text: string): SceneItemCopy | undefined {
    if (!text.trimStart().startsWith('{')) { return; }
    let data: SceneItemCopy;

    try { data = JSON.parse(text); } catch { return; }
    if (data?.format !== 'effects-scene-items' || !Array.isArray(data.roots) || !Array.isArray(data.objects) || !Array.isArray(data.extras)) { return; }
    const objects = new Map(data.objects.filter(object => object && typeof object.id === 'string' && typeof object.dataType === 'string').map(object => [object.id, object]));

    if (objects.size !== data.objects.length || !data.roots.length || data.roots.some(root => !root || objects.get(root.id)?.dataType !== 'VFXItemData' ||
      !Array.isArray(root.worldTransform) || root.worldTransform.length !== 16 || !root.worldTransform.every(Number.isFinite)) ||
      data.roots.some(root => root.parentWorldTransform !== undefined && (!Array.isArray(root.parentWorldTransform) || root.parentWorldTransform.length !== 16 || !root.parentWorldTransform.every(Number.isFinite))) ||
      data.extras.some(entry => !Array.isArray(entry) || typeof entry[0] !== 'string' || !entry[1] || typeof entry[1] !== 'object')) { return; }

    return data;
  }
  private readonly clipboardEvent = (event: ClipboardEvent): void => {
    if (event.type === 'copy' && this.systemCopyText !== undefined) {
      event.clipboardData?.setData('text/plain', this.systemCopyText); event.preventDefault();

      return;
    }
    if (!this.enabled || !this.focused() || this.editingText()) {
      if (event.type === 'copy' || event.type === 'cut') { this.clipboard = undefined; }

      return;
    }
    if (event.type === 'paste') {
      const data = this.parse(event.clipboardData?.getData('text/plain') ?? '');

      if (!data) { return; }
      this.clipboard = data;
      new SceneItemOperations(sceneWorkspace.current!).paste(data);
    } else {
      if (!this.selectedItems.length) { return; }
      this.copy(event.type === 'cut', event);
    }
    event.preventDefault();
  };
  private copyThroughEvent (text: string): void {
    // Clipboard events also work on local HTTP origins without the asynchronous API.
    this.systemCopyText = text;
    try { document.execCommand('copy'); } catch { /* The scene clipboard still supports menu actions. */ }
    this.systemCopyText = undefined;
  }
}

export const sceneEditCommands = new SceneEditCommands();
