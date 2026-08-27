import type {
  Engine,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
} from '@galacean/effects';
import {
  Control,
  CursorShape,
  FocusMode,
  MouseButton,
  MouseButtonMask,
  MouseFilter,
  math,
} from '@galacean/effects';
import {
  ColorRect,
  Label,
  Panel,
  TextOverflow,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import type { AppContext } from '../context';
import { attachAnchoredRect, placeNormalized } from '../layout';
import { getTheme, mix, setFontOverrides } from '../theme';
import { createButton, createSegmentedControl, createToggle } from '../widgets';

type Vector2 = math.Vector2;
type DragPayload = {
  source: InputEventControl,
  label: string,
};
type LogEntry = {
  owner: string,
  event: string,
  position?: Vector2,
};

const ownerColors = [
  new math.Color(0.49, 0.78, 1, 1),
  new math.Color(1, 0.69, 0.41, 1),
  new math.Color(0.43, 0.89, 0.64, 1),
  new math.Color(0.78, 0.61, 1, 1),
  new math.Color(1, 0.82, 0.40, 1),
  new math.Color(1, 0.56, 0.64, 1),
];

export class InputPage extends Control {
  constructor (engine: Engine, _ctx: AppContext) {
    super(engine);
    const theme = getTheme();
    const setPalette = (
      control: InputEventControl,
      hue: math.Color,
      normal: number,
      hover: number,
      pressed: number,
      border = 0.82,
    ): void => {
      control.fillColor = mix(theme.panelBg, hue, normal);
      control.hoverColor = mix(theme.panelBg, hue, hover);
      control.pressedColor = mix(theme.panelBg, hue, pressed);
      control.borderColor = mix(theme.panelBg, hue, border);
    };
    const inspector = new InputInspector(engine);
    const stage = new InputEventControl(engine, inspector);

    attachAnchoredRect(stage, this, 0, 0, 0.66, 1, 0, 0, 8, 0);
    attachAnchoredRect(inspector, this, 0.66, 0, 1, 1, 8, 0, 0, 0);
    stage.label = 'Stage (Pass)';
    stage.detail = 'Empty space remains unhandled';
    stage.mouseFilter = MouseFilter.Pass;
    stage.defaultCursorShape = CursorShape.Arrow;
    setPalette(stage, theme.cyan, 0.08, 0.15, 0.26, 0.34);
    stage.clipContents = true;

    const group = new InputEventControl(engine, inspector);

    placeNormalized(group, stage, 0.035, 0.12, 0.57, 0.76);
    group.label = 'Parent (Pass)';
    group.detail = 'Receives bubbled events from Pass children';
    group.mouseFilter = MouseFilter.Pass;
    setPalette(group, theme.violet, 0.16, 0.27, 0.40, 0.55);

    const back = new InputEventControl(engine, inspector);

    placeNormalized(back, group, 0.055, 0.18, 0.60, 0.48);
    back.label = 'Back (Pass)';
    back.detail = 'Visible through Ignore; bubbles to Parent';
    back.mouseFilter = MouseFilter.Pass;
    back.focusMode = FocusMode.Click;
    back.defaultCursorShape = CursorShape.Cross;
    setPalette(back, theme.accent, 0.42, 0.56, 0.68);

    const front = new InputEventControl(engine, inspector);

    placeNormalized(front, group, 0.33, 0.41, 0.60, 0.41);
    front.focusMode = FocusMode.Click;
    front.defaultCursorShape = CursorShape.PointingHand;
    setPalette(front, theme.warning, 0.40, 0.54, 0.68);
    front.detail = 'Change MouseFilter with the controls';

    const dropZone = new InputEventControl(engine, inspector);

    placeNormalized(dropZone, stage, 0.65, 0.12, 0.31, 0.37);
    dropZone.label = 'Drop zone';
    dropZone.detail = 'Drag the chip here';
    dropZone.mouseFilter = MouseFilter.Stop;
    dropZone.dropTarget = true;
    setPalette(dropZone, theme.success, 0.34, 0.48, 0.62);

    const target = new InputEventControl(engine, inspector);

    placeNormalized(target, stage, 0.65, 0.55, 0.31, 0.16);
    target.label = 'Target';
    target.detail = 'Stops input';
    target.mouseFilter = MouseFilter.Stop;
    target.focusMode = FocusMode.Click;
    target.defaultCursorShape = CursorShape.Cross;
    setPalette(target, theme.cyan, 0.36, 0.50, 0.64);

    const ignore = new InputEventControl(engine, inspector);

    placeNormalized(ignore, stage, 0.81, 0.565, 0.13, 0.13);
    ignore.label = 'Ignore';
    ignore.detail = 'Pass-through';
    ignore.mouseFilter = MouseFilter.Ignore;
    setPalette(ignore, theme.violet, 0.36, 0.50, 0.64);

    const dragChip = new InputEventControl(engine, inspector);

    placeNormalized(dragChip, stage, 0.69, 0.78, 0.22, 0.14);
    dragChip.label = 'Drag chip';
    dragChip.detail = 'Drag > 10 px to begin';
    dragChip.mouseFilter = MouseFilter.Stop;
    dragChip.draggable = true;
    dragChip.defaultCursorShape = CursorShape.Drag;
    setPalette(dragChip, theme.rose, 0.42, 0.56, 0.68);

    dropZone.onDrop = payload => {
      dropZone.detail = `${payload.label} accepted`;
      payload.source.detail = 'Dropped — drag again';
    };

    const filters = [MouseFilter.Stop, MouseFilter.Pass, MouseFilter.Ignore];
    const filterControl = createSegmentedControl(engine, ['Stop', 'Pass', 'Ignore'], 0, index => setFrontFilter(filters[index]));

    filterControl.control.setRect({ position: new math.Vector2(16, 40), size: new math.Vector2(192, 34) });
    filterControl.control.parent = inspector;
    const acceptToggle = createToggle(engine, 'Accept front events', false, value => {
      front.acceptMouseButtons = value;
      inspector.appendLog('settings', `event.accept = ${value}`);
    });

    acceptToggle.setRect({ position: new math.Vector2(16, 84), size: new math.Vector2(192, 36) });
    acceptToggle.parent = inspector;

    const cursorShapes = [CursorShape.Arrow, CursorShape.PointingHand, CursorShape.Cross, CursorShape.Drag];
    const cursorControl = createSegmentedControl(engine, ['Arrow', 'Hand', 'Cross', 'Drag'], 0, index => {
      stage.defaultCursorShape = cursorShapes[index];
      inspector.cursor = ['Arrow', 'Hand', 'Cross', 'Drag'][index];
      inspector.appendLog('settings', `cursor = ${inspector.cursor}`);
    });

    cursorControl.control.setRect({ position: new math.Vector2(16, 150), size: new math.Vector2(192, 32) });
    cursorControl.control.parent = inspector;
    const clear = createButton(engine, 'Clear log', () => {
      inspector.clearLogs();
    }, 'ghost');

    clear.setRect({ position: new math.Vector2(148, 350), size: new math.Vector2(60, 28) });
    clear.parent = inspector;

    function setFrontFilter (filter: MouseFilter): void {
      front.mouseFilter = filter;
      front.label = `Front (${MouseFilter[filter]})`;
      inspector.filter = MouseFilter[filter];
      filterControl.select(filters.indexOf(filter));
      inspector.appendLog('settings', `Front = ${MouseFilter[filter]}`);
    }

    setFrontFilter(MouseFilter.Stop);
    inspector.appendLog('ready', 'Control input demo');
  }
}

class InputInspector extends Panel {
  private readonly statusValues: Label[] = [];
  private readonly logRows: Array<{ owner: Label, event: Label }> = [];
  private readonly logHeader: Label;
  private readonly emptyLog: Label;
  private _filter = 'Stop';
  private _handled = false;
  private _focusOwner = 'none';
  private _drag = 'idle';
  private _cursor = 'Arrow';
  readonly logs: LogEntry[] = [];

  constructor (engine: Engine) {
    super(engine);
    const theme = getTheme();

    this.addText('INPUT SETTINGS', 16, 12, 192, 20, 9, theme.textTertiary, 700);
    this.addText('CURSOR SHAPE', 16, 124, 192, 20, 9, theme.textTertiary, 700);
    this.addText('RUNTIME STATUS', 16, 196, 192, 20, 9, theme.textTertiary, 700);
    ['Mouse filter', 'Input handled', 'Key focus', 'Drag state', 'Cursor'].forEach((name, index) => {
      const y = 220 + index * 23;

      this.addText(name, 16, y, 94, 20, 9, theme.textTertiary, 600);
      this.statusValues.push(this.addText('', 112, y, 96, 20, 10, theme.textPrimary, 650));
    });
    this.logHeader = this.addText('EVENT LOG · 0', 16, 346, 126, 28, 9, theme.textTertiary, 700);
    const divider = new ColorRect(engine);

    divider.color = theme.borderSubtle;
    divider.setRect({ position: new math.Vector2(16, 380), size: new math.Vector2(192, 1) });
    divider.parent = this;
    this.emptyLog = this.addText('Move or click inside the stage', 16, 390, 192, 24, 10, theme.textTertiary, 500);
    for (let index = 0; index < 4; index++) {
      const y = 390 + index * 24;

      this.logRows.push({
        owner: this.addText('', 16, y, 66, 20, 9, theme.accent, 650),
        event: this.addText('', 84, y, 124, 20, 9, theme.textSecondary, 500),
      });
    }
    this.refreshStatus();
    this.refreshLog();
  }

  get filter (): string {
    return this._filter;
  }

  set filter (value: string) {
    this._filter = value;
    this.refreshStatus();
  }

  get handled (): boolean {
    return this._handled;
  }

  set handled (value: boolean) {
    this._handled = value;
    this.refreshStatus();
  }

  get focusOwner (): string {
    return this._focusOwner;
  }

  set focusOwner (value: string) {
    this._focusOwner = value;
    this.refreshStatus();
  }

  get drag (): string {
    return this._drag;
  }

  set drag (value: string) {
    this._drag = value;
    this.refreshStatus();
  }

  get cursor (): string {
    return this._cursor;
  }

  set cursor (value: string) {
    this._cursor = value;
    this.refreshStatus();
  }

  appendLog (owner: string, event: string, position?: Vector2): void {
    this.logs.unshift({ owner, event, position: position?.clone() });
    this.logs.length = Math.min(this.logs.length, 80);
    this.refreshLog();
  }

  clearLogs (): void {
    this.logs.length = 0;
    this.refreshLog();
  }

  private addText (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    color: math.Color,
    weight: number,
  ): Label {
    const control = new Label(this.engine, text);

    setFontOverrides(control, { size, weight, color });
    control.textOverflow = TextOverflow.Ellipsis;
    control.verticalAlignment = VerticalAlignment.Center;
    control.mouseFilter = MouseFilter.Ignore;
    control.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
    control.parent = this;

    return control;
  }

  private refreshStatus (): void {
    if (this.statusValues.length === 0) {
      return;
    }
    const theme = getTheme();
    const values = [this._filter, String(this._handled), this._focusOwner, this._drag, this._cursor];

    this.statusValues.forEach((control, index) => {
      control.text = values[index];
      control.setThemeColorOverride('fontColor', index === 1
        ? this._handled ? theme.warning : theme.success
        : theme.textPrimary);
    });
  }

  private refreshLog (): void {
    this.logHeader.text = `EVENT LOG · ${this.logs.length}`;
    this.emptyLog.visible = this.logs.length === 0;
    this.logRows.forEach((row, index) => {
      const entry = this.logs[index];

      row.owner.visible = Boolean(entry);
      row.event.visible = Boolean(entry);
      if (entry) {
        row.owner.text = entry.owner;
        row.owner.setThemeColorOverride('fontColor', getOwnerColor(entry.owner));
        row.event.text = entry.position
          ? `${entry.event} · ${entry.position.x.toFixed(0)},${entry.position.y.toFixed(0)}`
          : entry.event;
      }
    });
  }
}

class InputEventControl extends Control {
  private readonly titleControl: Label;
  private readonly detailControl: Label;
  private _label = 'Control';
  private _detail = '';
  fillColor: math.Color;
  hoverColor: math.Color;
  pressedColor: math.Color;
  borderColor: math.Color;
  acceptMouseButtons = false;
  draggable = false;
  dropTarget = false;
  onDrop?: (payload: DragPayload) => void;

  private hovered = false;
  private pressed = false;

  constructor (engine: Engine, private readonly inspector: InputInspector) {
    super(engine);
    const theme = getTheme();

    this.fillColor = mix(theme.panelBg, theme.accent, 0.12);
    this.hoverColor = mix(theme.panelBg, theme.accent, 0.22);
    this.pressedColor = mix(theme.panelBg, theme.accent, 0.36);
    this.borderColor = mix(theme.panelBg, theme.accent, 0.58);
    this.titleControl = new Label(engine, this._label);
    setFontOverrides(this.titleControl, { size: 12, weight: 650, color: theme.textPrimary });
    this.titleControl.textOverflow = TextOverflow.Ellipsis;
    this.titleControl.verticalAlignment = VerticalAlignment.Center;
    this.titleControl.mouseFilter = MouseFilter.Ignore;
    attachAnchoredRect(this.titleControl, this, 0, 0, 1, 0, 13, 7, 13, -30);
    this.detailControl = new Label(engine);
    setFontOverrides(this.detailControl, { size: 10, color: theme.textSecondary });
    this.detailControl.textOverflow = TextOverflow.Ellipsis;
    this.detailControl.verticalAlignment = VerticalAlignment.Center;
    this.detailControl.mouseFilter = MouseFilter.Ignore;
    attachAnchoredRect(this.detailControl, this, 0, 0, 1, 0, 13, 31, 13, -52);
    this.on('sizeChanged', () => {
      this.detailControl.visible = this._detail.length > 0 && this.height >= 54;
    });
  }

  get label (): string {
    return this._label;
  }

  set label (value: string) {
    this._label = value;
    this.titleControl.text = value;
  }

  get detail (): string {
    return this._detail;
  }

  set detail (value: string) {
    this._detail = value;
    this.detailControl.text = value;
    this.detailControl.visible = value.length > 0 && this.height >= 54;
  }

  override draw (): void {
    const color = this.pressed ? this.pressedColor : this.hovered ? this.hoverColor : this.fillColor;

    this.fillRect(0, 0, this.width, this.height, color);
    this.drawRect(0, 0, this.width, this.height, this.borderColor, 1);
  }

  override onMouseEnter (location: Vector2): void {
    this.hovered = true;
    this.inspector.appendLog(this.label, 'mouse enter', location);
  }

  override onMouseLeave (): void {
    this.hovered = false;
    this.pressed = false;
    this.inspector.appendLog(this.label, 'mouse exit');
  }

  override onMouseDown (event: InputEventMouseButton): void {
    this.pressed = event.buttonIndex === MouseButton.Left;
    this.inspector.appendLog(this.label, `mouse down (${MouseButton[event.buttonIndex]})`, event.position);
    if (this.acceptMouseButtons) {
      this.inspector.appendLog(this.label, 'event.accept()');
      event.accept();
    }
    this.reportHandled();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    this.pressed = false;
    this.inspector.appendLog(this.label, `mouse up (${MouseButton[event.buttonIndex]})`, event.position);
    if (this.acceptMouseButtons) {
      this.inspector.appendLog(this.label, 'event.accept()');
      event.accept();
    }
    this.reportHandled();
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    if ((event.buttonMask & MouseButtonMask.Left) !== 0) {
      this.inspector.appendLog(this.label, 'mouse drag', event.position);
    }
    this.reportHandled();
  }

  override onMouseWheel (event: InputEventMouseButton): void {
    const direction = event.buttonIndex === MouseButton.WheelUp || event.buttonIndex === MouseButton.WheelLeft ? 1 : -1;

    this.inspector.appendLog(this.label, `wheel (${(direction * event.factor).toFixed(0)})`, event.position);
    this.reportHandled();
  }

  override onGotFocus (): void {
    this.inspector.focusOwner = this.label;
    this.inspector.appendLog(this.label, 'focus enter');
  }

  override onLostFocus (): void {
    this.inspector.focusOwner = 'none';
    this.inspector.appendLog(this.label, 'focus exit');
  }

  override onKeyDown (event: InputEventKey): void {
    this.inspector.appendLog(this.label, `key down (${event.keycode})`);
    this.reportHandled();
  }

  override onKeyUp (event: InputEventKey): void {
    this.inspector.appendLog(this.label, `key up (${event.keycode})`);
    this.reportHandled();
  }

  protected override getDragData (position: Vector2): DragPayload | null {
    if (!this.draggable) {
      return null;
    }
    this.inspector.appendLog(this.label, 'drag begin', position);
    this.inspector.drag = `dragging ${this.label}`;

    return { source: this, label: this.label };
  }

  protected override canDropData (_position: Vector2, data: unknown): boolean {
    return this.dropTarget && isDragPayload(data);
  }

  protected override dropData (position: Vector2, data: unknown): void {
    if (!isDragPayload(data)) {
      return;
    }
    this.inspector.appendLog(this.label, `drop ${data.label}`, position);
    this.inspector.drag = `${data.label} dropped`;
    this.onDrop?.(data);
  }

  private reportHandled (): void {
    queueMicrotask(() => {
      if (!this.isDisposed) {
        this.inspector.handled = this.engine.windowRoot.isInputHandled();
      }
    });
  }
}

function isDragPayload (data: unknown): data is DragPayload {
  return typeof data === 'object' && data !== null
    && 'source' in data && data.source instanceof InputEventControl
    && 'label' in data && typeof data.label === 'string';
}

function getOwnerColor (owner: string): math.Color {
  let hash = 0;

  for (let index = 0; index < owner.length; index++) {
    hash = (hash * 31 + owner.charCodeAt(index)) >>> 0;
  }

  return ownerColors[hash % ownerColors.length];
}
