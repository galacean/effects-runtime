import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Material } from '../material';
import { Geometry, VertexElementType, type Renderer, type TextMeasurement } from '../render';
import { TextCache, type GlyphAtlas } from '../render/text-cache';
import type { Texture } from '../texture';
import type { FrameComponent, FrameTitleStyle } from './frame-component';

/** Frame 自身绘制标题，共用 Graphics 的字形图集、排版和字重。 */
export class FrameTitle {
  readonly materials: Material[] = [];
  private geometry?: Geometry;
  private readonly drawMaterials: Material[] = [];
  private readonly hitPositions = new Float32Array(12);
  private readonly worldMatrix = new Matrix4();
  private iconMaterial?: Material;
  private atlas?: GlyphAtlas;
  private textKey = '';

  constructor (private readonly engine: Engine) {}

  update (frame: FrameComponent, style: FrameTitleStyle, corners: Vector3[]): void {
    const { fontSize, fontFamily, fontWeight, fontStyle } = style;
    const icon = style.icon && !style.icon.isDestroyed && style.iconSize > 0 ? style.icon : undefined;
    const graphics = this.engine.renderingServer.graphics;
    const edgeWidth = this.updateWorldMatrix(frame, corners);
    const textOffset = icon ? style.iconSize + style.iconGap : 0;
    const maxWidth = Math.max(0, Math.min(edgeWidth, style.maxWidth) - textOffset);
    const measure = (text: string) => graphics.measureText(text, fontSize, fontFamily, fontWeight, fontStyle);
    const text = this.ellipsize(`${icon ? ' ' : ''}${frame.item.name.replace(/[\r\n]+/g, ' ')}`, maxWidth, measure);
    const atlas = graphics.textCache.getAtlas(fontSize, fontFamily, fontWeight, fontStyle);
    const key = JSON.stringify([
      text, fontSize, fontFamily, fontWeight, fontStyle, atlas.resolution,
      style.gap, icon?.getInstanceId(), style.iconSize, style.iconGap,
    ]);

    if (this.textKey !== key || this.atlas !== atlas) {
      const metrics = measure(text);

      this.updateGeometry(style, atlas, text, metrics, icon);
      this.textKey = key;
      this.atlas = atlas;
    }
    for (const material of this.materials) {
      if (material !== this.iconMaterial) {
        material.setColor('_Color', style.color);
      }
    }
    atlas.uploadIfDirty();
  }

