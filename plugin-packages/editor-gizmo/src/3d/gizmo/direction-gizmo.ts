import { MouseButton, PluginSystem, Transform, math, type Engine, type Texture, type spec, type Composition, type InputEventMouseButton, type Renderer } from '@galacean/effects';
import type { Point2 } from '../../math/types';
import { computeOrthographicOffCenter } from '../../math/projection';
import { directionGizmoStyle } from './gizmo-settings';
import type { EditorGizmoPlugin } from '../editor-gizmo-plugin';
import { Control, MouseFilter } from '@galacean/effects-plugin-gui';
import type { Editor3D } from '../editor-3d';
import { PrimitiveType } from '../geometry/primitives';
import { GizmoBoundsType, type GizmoBounds } from './gizmo-bounds';
import { color, renderMode } from './gizmo-settings';
import { createGizmoDrawing, createGizmoMesh, createGizmoIcon, updateGizmoMatrices, highlightGizmo, drawGizmo, disposeGizmoDrawing, type GizmoDrawing, type GizmoMesh } from './gizmo-drawing';
import { hitTestGizmo, type GizmoHit } from './gizmo-picking';

/** Draws and picks the six-axis direction control in the viewport corner. */
export class DirectionGizmo extends Control {
  private hoveredAxis?: string;
  private drawingScene?: Composition;
  private drawing?: GizmoDrawing;

  constructor (private readonly viewport: Editor3D) {
    super(viewport.engine);
    this.setAnchorsAndOffsetsPreset('fullRect');
    this.mouseFilter = MouseFilter.Ignore;
  }

  updateDrawing (): void {
    if (this.isDisposed) { return; }
    const composition = this.viewport.composition;

    if (this.drawingScene !== composition) {
      this.disposeDrawing();
      this.drawingScene = composition;
    }
    if (!composition) { return; }
    if (!this.drawing) {
      const plugin = PluginSystem.getPlugins()?.find(plugin => plugin.name === 'editor-gizmo') as EditorGizmoPlugin | undefined;

      if (!plugin) { return; }
      this.drawing = createDirectionDrawing(this.viewport.engine, plugin.getIconTextures(composition));
    }
    const drawing = this.drawing;
    const camera = composition.camera;
    const orientation = camera.getInverseViewMatrix().getTransform().rotation.conjugate();
    const { x: width, y: height } = this.viewport.viewportSize;
    const inset = directionGizmoStyle.margin + directionGizmoStyle.size / 2;
    const model = new math.Matrix4().compose(new math.Vector3(width / 2 - inset, height / 2 - inset, 0), new math.Quaternion(), math.Vector3.ONE);

    drawing.projection = computeOrthographicOffCenter(-width / 2, width / 2, -height / 2, height / 2, -100, 100);

    highlightGizmo(drawing, this.hoveredAxis);
    for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
      const direction = new math.Vector3();

      direction.setElement(index, 1);
      direction.applyQuaternion(orientation).multiply(directionGizmoStyle.axisLength);
      for (const part of drawing.meshes) {
        if (!part.data.name.endsWith(axis) && part.data.name !== 'pos' + axis + 'Line') { continue; }
        const line = part.data.name.endsWith('Line');
        const sign = part.data.name.startsWith('neg') ? -1 : 1;
        const point = direction.clone().multiply(sign);

        if (line) {
          const length = point.toVector2().length();
          const start = Math.min(0.5, length);
          const midpoint = length > 0 ? (length + start) / (2 * length) : 0;

          part.local.setTransform({ position: new math.Vector3(point.x * midpoint, point.y * midpoint, point.z),
            quat: new math.Quaternion().setFromAxisAngle(new math.Vector3(0, 0, 1), Math.atan2(point.y, point.x)),
            scale: new math.Vector3((length - start) / directionGizmoStyle.axisLength, 1, 1) });
        } else {
          part.local.setTransform({ position: point });
        }
      }
    }
    // Paint far markers first; the front-facing circles cover lines and rear markers.
    drawing.meshes.sort((a, b) => {
      return a.local.position.z - b.local.position.z || Number(!a.data.name.endsWith('Line')) - Number(!b.data.name.endsWith('Line'));
    });
    updateGizmoMatrices(drawing, camera.getInverseViewMatrix().multiply(model));
  }

  drawGizmo (renderer: Renderer): void {
    if (!this.visible || this.isDisposed) { return; }
    this.updateDrawing();
    if (this.drawing) { drawGizmo(this.drawing, renderer); }
  }

  private disposeDrawing (): void {
    if (this.drawing) { disposeGizmoDrawing(this.drawing); }
    this.drawing = undefined;
    this.drawingScene = undefined;
  }

  override onDestroy (): void { this.disposeDrawing(); }

  hover (point?: Point2): void {
    this.hoveredAxis = point ? this.hitTest(point)?.key : undefined;
    if (this.drawing) { highlightGizmo(this.drawing, this.hoveredAxis); }
  }

  hasGeometry (): boolean { return !!this.drawing?.meshes.length; }

  hitTest (point: Point2): GizmoHit | undefined {
    const composition = this.viewport.composition;
    const ndc = this.viewport.toNDC(point);

    if (this.isDisposed || !this.visible || !this.viewport.enabled || !composition?.interactive || !ndc) { return; }
    this.updateDrawing();

    return this.drawing && hitTestGizmo(this.drawing, composition.getHitTestRay(ndc.x, ndc.y), ndc, composition.camera, this.viewport.viewportSize);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    const hit = this.pickAxis(event.position);

    if (!hit) { return; }
    event.accept();
    this.viewport.viewportCamera.orientToAxis(hit.axis, hit.sign);
  }

  pickAxis (point: Point2): { axis: number, sign: number } | undefined {
    const hit = this.hitTest(point);

    return hit && this.axisFromKey(hit.key);
  }
  private axisFromKey (key: string): { axis: number, sign: number } | undefined {
    const match: Record<string, { axis: number, sign: number }> = {
      posX: { axis: 0, sign: 1 }, negX: { axis: 0, sign: -1 },
      posY: { axis: 1, sign: 1 }, negY: { axis: 1, sign: -1 },
      posZ: { axis: 2, sign: 1 }, negZ: { axis: 2, sign: -1 },
    };

    return match[key];
  }
}

function createDirectionDrawing (engine: Engine, texture: Map<string, Texture>): GizmoDrawing {
  const boundingMap = new Map<string, GizmoBounds>();
  const result = new Map<GizmoMesh, Transform>();
  const { axisLength, markerSize, lineWidth } = directionGizmoStyle;
  const colors = [color.xAxisColor, color.yAxisColor, color.zAxisColor];

  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
    const stem = createGizmoMesh(engine, PrimitiveType.Plane, {
      size: { width: axisLength, height: lineWidth }, color: colors[index] as spec.vec3,
      renderMode, name: 'pos' + axis + 'Line',
    });

    stem.material.depthMask = false;
    result.set(stem, new Transform());
    for (const sign of [1, -1]) {
      const name = (sign > 0 ? 'pos' : 'neg') + axis;
      const local = new Transform();
      const marker = createGizmoIcon(engine, {
        size: { width: markerSize, height: markerSize }, color: colors[index] as spec.vec3, renderMode, name,
      }, texture.get(name));

      local.position.setElement(index, axisLength * sign);
      marker.material.depthMask = false;
      result.set(marker, local);
      // Match the pick radius to the visible SVG circle.
      boundingMap.set(name, { type: GizmoBoundsType.sphere, center: local.position, radius: markerSize * 0.42 });
    }
  }

  return createGizmoDrawing(result, boundingMap);
}
