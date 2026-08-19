import type {
  Engine,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
} from '@galacean/effects';
import {
  Composition,
  ContainerControl,
  CursorShape,
  FocusMode,
  MouseButton,
  MouseButtonMask,
  MouseFilter,
  Player,
  UIControl,
  VFXItem,
  math,
} from '@galacean/effects';

const { Color } = math;

type Vector2 = math.Vector2;
type DragPayload = {
  source: DemoControl,
  label: string,
};

const logElement = document.getElementById('event-log') as HTMLDivElement;
const logCountElement = document.getElementById('log-count') as HTMLSpanElement;
const filterValueElement = document.getElementById('filter-value') as HTMLSpanElement;
const handledValueElement = document.getElementById('handled-value') as HTMLSpanElement;
const focusValueElement = document.getElementById('focus-value') as HTMLSpanElement;
const dragValueElement = document.getElementById('drag-value') as HTMLSpanElement;
const acceptInput = document.getElementById('accept-input') as HTMLInputElement;
const clearButton = document.getElementById('clear-log') as HTMLButtonElement;
const canvasHost = document.getElementById('canvas-host') as HTMLDivElement;

const white = new Color(0.95, 0.97, 1, 1);
const muted = new Color(0.65, 0.7, 0.8, 1);

const maxLogLines = 80;
const ownerPalette = ['#7cc7ff', '#ffb168', '#6de2a3', '#c79bff', '#ffd166', '#ff8fa3', '#64d8cb', '#9fb7ff'];

function ownerColor (owner: string): string {
  const key = owner.split(' ')[0];
  let hash = 0;

  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  return ownerPalette[hash % ownerPalette.length];
}

function appendLog (owner: string, event: string, position?: Vector2): void {
  const line = document.createElement('div');
  const ownerSpan = document.createElement('span');
  const eventSpan = document.createElement('span');

  line.className = 'log-line';
  ownerSpan.className = 'log-owner';
  ownerSpan.style.color = ownerColor(owner);
  ownerSpan.textContent = owner;
  eventSpan.className = 'log-event';
  eventSpan.textContent = event;
  line.append(ownerSpan, eventSpan);

  if (position) {
    const positionSpan = document.createElement('span');

    positionSpan.className = 'log-pos';
    positionSpan.textContent = `@ ${position.x.toFixed(0)}, ${position.y.toFixed(0)}`;
    line.append(positionSpan);
  }

  logElement.prepend(line);
  while (logElement.childElementCount > maxLogLines) {
    logElement.lastElementChild?.remove();
  }
  logCountElement.textContent = String(logElement.childElementCount);
}

function reportHandled (engine: Engine): void {
  queueMicrotask(() => {
    const handled = engine.windowRoot.isInputHandled();

    handledValueElement.textContent = handled ? 'true' : 'false';
    handledValueElement.dataset.state = handled ? 'handled' : 'open';
  });
}

class DemoControl extends ContainerControl {
  label = 'Control';
  detail = '';
  fillColor = new Color(0.18, 0.22, 0.31, 1);
  hoverColor = new Color(0.23, 0.29, 0.4, 1);
  pressedColor = new Color(0.13, 0.17, 0.25, 1);
  borderColor = new Color(0.4, 0.48, 0.62, 1);
  acceptMouseButtons = false;
  draggable = false;
  dropTarget = false;
  onDrop?: (payload: DragPayload) => void;

  private hovered = false;
  private pressed = false;

  override drawSelf (): void {
    const size = this.size;
    const color = this.pressed ? this.pressedColor : this.hovered ? this.hoverColor : this.fillColor;

    this.fillRect(0, 0, size.x, size.y, color);
    this.drawRect(1.5, 1.5, size.x - 3, size.y - 3, this.borderColor, 1.5);
    this.drawText(16, size.y - 34, this.label, 21, white, 'Arial', 600);
    if (this.detail) {
      this.drawText(16, size.y - 62, this.detail, 14, muted, 'Arial');
    }
  }

  override onMouseEnter (location: Vector2): void {
    this.hovered = true;
    appendLog(this.label, 'mouse enter', location);
  }

  override onMouseLeave (): void {
    this.hovered = false;
    this.pressed = false;
    appendLog(this.label, 'mouse exit');
  }

  override onMouseDown (
    location: Vector2,
    button: MouseButton,
    event: InputEventMouseButton,
  ): void {
    this.pressed = button === MouseButton.Left;
    appendLog(this.label, `mouse down (${MouseButton[button]})`, location);
    if (this.acceptMouseButtons) {
      appendLog(this.label, 'acceptEvent()');
      this.acceptEvent();
    }
    reportHandled(this.engine);
  }

