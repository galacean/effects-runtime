import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import * as spec from '@galacean/effects-specification';
import { Component } from './component';
import { effectsClass } from '../decorators';
import { glContext as gl } from '../gl';
import { Material } from '../material/material';
import { MaskStencil } from '../material/mask-stencil';
import { GraphicsPath } from '../plugins/shape/graphics-path';
import { appendBezierPaths, buildPathGeometry } from '../plugins/shape/path-geometry';
import { Geometry } from '../render/geometry';
import { BufferUsage } from '../render/gpu-buffer';
import type { Renderer } from '../render/renderer';

/** Ordered, hard-edge paths owned by one layer; not independently rendered scene items. */
@effectsClass(spec.DataType.MaskComponent)
export class MaskComponent extends Component {
  /** Animation bindings use masks.<id>.path.points.<index>, independently of stack order. */
  readonly masks: Record<string, spec.PathMaskData> = Object.create(null);

  private order: string[] = [];
  private geometries = new Map<string, { geometry: Geometry, revision: number, scale: number }>();
  private revision = 0;
  private material?: Material;
  private mvp = new Matrix4();

  override onAwake (): void {
    if (this.item.getComponents(MaskComponent).length > 1) {
      throw new Error('A layer can own only one MaskComponent. Add paths to its masks array.');
    }
  }

  /** Replaces the ordered stack. Surviving IDs retain their animation binding objects. */
  setMasks (masks: readonly spec.PathMaskData[]): void {
    const ids = new Set<string>();

    for (const mask of masks) {
      if (typeof mask.id !== 'string' || !/^[\w-]+$/.test(mask.id) || ids.has(mask.id)) {
        throw new Error(`Invalid or duplicate path mask ID: ${mask.id}`);
      }
      if (mask.operation !== undefined && ![spec.MaskOperation.Add, spec.MaskOperation.Subtract, spec.MaskOperation.Intersect].includes(mask.operation)) {
        throw new Error(`Unsupported mask operation: ${mask.operation}`);
      }
      validatePath(mask.path);
      ids.add(mask.id);
    }
    for (const id of this.order) {
      if (!ids.has(id)) {
        this.geometries.get(id)?.geometry.dispose();
        this.geometries.delete(id);
        delete this.masks[id];
      }
    }
    for (const mask of masks) {
      const current = this.masks[mask.id];

      if (current) {
        copyPath(current.path, mask.path);
        current.name = mask.name;
        current.enabled = mask.enabled;
        current.operation = mask.operation;
        current.inverted = mask.inverted;
      } else {
        this.masks[mask.id] = cloneMask(mask);
      }
    }
    this.order = masks.map(mask => mask.id);
    this.revision++;
  }

  /** Returns a detached snapshot in evaluation order. */
  getMasks (): spec.PathMaskData[] {
    return this.order.map(id => cloneMask(this.masks[id]));
  }

  setMaskPath (id: string, path: spec.ShapePathData): void {
    if (!this.masks[id]) {
      throw new Error(`Path mask not found: ${id}`);
    }
    validatePath(path);
    copyPath(this.masks[id].path, path);
    const cached = this.geometries.get(id);

    if (cached) {
      cached.revision = -1;
    }
  }

  moveMask (id: string, index: number): void {
    const previous = this.order.indexOf(id);

    if (previous < 0 || !Number.isInteger(index) || index < 0 || index >= this.order.length) {
      throw new Error('Invalid path mask or destination index.');
    }
    this.order.splice(previous, 1);
    this.order.splice(index, 0, id);
  }

  override onApplyAnimationProperties (): void {
    this.revision++;
  }

  /** @internal */
  hasActivePaths (): boolean {
    return this.isActiveAndEnabled && this.order.some(id => this.isPathActive(this.masks[id]));
  }

