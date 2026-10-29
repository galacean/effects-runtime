import { ImGui } from '../../../platform/imgui/index';
import { PropertyFields as Fields } from '../../../ui/property-editor/property-fields';
import { PropertyGrid, PropertyGridState } from '../../../ui/property-editor/property-grid';
import { editorTileColor } from '../../../ui/theme/editor-interaction';
import { beginEditorContextItem, editorMenuItem, endEditorPopup } from '../../../ui/widgets/editor-menu';
import { searchBar } from '../../../ui/widgets/search-bar';
import { assetLibrary } from '../../assets/asset-library';
import { CONTENT_COLORS as C, contentIcon, contentText, contentWindowBackground, contentWrappedText } from '../../content-browser/content-style';
import type { ProjectRecord } from '../project-types';
import { projectWorkspace as projects } from '../project-workspace';

type BrowserMode = 'open' | 'recent' | 'new';

export class ProjectBrowserDialog {
  private opened = false;
  private request = false;
  private mode: BrowserMode = 'open';
  private selected?: string;
  private search: [string] = [''];
  private name: [string] = [''];
  private description: [string] = [''];
  private focusName = false;
  private showDeleted = false;
  private deleteId?: string;
  private deleteRequested = false;
  private childMenu = false;
  private settingsOpen = false;
  private settingsVisible = false;
  private settingsRequested = false;
  private settingsName: [string] = [''];
  private settingsDescription: [string] = [''];
  private startup?: string;
  private readonly settingsGrid = new PropertyGridState();

  show (mode: BrowserMode = 'open'): void {
    this.mode = mode; this.opened = true; this.request = true; this.search[0] = ''; this.showDeleted = false;
    projects.error = '';
    this.selected = projects.current?.id; this.focusName = mode === 'new';
    if (mode === 'new') { this.name[0] = ''; this.description[0] = ''; }
    void projects.refresh();
  }

  showSettings (): void {
    const current = projects.current;

    if (!current) { return; }
    this.settingsName[0] = current.name; this.settingsDescription[0] = current.description;
    this.startup = current.startupSceneId; this.settingsOpen = true; this.settingsRequested = true;
  }

