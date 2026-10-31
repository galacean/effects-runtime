import { MouseButton } from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton, math } from '@galacean/effects';
import { AutowrapMode, Container, FocusMode, Label, MouseFilter, TextOverflow } from '@galacean/effects-plugin-gui';
import { append, place } from '../../../ui/controls/layout';
import { setTooltip } from '../../../ui/controls/tooltip';
import { VirtualList } from '../../../ui/controls/virtual-list';
import { paintIcon } from '../../../ui/icons/control-icons';
import { color, editorBox, editorColors as C, EDITOR_COMPACT_FONT_SIZE, EDITOR_FONT, EDITOR_FONT_SIZE } from '../../../ui/theme/control-theme';
import type { ProjectRecord } from '../project-types';

interface ProjectTileActions {
  selected: (id: string) => boolean, choose: (id: string) => void, open: (id: string) => void,
  context: (id: string, position: math.Vector2) => void, key: (event: InputEventKey) => void,
}

class ProjectTile extends Container {
  private project!: ProjectRecord;
  private readonly name: Label;
  private readonly date: Label;
  private hovered = false;
  private foreground = C.foreground;
  constructor (engine: Engine, private readonly actions: ProjectTileActions) {
    super(engine); this.focusMode = FocusMode.All; this.clipContents = true;
    this.name = append(this, new Label(engine)); this.name.autowrapMode = AutowrapMode.WordSmart; this.name.textOverflow = TextOverflow.Ellipsis;
    this.date = append(this, new Label(engine)); this.date.textOverflow = TextOverflow.Ellipsis;
    for (const caption of [this.name, this.date]) { caption.setThemeFontSizeOverride('fontSize', EDITOR_COMPACT_FONT_SIZE); }
  }
  bind (project: ProjectRecord): void {
    this.project = project; this.name.text = project.name; this.date.text = new Date(project.lastOpenedAt).toLocaleDateString();
    setTooltip(this, project.name + (project.description ? '\n' + project.description : ''));
  }
  protected override sortChildren (): void { place(this.name, 5, 107, 96, 30); place(this.date, 5, 139, 96, 14); }
  override draw (): void {
    const selected = this.actions.selected(this.project.id), tint = selected ? this.hovered ? C.primaryHover : C.primary : this.hovered ? C.hover : C.header;
    const image = editorBox(color('474747'), 0, 4), name = editorBox(tint, 0, 4);

    image.setCornerRadii(4, 4, 0, 0); name.setCornerRadii(0, 0, 4, 4);
    this.drawStyleBox(image, 2, 2, 102, 102); this.drawStyleBox(name, 2, 104, 102, 51);
    paintIcon(this, 'project', 27, 27, 52, C.foreground);
    if (selected || this.hovered) { this.drawStyleBox(editorBox(C.clear, 0, 4, selected ? this.hovered ? C.primaryHover : C.primary : C.hover), 2, 2, 102, 153); }
  }
  override onMouseEnter (): void { this.hovered = true; }
  override onMouseLeave (): void { this.hovered = false; }
  override onMouseDown (event: InputEventMouseButton): void {
    this.grabFocus(); this.actions.choose(this.project.id);
    if (event.buttonIndex === MouseButton.Left && event.doubleClick) { this.actions.open(this.project.id); } else if (event.buttonIndex === MouseButton.Right) { this.actions.context(this.project.id, event.globalPosition); }
    event.accept();
  }
  override onKeyDown (event: InputEventKey): void { this.actions.key(event); }
  override update (dt: number): void {
    const foreground = this.actions.selected(this.project.id) || this.hovered ? C.foregroundHover : C.foreground;

    if (foreground !== this.foreground) { this.foreground = foreground; this.name.setThemeColorOverride('fontColor', foreground); this.date.setThemeColorOverride('fontColor', foreground); }
    super.update(dt);
  }
}

class ProjectTileRow extends Container {
  private tiles: ProjectTile[] = [];
  constructor (engine: Engine, private readonly actions: ProjectTileActions) { super(engine); this.mouseFilter = MouseFilter.Pass; }
  bind (projects: ProjectRecord[]): void {
    while (this.tiles.length > projects.length) { this.tiles.pop()!.dispose(); }
    while (this.tiles.length < projects.length) { this.tiles.push(append(this, new ProjectTile(this.engine, this.actions))); }
    projects.forEach((project, index) => this.tiles[index].bind(project)); this.queueSort();
  }
  protected override sortChildren (): void { this.tiles.forEach((tile, index) => place(tile, index * 111, 0, 107, 158)); }
}

export class ProjectTileView extends VirtualList<ProjectRecord[]> {
  columns = 1;
  private projects: ProjectRecord[] = [];
  constructor (engine: Engine, actions: ProjectTileActions) {
    super(engine, 162, projects => projects.map(project => project.id).join(','), () => new ProjectTileRow(engine, actions));
    this.emptyText = 'No matching projects'; this.on('sizeChanged', () => this.reflow());
  }
  setItems (projects: ProjectRecord[]): void { this.projects = projects; this.reflow(); }
  protected override drawEmpty (): void {
    const width = this.measureText(this.emptyText, EDITOR_FONT_SIZE, EDITOR_FONT).width;

    this.drawText(Math.max(8, (this.width - width) / 2), 25, this.emptyText, EDITOR_FONT_SIZE, C.foreground, EDITOR_FONT);
  }
  revealProject (id: string): void {
    const index = this.projects.findIndex(project => project.id === id), start = Math.floor(index / this.columns) * this.columns;

    if (index >= 0) { this.reveal(this.projects.slice(start, start + this.columns).map(project => project.id).join(',')); }
  }
  private reflow (): void {
    this.columns = Math.max(1, Math.floor((this.width - 14) / 111));
    const rows: ProjectRecord[][] = [];

    for (let index = 0; index < this.projects.length; index += this.columns) { rows.push(this.projects.slice(index, index + this.columns)); }
    this.setRows(rows);
  }
}
