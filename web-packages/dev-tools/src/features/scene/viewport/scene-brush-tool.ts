import { math, MouseButton, ShapeComponent, spec } from '@galacean/effects';
import type { InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import { Gizmo, GizmoTool, GestureCursorType, GizmoViewportUtils, createInteractionPlane, viewPositionToWorld } from '@galacean/effects-plugin-editor-gizmo';
import type { GizmoOwner } from '@galacean/effects-plugin-editor-gizmo';
import type { Control } from '@galacean/effects-plugin-gui';
import { expandStrokePath, flattenStrokePath } from '../../../../../../packages/effects-core/src/math/shape/stroke-expansion';
import { triangulate } from '../../../../../../packages/effects-core/src/math/shape/triangulate';
import { SceneItemOperations } from '../operations/scene-item-operations';
import { sceneWorkspace } from '../scene-workspace';
import { applyShapeComponentData, readShapeComponentData } from '../serialization/shape-component-data';
import type { SceneDocument } from '../document/scene-document';
import { STROKE_WIDTH_PRESETS } from '../factories/stroke-width-presets';
import { BrushPathSampler, brushContour, createBrushCurve } from './scene-brush-path';
import type { BrushCurve } from './scene-brush-path';
import type { SceneBrushSettings } from './scene-brush-settings';

interface BrushProjection {
  origin: math.Vector3,
  x: math.Vector3,
  y: math.Vector3,
  pixelSize: number,
}

interface BrushDraft {
  document: SceneDocument,
  settings: SceneBrushSettings,
  projection: BrushProjection,
  sampler: BrushPathSampler,
  curve?: BrushCurve,
}

/** A draft stays outside the scene graph until its pointer gesture completes. */
export class SceneBrushTool extends GizmoTool {
  private draft?: BrushDraft;
  private pending = false;
  private dirty = false;
  private triangles: number[] = [];

  constructor (owner: GizmoOwner, readonly settings: SceneBrushSettings) { super(owner); }

  override createGizmos (): Gizmo[] { return [new SceneBrushGizmo(this.owner, this)]; }

  begin (position: math.Vector2): boolean {
    const document = sceneWorkspace.current;
    const projection = this.projection();

    if (!document || document.composition.engine !== this.owner.getEngine() || document.restoring || sceneWorkspace.busy || !projection) { return false; }
    this.cancel();
    this.draft = { document, projection, settings: { ...this.settings, color: this.settings.color.clone() },
      sampler: new BrushPathSampler(position, this.settings.spacing) };
    this.dirty = true;

    return true;
  }

  sample (position: math.Vector2): void {
    const draft = this.draft;

    if (!draft || this.pending || !draft.sampler.add(position)) { return; }
    draft.curve = undefined; this.dirty = true;
  }

  finish (event: InputEventMouseButton): void {
    if (event.canceled) { this.cancel(); } else if (this.draft) { this.sample(event.position); this.pending = true; }
  }

  cancel (): void { this.draft = undefined; this.pending = this.dirty = false; this.triangles.length = 0; }

  /** Commit after input dispatch so selection changes cannot interrupt the gesture. */
  commitPendingStroke (): void {
    if (!this.pending || !this.draft) { return; }
    const { document, settings, projection, sampler } = this.draft;
    const curve = this.draft.curve ?? createBrushCurve(sampler.points, settings.smoothing);
    const world = (point: math.Vector2, vector = false): math.Vector3 => projection.x.clone().multiply(point.x)
      .add(projection.y.clone().multiply(point.y)).add(vector ? new math.Vector3() : projection.origin);
    const points = curve.points.map(point => world(point));
    const bounds = new math.Box3();

    points.forEach(point => bounds.expandByPoint(point));
    const center = bounds.getCenter(new math.Vector3());

    this.cancel();
    if (document !== sceneWorkspace.current || sceneWorkspace.busy || document.restoring) { return; }
    new SceneItemOperations(document).create({ type: spec.ItemType.shape, label: 'Brush Stroke' }, undefined, item => {
      const component = item.getComponent(ShapeComponent);
      const parentMatrix = item.parent!.transform.getWorldMatrix().clone();

      if (Math.abs(parentMatrix.determinant()) < 1e-10) { throw new Error('Cannot draw into a scene with zero scale.'); }
      const matrix = new math.Matrix4().compose(center, new math.Quaternion(), new math.Vector3(1, 1, 1));
      const xy = (point: math.Vector3): { x: number, y: number } => ({ x: point.x, y: point.y });
      const { r, g, b, a } = settings.color;

      item.transform.cloneFromMatrix(parentMatrix.invert().multiply(matrix));
      applyShapeComponentData(component, { ...readShapeComponentData(component), type: spec.ShapePrimitiveType.Custom,
        points: points.map(point => xy(point.subtract(center))),
        easingIns: curve.easingIns.map(point => xy(world(point, true))),
        easingOuts: curve.easingOuts.map(point => xy(world(point, true))),
        shapes: [{ close: false, indexes: points.map((_, index) => ({ point: index, easingIn: index, easingOut: index })) }],
        fills: [], strokes: [{ type: spec.FillType.Solid, color: { r, g, b, a } }],
        strokeWidth: settings.width, strokeAlignment: .5, strokeCap: settings.cap, strokeJoin: settings.join,
        strokeMiterLimit: settings.miterLimit, variableWidthPoints: STROKE_WIDTH_PRESETS[settings.profile].points.map(point => ({ ...point })),
      });
      component.onUpdate(0);
    });
  }

  draw (control: Control): void {
    const draft = this.draft;

    if (!draft) { return; }
    if (this.dirty) {
      const curve = draft.curve ??= createBrushCurve(draft.sampler.points, draft.settings.smoothing);
      const { width, cap, join, miterLimit, profile } = draft.settings;
      const expanded = expandStrokePath(brushContour(curve), { width: width / draft.projection.pixelSize,
        alignment: .5, cap, join, miterLimit, variableWidthPoints: STROKE_WIDTH_PRESETS[profile].points });

      this.triangles = triangulate(flattenStrokePath(expanded, 1).map(contour => contour.points), 'nonzero');
      this.dirty = false;
    }
    const vertices = this.triangles;

    for (let index = 0; index < vertices.length; index += 6) {
      control.fillTriangle(vertices[index], vertices[index + 1], vertices[index + 2], vertices[index + 3], vertices[index + 4], vertices[index + 5], draft.settings.color);
    }
  }

  private projection (): BrushProjection | undefined {
    const engine = this.owner.getEngine(), container = engine.canvas.parentElement;

    if (!container) { return; }
    const size = GizmoViewportUtils.getContainerSize(container), camera = GizmoViewportUtils.getCameraInfo(engine);
    const plane = createInteractionPlane(new math.Vector3(), new math.Euler());
    const origin = viewPositionToWorld(new math.Vector2(), camera, plane, size);
    const x = viewPositionToWorld(new math.Vector2(1, 0), camera, plane, size);
    const y = viewPositionToWorld(new math.Vector2(0, 1), camera, plane, size);

    if (!origin || !x || !y) { return; }
    x.subtract(origin); y.subtract(origin);
    const pixelSize = x.length();

    return pixelSize > 0 ? { origin, x, y, pixelSize } : undefined;
  }
}

class SceneBrushGizmo extends Gizmo {
  readonly type = 'scene-brush';
  constructor (owner: GizmoOwner, private readonly tool: SceneBrushTool) { super(owner); }
  override requiresDragThreshold (): boolean { return false; }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.tool.begin(event.position)) { this.cursor(); event.accept(); }
  }
  override onMouseDrag (event: InputEventMouseMotion): void { this.tool.sample(event.position); this.cursor(); event.accept(); }
  override onMouseMove (event: InputEventMouseMotion): void { this.cursor(); event.accept(); }
  override onMouseUp (event: InputEventMouseButton): void {
    this.tool.finish(event); this.cursor(); event.accept();
  }
  override draw (control: Control): void { this.tool.draw(control); }
  override dispose (): void { this.tool.cancel(); }
  private cursor (): void { this._owner.setCursor({ type: GestureCursorType.PEN, angle: 0 }); }
}