  override onMouseUp (
    location: Vector2,
    button: MouseButton,
    event: InputEventMouseButton,
  ): void {
    this.pressed = false;
    appendLog(this.label, `mouse up (${MouseButton[button]})`, location);
    if (this.acceptMouseButtons) {
      appendLog(this.label, 'acceptEvent()');
      this.acceptEvent();
    }
    reportHandled(this.engine);
  }

  override onMouseMove (location: Vector2, event: InputEventMouseMotion): void {
    if ((event.buttonMask & MouseButtonMask.Left) !== 0) {
      appendLog(this.label, 'mouse drag', location);
    }
    reportHandled(this.engine);
  }

  override onMouseWheel (
    location: Vector2,
    delta: number,
    event: InputEventMouseButton,
  ): void {
    appendLog(this.label, `wheel (${delta.toFixed(0)})`, location);
    reportHandled(this.engine);
  }

  override onGotFocus (): void {
    focusValueElement.textContent = this.label;
    appendLog(this.label, 'focus enter');
  }

  override onLostFocus (): void {
    focusValueElement.textContent = 'none';
    appendLog(this.label, 'focus exit');
  }

  override onKeyDown (event: InputEventKey): void {
    appendLog(this.label, `key down (${event.keycode})`);
    reportHandled(this.engine);
  }

  override onKeyUp (event: InputEventKey): void {
    appendLog(this.label, `key up (${event.keycode})`);
    reportHandled(this.engine);
  }

  protected override getDragData (position: Vector2): DragPayload | null {
    if (!this.draggable) {
      return null;
    }

    appendLog(this.label, 'drag begin', position);
    dragValueElement.textContent = `dragging ${this.label}`;

    return { source: this, label: this.label };
  }

  protected override canDropData (position: Vector2, data: unknown): boolean {
    return this.dropTarget && isDragPayload(data);
  }

  protected override dropData (position: Vector2, data: unknown): void {
    if (!isDragPayload(data)) {
      return;
    }

    appendLog(this.label, `drop ${data.label}`, position);
    dragValueElement.textContent = `${data.label} dropped successfully`;
    this.onDrop?.(data);
  }
}

function isDragPayload (data: unknown): data is DragPayload {
  return typeof data === 'object' && data !== null &&
    'source' in data && data.source instanceof DemoControl &&
    'label' in data && typeof data.label === 'string';
}

function addControl (
  engine: Engine,
  parent: VFXItem,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
): DemoControl {
  const item = new VFXItem(engine);
  const control = new DemoControl(engine);
  const bridge = item.addComponent(UIControl);

  item.name = label;
  bridge.control = control;
  control.label = label;
  item.setParent(parent);
  control.setSize(width, height);
  control.setPosition(x, y);

  return control;
}

const player = new Player({
  container: canvasHost,
  interactive: true,
});
const composition = new Composition(player.engine);

const stage = addControl(player.engine, composition.sceneRoot, 'Stage (Pass)', 0, 0, 900, 600);

stage.mouseFilter = MouseFilter.Pass;
stage.fillColor = new Color(0.055, 0.07, 0.11, 1);
stage.hoverColor = stage.fillColor;
stage.borderColor = new Color(0.12, 0.16, 0.24, 1);
stage.detail = 'Empty space remains unhandled';

const group = addControl(player.engine, stage.item!, 'Parent (Pass)', 40, 45, 500, 460);

group.mouseFilter = MouseFilter.Pass;
group.fillColor = new Color(0.09, 0.12, 0.18, 1);
group.hoverColor = new Color(0.11, 0.15, 0.22, 1);
group.borderColor = new Color(0.3, 0.38, 0.54, 1);
group.detail = 'Receives bubbled events from Pass children';

const back = addControl(player.engine, group.item!, 'Back (Pass)', 35, 140, 300, 200);

back.mouseFilter = MouseFilter.Pass;
back.focusMode = FocusMode.Click;
back.defaultCursorShape = CursorShape.Cross;
back.fillColor = new Color(0.12, 0.34, 0.52, 1);
back.hoverColor = new Color(0.16, 0.44, 0.65, 1);
back.pressedColor = new Color(0.08, 0.25, 0.4, 1);
back.borderColor = new Color(0.38, 0.77, 1, 1);
back.detail = 'Visible through Ignore; bubbles to Parent';