  draw (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(12, 12));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(8, 5));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 8));
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 3);
    ImGui.PushStyleColor(ImGui.Col.PopupBg, new ImGui.Vec4(0.141, 0.141, 0.141, 1));
    ImGui.PushStyleColor(ImGui.Col.ChildBg, new ImGui.Vec4(0.102, 0.102, 0.102, 1));
    ImGui.PushStyleColor(ImGui.Col.FrameBg, new ImGui.Vec4(0.059, 0.059, 0.059, 1));
    ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Vec4(0.22, 0.22, 0.22, 1));
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.Vec4(0.34, 0.34, 0.34, 1));
    ImGui.PushStyleColor(ImGui.Col.Header, new ImGui.Vec4(0.22, 0.22, 0.22, 1));
    ImGui.PushStyleColor(ImGui.Col.HeaderHovered, new ImGui.Vec4(0.34, 0.34, 0.34, 1));
    ImGui.PushStyleColor(ImGui.Col.HeaderActive, new ImGui.Vec4(0, 0.44, 0.88, 1));
    this.drawBrowser(); this.drawSettings(); this.drawError();
    ImGui.PopStyleColor(8); ImGui.PopStyleVar(4);
  }

  private size (width: number, height: number): void {
    const display = ImGui.GetIO().DisplaySize;

    ImGui.SetNextWindowSize(new ImGui.Vec2(Math.min(width, display.x - 24), Math.min(height, display.y - 36)), ImGui.Cond.Always);
    ImGui.SetNextWindowPos(new ImGui.Vec2(display.x / 2, display.y / 2), ImGui.Cond.Appearing, new ImGui.Vec2(0.5, 0.5));
  }

  private drawBrowser (): void {
    if (this.request) { ImGui.OpenPopup('Project Browser'); this.request = false; }
    if (!this.opened) { return; }
    this.size(860, 550);
    if (!ImGui.BeginPopupModal('Project Browser', value => {
      if (value !== undefined) { this.opened = value; }

      return this.opened;
    }, ImGui.WindowFlags.NoResize | ImGui.WindowFlags.NoSavedSettings)) { return; }
    contentWindowBackground();
    ImGui.BeginDisabled(projects.busy);
    this.childMenu = false;
    const area = ImGui.GetContentRegionAvail(), sidebar = Math.min(166, area.x * 0.25);

    ImGui.BeginChild('##ProjectNavigation', new ImGui.Vec2(sidebar, area.y - 46));
    ImGui.TextDisabled('PROJECTS'); ImGui.Spacing();
    for (const [mode, label] of [['open', 'My Projects'], ['recent', 'Recent Projects'], ['new', 'New Project']] as const) {
      if (ImGui.Selectable(label, this.mode === mode, ImGui.SelectableFlags.None, new ImGui.Vec2(0, 32))) { this.mode = mode; this.focusName = mode === 'new'; this.showDeleted = false; }
    }
    ImGui.Spacing(); ImGui.Separator(); ImGui.Spacing();
    ImGui.TextDisabled('CURRENT PROJECT'); ImGui.PushTextWrapPos(); ImGui.TextWrapped(projects.current?.name ?? ''); ImGui.PopTextWrapPos();
    ImGui.EndChild(); ImGui.SameLine();
    ImGui.BeginChild('##ProjectMain', new ImGui.Vec2(0, area.y - 46), ImGui.ChildFlags.AlwaysUseWindowPadding);
    if (projects.error) { ImGui.TextWrapped(projects.error); }
    if (this.mode === 'new') { this.drawNew(); } else { this.drawProjects(); }
    ImGui.EndChild();
    ImGui.Separator();
    this.drawFooter();
    ImGui.EndDisabled();
    const deleting = !!this.deleteId;

    this.drawDelete();
    if (ImGui.IsKeyPressed(ImGui.Key.Escape, false) && !deleting && !this.childMenu) { this.opened = false; }
    if (!this.opened) { ImGui.CloseCurrentPopup(); }
    ImGui.EndPopup();
  }

  private drawNew (): void {
    ImGui.Text('New Project'); ImGui.TextDisabled('Choose a starting point for your project.'); ImGui.Spacing();
    const p = ImGui.GetCursorScreenPos(), draw = ImGui.GetWindowDrawList();

    draw.AddRectFilled(p, new ImGui.Vec2(p.x + 150, p.y + 114), C.recessed, 4);
    draw.AddRect(p, new ImGui.Vec2(p.x + 150, p.y + 114), C.selection, 4, 0, 2);
    contentIcon('project', p.x + 49, p.y + 14, 52, C.text);
    contentText('Blank', p.x + 54, p.y + 84, C.white);
    ImGui.Dummy(new ImGui.Vec2(150, 114));
    ImGui.TextDisabled('An empty Main scene and a separate asset library.'); ImGui.Spacing();
    ImGui.Text('Project Name'); ImGui.SetNextItemWidth(-1);
    if (this.focusName) { ImGui.SetKeyboardFocusHere(); this.focusName = false; }
    ImGui.InputText('##NewProjectName', this.name, 256);
    ImGui.Text('Description'); ImGui.SetNextItemWidth(-1);
    ImGui.InputTextMultiline('##NewProjectDescription', this.description, 4097, new ImGui.Vec2(-1, 64));
    ImGui.TextDisabled('Saved locally in this browser.');
    if (this.duplicateName) { ImGui.TextColored(new ImGui.Vec4(0.9, 0.35, 0.3, 1), 'A project with this name already exists.'); }
  }

  private get duplicateName (): boolean {
    return projects.projects.some(project => !project.deletedAt && project.name.toLowerCase() === this.name[0].trim().toLowerCase());
  }

  private drawProjects (): void {
    searchBar('##ProjectSearch', this.search, { hint: 'Search projects' });
    ImGui.Spacing();
    const query = this.search[0].trim().toLowerCase();
    const entries = (this.mode === 'recent' && !this.showDeleted ? projects.recent : projects.projects)
      .filter(project => !!project.deletedAt === this.showDeleted && (project.name + ' ' + project.description).toLowerCase().includes(query))
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    const height = ImGui.GetContentRegionAvail().y;

    if (this.selected && !entries.some(project => project.id === this.selected)) { this.selected = undefined; }

    ImGui.BeginChild('##ProjectCards', new ImGui.Vec2(0, height));
    const width = 166, columns = Math.max(1, Math.floor((ImGui.GetContentRegionAvail().x + 10) / (width + 10)));

    for (let index = 0; index < entries.length; index++) {
      if (index % columns) { ImGui.SameLine(0, 10); }
      this.drawCard(entries[index], width);
    }
    if (!entries.length) { ImGui.TextDisabled(this.showDeleted ? 'No deleted projects.' : 'No projects match your search.'); }
    if (!ImGui.GetIO().WantTextInput && !this.showDeleted && entries.length && ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows)) {
      const index = Math.max(0, entries.findIndex(project => project.id === this.selected));
      const delta = ImGui.IsKeyPressed(ImGui.Key.RightArrow) ? 1 : ImGui.IsKeyPressed(ImGui.Key.LeftArrow) ? -1 : ImGui.IsKeyPressed(ImGui.Key.DownArrow) ? columns : ImGui.IsKeyPressed(ImGui.Key.UpArrow) ? -columns : 0;

      if (delta) { this.selected = entries[Math.max(0, Math.min(entries.length - 1, index + delta))].id; }
      if (ImGui.IsKeyPressed(ImGui.Key.Enter, false) && this.selected) { this.openSelected(); }
    }
    ImGui.EndChild();
  }

  private drawCard (project: ProjectRecord, width: number): void {
    ImGui.PushID(project.id); ImGui.BeginGroup();
    const p = ImGui.GetCursorScreenPos(), height = 164, selected = this.selected === project.id, draw = ImGui.GetWindowDrawList();

    if (ImGui.InvisibleButton('##Project', new ImGui.Vec2(width, height))) { this.selected = project.id; }
    const hovered = ImGui.IsItemHovered();
    const background = ImGui.GetColorU32(editorTileColor(selected, hovered));

    draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + height), background, 4);
    draw.AddRectFilled(new ImGui.Vec2(p.x + 2, p.y + 2), new ImGui.Vec2(p.x + width - 2, p.y + 94), C.recessed, 3);
    contentIcon('project', p.x + (width - 64) / 2, p.y + 12, 64, project.deletedAt ? C.faint : C.text);
    if (selected || hovered) { draw.AddRect(p, new ImGui.Vec2(p.x + width, p.y + height), background, 4, 0, 2); }
    contentWrappedText(project.name, p.x + 9, p.y + 101, width - 18, 2, selected ? C.white : C.text);
    contentText(project.id === projects.current?.id ? 'Current Project' : new Date(project.lastOpenedAt).toLocaleDateString(), p.x + 9, p.y + 144, selected ? C.white : C.muted, width - 18, ImGui.GetFontSize() * 0.85);
    if (hovered && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left) && !project.deletedAt) { this.selected = project.id; this.openSelected(); }
    if (hovered && ImGui.IsMouseClicked(ImGui.MouseButton.Right)) { this.selected = project.id; }
    if (beginEditorContextItem('##ProjectContext')) {
      this.childMenu = true;
      if (project.deletedAt) {
        if (editorMenuItem('Restore')) { void projects.trash(project.id, true); }
      } else {
        if (editorMenuItem('Open')) { this.selected = project.id; this.openSelected(); }
        if (editorMenuItem('Delete Project...', '', false, project.id !== projects.current?.id)) { this.deleteId = project.id; this.deleteRequested = true; }
      }
      if (ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { ImGui.CloseCurrentPopup(); }
      endEditorPopup();
    }
    if (hovered && ImGui.IsItemHovered(ImGui.HoveredFlags.DelayNormal) && !ImGui.IsMouseDown(ImGui.MouseButton.Left)) {
      ImGui.BeginTooltip(); ImGui.Text(project.name);
      if (project.description) { ImGui.PushTextWrapPos(320); ImGui.TextWrapped(project.description); ImGui.PopTextWrapPos(); }
      ImGui.EndTooltip();
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + height)); ImGui.Dummy(new ImGui.Vec2(width, 0));
    ImGui.EndGroup(); ImGui.PopID();
  }

  private openSelected (): void {
    if (!this.selected) { return; }
    this.opened = false; void projects.open(this.selected);
  }

  private drawFooter (): void {
    const width = ImGui.GetContentRegionAvail().x, p = ImGui.GetCursorScreenPos();
    const selected = projects.projects.find(project => project.id === this.selected && !!project.deletedAt === this.showDeleted);

    if (this.mode !== 'new') {
      if (ImGui.Button('Import Project...', new ImGui.Vec2(132, 30))) { this.opened = false; projects.chooseImport(); }
      ImGui.SameLine(); ImGui.Checkbox('Deleted Projects', value => {
        if (value !== undefined) { this.showDeleted = value; }

        return this.showDeleted;
      });
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x + width - 206, p.y));
    ImGui.BeginDisabled(this.mode === 'new' ? !this.name[0].trim() || this.name[0].trim().length > 80 || this.duplicateName : !selected);
    ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Vec4(0, 0.44, 0.88, 1));
    if (ImGui.Button(this.mode === 'new' ? 'Create' : this.showDeleted ? 'Restore' : 'Open', new ImGui.Vec2(104, 30))) {
      if (this.mode === 'new') { this.opened = false; void projects.create(this.name[0], this.description[0]); } else if (this.showDeleted && this.selected) { void projects.trash(this.selected, true); } else { this.openSelected(); }
    }
    ImGui.PopStyleColor(); ImGui.EndDisabled(); ImGui.SameLine();
    if (ImGui.Button('Cancel', new ImGui.Vec2(94, 30))) { this.opened = false; }
  }

  private drawDelete (): void {
    if (this.deleteRequested) { ImGui.OpenPopup('Delete Project'); this.deleteRequested = false; }
    if (this.deleteId) { this.size(460, 180); }
    if (ImGui.BeginPopupModal('Delete Project', null, ImGui.WindowFlags.NoResize | ImGui.WindowFlags.NoSavedSettings)) {
      ImGui.TextWrapped('Move "' + projects.projects.find(project => project.id === this.deleteId)?.name + '" to deleted projects?');
      ImGui.TextDisabled('Its scenes and assets can be restored together.'); ImGui.Spacing();
      if (ImGui.Button('Delete', new ImGui.Vec2(90, 0))) { if (this.deleteId) { void projects.trash(this.deleteId); } this.deleteId = undefined; ImGui.CloseCurrentPopup(); }
      ImGui.SameLine();
      if (ImGui.Button('Cancel', new ImGui.Vec2(90, 0)) || ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { this.deleteId = undefined; ImGui.CloseCurrentPopup(); }
      ImGui.EndPopup();
    }
  }

  private drawSettings (): void {
    if (this.settingsRequested) { ImGui.OpenPopup('Project Settings'); this.settingsRequested = false; this.settingsVisible = true; }
    if (!this.settingsVisible) { return; }
    this.size(660, 470);
    if (ImGui.BeginPopupModal('Project Settings', null, ImGui.WindowFlags.NoResize | ImGui.WindowFlags.NoSavedSettings)) {
      if (!this.settingsOpen) {
        ImGui.CloseCurrentPopup(); this.settingsVisible = false; ImGui.EndPopup();

        return;
      }
      contentWindowBackground(); ImGui.BeginDisabled(projects.busy);
      ImGui.Text(projects.current?.name ?? ''); ImGui.TextDisabled('Project identity and editor startup.'); ImGui.Spacing();
      const height = ImGui.GetContentRegionAvail().y - 78;

      ImGui.BeginChild('##ProjectSettingsFields', new ImGui.Vec2(0, height));
      PropertyGrid.begin(this.settingsGrid, '');
      PropertyGrid.category('General', 'General', ['Name', 'Description'], () => {
        Fields.Property('Project Name', width => {
          ImGui.SetNextItemWidth(width);

          return ImGui.InputText('##Name', this.settingsName, 256);
        });
        Fields.Property('Description', width => ImGui.InputTextMultiline('##Description', this.settingsDescription, 4097, new ImGui.Vec2(width, 72)));
      });
      PropertyGrid.category('Startup', 'Startup', ['Editor Startup Scene'], () => {
        const scenes = assetLibrary.entries.filter(entry => entry.kind === 'scene' && !entry.deletedAt);

        Fields.ComboField('Editor Startup Scene', next => {
          if (next !== undefined) { this.startup = scenes[next - 1]?.id; }

          return scenes.findIndex(scene => scene.id === this.startup) + 1;
        }, ['Last Opened Scene', ...scenes.map(scene => assetLibrary.pathText(scene.parentId) + '/' + scene.name)]);
      });
      PropertyGrid.end(); ImGui.EndChild();
      if (projects.error) { ImGui.TextWrapped(projects.error); }
      ImGui.TextDisabled('The startup scene opens when this project is opened.'); ImGui.Separator();
      ImGui.BeginDisabled(!this.settingsName[0].trim());
      ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Vec4(0, 0.44, 0.88, 1));
      if (ImGui.Button('Save Settings', new ImGui.Vec2(128, 30))) {
        void projects.settings({ name: this.settingsName[0], description: this.settingsDescription[0], startupSceneId: this.startup }).then(() => { if (!projects.error) { this.settingsOpen = false; } });
      }
      ImGui.PopStyleColor(); ImGui.EndDisabled(); ImGui.SameLine();
      if (ImGui.Button('Cancel', new ImGui.Vec2(90, 30)) || ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { this.settingsOpen = false; }
      ImGui.EndDisabled();
      if (!this.settingsOpen) { ImGui.CloseCurrentPopup(); this.settingsVisible = false; }
      ImGui.EndPopup();
    }
  }

  private drawError (): void {
    if (!projects.error || this.opened || this.settingsVisible) { return; }
    ImGui.OpenPopup('Project Error');
    this.size(500, 190);
    if (ImGui.BeginPopupModal('Project Error', null, ImGui.WindowFlags.NoResize | ImGui.WindowFlags.NoSavedSettings)) {
      ImGui.TextWrapped(projects.error); ImGui.Spacing();
      if (ImGui.Button('OK', new ImGui.Vec2(90, 0)) || ImGui.IsKeyPressed(ImGui.Key.Escape, false)) { projects.error = ''; ImGui.CloseCurrentPopup(); }
      ImGui.EndPopup();
    }
  }
}

export const projectBrowser = new ProjectBrowserDialog();
