import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Popup } from '@galacean/effects-plugin-gui';
import { saveFocusedAsset } from '../../features/assets/editors/asset-editor-registry';
import { assetLibrary } from '../../features/assets/asset-library';
import { ContentAssetDialog } from '../../features/assets/ui/content-asset-dialog';
import { projectWorkspace as projects } from '../../features/projects/project-workspace';
import { projectBrowser } from '../../features/projects/ui/project-browser-dialog';
import { sceneWorkspace as workspace } from '../../features/scene/scene-workspace';
import { editorCommands } from '../../framework/commands/editor-commands';
import { EditorDialog } from '../../ui/controls/dialog';
import type { MenuAction } from '../../ui/controls/menu';
import { commandMenuItem } from '../../ui/menus/command-menu-item';

export class EditorMenus {
  closeActivePanel: () => void = () => {};
  private displayedDialog = '';
  private sceneDialog!: EditorDialog;
  private assetDialog!: ContentAssetDialog;
  private errorDialog!: EditorDialog;
  private source!: Control;
  private error = '';
  initialize (engine: Engine, source: Control): void {
    this.source = source; this.sceneDialog = new EditorDialog(engine); this.assetDialog = new ContentAssetDialog(engine); this.errorDialog = new EditorDialog(engine);
    this.sceneDialog.canceled = () => { workspace.cancelOpen(); this.displayedDialog = ''; };
    this.assetDialog.canceled = this.sceneDialog.canceled;
    this.errorDialog.canceled = () => { workspace.error = ''; projects.error = ''; this.error = ''; };
    projectBrowser.initialize(engine, source);
    window.addEventListener('keydown', this.onKeyDown, true);
  }
  shutdown (): void {
    window.removeEventListener('keydown', this.onKeyDown, true); this.sceneDialog.dispose(); this.assetDialog.dispose(); this.errorDialog.dispose(); projectBrowser.dispose();
  }
  fileActions (): MenuAction[] {
    return [{ label: 'Open', heading: true }, commandMenuItem('scene.new'), commandMenuItem('scene.open'),
      { label: 'Save', heading: true }, commandMenuItem('scene.save'), commandMenuItem('scene.save-as'), commandMenuItem('scene.save-all'),
      { label: 'Project', heading: true },
      commandMenuItem('project.new'), commandMenuItem('project.open'),
      { label: 'Recent Projects', children: [...projects.recent.map(project => ({ label: project.name, checked: project.id === projects.current?.id, action: () => { void projects.open(project.id); } })),
        { label: 'Browse Recent Projects…', action: () => projectBrowser.show('recent') }] },
      commandMenuItem('project.import'), commandMenuItem('project.export')];
  }
  editActions (): MenuAction[] { return [{ label: 'History', heading: true }, commandMenuItem('document.undo'), commandMenuItem('document.redo'), { label: 'Configuration', heading: true }, commandMenuItem('project.settings')]; }
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.isComposing || event.repeat) { return; }
    let command = '';

    if (event.code === 'KeyW' && !event.altKey && !event.shiftKey) { command = 'window.close-panel'; } else if (event.code === 'KeyS') { command = event.altKey ? 'scene.save-as' : event.shiftKey ? 'scene.save-all' : 'scene.save'; } else if (!event.altKey && !event.shiftKey && event.code === 'KeyN') { command = 'scene.new'; } else if (!event.altKey && !event.shiftKey && event.code === 'KeyO') { command = 'scene.open'; } else if (!(event.target instanceof HTMLTextAreaElement)) {
      if (event.code === 'KeyZ') { command = event.shiftKey ? 'document.redo' : 'document.undo'; } else if (event.code === 'KeyY') { command = 'document.redo'; }
    }
    if (!command) { return; }
    event.preventDefault(); event.stopImmediatePropagation();
    if (workspace.busy || projects.busy || workspace.dialog || workspace.error) { return; }
    for (let focus = this.source.root?.guiGetFocusOwner(); focus; focus = focus.parent) { if (focus instanceof Popup) { return; } }
    workspace.flushEdits();
    if (command === 'window.close-panel') {
      this.closeActivePanel();

      return;
    }
    if (command === 'scene.save' && saveFocusedAsset()) { return; }
    editorCommands.execute(command);
  };
  update (): void {
    projectBrowser.update();
    this.sceneDialog.body.enabled = !workspace.busy;
    this.assetDialog.body.enabled = this.assetDialog.beforeButtons.enabled = !workspace.busy;
    if (workspace.dialog !== this.displayedDialog) {
      this.sceneDialog.close(); this.assetDialog.close(); this.displayedDialog = workspace.dialog;
      if (workspace.dialog) { this.showSceneDialog(workspace.dialog); }
    }
    const error = workspace.error || (projectBrowser.displaysErrors ? '' : projects.error);

    if (error && error !== this.error) {
      this.error = error;
      this.errorDialog.show(this.source, workspace.error ? 'Scene Error' : 'Project Error', body => this.errorDialog.message(body, error),
        [{ label: 'OK', action: () => { workspace.error = ''; projects.error = ''; this.error = ''; this.errorDialog.close(); } }]);
    }
  }
  private showSceneDialog (kind: string): void {
    const dialog = this.sceneDialog;

    if (kind === 'open') {
      this.assetDialog.showAssets(this.source, 'Open Scene', {
        mode: 'open', kind: 'scene', folder: assetLibrary.preferences.folder, busy: () => workspace.busy,
        confirm: id => {
          const scene = workspace.scenes.find(scene => scene.id === id);

          if (scene) { workspace.dialog = ''; void workspace.openSaved(scene); }
        }, cancel: () => workspace.cancelOpen(),
      });
    } else if (kind === 'save') {
      this.assetDialog.showAssets(this.source, 'Save Scene As', {
        mode: 'save', kind: 'scene', folder: workspace.saveFolder, name: workspace.nameBuffer[0], busy: () => workspace.busy,
        changed: (folder, name) => { workspace.saveFolder = folder; workspace.nameBuffer[0] = name; },
        confirm: () => { void workspace.saveAs(); }, cancel: () => workspace.cancelOpen(),
      });
    } else if (kind === 'replace') {
      dialog.show(this.source, 'Replace Scene', body => dialog.message(body, 'A scene named "' + workspace.nameBuffer[0] + '" already exists. Replace its saved contents?'),
        [{ label: 'Replace', primary: true, action: () => { void workspace.replace(); } }, { label: 'Cancel', action: () => workspace.cancelOpen() }]);
    } else {
      dialog.show(this.source, 'Unsaved Changes', body => dialog.message(body, 'Save changes to "' + workspace.current?.name + '" before ' + workspace.pendingDescription + '?'), [
        { label: 'Save', primary: true, action: () => editorCommands.execute('scene.save') }, { label: 'Discard', action: () => workspace.discardAndOpen() },
        { label: 'Cancel', action: () => workspace.cancelOpen() },
      ]);
    }
  }
}
