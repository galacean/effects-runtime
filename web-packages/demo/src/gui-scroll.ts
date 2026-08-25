import type { Engine, InputEventMouseButton } from '@galacean/effects';
import { Composition, Control, FocusMode, Player, SizeFlags, math } from '@galacean/effects';
import { ScrollContainer, VBoxContainer } from '@galacean/effects-plugin-gui';

class ScrollSurface extends Control {
  constructor (engine: Engine, private readonly minimum: math.Vector2) {
    super(engine);
  }

  override getMinimumSize (): math.Vector2 {
    return this.minimum.clone();
  }

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, new math.Color(0.08, 0.10, 0.14, 1));
    for (let x = 0; x < this.width; x += 40) {
      this.drawLine(x, 0, x, this.height, new math.Color(0.16, 0.19, 0.25, 1));
    }
    for (let y = 0; y < this.height; y += 40) {
      this.drawLine(0, y, this.width, y, new math.Color(0.16, 0.19, 0.25, 1));
    }
  }
}

class FocusRow extends Control {
  private focused = false;

  constructor (engine: Engine, private readonly label: string, private readonly color: math.Color) {
    super(engine);
    this.focusMode = FocusMode.All;
    this.setCustomMinimumSize(420, 54);
  }

  override draw (): void {
    const color = this.focused ? new math.Color(0.30, 0.52, 0.92, 1) : this.color;

    this.fillRect(0, 0, this.width, this.height, color);
    this.drawText(16, 34, this.label, 16, math.Color.WHITE, 'system-ui', 600);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    this.grabFocus();
    event.accept();
  }

  override onGotFocus (): void {
    this.focused = true;
  }

  override onLostFocus (): void {
    this.focused = false;
  }
}

class RotatedClip extends Control {
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, new math.Color(0.22, 0.16, 0.32, 1));
    this.drawText(12, 28, '旋转 Control：子节点按屏幕 AABB 裁剪', 14, math.Color.WHITE);
  }
}

class OversizedChild extends Control {
  override draw (): void {
    this.fillCircle(100, 90, 86, new math.Color(0.83, 0.34, 0.45, 0.92));
    this.fillRect(-60, 62, 320, 50, new math.Color(0.94, 0.66, 0.25, 0.78));
  }
}

const stage = document.getElementById('stage');
const focusLast = document.getElementById('focus-last');

if (!stage || !focusLast) {
  throw new Error('Missing GUI scroll demo elements.');
}

const player = new Player({ container: stage, interactive: true, env:'editor' });
const composition = new Composition(player.engine);
const outer = new ScrollContainer(player.engine);
const surface = new ScrollSurface(player.engine, new math.Vector2(920, 760));
const list = new VBoxContainer(player.engine);

outer.parent = composition.uiCanvas.rootControl;
outer.setAnchorsAndOffsetsPreset('fullRect', 24);
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
  const row = new FocusRow(player.engine, `可聚焦列表项 ${index + 1}`, colors[index % colors.length]);

  row.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
  list.addChild(row);
  rows.push(row);
}

const nested = new ScrollContainer(player.engine);
const nestedSurface = new ScrollSurface(player.engine, new math.Vector2(480, 420));

nested.parent = surface;
nested.setRect({ position: new math.Vector2(560, 42), size: new math.Vector2(300, 230) });
nested.deadzone = 4;
nested.addChild(nestedSurface);
nestedSurface.draw = function (): void {
  this.fillRect(0, 0, this.width, this.height, new math.Color(0.08, 0.24, 0.26, 1));
  this.drawText(18, 34, '嵌套 ScrollContainer', 18, math.Color.WHITE, 'system-ui', 700);
  for (let index = 0; index < 8; index++) {
    this.fillRect(18 + index * 52, 70 + index * 34, 42, 120, new math.Color(0.20, 0.58, 0.60, 1));
  }
};

const rotated = new RotatedClip(player.engine);
const oversized = new OversizedChild(player.engine);

rotated.parent = surface;
rotated.setRect({ position: new math.Vector2(590, 390), size: new math.Vector2(220, 170) });
rotated.setRotation(10);
rotated.clipContents = true;
oversized.parent = rotated;
oversized.setRect({ position: new math.Vector2(10, 35), size: new math.Vector2(200, 130) });

focusLast.addEventListener('click', () => rows[rows.length - 1].grabFocus());
window.addEventListener('resize', () => player.resize());
window.addEventListener('beforeunload', () => player.dispose(), { once: true });

player.play();
