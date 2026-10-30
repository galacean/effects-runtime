import { saveFocusedAsset } from '../../features/assets/editors/asset-editor-registry';
import { assetLibrary } from '../../features/assets/asset-library';
import { ASSET_ROOT } from '../../features/assets/model/asset-types';
import { projectWorkspace as projects } from '../../features/projects/project-workspace';
import { projectBrowser } from '../../features/projects/ui/project-browser-dialog';
import { sceneWorkspace as workspace } from '../../features/scene/scene-workspace';
import { editorCommands } from '../../framework/commands/editor-commands';
import { ImGui } from '../../platform/imgui/index';
import { commandMenuItem } from '../../ui/menus/command-menu-item';
import { beginEditorMenu, editorMenuItem, editorMenuSection, endEditorMenu } from '../../ui/widgets/editor-menu';
import { searchBar } from '../../ui/widgets/search-bar';

function dialogTitle (kind: string): string {
  return kind === 'open' ? 'Open Scene' : kind === 'save' ? 'Save Scene As' : kind === 'replace' ? 'Replace Scene' : 'Unsaved Changes';
}

export class EditorMenus {
  private displayedDialog = '';
  private search: [string] = [''];
  private fileShortcut?: 'new' | 'save' | 'saveAs' | 'saveAll' | 'open';

  initialize (): void {
    if (typeof window !== 'undefined') { window.addEventListener('keydown', this.onKeyDown, true); }
  }

  shutdown (): void {
    if (typeof window !== 'undefined') { window.removeEventListener('keydown', this.onKeyDown, true); }
    this.fileShortcut = undefined;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.isComposing) { return; }
    const save = event.code === 'KeyS';
    const open = event.code === 'KeyO' && !event.shiftKey && !event.altKey;
    const create = event.code === 'KeyN' && !event.shiftKey && !event.altKey;

    if ((!save && !open && !create) || save && event.shiftKey && event.altKey) { return; }
    // Cancel browser commands synchronously, then execute after the current edits have been drawn.
    event.preventDefault();
    if (!event.repeat && !workspace.busy && !projects.busy && !workspace.dialog && !workspace.error) {
      this.fileShortcut = create ? 'new' : save ? event.altKey ? 'saveAs' : event.shiftKey ? 'saveAll' : 'save' : 'open';
    }
  };

  drawFileMenu (): void {
    if (!beginEditorMenu('File', true, true)) { return; }
    ImGui.BeginDisabled(projects.busy || workspace.busy);
    editorMenuSection('Open');
    commandMenuItem('scene.new');
    commandMenuItem('scene.open');
    editorMenuSection('Save', true);
    commandMenuItem('scene.save');
    commandMenuItem('scene.save-as');
    commandMenuItem('scene.save-all');
    editorMenuSection('Project', true);
    commandMenuItem('project.new');
    commandMenuItem('project.open');
    if (beginEditorMenu('Recent Projects', projects.recent.length > 0)) {
      for (const project of projects.recent) { if (editorMenuItem(project.name, '', project.id === projects.current?.id)) { void projects.open(project.id); } }
      ImGui.Separator();
      if (editorMenuItem('Browse Recent Projects...')) { projectBrowser.show('recent'); }
      if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { ImGui.CloseCurrentPopup(); }
      endEditorMenu();
    }
    ImGui.Separator();
    commandMenuItem('project.import');
    commandMenuItem('project.export');
    ImGui.EndDisabled();
    if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { ImGui.CloseCurrentPopup(); }
    endEditorMenu();
  }

  drawEditMenu (): void {
    if (!beginEditorMenu('Edit', true, true)) { return; }
    commandMenuItem('document.undo');
    commandMenuItem('document.redo');
    ImGui.Separator();
    commandMenuItem('project.settings');
    endEditorMenu();
  }

  shortcuts (): void {
    const io = ImGui.GetIO();
    const shortcut = this.fileShortcut;

    this.fileShortcut = undefined;
    if (workspace.busy || projects.busy || workspace.dialog || workspace.error) { return; }
    if (shortcut === 'new') {
      editorCommands.execute('scene.new');

      return;
    }
    if (shortcut === 'save' || shortcut === 'saveAs') {
      if (shortcut === 'saveAs') { editorCommands.execute('scene.save-as'); } else if (!saveFocusedAsset()) { editorCommands.execute('scene.save'); }

      return;
    }
    if (shortcut === 'saveAll') {
      editorCommands.execute('scene.save-all');

      return;
    }
    if (io.WantTextInput || ImGui.IsAnyItemActive() || ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup)) { return; }
    if (shortcut === 'open') {
      editorCommands.execute('scene.open');

      return;
    }
    if (!(io.KeyCtrl || io.KeySuper)) { return; }
    if (ImGui.IsKeyPressed(ImGui.Key.Z, false)) {
      if (io.KeyShift) { editorCommands.execute('document.redo'); } else { editorCommands.execute('document.undo'); }
    } else if (ImGui.IsKeyPressed(ImGui.Key.Y, false)) { editorCommands.execute('document.redo'); }
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
    projectBrowser.draw();
  }

  private drawOpen (): void {
    ImGui.TextDisabled('Scenes in ' + (projects.current?.name ?? 'the current project'));
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
    if (ImGui.BeginCombo('##SceneFolder', assetLibrary.pathText(workspace.saveFolder))) {
      const folders = [{ id: ASSET_ROOT, name: '/Game' }, ...assetLibrary.entries.filter(entry => entry.kind === 'folder' && !entry.deletedAt)
        .map(entry => ({ id: entry.id, name: assetLibrary.pathText(entry.id) })).sort((a, b) => a.name.localeCompare(b.name))];

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
    ImGui.TextWrapped('Save changes to "' + workspace.current?.name + '" before ' + workspace.pendingDescription + '?');
    ImGui.Spacing();
    if (ImGui.Button('Save', new ImGui.Vec2(90, 0))) { editorCommands.execute('scene.save'); }
    ImGui.SameLine();
    if (ImGui.Button('Discard', new ImGui.Vec2(90, 0))) { workspace.discardAndOpen(); }
    ImGui.SameLine();
    if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0))) { workspace.cancelOpen(); }
  }
}