const front = addControl(player.engine, group.item!, 'Front (Stop)', 160, 50, 280, 180);

front.mouseFilter = MouseFilter.Stop;
front.focusMode = FocusMode.Click;
front.defaultCursorShape = CursorShape.PointingHand;
front.fillColor = new Color(0.58, 0.25, 0.13, 0.96);
front.hoverColor = new Color(0.76, 0.34, 0.16, 0.98);
front.pressedColor = new Color(0.45, 0.17, 0.08, 1);
front.borderColor = new Color(1, 0.66, 0.32, 1);
front.detail = 'Change MouseFilter with the buttons';

const dropZone = addControl(player.engine, stage.item!, 'Drop zone', 610, 45, 260, 245);

dropZone.mouseFilter = MouseFilter.Stop;
dropZone.dropTarget = true;
dropZone.fillColor = new Color(0.08, 0.29, 0.2, 1);
dropZone.hoverColor = new Color(0.11, 0.4, 0.27, 1);
dropZone.borderColor = new Color(0.32, 0.86, 0.58, 1);
dropZone.detail = 'Drag the chip here';
dropZone.onDrop = payload => {
  dropZone.detail = `${payload.label} accepted`;
  payload.source.detail = 'Dropped — drag again';
};

const ignoreTarget = addControl(player.engine, stage.item!, 'Target', 610, 325, 260, 95);

ignoreTarget.mouseFilter = MouseFilter.Stop;
ignoreTarget.focusMode = FocusMode.Click;
ignoreTarget.defaultCursorShape = CursorShape.Cross;
ignoreTarget.fillColor = new Color(0.36, 0.24, 0.06, 1);
ignoreTarget.hoverColor = new Color(0.52, 0.36, 0.08, 1);
ignoreTarget.pressedColor = new Color(0.27, 0.16, 0.03, 1);
ignoreTarget.borderColor = new Color(0.95, 0.7, 0.22, 1);
ignoreTarget.detail = 'Stops input';

const ignoreOverlay = addControl(player.engine, stage.item!, 'Ignore', 735, 335, 120, 75);

ignoreOverlay.mouseFilter = MouseFilter.Ignore;
ignoreOverlay.fillColor = new Color(0.07, 0.42, 0.52, 0.45);
ignoreOverlay.hoverColor = ignoreOverlay.fillColor;
ignoreOverlay.pressedColor = ignoreOverlay.fillColor;
ignoreOverlay.borderColor = new Color(0.4, 0.86, 0.95, 1);
ignoreOverlay.detail = 'Pass-through';

const dragChip = addControl(player.engine, stage.item!, 'Drag chip', 642, 455, 196, 82);

dragChip.mouseFilter = MouseFilter.Stop;
dragChip.draggable = true;
dragChip.defaultCursorShape = CursorShape.Drag;
dragChip.fillColor = new Color(0.35, 0.2, 0.57, 1);
dragChip.hoverColor = new Color(0.48, 0.29, 0.72, 1);
dragChip.pressedColor = new Color(0.27, 0.13, 0.45, 1);
dragChip.borderColor = new Color(0.75, 0.55, 1, 1);
dragChip.detail = 'Drag > 10 px to begin';

function setFrontFilter (filter: MouseFilter): void {
  front.mouseFilter = filter;
  front.label = `Front (${MouseFilter[filter]})`;
  filterValueElement.textContent = MouseFilter[filter];
  if (player.engine.windowRoot.guiGetFocusOwner() === front) {
    focusValueElement.textContent = front.label;
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
    button.classList.toggle('active', button.dataset.filter === MouseFilter[filter]);
  }
  appendLog('settings', `Front = ${MouseFilter[filter]}`);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;

    if (filter === 'Stop') {
      setFrontFilter(MouseFilter.Stop);
    } else if (filter === 'Pass') {
      setFrontFilter(MouseFilter.Pass);
    } else if (filter === 'Ignore') {
      setFrontFilter(MouseFilter.Ignore);
    }
  });
}

acceptInput.addEventListener('change', () => {
  front.acceptMouseButtons = acceptInput.checked;
  appendLog('settings', `acceptEvent = ${acceptInput.checked}`);
});

clearButton.addEventListener('click', () => {
  logElement.replaceChildren();
  logCountElement.textContent = '0';
});

window.addEventListener('beforeunload', () => player.dispose(), { once: true });

setFrontFilter(MouseFilter.Stop);
appendLog('ready', 'Control input demo');
player.play();
