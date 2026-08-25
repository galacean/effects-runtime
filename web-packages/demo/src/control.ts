import type {
  Engine,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
} from '@galacean/effects';
import {
  Composition,
  Control,
  CursorShape,
  FocusMode,
  MouseButton,
  MouseButtonMask,
  MouseFilter,
  Player,
  SizeFlags,
  math,
} from '@galacean/effects';
import {
  GridContainer,
  MarginContainer,
  ScrollContainer,
  VBoxContainer,
} from '@galacean/effects-plugin-gui';

const FONT_FAMILY = 'Inter, system-ui, sans-serif';
const MONO_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const palette = {
  background: new math.Color(0.025, 0.035, 0.055, 1),
  sidebar: new math.Color(0.04, 0.055, 0.085, 1),
  panel: new math.Color(0.055, 0.073, 0.11, 1),
  panelRaised: new math.Color(0.075, 0.098, 0.145, 1),
  border: new math.Color(0.18, 0.23, 0.32, 1),
  borderBright: new math.Color(0.31, 0.39, 0.52, 1),
  text: new math.Color(0.91, 0.94, 0.98, 1),
  muted: new math.Color(0.55, 0.61, 0.71, 1),
  faint: new math.Color(0.35, 0.41, 0.51, 1),
  accent: new math.Color(0.35, 0.63, 1, 1),
  accentSoft: new math.Color(0.12, 0.22, 0.38, 1),
  green: new math.Color(0.35, 0.86, 0.63, 1),
  orange: new math.Color(1, 0.61, 0.27, 1),
  red: new math.Color(0.96, 0.36, 0.43, 1),
};

type DemoID = 'input' | 'layout' | 'scroll';
type DemoDefinition = {
  id: DemoID,
  index: string,
  title: string,
  subtitle: string,
  eyebrow: string,
};

const demoDefinitions: DemoDefinition[] = [
  {
    id: 'input',
    index: '01',
    title: 'Control Input',
    subtitle: '鼠标过滤、焦点、事件冒泡与拖放',
    eyebrow: 'INPUT ROUTING',
  },
  {
    id: 'layout',
    index: '02',
    title: 'Automatic Layout',
    subtitle: '容器测量、网格分配与实时重排',
    eyebrow: 'LAYOUT SYSTEM',
  },
  {
    id: 'scroll',
    index: '03',
    title: 'Clip & Scroll',
    subtitle: '双轴滚动、嵌套滚动与旋转裁剪',
    eyebrow: 'SCROLL CONTAINER',
  },
];

function attachFullRect (
  control: Control,
  parent: Control,
  left = 0,
  top = 0,
  right = 0,
  bottom = 0,
): void {
  control.parent = parent;
  control.setAnchorMin(0, 0);
  control.setAnchorMax(1, 1);
  control.setOffsetMin(left, top);
  control.setOffsetMax(-right, -bottom);
}

function attachAnchoredRect (
  control: Control,
  parent: Control,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  left = 0,
  top = 0,
  right = 0,
  bottom = 0,
): void {
  control.parent = parent;
  control.setAnchorMin(minX, minY);
  control.setAnchorMax(maxX, maxY);
  control.setOffsetMin(left, top);
  control.setOffsetMax(-right, -bottom);
}

function fillRoundedRect (
  control: Control,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: math.Color,
): void {
  const actualRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  if (actualRadius === 0) {
    control.fillRect(x, y, width, height, color);

    return;
  }
  control.fillRect(x + actualRadius, y, width - actualRadius * 2, height, color);
  control.fillRect(x, y + actualRadius, width, height - actualRadius * 2, color);
  control.fillCircle(x + actualRadius, y + actualRadius, actualRadius, color);
  control.fillCircle(x + width - actualRadius, y + actualRadius, actualRadius, color);
  control.fillCircle(x + actualRadius, y + height - actualRadius, actualRadius, color);
  control.fillCircle(x + width - actualRadius, y + height - actualRadius, actualRadius, color);
}

