import { sceneWorkspace as workspace } from '../../core/scene-document/scene-workspace';
import { ImGui } from '../../imgui';
import { editorMenuSection } from '../../widgets/editor-menu';
import { editorLayout } from '../../core/editor-layout';
import { contentLibrary } from '../../core/content-library/content-library';
import { CONTENT_ROOT } from '../../core/content-library/content-storage';
import { searchBar } from '../../widgets/search-bar';

function dialogTitle (kind: string): string {
  return kind === 'open' ? 'Open Scene' : kind === 'save' ? 'Save Scene As' : kind === 'replace' ? 'Replace Scene' : 'Unsaved Changes';
}

export class SceneFiles {
  private displayedDialog = '';
  private search: [string] = [''];
  private fileShortcut?: 'new' | 'save' | 'saveAs' | 'open';

  initialize (): void {
    if (typeof window !== 'undefined') { window.addEventListener('keydown', this.onKeyDown, true); }
  }

  shutdown (): void {
    if (typeof window !== 'undefined') { window.removeEventListener('keydown', this.onKeyDown, true); }
    this.fileShortcut = undefined;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) { return; }
    const save = event.code === 'KeyS';
    const open = event.code === 'KeyO' && !event.shiftKey;
    const create = event.code === 'KeyN' && !event.shiftKey;