  /** Writes the stack to bit 0; bit 1 is scratch, all other stencil bits are preserved. @internal */
  drawStencilStack (renderer: Renderer, worldMatrix = this.transform.getWorldMatrix()): void {
    let first = true;
    const scale = this.computeScreenScale(renderer, worldMatrix);
    const pathBits = MaskStencil.Path | MaskStencil.Scratch;

    for (const id of this.order) {
      const mask = this.masks[id];

      if (!this.isPathActive(mask)) {
        continue;
      }
      const operation = mask.operation ?? spec.MaskOperation.Add;
      const inverted = !!mask.inverted;

      if (first) {
        const complement = inverted !== (operation === spec.MaskOperation.Subtract);

        renderer.drawFullscreenStencil(pathBits, complement ? MaskStencil.Path : 0, gl.ALWAYS, gl.REPLACE);
        this.drawPath(renderer, id, scale, MaskStencil.Path, complement ? 0 : MaskStencil.Path, worldMatrix);
        first = false;
      } else if (operation === spec.MaskOperation.Add && !inverted) {
        this.drawPath(renderer, id, scale, MaskStencil.Path, MaskStencil.Path, worldMatrix);
      } else if ((operation === spec.MaskOperation.Subtract && !inverted) || (operation === spec.MaskOperation.Intersect && inverted)) {
        this.drawPath(renderer, id, scale, MaskStencil.Path, 0, worldMatrix);
      } else {
        renderer.drawFullscreenStencil(MaskStencil.Scratch, 0, gl.ALWAYS, gl.ZERO);
        this.drawPath(renderer, id, scale, MaskStencil.Scratch, MaskStencil.Scratch, worldMatrix);
        if (operation === spec.MaskOperation.Add) {
          renderer.drawFullscreenStencil(MaskStencil.Scratch, 0, gl.ALWAYS, gl.INVERT);
          // GL compares reference <= stored value: either coverage bit makes the union true.
          renderer.drawFullscreenStencil(pathBits, MaskStencil.Path, gl.LEQUAL, gl.REPLACE, gl.KEEP, MaskStencil.Path);
        } else {
          renderer.drawFullscreenStencil(pathBits, pathBits, gl.EQUAL, gl.KEEP, gl.ZERO, MaskStencil.Path);
        }
      }
    }
  }

  override fromData (data: spec.MaskComponentData): void {
    super.fromData({ ...data, _enabled: data.enabled ?? true });
    this.setMasks(data.masks);
  }

  override toData (): void {
    delete this.definition._enabled;
    Object.assign(this.definition, {
      id: this.getInstanceId(), dataType: spec.DataType.MaskComponent,
      item: { id: this.item.getInstanceId() }, enabled: this.enabled, masks: this.getMasks(),
    });
  }

  override dispose (): void {
    for (const { geometry } of this.geometries.values()) {
      geometry.dispose();
    }
    this.geometries.clear();
    this.material?.dispose();
    this.material = undefined;
    super.dispose();
  }

  private isPathActive (mask: spec.PathMaskData): boolean {
    return mask.enabled !== false && mask.path.shapes.some(shape => shape.close && shape.indexes.length > 0);
  }

  private drawPath (renderer: Renderer, id: string, scale: number, writeMask: number, reference: number, worldMatrix: Matrix4): void {
    let cached = this.geometries.get(id);

    if (!cached || cached.revision !== this.revision || cached.scale !== scale) {
      const path = new GraphicsPath();
      const data = this.masks[id].path;

      appendBezierPaths(path, data, scale, true);
      const vertices = new Float32Array(buildPathGeometry(path.shapePath, scale, 'compound').vertices);
      const geometry = cached?.geometry ?? Geometry.create(this.engine, { attributes: {}, mode: gl.TRIANGLES });

      const previousVertices = geometry.getAttributeData('aPos');

      if (previousVertices && previousVertices.length >= vertices.length) {
        geometry.setAttributeData('aPos', vertices);
      } else {
        geometry.setAttribute('aPos', { data: vertices, size: 2 }, BufferUsage.Dynamic);
      }
      geometry.setDrawCount(vertices.length / 2);
      cached = { geometry, revision: this.revision, scale };
      this.geometries.set(id, cached);
    }
    if (!this.material) {
      this.material = Material.create(this.engine, {
        shader: {
          vertex: `attribute vec2 aPos;
uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;
void main() { gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 0.0, 1.0); }`,
          fragment: 'precision mediump float; void main() { gl_FragColor = vec4(0.0); }',
        },
      });
      this.material.colorMask = false;
      this.material.depthTest = false;
      this.material.depthMask = false;
      this.material.culling = false;
      this.material.blending = false;
      this.material.stencilTest = true;
      this.material.stencilFunc = [gl.ALWAYS, gl.ALWAYS];
      this.material.stencilOpZPass = [gl.REPLACE, gl.REPLACE];
    }
    this.material.stencilMask = [writeMask, writeMask];
    this.material.stencilRef = [reference, reference];
    renderer.drawGeometry(cached.geometry, worldMatrix, this.material);
  }