function shorten (value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, Math.max(0, maximum - 1))}…`;
}

function getTextCellHeight (fontSize: number): number {
  // Graphics.drawText() uses the glyph cell's top-left corner. The atlas adds
  // four logical pixels of padding above and below the measured font height.
  return fontSize + 8;
}

function getVerticallyCenteredTextY (top: number, height: number, fontSize: number): number {
  return top + Math.max(0, (height - getTextCellHeight(fontSize)) / 2);
}

function estimateTextWidth (text: string, fontSize: number): number {
  let units = 0;

  for (const character of text) {
    if (/\s/.test(character)) {
      units += 0.34;
    } else {
      units += character.charCodeAt(0) > 255 ? 1 : 0.58;
    }
  }

  return units * fontSize;
}

function drawCenteredText (
  control: Control,
  top: number,
  height: number,
  text: string,
  fontSize: number,
  color: math.Color,
  fontFamily = FONT_FAMILY,
  fontWeight = 600,
): void {
  control.drawText(
    Math.max(0, (control.width - estimateTextWidth(text, fontSize)) / 2),
    getVerticallyCenteredTextY(top, height, fontSize),
    text,
    fontSize,
    color,
    fontFamily,
    fontWeight,
  );
}

abstract class ClickControl extends Control {
  protected hovered = false;
  protected pressed = false;

  constructor (engine: Engine, private readonly clickAction: () => void) {
    super(engine);
    this.defaultCursorShape = CursorShape.PointingHand;
  }

  override onMouseEnter (): void {
    this.hovered = true;
  }

  override onMouseLeave (): void {
    this.hovered = false;
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this.pressed = true;
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    const shouldClick = this.pressed && this.hasPoint(event.position);

    this.pressed = false;
    event.accept();
    if (shouldClick) {
      this.clickAction();
    }
  }
}

class TextButton extends ClickControl {
  selected = false;

  constructor (
    engine: Engine,
    private readonly label: string,
    clickAction: () => void,
    private readonly compact = false,
  ) {
    super(engine, clickAction);
  }

  override draw (): void {
    const background = this.selected
      ? palette.accentSoft
      : this.pressed
        ? new math.Color(0.12, 0.15, 0.21, 1)
        : this.hovered
          ? palette.panelRaised
          : palette.panel;
    const border = this.selected ? palette.accent : this.hovered ? palette.borderBright : palette.border;
    const textColor = this.selected ? new math.Color(0.7, 0.82, 1, 1) : palette.text;

    fillRoundedRect(this, 0, 0, this.width, this.height, this.compact ? 7 : 9, background);
    this.drawRect(0.5, 0.5, this.width - 1, this.height - 1, border, 1);
    drawCenteredText(this, 0, this.height, this.label, this.compact ? 12 : 13, textColor);
  }
}

class AppBackground extends Control {
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, palette.background);
    for (let x = 0; x < this.width; x += 32) {
      for (let y = 0; y < this.height; y += 32) {
        this.fillCircle(x, y, 0.7, new math.Color(0.18, 0.23, 0.32, 0.23));
      }
    }
  }
}

class Sidebar extends Control {
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, palette.sidebar);
    this.drawLine(this.width - 1, 0, this.width - 1, this.height, palette.border, 1);
    fillRoundedRect(this, 20, 24, 38, 38, 10, palette.accent);
    this.drawText(31, getVerticallyCenteredTextY(24, 38, 20), 'C', 20, math.Color.WHITE, FONT_FAMILY, 700);
    this.drawText(70, 27, 'CONTROL', 17, palette.text, FONT_FAMILY, 700);
    this.drawText(70, 51, 'PLAYGROUND', 10, palette.muted, FONT_FAMILY, 600);
    this.drawText(20, 125, 'DEMOS', 10, palette.faint, FONT_FAMILY, 700);

    this.drawLine(20, this.height - 76, this.width - 20, this.height - 76, palette.border, 1);
    this.fillCircle(27, this.height - 43, 4, palette.green);
    this.drawText(40, this.height - 54, 'Pure Control UI', 11, palette.muted, MONO_FONT_FAMILY, 500);
    this.drawText(20, this.height - 29, 'No DOM widgets', 10, palette.faint, MONO_FONT_FAMILY, 500);
  }
}

class NavButton extends ClickControl {
  selected = false;

  constructor (
    engine: Engine,
    private readonly definition: DemoDefinition,
    clickAction: () => void,
  ) {
    super(engine, clickAction);
  }

  override draw (): void {
    if (this.selected || this.hovered) {
      fillRoundedRect(
        this,
        0,
        0,
        this.width,
        this.height,
        10,
        this.selected ? palette.accentSoft : palette.panel,
      );
    }
    if (this.selected) {
      fillRoundedRect(this, 0, 14, 3, this.height - 28, 1.5, palette.accent);
    }
    const badgeColor = this.selected ? palette.accent : palette.borderBright;

    fillRoundedRect(this, 15, 15, 34, 34, 8, this.selected ? palette.accent : palette.panelRaised);
    this.drawText(
      24,
      getVerticallyCenteredTextY(15, 34, 10),
      this.definition.index,
      10,
      math.Color.WHITE,
      MONO_FONT_FAMILY,
      700,
    );
    this.drawText(61, 12, this.definition.title, 13, this.selected ? palette.text : palette.muted, FONT_FAMILY, 650);
    this.drawText(61, 36, this.definition.eyebrow, 9, this.selected ? badgeColor : palette.faint, MONO_FONT_FAMILY, 600);
  }
}

class AppHeader extends Control {
  definition = demoDefinitions[0];

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, new math.Color(0.025, 0.035, 0.055, 0.86));
    this.drawLine(0, this.height - 1, this.width, this.height - 1, palette.border, 1);
    this.drawText(28, 21, this.definition.eyebrow, 10, palette.accent, MONO_FONT_FAMILY, 700);
    this.drawText(28, 45, this.definition.title, 29, palette.text, FONT_FAMILY, 700);
    this.drawText(28, 91, this.definition.subtitle, 13, palette.muted, FONT_FAMILY, 400);

    const badgeWidth = 156;
    const badgeX = Math.max(28, this.width - badgeWidth - 28);

    fillRoundedRect(this, badgeX, 37, badgeWidth, 34, 17, palette.panel);
    this.drawRect(badgeX + 0.5, 37.5, badgeWidth - 1, 33, palette.border, 1);
    this.fillCircle(badgeX + 18, 54, 4, palette.green);
    this.drawText(
      badgeX + 31,
      getVerticallyCenteredTextY(37, 34, 10),
      'LIVE CONTROL TREE',
      10,
      palette.muted,
      MONO_FONT_FAMILY,
      600,
    );
  }
}

class DemoViewport extends Control {
  override draw (): void {
    fillRoundedRect(this, 0, 0, this.width, this.height, 14, palette.panel);
    this.drawRect(0.5, 0.5, this.width - 1, this.height - 1, palette.border, 1);
  }
}

class ControlApp extends Control {
  private readonly header: AppHeader;
  private readonly navButtons = new Map<DemoID, NavButton>();
  private readonly pages = new Map<DemoID, Control>();
  private activeID: DemoID = 'input';

  constructor (engine: Engine) {
    super(engine);

    const background = new AppBackground(engine);
    const sidebar = new Sidebar(engine);

    attachFullRect(background, this);
    attachAnchoredRect(sidebar, this, 0, 0, 0, 1, 0, 0, -248, 0);

    this.header = new AppHeader(engine);
    attachAnchoredRect(this.header, this, 0, 0, 1, 0, 248, 0, 0, -132);

    for (let index = 0; index < demoDefinitions.length; index++) {
      const definition = demoDefinitions[index];
      const button = new NavButton(engine, definition, () => this.selectDemo(definition.id));

      button.parent = this;
      button.setRect({
        position: new math.Vector2(17, 145 + index * 76),
        size: new math.Vector2(214, 64),
      });
      this.navButtons.set(definition.id, button);
    }

    const viewport = new DemoViewport(engine);

    attachFullRect(viewport, this, 270, 150, 22, 22);

    const inputPage = new InputDemoPage(engine);
    const layoutPage = new LayoutDemoPage(engine);
    const scrollPage = new ScrollDemoPage(engine);

    for (const [id, page] of [
      ['input', inputPage],
      ['layout', layoutPage],
      ['scroll', scrollPage],
    ] as const) {
      attachFullRect(page, this, 270, 150, 22, 22);
      this.pages.set(id, page);
    }

    this.selectDemo('input');
  }

  private selectDemo (id: DemoID): void {
    this.activeID = id;
    this.header.definition = demoDefinitions.find(definition => definition.id === id) ?? demoDefinitions[0];
    for (const [buttonID, button] of this.navButtons) {
      button.selected = buttonID === id;
    }
    for (const [pageID, page] of this.pages) {
      page.visible = pageID === id;
      page.enabled = pageID === id;
    }
    this.engine.windowRoot.guiReleaseFocus();
  }
}

// -----------------------------------------------------------------------------
// Control input demo

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

function getOwnerColor (owner: string): math.Color {
  let hash = 0;

  for (let index = 0; index < owner.length; index++) {
    hash = (hash * 31 + owner.charCodeAt(index)) >>> 0;
  }

  return ownerColors[hash % ownerColors.length];
}

class InputInspector extends Control {
  filter = 'Stop';
  handled = false;
  focusOwner = 'none';
  drag = 'idle';
  readonly logs: LogEntry[] = [];

  override draw (): void {
    fillRoundedRect(this, 0, 0, this.width, this.height, 10, new math.Color(0.04, 0.055, 0.085, 1));
    this.drawRect(0.5, 0.5, this.width - 1, this.height - 1, palette.border, 1);
    this.drawText(16, 17, 'INPUT SETTINGS', 10, palette.faint, MONO_FONT_FAMILY, 700);
    this.drawText(16, 151, 'RUNTIME STATUS', 10, palette.faint, MONO_FONT_FAMILY, 700);

    const status = [
      ['Mouse Filter', this.filter],
      ['Input Handled', String(this.handled)],
      ['Key Focus', this.focusOwner],
      ['Drag State', this.drag],
    ];

    for (let index = 0; index < status.length; index++) {
      const y = 178 + index * 28;
      const valueColor = status[index][0] === 'Input Handled'
        ? this.handled ? palette.orange : palette.green
        : palette.text;

      this.drawText(16, y, status[index][0].toUpperCase(), 9, palette.faint, MONO_FONT_FAMILY, 600);
      this.drawText(Math.max(124, this.width * 0.43), y, shorten(status[index][1], 22), 11, valueColor, MONO_FONT_FAMILY, 600);
      this.drawLine(16, y + 22, this.width - 16, y + 22, new math.Color(0.18, 0.23, 0.32, 0.5), 1);
    }

    const logTop = 315;

    this.drawText(16, logTop, 'EVENT LOG', 10, palette.faint, MONO_FONT_FAMILY, 700);
    fillRoundedRect(this, 78, logTop - 1, 34, 18, 9, palette.panelRaised);
    this.drawText(
      89,
      getVerticallyCenteredTextY(logTop - 1, 18, 9),
      String(this.logs.length),
      9,
      palette.muted,
      MONO_FONT_FAMILY,
      600,
    );
    this.drawLine(16, logTop + 27, this.width - 16, logTop + 27, palette.border, 1);

    const rowHeight = 28;
    const visibleRows = Math.max(1, Math.floor((this.height - logTop - 45) / rowHeight));

    if (this.logs.length === 0) {
      this.drawText(16, logTop + 39, 'Move or click inside the stage', 10, palette.faint, MONO_FONT_FAMILY, 500);
    }
    for (let index = 0; index < Math.min(visibleRows, this.logs.length); index++) {
      const log = this.logs[index];
      const y = logTop + 39 + index * rowHeight;
      const position = log.position ? `${log.position.x.toFixed(0)},${log.position.y.toFixed(0)}` : '';

      this.drawText(16, y, shorten(log.owner, 12), 10, getOwnerColor(log.owner), MONO_FONT_FAMILY, 650);
      this.drawText(105, y, shorten(log.event, 24), 10, palette.muted, MONO_FONT_FAMILY, 500);
      if (position) {
        this.drawText(Math.max(220, this.width - 70), y, position, 9, palette.faint, MONO_FONT_FAMILY, 500);
      }
    }
  }

  appendLog (owner: string, event: string, position?: Vector2): void {
    this.logs.unshift({ owner, event, position: position?.clone() });
    this.logs.length = Math.min(this.logs.length, 80);
  }
}

class ToggleControl extends ClickControl {
  checked = false;

  constructor (engine: Engine, private readonly change: (value: boolean) => void) {
    super(engine, () => {
      this.checked = !this.checked;
      this.change(this.checked);
    });
  }

  override draw (): void {
    fillRoundedRect(this, 0, 0, this.width, this.height, 8, this.hovered ? palette.panelRaised : palette.panel);
    this.drawRect(0.5, 0.5, this.width - 1, this.height - 1, palette.border, 1);
    fillRoundedRect(this, 12, 10, 36, 20, 10, this.checked ? palette.accent : palette.borderBright);
    this.fillCircle(this.checked ? 38 : 22, 20, 7, math.Color.WHITE);
    this.drawText(
      60,
      getVerticallyCenteredTextY(0, this.height, 11),
      'event.accept() on Front',
      11,
      palette.text,
      MONO_FONT_FAMILY,
      550,
    );
  }
}

class InputEventControl extends Control {
  label = 'Control';
  detail = '';
  fillColor = new math.Color(0.18, 0.22, 0.31, 1);
  hoverColor = new math.Color(0.23, 0.29, 0.4, 1);
  pressedColor = new math.Color(0.13, 0.17, 0.25, 1);
  borderColor = new math.Color(0.4, 0.48, 0.62, 1);
  acceptMouseButtons = false;
  draggable = false;
  dropTarget = false;
  onDrop?: (payload: DragPayload) => void;

  private hovered = false;
  private pressed = false;

  constructor (engine: Engine, private readonly inspector: InputInspector) {
    super(engine);
  }

  override draw (): void {
    const color = this.pressed ? this.pressedColor : this.hovered ? this.hoverColor : this.fillColor;

    fillRoundedRect(this, 0, 0, this.width, this.height, 7, color);
    this.drawRect(1, 1, this.width - 2, this.height - 2, this.borderColor, 1.5);
    this.drawText(13, this.height >= 54 ? 11 : getVerticallyCenteredTextY(0, this.height, 15), this.label, 15, palette.text, FONT_FAMILY, 650);
    if (this.detail && this.height >= 54) {
      this.drawText(13, 36, shorten(this.detail, 37), 10, palette.muted, FONT_FAMILY, 450);
    }
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

  protected override canDropData (position: Vector2, data: unknown): boolean {
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
      this.inspector.handled = this.engine.windowRoot.isInputHandled();
    });
  }
}

function isDragPayload (data: unknown): data is DragPayload {
  return typeof data === 'object' && data !== null &&
    'source' in data && data.source instanceof InputEventControl &&
    'label' in data && typeof data.label === 'string';
}

function placeNormalized (
  control: Control,
  parent: Control,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  attachAnchoredRect(control, parent, x, y, x + width, y + height);
}

class InputDemoPage extends Control {
  constructor (engine: Engine) {
    super(engine);

    const inspector = new InputInspector(engine);
    const stage = new InputEventControl(engine, inspector);

    attachAnchoredRect(stage, this, 0, 0, 0.66, 1, 18, 18, 10, 18);
    attachAnchoredRect(inspector, this, 0.66, 0, 1, 1, 10, 18, 18, 18);

    stage.label = 'Stage (Pass)';
    stage.detail = 'Empty space remains unhandled';
    stage.mouseFilter = MouseFilter.Pass;
    stage.fillColor = new math.Color(0.035, 0.047, 0.075, 1);
    stage.hoverColor = stage.fillColor;
    stage.borderColor = palette.border;
    stage.clipContents = true;

    const group = new InputEventControl(engine, inspector);

    placeNormalized(group, stage, 0.035, 0.12, 0.57, 0.76);
    group.label = 'Parent (Pass)';
    group.detail = 'Receives bubbled events from Pass children';
    group.mouseFilter = MouseFilter.Pass;
    group.fillColor = new math.Color(0.07, 0.095, 0.14, 1);
    group.hoverColor = new math.Color(0.09, 0.12, 0.18, 1);
    group.borderColor = new math.Color(0.28, 0.37, 0.54, 1);

    const back = new InputEventControl(engine, inspector);

    placeNormalized(back, group, 0.055, 0.18, 0.60, 0.48);
    back.label = 'Back (Pass)';
    back.detail = 'Visible through Ignore; bubbles to Parent';
    back.mouseFilter = MouseFilter.Pass;
    back.focusMode = FocusMode.Click;
    back.defaultCursorShape = CursorShape.Cross;
    back.fillColor = new math.Color(0.12, 0.34, 0.52, 1);
    back.hoverColor = new math.Color(0.16, 0.44, 0.65, 1);
    back.pressedColor = new math.Color(0.08, 0.25, 0.4, 1);
    back.borderColor = new math.Color(0.38, 0.77, 1, 1);

    const front = new InputEventControl(engine, inspector);

    placeNormalized(front, group, 0.33, 0.41, 0.60, 0.41);
    front.focusMode = FocusMode.Click;
    front.defaultCursorShape = CursorShape.PointingHand;
    front.fillColor = new math.Color(0.58, 0.25, 0.13, 0.96);
    front.hoverColor = new math.Color(0.76, 0.34, 0.16, 0.98);
    front.pressedColor = new math.Color(0.45, 0.17, 0.08, 1);
    front.borderColor = new math.Color(1, 0.66, 0.32, 1);
    front.detail = 'Change MouseFilter with the controls';

    const dropZone = new InputEventControl(engine, inspector);

    placeNormalized(dropZone, stage, 0.65, 0.12, 0.31, 0.37);
    dropZone.label = 'Drop zone';
    dropZone.detail = 'Drag the chip here';
    dropZone.mouseFilter = MouseFilter.Stop;
    dropZone.dropTarget = true;
    dropZone.fillColor = new math.Color(0.08, 0.29, 0.2, 1);
    dropZone.hoverColor = new math.Color(0.11, 0.4, 0.27, 1);
    dropZone.borderColor = new math.Color(0.32, 0.86, 0.58, 1);

    const target = new InputEventControl(engine, inspector);

    placeNormalized(target, stage, 0.65, 0.55, 0.31, 0.16);
    target.label = 'Target';
    target.detail = 'Stops input';
    target.mouseFilter = MouseFilter.Stop;
    target.focusMode = FocusMode.Click;
    target.defaultCursorShape = CursorShape.Cross;
    target.fillColor = new math.Color(0.36, 0.24, 0.06, 1);
    target.hoverColor = new math.Color(0.52, 0.36, 0.08, 1);
    target.pressedColor = new math.Color(0.27, 0.16, 0.03, 1);
    target.borderColor = new math.Color(0.95, 0.7, 0.22, 1);

    const ignore = new InputEventControl(engine, inspector);

    placeNormalized(ignore, stage, 0.81, 0.565, 0.13, 0.13);
    ignore.label = 'Ignore';
    ignore.detail = 'Pass-through';
    ignore.mouseFilter = MouseFilter.Ignore;
    ignore.fillColor = new math.Color(0.07, 0.42, 0.52, 0.45);
    ignore.hoverColor = ignore.fillColor;
    ignore.pressedColor = ignore.fillColor;
    ignore.borderColor = new math.Color(0.4, 0.86, 0.95, 1);

    const dragChip = new InputEventControl(engine, inspector);

    placeNormalized(dragChip, stage, 0.69, 0.78, 0.22, 0.14);
    dragChip.label = 'Drag chip';
    dragChip.detail = 'Drag > 10 px to begin';
    dragChip.mouseFilter = MouseFilter.Stop;
    dragChip.draggable = true;
    dragChip.defaultCursorShape = CursorShape.Drag;
    dragChip.fillColor = new math.Color(0.35, 0.2, 0.57, 1);
    dragChip.hoverColor = new math.Color(0.48, 0.29, 0.72, 1);
    dragChip.pressedColor = new math.Color(0.27, 0.13, 0.45, 1);
    dragChip.borderColor = new math.Color(0.75, 0.55, 1, 1);

    dropZone.onDrop = payload => {
      dropZone.detail = `${payload.label} accepted`;
      payload.source.detail = 'Dropped — drag again';
    };

    const filterButtons = [MouseFilter.Stop, MouseFilter.Pass, MouseFilter.Ignore].map(filter =>
      new TextButton(engine, MouseFilter[filter], () => setFrontFilter(filter), true));

    for (let index = 0; index < filterButtons.length; index++) {
      const left = index === 0 ? 16 : 5;
      const right = index === filterButtons.length - 1 ? 16 : 5;

      attachAnchoredRect(
        filterButtons[index],
        inspector,
        index / 3,
        0,
        (index + 1) / 3,
        0,
        left,
        44,
        right,
        -78,
      );
    }

    const acceptToggle = new ToggleControl(engine, value => {
      front.acceptMouseButtons = value;
      inspector.appendLog('settings', `event.accept = ${value}`);
    });

    attachAnchoredRect(acceptToggle, inspector, 0, 0, 1, 0, 16, 92, 16, -132);

    const clearButton = new TextButton(engine, 'Clear', () => {
      inspector.logs.length = 0;
    }, true);

    attachAnchoredRect(clearButton, inspector, 1, 0, 1, 0, -82, 306, 16, -334);

    function setFrontFilter (filter: MouseFilter): void {
      front.mouseFilter = filter;
      front.label = `Front (${MouseFilter[filter]})`;
      inspector.filter = MouseFilter[filter];
      filterButtons.forEach((button, index) => {
        button.selected = filter === [MouseFilter.Stop, MouseFilter.Pass, MouseFilter.Ignore][index];
      });
      inspector.appendLog('settings', `Front = ${MouseFilter[filter]}`);
    }

    setFrontFilter(MouseFilter.Stop);
    inspector.appendLog('ready', 'Control input demo');
  }
}

// -----------------------------------------------------------------------------
// Automatic layout demo

class DemoCard extends Control {
  constructor (
    engine: Engine,
    private readonly label: string,
    private readonly color: math.Color,
    private readonly minimum: math.Vector2,
    private readonly desired: math.Vector2,
  ) {
    super(engine);
  }

  override getMinimumSize (): math.Vector2 { return this.minimum.clone(); }
  override getDesiredSize (): math.Vector2 { return this.desired.clone(); }

  override draw (): void {
    fillRoundedRect(this, 0, 0, this.width, this.height, 7, this.color);
    this.drawText(
      14,
      getVerticallyCenteredTextY(0, this.height, 13),
      this.label,
      13,
      math.Color.WHITE,
      FONT_FAMILY,
      650,
    );
  }
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

class ResizeHandle extends Control {
  private dragging = false;

  constructor (
    engine: Engine,
    private readonly corner: ResizeCorner,
    private readonly begin: (corner: ResizeCorner) => void,
    private readonly move: (corner: ResizeCorner) => void,
  ) {
    super(engine);
    this.defaultCursorShape = corner === 'nw' || corner === 'se' ? CursorShape.Fdiagsize : CursorShape.Bdiagsize;
  }

  override draw (): void {
    fillRoundedRect(this, 0, 0, this.width, this.height, 5, this.dragging ? palette.accent : palette.panelRaised);
    this.drawRect(0.5, 0.5, this.width - 1, this.height - 1, this.dragging ? palette.text : palette.borderBright, 1);
    this.fillCircle(this.width / 2, this.height / 2, 2.2, palette.text);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this.dragging = true;
    this.begin(this.corner);
    event.accept();
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.dragging && (event.buttonMask & MouseButtonMask.Left) !== 0) {
      this.move(this.corner);
      event.accept();
    }
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) {
      this.dragging = false;
      event.accept();
    }
  }
}

class LayoutStage extends Control {
  constructor (engine: Engine, resizeOwner: LayoutDemoPage) {
    super(engine);
    this.clipContents = false;

    const margin = new MarginContainer(engine);
    const column = new VBoxContainer(engine);
    const grid = new GridContainer(engine);

    attachFullRect(margin, this, 20, 20, 20, 20);
    margin.addChild(column);
    column.separation = 12;
    column.addChild(new DemoCard(
      engine,
      'Intrinsic desired height · 64px',
      new math.Color(0.16, 0.29, 0.54, 1),
      new math.Vector2(180, 44),
      new math.Vector2(420, 64),
    ));
    column.addChild(grid);

    grid.columns = 3;
    grid.horizontalSeparation = 10;
    grid.verticalSeparation = 10;
    grid.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);

    const colors = [
      new math.Color(0.48, 0.20, 0.28, 1),
      new math.Color(0.18, 0.42, 0.34, 1),
      new math.Color(0.39, 0.27, 0.55, 1),
      new math.Color(0.48, 0.35, 0.16, 1),
      new math.Color(0.17, 0.36, 0.52, 1),
      new math.Color(0.35, 0.37, 0.42, 1),
    ];

    for (let index = 0; index < colors.length; index++) {
      const card = new DemoCard(
        engine,
        `Cell ${index + 1}`,
        colors[index],
        new math.Vector2(72, 48),
        new math.Vector2(140, 90),
      );

      card.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
      grid.addChild(card);
    }

    for (const corner of ['nw', 'ne', 'sw', 'se'] as ResizeCorner[]) {
      const handle = new ResizeHandle(
        engine,
        corner,
        selectedCorner => resizeOwner.beginResize(selectedCorner),
        selectedCorner => resizeOwner.resizeFromPointer(selectedCorner),
      );
      const left = corner.endsWith('w');
      const top = corner.startsWith('n');
      const anchorX = left ? 0 : 1;
      const anchorY = top ? 0 : 1;

      attachAnchoredRect(handle, this, anchorX, anchorY, anchorX, anchorY, -8, -8, -8, -8);
    }
  }

  override draw (): void {
    fillRoundedRect(this, 0, 0, this.width, this.height, 12, new math.Color(0.075, 0.09, 0.13, 1));
    this.drawRect(0.5, 0.5, this.width - 1, this.height - 1, palette.borderBright, 1);
  }
}

class LayoutDemoPage extends Control {
  private readonly stage: LayoutStage;
  private initialized = false;
  private fixedX = 0;
  private fixedY = 0;
  private activeCorner: ResizeCorner = 'se';

  constructor (engine: Engine) {
    super(engine);
    this.stage = new LayoutStage(engine, this);
    this.stage.parent = this;

    const resetButton = new TextButton(engine, 'Reset size', () => this.resetStage(), true);

    attachAnchoredRect(resetButton, this, 1, 0, 1, 0, -116, 22, 18, -54);
    this.on('sizeChanged', () => this.layoutForPageSize());
  }

  override draw (): void {
    this.drawText(20, 18, '拖动任意角点调整 Control 容器尺寸，自动布局会在同一帧重新测量与排列。', 12, palette.muted, FONT_FAMILY, 450);
    this.drawText(
      20,
      43,
      `${Math.round(this.stage.width)} × ${Math.round(this.stage.height)} px`,
      10,
      palette.accent,
      MONO_FONT_FAMILY,
      650,
    );
  }

  beginResize (corner: ResizeCorner): void {
    const stageRect = this.stage.getRect();

    this.activeCorner = corner;
    this.fixedX = corner.endsWith('w') ? stageRect.position.x + stageRect.size.x : stageRect.position.x;
    this.fixedY = corner.startsWith('n') ? stageRect.position.y + stageRect.size.y : stageRect.position.y;
  }

  resizeFromPointer (corner: ResizeCorner): void {
    if (corner !== this.activeCorner) {
      return;
    }
    const root = this.root;

    if (!root) {
      return;
    }
    const pointer = this.makePositionLocal(root.getMousePosition());
    const west = corner.endsWith('w');
    const north = corner.startsWith('n');
    const minimumWidth = Math.min(360, Math.max(180, this.width - 40));
    const minimumHeight = Math.min(260, Math.max(160, this.height - 90));
    const left = west
      ? Math.max(18, Math.min(pointer.x, this.fixedX - minimumWidth))
      : this.fixedX;
    const right = west
      ? this.fixedX
      : Math.min(this.width - 18, Math.max(pointer.x, this.fixedX + minimumWidth));
    const top = north
      ? Math.max(72, Math.min(pointer.y, this.fixedY - minimumHeight))
      : this.fixedY;
    const bottom = north
      ? this.fixedY
      : Math.min(this.height - 18, Math.max(pointer.y, this.fixedY + minimumHeight));

    this.stage.setRect({
      position: new math.Vector2(left, top),
      size: new math.Vector2(Math.max(1, right - left), Math.max(1, bottom - top)),
    });
  }

  private resetStage (): void {
    const width = Math.max(360, Math.min(760, this.width - 96));
    const height = Math.max(260, Math.min(480, this.height - 118));

    this.stage.setRect({
      position: new math.Vector2((this.width - width) / 2, 76 + Math.max(0, (this.height - 76 - height) / 2)),
      size: new math.Vector2(width, height),
    });
  }

  private layoutForPageSize (): void {
    if (this.width < 480 || this.height < 320) {
      return;
    }
    if (!this.initialized) {
      this.initialized = true;
      this.resetStage();

      return;
    }
    const rect = this.stage.getRect();
    const width = Math.min(rect.size.x, Math.max(1, this.width - 36));
    const height = Math.min(rect.size.y, Math.max(1, this.height - 90));
    const x = Math.max(18, Math.min(rect.position.x, this.width - width - 18));
    const y = Math.max(72, Math.min(rect.position.y, this.height - height - 18));

    this.stage.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
  }
}

// -----------------------------------------------------------------------------
// Clip and scroll demo

class ScrollSurface extends Control {
  constructor (engine: Engine, private readonly minimum: math.Vector2) {
    super(engine);
  }

  override getMinimumSize (): math.Vector2 {
    return this.minimum.clone();
  }

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, new math.Color(0.035, 0.05, 0.075, 1));
    for (let x = 0; x < this.width; x += 40) {
      this.drawLine(x, 0, x, this.height, new math.Color(0.12, 0.16, 0.23, 1), 1);
    }
    for (let y = 0; y < this.height; y += 40) {
      this.drawLine(0, y, this.width, y, new math.Color(0.12, 0.16, 0.23, 1), 1);
    }
  }
}

class FocusRow extends Control {
  private focused = false;

  constructor (
    engine: Engine,
    private readonly label: string,
    private readonly color: math.Color,
    private readonly focusChanged: (label: string) => void,
  ) {
    super(engine);
    this.focusMode = FocusMode.All;
    this.defaultCursorShape = CursorShape.PointingHand;
    this.setCustomMinimumSize(420, 54);
  }

  override draw (): void {
    const color = this.focused ? new math.Color(0.25, 0.52, 0.95, 1) : this.color;

    fillRoundedRect(this, 0, 0, this.width, this.height, 8, color);
    this.drawText(
      16,
      getVerticallyCenteredTextY(0, this.height, 14),
      this.label,
      14,
      math.Color.WHITE,
      FONT_FAMILY,
      650,
    );
    this.drawText(
      this.width - 72,
      getVerticallyCenteredTextY(0, this.height, 9),
      this.focused ? 'FOCUSED' : 'CLICK',
      9,
      new math.Color(0.88, 0.93, 1, 0.8),
      MONO_FONT_FAMILY,
      650,
    );
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) {
      this.grabFocus();
      event.accept();
    }
  }

  override onGotFocus (): void {
    this.focused = true;
    this.focusChanged(this.label);
  }

  override onLostFocus (): void {
    this.focused = false;
  }
}

class RotatedClip extends Control {
  override draw (): void {
    fillRoundedRect(this, 0, 0, this.width, this.height, 8, new math.Color(0.22, 0.16, 0.32, 1));
    this.drawText(12, 12, '旋转 Control · AABB 裁剪', 13, math.Color.WHITE, FONT_FAMILY, 650);
  }
}

class OversizedChild extends Control {
  override draw (): void {
    this.fillCircle(100, 90, 86, new math.Color(0.83, 0.34, 0.45, 0.92));
    this.fillRect(-60, 62, 320, 50, new math.Color(0.94, 0.66, 0.25, 0.78));
  }
}

class NestedScrollSurface extends ScrollSurface {
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, new math.Color(0.055, 0.23, 0.25, 1));
    this.drawText(18, 17, '嵌套 ScrollContainer', 17, math.Color.WHITE, FONT_FAMILY, 700);
    for (let index = 0; index < 8; index++) {
      this.fillRect(18 + index * 52, 70 + index * 34, 42, 120, new math.Color(0.20, 0.58, 0.60, 1));
    }
  }
}

class ScrollDemoPage extends Control {
  private focusLabel = 'none';

  constructor (engine: Engine) {
    super(engine);

    const outer = new ScrollContainer(engine);
    const surface = new ScrollSurface(engine, new math.Vector2(1240, 820));
    const list = new VBoxContainer(engine);

    attachFullRect(outer, this, 18, 74, 18, 18);
    outer.followFocus = true;
    outer.deadzone = 6;
    outer.addChild(surface);

    list.parent = surface;
    list.setRect({ position: new math.Vector2(28, 28), size: new math.Vector2(440, 650) });
    list.separation = 10;

    const rows: FocusRow[] = [];
    const colors = [
      new math.Color(0.20, 0.32, 0.50, 1),
      new math.Color(0.24, 0.43, 0.36, 1),
      new math.Color(0.42, 0.29, 0.50, 1),
    ];

    for (let index = 0; index < 10; index++) {
      const row = new FocusRow(engine, `可聚焦列表项 ${index + 1}`, colors[index % colors.length], label => {
        this.focusLabel = label;
      });

      row.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
      list.addChild(row);
      rows.push(row);
    }

    const nested = new ScrollContainer(engine);
    const nestedSurface = new NestedScrollSurface(engine, new math.Vector2(480, 420));

    nested.parent = surface;
    nested.setRect({ position: new math.Vector2(560, 42), size: new math.Vector2(330, 240) });
    nested.deadzone = 4;
    nested.addChild(nestedSurface);

    const rotated = new RotatedClip(engine);
    const oversized = new OversizedChild(engine);

    rotated.parent = surface;
    rotated.setRect({ position: new math.Vector2(600, 390), size: new math.Vector2(260, 180) });
    rotated.setRotation(10);
    rotated.clipContents = true;
    oversized.parent = rotated;
    oversized.setRect({ position: new math.Vector2(25, 40), size: new math.Vector2(210, 130) });

    const focusButton = new TextButton(engine, 'Focus last item', () => rows[rows.length - 1].grabFocus(), true);

    attachAnchoredRect(focusButton, this, 1, 0, 1, 0, -154, 20, 18, -54);
  }

  override draw (): void {
    this.drawText(20, 17, '滚轮 / 触摸拖动；嵌套区域独立滚动，聚焦会自动跟随到可见范围。', 12, palette.muted, FONT_FAMILY, 450);
    fillRoundedRect(this, 20, 42, 9, 9, 4.5, palette.green);
    this.drawText(37, 42, `FOCUS · ${shorten(this.focusLabel, 28)}`, 10, palette.accent, MONO_FONT_FAMILY, 650);
  }
}

const player = new Player({
  container: document.body,
  interactive: true,
  env: 'editor',
});
const composition = new Composition(player.engine);
const app = new ControlApp(player.engine);

attachFullRect(app, composition.uiCanvas.rootControl);

window.addEventListener('resize', () => player.resize());
window.addEventListener('beforeunload', () => player.dispose(), { once: true });

player.play();
