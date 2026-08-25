import type { Engine, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import { Control, CursorShape, MouseButton, MouseButtonMask, Texture, TextureSourceType, math } from '@galacean/effects';
import {
  AutowrapMode,
  HorizontalAlignment,
  Label,
  TextOverflow,
  TextureRect,
  TextureStretchMode,
  VerticalAlignment,
} from '@galacean/effects-plugin-gui';
import { FONT_FAMILY, getTheme } from '../theme';

export function label (
  engine: Engine,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parent: import('@galacean/effects').Control,
  options: {
    size?: number,
    color?: math.Color,
    weight?: number,
    horizontal?: HorizontalAlignment,
    vertical?: VerticalAlignment,
    overflow?: TextOverflow,
    autowrap?: AutowrapMode,
  } = {},
): Label {
  const control = new Label(engine, text);

  control.fontFamily = FONT_FAMILY;
  control.fontSize = options.size ?? 13;
  control.fontWeight = options.weight ?? 450;
  control.textColor = options.color ?? getTheme().textPrimary;
  control.horizontalAlignment = options.horizontal ?? HorizontalAlignment.Left;
  control.verticalAlignment = options.vertical ?? VerticalAlignment.Center;
  control.textOverflow = options.overflow ?? TextOverflow.Clip;
  control.autowrapMode = options.autowrap ?? AutowrapMode.Off;
  control.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
  control.parent = parent;

  return control;
}

export function createDemoTexture (engine: Engine): Texture {
  const canvas = document.createElement('canvas');

  canvas.width = 96;
  canvas.height = 64;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create the control demo texture.');
  }
  const gradient = context.createLinearGradient(0, 0, 96, 64);

  gradient.addColorStop(0, '#17314f');
  gradient.addColorStop(1, '#7c5cfc');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 64);
  context.fillStyle = '#4c8dff';
  context.fillRect(0, 0, 96, 8);
  context.fillRect(0, 56, 96, 8);
  context.fillRect(0, 0, 8, 64);
  context.fillRect(88, 0, 8, 64);
  context.fillStyle = '#ffffff';
  context.globalAlpha = 0.82;
  context.beginPath();
  context.arc(48, 32, 12, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const texture = Texture.create(engine, {
    sourceType: TextureSourceType.image,
    image: canvas,
    flipY: true,
  });

  texture.initialize();

  return texture;
}

export function texturePreview (
  engine: Engine,
  texture: Texture,
  parent: import('@galacean/effects').Control,
  x: number,
  y: number,
  width: number,
  height: number,
): TextureRect {
  const preview = new TextureRect(engine, texture);

  preview.stretchMode = TextureStretchMode.KeepAspectCentered;
  preview.setRect({ position: new math.Vector2(x, y), size: new math.Vector2(width, height) });
  preview.parent = parent;

  return preview;
}

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export class ResizeHandle extends Control {
  dragging = false;

  constructor (
    engine: Engine,
    readonly corner: ResizeCorner,
    private readonly begin: (corner: ResizeCorner) => void,
    private readonly move: (corner: ResizeCorner) => void,
  ) {
    super(engine);
    this.defaultCursorShape = corner === 'nw' || corner === 'se' ? CursorShape.Fdiagsize : CursorShape.Bdiagsize;
  }

  override draw (): void {
    const theme = getTheme();
    const color = this.dragging ? theme.accent : theme.borderStrong;

    this.fillRect(3, 3, Math.max(0, this.width - 6), Math.max(0, this.height - 6), theme.panelBg);
    this.drawRect(3.5, 3.5, Math.max(0, this.width - 7), Math.max(0, this.height - 7), color, this.dragging ? 2 : 1);
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