  private computeScreenScale (renderer: Renderer, worldMatrix: Matrix4): number {
    const vp = renderer.renderingData.globalUniforms.matrices.effects_MatrixVP;

    if (!vp) {
      return 1;
    }
    this.mvp.multiplyMatrices(vp, worldMatrix);
    const e = this.mvp.elements;
    const [, , width, height] = renderer.getViewport();
    const w = Math.abs(e[15]) || 1;
    const scale = Math.max(Math.hypot(e[0] * width, e[1] * height), Math.hypot(e[4] * width, e[5] * height)) / (2 * w);

    // Quantization avoids retessellating a curve on every small transform change.
    return 2 ** Math.ceil(Math.log2(Math.max(1, Math.min(65536, scale))));
  }
}

function validatePath (path: spec.ShapePathData): void {
  if (!path || !Array.isArray(path.shapes)) {
    throw new Error('A mask path requires indexed contours.');
  }
  for (const vectors of [path.points, path.easingIns, path.easingOuts]) {
    if (!Array.isArray(vectors) || vectors.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      throw new Error('Mask vertices and tangents must be finite arrays.');
    }
  }
  for (const shape of path.shapes) {
    if (!shape || typeof shape.close !== 'boolean' || !Array.isArray(shape.indexes)) {
      throw new Error('A mask contour requires indexes and a close flag.');
    }
    for (const index of shape.indexes) {
      if (!index || !Number.isInteger(index.point) || index.point < 0 || index.point >= path.points.length ||
        !Number.isInteger(index.easingIn) || index.easingIn < 0 || (path.easingIns.length > 0 && index.easingIn >= path.easingIns.length) ||
        !Number.isInteger(index.easingOut) || index.easingOut < 0 || (path.easingOuts.length > 0 && index.easingOut >= path.easingOuts.length)) {
        throw new Error('Mask contour indexes must reference existing vertices and tangents.');
      }
    }
  }
}

function copyPath (target: spec.ShapePathData, source: spec.ShapePathData): void {
  for (const key of ['points', 'easingIns', 'easingOuts'] as const) {
    const sourcePoints = source[key];
    const points = target[key];

    for (let i = 0; i < sourcePoints.length; i++) {
      if (points[i]) {
        points[i].x = sourcePoints[i].x;
        points[i].y = sourcePoints[i].y;
      } else {
        points[i] = { ...sourcePoints[i] };
      }
    }
    points.length = sourcePoints.length;
  }
  for (let i = 0; i < source.shapes.length; i++) {
    const sourceShape = source.shapes[i];
    const shape = target.shapes[i] ?? (target.shapes[i] = { close: sourceShape.close, indexes: [] });

    shape.close = sourceShape.close;
    for (let j = 0; j < sourceShape.indexes.length; j++) {
      const index = shape.indexes[j] ?? (shape.indexes[j] = { point: 0, easingIn: 0, easingOut: 0 });

      Object.assign(index, sourceShape.indexes[j]);
    }
    shape.indexes.length = sourceShape.indexes.length;
    if (sourceShape.transform) {
      shape.transform = JSON.parse(JSON.stringify(sourceShape.transform));
    } else {
      delete shape.transform;
    }
  }
  target.shapes.length = source.shapes.length;
}

function cloneMask (mask: spec.PathMaskData): spec.PathMaskData {
  const path: spec.ShapePathData = { points: [], easingIns: [], easingOuts: [], shapes: [] };

  copyPath(path, mask.path);

  return { ...mask, path };
}
