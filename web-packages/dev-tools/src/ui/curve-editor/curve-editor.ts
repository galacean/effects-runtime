import { ImGui } from '../../platform/imgui';
import { InteractionColors as I } from '../theme/editor-interaction';
import type { CurveBounds, CurveKey, CurveModel, CurveRect } from './curve-model';
import { CurveScreenSpace, curveTickStep } from './curve-screen-space';

export interface CurveHit { x: number, y: number, model: CurveModel, key: CurveKey, side?: 'in' | 'out' }
export interface CurveEditorOptions {
  rect: CurveRect,
  bounds: CurveBounds,
  models: readonly CurveModel[],
  selected: ReadonlySet<string>,
  showTangents?: boolean,
  selectedTangents?: ReadonlySet<string>,
  mode?: 'curves' | 'keys',
  keyRadius?: number,
  selectedColor?: ImGui.Vec4,
  borderColor?: ImGui.Vec4,
  textColor?: ImGui.Vec4,
  gridColor?: ImGui.Vec4,
  zeroColor?: ImGui.Vec4,
  valueGrid?: boolean,
}

export class CurveEditor {
  readonly keys: CurveHit[] = [];
  readonly tangents: CurveHit[] = [];
  private models: readonly CurveModel[] = [];
  private space?: CurveScreenSpace;

  draw (options: CurveEditorOptions): void {
    const { rect, models, selected } = options;
    const space = new CurveScreenSpace(rect, options.bounds), draw = ImGui.GetWindowDrawList();

    this.space = space; this.models = models; this.keys.length = 0; this.tangents.length = 0;
    if (options.valueGrid) { this.drawValueGrid(options, space); }
    draw.PushClipRect(new ImGui.Vec2(rect.x, rect.y), new ImGui.Vec2(rect.x + rect.width, rect.y + rect.height), true);
    for (const model of models) {
      if (options.mode !== 'keys') { this.drawLine(model, space); }
      for (const key of model.keys()) {
        const x = space.timeX(key.time), y = options.mode === 'keys' ? rect.y + rect.height / 2 : space.valueY(key.value);

        if (!Number.isFinite(x) || !Number.isFinite(y)) { continue; }
        if (selected.has(key.id) && options.showTangents && options.mode !== 'keys') {
          for (const side of ['in', 'out'] as const) {
            const point = key.handles?.[side];

            if (!point) { continue; }
            const hx = space.timeX(point.time), hy = space.valueY(point.value), segment = space.clipSegment(x, y, hx, hy);

            if (segment) { draw.AddLine(new ImGui.Vec2(segment[0], segment[1]), new ImGui.Vec2(segment[2], segment[3]), ImGui.GetColorU32(options.textColor ?? I.muted)); }
            if (space.contains(hx, hy, 6)) {
              draw.AddCircleFilled(new ImGui.Vec2(hx, hy), 3.5, ImGui.GetColorU32(options.selectedColor ?? I.primaryHover));
              if (options.selectedTangents?.has(key.id + ':' + side)) { draw.AddCircle(new ImGui.Vec2(hx, hy), 5, ImGui.GetColorU32(I.foreground), 16, 1); }
              this.tangents.push({ x: hx, y: hy, model, key, side });
            }
          }
        }
        if (space.contains(x, y, 6)) {
          const hovered = ImGui.IsWindowHovered() && Math.hypot(ImGui.GetMousePos().x - x, ImGui.GetMousePos().y - y) <= 7;
          const radius = (options.keyRadius ?? 4) + (selected.has(key.id) || hovered ? 1 : 0);
          const color = selected.has(key.id) ? options.selectedColor ?? I.primaryHover : hovered ? I.foregroundHover : model.color;

          CurveEditor.diamond(x, y, color, radius, options.borderColor ?? I.outline);
          this.keys.push({ x, y, model, key });
        }
      }
    }
    draw.PopClipRect();
  }