  private ellipsize (text: string, width: number, measure: (text: string) => TextMeasurement): string {
    if (measure(text).width <= width) {
      return text;
    }
    const ellipsis = '...';

    if (measure(ellipsis).width > width) {
      return '';
    }
    const characters = TextCache.graphemeSegmenter(text);
    let low = 0;
    let high = characters.length;

    while (low < high) {
      const mid = Math.ceil((low + high) / 2);

      if (measure(characters.slice(0, mid).join('') + ellipsis).width <= width) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return characters.slice(0, low).join('') + ellipsis;
  }

  /** 与图片标签一样，选取屏幕最上方的边，并从其左端沿边绘制。 */
  private updateWorldMatrix (frame: FrameComponent, corners: Vector3[]): number {
    const camera = frame.item.composition!.camera;
    let top = corners[0];

    for (const corner of corners) {
      if (corner.y > top.y) {
        top = corner;
      }
    }
    let next: Vector3 | undefined;

    for (const corner of corners) {
      if (corner !== top && (!next || corner.y >= next.y)) {
        next = corner;
      }
    }
    const left = top.x < next!.x ? top : next!;
    const right = top.x > next!.x ? top : next!;
    const axis = right.clone().subtract(left);
    const length = Math.hypot(axis.x, axis.y);

    axis.multiply(1 / length);
    const origin = camera.screenToWorldPoint(left);
    const xAxis = camera.screenToWorldPoint(new Vector3(left.x + axis.x, left.y + axis.y, left.z)).subtract(origin);
    const yAxis = camera.screenToWorldPoint(new Vector3(left.x + axis.y, left.y - axis.x, left.z)).subtract(origin);

    this.worldMatrix.set(
      xAxis.x, xAxis.y, xAxis.z, 0,
      yAxis.x, yAxis.y, yAxis.z, 0,
      0, 0, 1, 0,
      origin.x, origin.y, origin.z, 1,
    );

    return length;
  }

  private updateGeometry (style: FrameTitleStyle, atlas: GlyphAtlas, text: string, metrics: TextMeasurement, icon?: Texture): void {
    this.disposeGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const subMeshes: { offset: number, indexCount: number, vertexCount: number }[] = [];
    const textMaterials = new Map<Texture, Material>();
    const iconSize = icon ? style.iconSize : 0;
    const textOffset = icon ? iconSize + style.iconGap : 0;
    const center = -style.gap - (iconSize || style.fontSize) / 2;
    const textTop = center - metrics.inkTop - metrics.inkHeight / 2;
    const layout = atlas.getLayout(text, style.fontSize);
    let lineShift = (atlas.lineHeight - atlas.fontMetrics.fontSize) / 2;

    if (lineShift - atlas.baseLineOffset < 0) {
      lineShift = 0;
    }
    const addQuad = (material: Material, x: number, y: number, width: number, height: number, u0: number, v0: number, u1: number, v1: number) => {
      if (this.drawMaterials[this.drawMaterials.length - 1] !== material) {
        this.drawMaterials.push(material);
        subMeshes.push({ offset: indices.length * Uint16Array.BYTES_PER_ELEMENT, indexCount: 0, vertexCount: 0 });
      }
      const offset = positions.length / 3;
      const subMesh = subMeshes[subMeshes.length - 1];

      positions.push(x, y, 0, x, y + height, 0, x + width, y, 0, x + width, y + height, 0);
      uvs.push(u0, v1, u0, v0, u1, v1, u1, v0);
      indices.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
      subMesh.indexCount += 6;
      subMesh.vertexCount += 4;
    };

    // 与 Graphics.drawText 使用相同的字形 bearing、像素取整和 UV。
    for (const line of layout.lines) {
      for (let i = 0; i < line.charPositions.length; i++) {
        const glyph = atlas.chars[line.chars[i]];

        if (glyph.page === undefined || !glyph.frame) {
          continue;
        }
        const page = atlas.pages[glyph.page];
        const rect = glyph.frame;
        let material = textMaterials.get(page.texture);

        if (!material) {
          material = this.createMaterial(page.texture, false);
          textMaterials.set(page.texture, material);
          this.materials.push(material);
        }
        addQuad(
          material,
          textOffset + Math.round(line.charPositions[i] + glyph.xOffset) * layout.scale,
          textTop + Math.round(atlas.baseLineOffset + glyph.yOffset + lineShift) * layout.scale,
          rect.width * layout.scale, rect.height * layout.scale,
          rect.x / page.width, 1 - (rect.y + rect.height) / page.height,
          (rect.x + rect.width) / page.width, 1 - rect.y / page.height,
        );
      }
    }
    if (icon) {
      this.iconMaterial = this.createMaterial(icon, true);
      this.materials.push(this.iconMaterial);
      addQuad(this.iconMaterial, 0, -style.gap - iconSize, iconSize, iconSize, 0, 0, 1, 1);
    }
    this.geometry = Geometry.create(this.engine, {
      attributes: {
        [VertexElementType.Position]: { type: glContext.FLOAT, size: 3, data: new Float32Array(positions) },
        [VertexElementType.TexCoord0]: { size: 2, data: new Float32Array(uvs) },
      },
      indices: { data: new Uint16Array(indices) },
      mode: glContext.TRIANGLES,
      drawCount: indices.length,
    });
    this.geometry.subMeshes = subMeshes;
    const top = icon ? Math.min(textTop, -style.gap - iconSize) : textTop;
    const bottom = icon ? Math.max(textTop + metrics.lineHeight, -style.gap) : textTop + metrics.lineHeight;
    const right = textOffset + metrics.width;

    this.hitPositions.set([0, top, 0, 0, bottom, 0, right, top, 0, right, bottom, 0]);
  }

  private createMaterial (texture: Texture, isIcon: boolean): Material {
    const material = Material.create(this.engine, {
      shader: {
        vertex: `
          precision highp float;
          attribute vec3 aPos;
          attribute vec2 aUV;
          varying vec2 vUV;
          uniform mat4 effects_ObjectToWorld;
          uniform mat4 effects_MatrixVP;
          void main() {
            vUV = aUV;
            gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
          }
        `,
        fragment: `
          precision highp float;
          varying vec2 vUV;
          uniform sampler2D _MainTex;
          uniform vec4 _Color;
          uniform float _IsIcon;
          void main() {
            vec4 texel = texture2D(_MainTex, vUV);
            float alpha = texel.a * _Color.a;
            vec3 rgb = texel.rgb * _Color.rgb * mix(_Color.a, alpha, _IsIcon);
            gl_FragColor = vec4(rgb, alpha);
          }
        `,
        shared: true,
      },
    });

    material.depthTest = true;
    material.depthMask = false;
    material.blending = true;
    material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];
    material.setFloat('_IsIcon', +isIcon);
    material.setTexture('_MainTex', texture);
    material.setColor('_Color', Color.WHITE);

    return material;
  }

  render (renderer: Renderer): void {
    if (this.geometry) {
      this.drawMaterials.forEach((material, index) => renderer.drawGeometry(this.geometry!, this.worldMatrix, material, index));
    }
  }

  getHitTestTriangles (): TriangleLike[] {
    const point = (index: number) => this.worldMatrix.transformPoint(new Vector3(
      this.hitPositions[index * 3], this.hitPositions[index * 3 + 1], this.hitPositions[index * 3 + 2],
    ));
    const [topLeft, bottomLeft, topRight, bottomRight] = [0, 1, 2, 3].map(point);

    return [
      { p0: topLeft, p1: bottomLeft, p2: topRight },
      { p0: topRight, p1: bottomLeft, p2: bottomRight },
    ];
  }

  private disposeGeometry (): void {
    this.geometry?.dispose();
    this.materials.forEach(material => material.dispose());
    this.materials.length = 0;
    this.drawMaterials.length = 0;
    this.iconMaterial = undefined;
  }

  dispose (): void {
    this.disposeGeometry();
  }
}