    if (!save && !open && !create) { return; }
    // Cancel browser commands synchronously, then execute after the current edits have been drawn.
    event.preventDefault();
    if (!event.repeat && !workspace.busy && !workspace.dialog && !workspace.error) {
      this.fileShortcut = create ? 'new' : save ? event.shiftKey ? 'saveAs' : 'save' : 'open';
    }
  };

  drawFileMenu (): void {
    const document = workspace.current;

    if (!ImGui.BeginMenu('File')) { return; }
    editorMenuSection('Scene');
    if (ImGui.MenuItem('New Scene', 'Ctrl+N', false, !workspace.busy)) { void workspace.newScene(); }
    if (ImGui.MenuItem('Open Scene...', 'Ctrl+O', false, !workspace.busy)) { workspace.showOpen(); }
    if (ImGui.MenuItem('Save Scene', 'Ctrl+S', false, !!document && !workspace.busy)) { void workspace.save(); }
    if (ImGui.MenuItem('Save Scene As...', 'Ctrl+Shift+S', false, !!document && !workspace.busy)) { workspace.showSaveAs(); }
    editorMenuSection('Editor', true);
    if (ImGui.MenuItem('Save Layout')) { editorLayout.requestSave(); }
    ImGui.EndMenu();
  }

  drawEditMenu (): void {
    const document = workspace.current;

    if (!ImGui.BeginMenu('Edit')) { return; }
    if (ImGui.MenuItem('Undo' + (document?.canUndo ? ' ' + document.undoLabel : ''), 'Ctrl+Z', false, !!document?.canUndo && !workspace.busy)) { workspace.undo(); }
    if (ImGui.MenuItem('Redo' + (document?.canRedo ? ' ' + document.redoLabel : ''), 'Ctrl+Shift+Z', false, !!document?.canRedo && !workspace.busy)) { workspace.redo(); }
    ImGui.EndMenu();
  }

  shortcuts (): void {
    const io = ImGui.GetIO();
    const shortcut = this.fileShortcut;

    this.fileShortcut = undefined;
    if (workspace.busy || workspace.dialog || workspace.error) { return; }
    if (shortcut === 'new') {
      void workspace.newScene();

      return;
    }
    if (shortcut === 'save' || shortcut === 'saveAs') {
      if (shortcut === 'saveAs') { workspace.showSaveAs(); } else { void workspace.save(); }

      return;
    }
    if (io.WantTextInput || ImGui.IsAnyItemActive() || ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup)) { return; }
    if (shortcut === 'open') {
      workspace.showOpen();

      return;
    }
    if (!(io.KeyCtrl || io.KeySuper)) { return; }
    if (ImGui.IsKeyPressed(ImGui.Key.Z, false)) {
      if (io.KeyShift) { workspace.redo(); } else { workspace.undo(); }
    } else if (ImGui.IsKeyPressed(ImGui.Key.Y, false)) { workspace.redo(); }
  }

  drawDialogs (): void {
    const kind = workspace.dialog;
    const title = dialogTitle(kind);

    // Async operations can finish between frames; close the previous modal in an ImGui frame.
    if (this.displayedDialog && this.displayedDialog !== kind) {
      if (ImGui.BeginPopupModal(dialogTitle(this.displayedDialog), null, ImGui.WindowFlags.AlwaysAutoResize | ImGui.WindowFlags.NoSavedSettings)) {
        ImGui.CloseCurrentPopup(); ImGui.EndPopup();
      }
      this.displayedDialog = '';
    }

    if (kind && this.displayedDialog !== kind) { ImGui.OpenPopup(title); this.displayedDialog = kind; }
    if (kind) {
      ImGui.SetNextWindowSize(new ImGui.Vec2(kind === 'open' ? 520 : 440, 0), ImGui.Cond.Always);
      if (ImGui.BeginPopupModal(title, null, ImGui.WindowFlags.AlwaysAutoResize | ImGui.WindowFlags.NoResize | ImGui.WindowFlags.NoSavedSettings)) {
        ImGui.BeginDisabled(workspace.busy);
        if (kind === 'open') { this.drawOpen(); } else if (kind === 'save') { this.drawSave(); } else if (kind === 'replace') {
          ImGui.TextWrapped('A scene named "' + workspace.nameBuffer[0] + '" already exists. Replace its saved contents?');
          ImGui.Spacing();
          if (ImGui.Button('Replace', new ImGui.Vec2(90, 0))) { void workspace.replace(); }
          ImGui.SameLine();
          if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0))) { workspace.cancelOpen(); }
        } else { this.drawUnsaved(); }
        ImGui.EndDisabled();
        if (workspace.busy) { ImGui.TextDisabled('Saving scene...'); }
        if (workspace.dialog !== kind) { ImGui.CloseCurrentPopup(); this.displayedDialog = ''; }
        ImGui.EndPopup();
      }
    }
    if (workspace.error) {
      ImGui.OpenPopup('Scene Error');
      ImGui.SetNextWindowSize(new ImGui.Vec2(480, 0), ImGui.Cond.Always);
      if (ImGui.BeginPopupModal('Scene Error', null, ImGui.WindowFlags.AlwaysAutoResize | ImGui.WindowFlags.NoResize | ImGui.WindowFlags.NoSavedSettings)) {
        ImGui.TextWrapped(workspace.error); ImGui.Spacing();
        if (ImGui.Button('OK', new ImGui.Vec2(90, 0))) { workspace.error = ''; ImGui.CloseCurrentPopup(); }
        ImGui.EndPopup();
      }
    }
  }

  private drawOpen (): void {
    ImGui.TextDisabled('Scenes saved in this browser');
    searchBar('##FindScene', this.search, { hint: 'Search scenes' });
    ImGui.Spacing();
    ImGui.BeginChild('##LocalScenes', new ImGui.Vec2(0, 260), ImGui.ChildFlags.Borders);
    const entries = workspace.scenes.filter(entry => entry.name.toLowerCase().includes(this.search[0].toLowerCase()));

    if (workspace.loadingScenes) { ImGui.TextDisabled('Loading scenes...'); } else {
      if (!entries.length) { ImGui.TextDisabled('No saved scenes.'); }
      for (const entry of entries) {
        ImGui.PushID(entry.id);
        if (ImGui.Selectable(entry.name, workspace.current?.storageId === entry.id, ImGui.SelectableFlags.None, new ImGui.Vec2(0, 28))) {
          workspace.dialog = ''; void workspace.openSaved(entry);
        }
        ImGui.SameLine(Math.max(180, ImGui.GetWindowWidth() - 180)); ImGui.TextDisabled(new Date(entry.updatedAt).toLocaleString());
        ImGui.PopID();
      }
    }
    ImGui.EndChild(); ImGui.Spacing();
    if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0))) { workspace.dialog = ''; }
  }

  private drawSave (): void {
    ImGui.Text('Location'); ImGui.SetNextItemWidth(-1);
    if (ImGui.BeginCombo('##SceneFolder', contentLibrary.pathText(workspace.saveFolder))) {
      const folders = [{ id: CONTENT_ROOT, name: '/Game' }, ...contentLibrary.entries.filter(entry => entry.kind === 'folder' && !entry.deletedAt)
        .map(entry => ({ id: entry.id, name: contentLibrary.pathText(entry.id) })).sort((a, b) => a.name.localeCompare(b.name))];

      for (const folder of folders) { if (ImGui.Selectable(folder.name, workspace.saveFolder === folder.id)) { workspace.saveFolder = folder.id; } }
      ImGui.EndCombo();
    }
    ImGui.Spacing();
    ImGui.Text('Scene Name'); ImGui.SetNextItemWidth(-1);
    if (ImGui.IsWindowAppearing()) { ImGui.SetKeyboardFocusHere(); }
    const enter = ImGui.InputText('##SceneName', workspace.nameBuffer, undefined, ImGui.InputTextFlags.EnterReturnsTrue);

    ImGui.Spacing(); ImGui.BeginDisabled(!workspace.nameBuffer[0].trim());
    if (ImGui.Button('Save', new ImGui.Vec2(90, 0)) || enter) {
      void workspace.saveAs();
    }
    ImGui.EndDisabled(); ImGui.SameLine();
    if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0))) { workspace.cancelOpen(); }
  }

  private drawUnsaved (): void {
    ImGui.TextWrapped('Save changes to "' + workspace.current?.name + '" before opening another scene?');
    ImGui.Spacing();
    if (ImGui.Button('Save', new ImGui.Vec2(90, 0))) { void workspace.save(); }
    ImGui.SameLine();
    if (ImGui.Button('Discard', new ImGui.Vec2(90, 0))) { workspace.discardAndOpen(); }
    ImGui.SameLine();
    if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0))) { workspace.cancelOpen(); }
  }
}
