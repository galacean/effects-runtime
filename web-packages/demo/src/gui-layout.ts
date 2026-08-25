import type { Engine } from '@galacean/effects';
import { Composition, Control, Player, SizeFlags, math } from '@galacean/effects';
import { GridContainer, MarginContainer, VBoxContainer } from '@galacean/effects-plugin-gui';

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
    this.fillRect(0, 0, this.width, this.height, this.color);
    this.drawText(14, Math.min(28, this.height - 8), this.label, 15, math.Color.WHITE, 'system-ui', 600);
  }
}

const stageElement = document.getElementById('stage');
const stageHostElement = document.getElementById('stage-host');
const resizeHandles = Array.from(document.querySelectorAll<HTMLElement>('.resize-handle'));

if (!stageElement || !stageHostElement || resizeHandles.length !== 4) {
  throw new Error('Missing GUI demo stage or resize handles.');
}

const stage = stageElement;
const stageHost = stageHostElement;
const player = new Player({ container: stage, pixelRatio: 1 });
const composition = new Composition(player.engine);
const margin = new MarginContainer(player.engine);
const column = new VBoxContainer(player.engine);
const grid = new GridContainer(player.engine);

margin.parent = composition.uiCanvas.rootControl;
margin.setAnchorsAndOffsetsPreset('fullRect', 20);
margin.addChild(column);

column.separation = 12;
column.addChild(new DemoCard(
  player.engine,
  'Intrinsic desired height: 64px',
  new math.Color(0.16, 0.27, 0.48, 1),
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
    player.engine,
    `Cell ${index + 1}`,
    colors[index],
    new math.Vector2(72, 48),
    new math.Vector2(140, 90),
  );

  card.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
  grid.addChild(card);
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
const MIN_STAGE_SIZE = 120;

interface ActiveResize {
  corner: ResizeCorner,
  fixedX: number,
  fixedY: number,
  handle: HTMLElement,
  hostLeft: number,
  hostTop: number,
  pointerId: number,
}

let activeResize: ActiveResize | undefined;

function startResize (event: PointerEvent, handle: HTMLElement): void {
  if (activeResize) {
    return;
  }

  const bounds = stage.getBoundingClientRect();
  const hostBounds = stageHost.getBoundingClientRect();
  const corner = handle.dataset.corner as ResizeCorner;
  const west = corner.endsWith('w');
  const north = corner.startsWith('n');

  event.preventDefault();
  activeResize = {
    corner,
    fixedX: west ? bounds.right : bounds.left,
    fixedY: north ? bounds.bottom : bounds.top,
    handle,
    hostLeft: hostBounds.left,
    hostTop: hostBounds.top,
    pointerId: event.pointerId,
  };
  handle.setPointerCapture(event.pointerId);
}

function resizeFromCorner (event: PointerEvent, handle: HTMLElement): void {
  if (!activeResize || activeResize.handle !== handle || event.pointerId !== activeResize.pointerId) {
    return;
  }

  const west = activeResize.corner.endsWith('w');
  const north = activeResize.corner.startsWith('n');
  const left = west ? Math.min(event.clientX, activeResize.fixedX - MIN_STAGE_SIZE) : activeResize.fixedX;
  const right = west ? activeResize.fixedX : Math.max(event.clientX, activeResize.fixedX + MIN_STAGE_SIZE);
  const top = north ? Math.min(event.clientY, activeResize.fixedY - MIN_STAGE_SIZE) : activeResize.fixedY;
  const bottom = north ? activeResize.fixedY : Math.max(event.clientY, activeResize.fixedY + MIN_STAGE_SIZE);

  stage.style.left = `${left - activeResize.hostLeft}px`;
  stage.style.top = `${top - activeResize.hostTop}px`;
  stage.style.width = `${right - left}px`;
  stage.style.height = `${bottom - top}px`;
  player.resize();
}

function finishResize (event: PointerEvent, handle: HTMLElement): void {
  if (!activeResize || activeResize.handle !== handle || event.pointerId !== activeResize.pointerId) {
    return;
  }

  activeResize = undefined;
  if (handle.hasPointerCapture(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
}

for (const handle of resizeHandles) {
  handle.addEventListener('pointerdown', event => startResize(event, handle));
  handle.addEventListener('pointermove', event => resizeFromCorner(event, handle));
  handle.addEventListener('pointerup', event => finishResize(event, handle));
  handle.addEventListener('pointercancel', event => finishResize(event, handle));
}

player.play();
window.addEventListener('beforeunload', () => {
  player.dispose();
}, { once: true });