  hitCurve (x: number, y: number, tolerance = 7): CurveModel | undefined {
    const space = this.space;
    let nearest: CurveModel | undefined, distance = tolerance;

    if (!space) { return; }
    for (const model of this.models) {
      const start = Math.max(space.rect.x, x - tolerance), end = Math.min(space.rect.x + space.rect.width, x + tolerance);
      let lastX = start, lastY = space.valueY(model.evaluate(space.timeAt(start)));

      for (let px = start + 2; px < end + 2; px += 2) {
        const nextX = Math.min(end, px), nextY = space.valueY(model.evaluate(space.timeAt(nextX)));
        const dx = nextX - lastX, dy = nextY - lastY;
        const ratio = Math.max(0, Math.min(1, ((x - lastX) * dx + (y - lastY) * dy) / (dx * dx + dy * dy || 1)));
        const delta = Math.hypot(x - lastX - ratio * dx, y - lastY - ratio * dy);

        if (delta < distance) { distance = delta; nearest = model; }
        lastX = nextX; lastY = nextY;
      }
    }

    return nearest;
  }

  private drawValueGrid (options: CurveEditorOptions, space: CurveScreenSpace): void {
    const draw = ImGui.GetWindowDrawList(), rect = space.rect;
    const step = curveTickStep((space.bounds.valueMax - space.bounds.valueMin) / Math.max(2, rect.height / 65));

    for (let value = Math.ceil(space.bounds.valueMin / step) * step; value <= space.bounds.valueMax; value += step) {
      const y = space.valueY(value), label = Math.abs(value) < 1e-8 ? '0' : Number(value.toPrecision(4)).toString();

      draw.AddLine(new ImGui.Vec2(rect.x, y), new ImGui.Vec2(rect.x + rect.width, y), ImGui.GetColorU32(Math.abs(value) < 1e-8 ? options.zeroColor ?? I.outline : options.gridColor ?? I.panel));
      draw.AddText(new ImGui.Vec2(rect.x - ImGui.CalcTextSize(label).x - 7, y - ImGui.GetTextLineHeight() / 2), ImGui.GetColorU32(options.textColor ?? I.muted), label);
    }
  }

  private drawLine (model: CurveModel, space: CurveScreenSpace): void {
    const start = space.rect.x, end = start + space.rect.width, points: ImGui.Vec2[] = [];

    if (![start, end].every(Number.isFinite) || end <= start) { return; }
    const draw = ImGui.GetWindowDrawList(), tint = ImGui.GetColorU32(model.color);
    const flush = () => { if (points.length > 1) { draw.AddPolyline(points, points.length, tint, 0, 1.6); } points.length = 0; };
    const append = (x: number, y: number) => {
      const last = points.at(-1), previous = points.at(-2);

      if (last && Math.abs(last.x - x) < 1e-6 && Math.abs(last.y - y) < 1e-6) { return; }
      if (previous && last) {
        const cross = (last.x - previous.x) * (y - previous.y) - (last.y - previous.y) * (x - previous.x);
        const length = Math.hypot(x - previous.x, y - previous.y);

        if (Math.abs(cross) <= 1e-4 * Math.max(1, length)) {
          points[points.length - 1] = new ImGui.Vec2(x, y);

          return;
        }
      }
      points.push(new ImGui.Vec2(x, y));
    };
    let lastX = start, lastY = space.valueY(model.evaluate(space.timeAt(start)));

    for (let x = start + 3; x < end + 3; x += 3) {
      const nextX = Math.min(end, x), y = space.valueY(model.evaluate(space.timeAt(nextX)));
      const segment = space.clipSegment(lastX, lastY, nextX, y);

      if (segment) {
        const last = points.at(-1);

        if (last && (Math.abs(last.x - segment[0]) > 1e-4 || Math.abs(last.y - segment[1]) > 1e-4)) { flush(); }
        append(segment[0], segment[1]); append(segment[2], segment[3]);
      } else { flush(); }
      lastX = nextX; lastY = y;
    }
    flush();
  }

  static diamond (x: number, y: number, color: ImGui.Vec4, radius: number, border: ImGui.Vec4): void {
    const draw = ImGui.GetWindowDrawList();
    const points = [new ImGui.Vec2(x, y - radius), new ImGui.Vec2(x + radius, y), new ImGui.Vec2(x, y + radius), new ImGui.Vec2(x - radius, y)];

    draw.AddQuadFilled(points[0], points[1], points[2], points[3], ImGui.GetColorU32(color));
    draw.AddQuad(points[0], points[1], points[2], points[3], ImGui.GetColorU32(border), 0.8);
  }
}
