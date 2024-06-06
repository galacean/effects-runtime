import type { BlendMode, NumberArrayLike, Slot } from '@esotericsoftware/spine-core';
import {
  ClippingAttachment,
  Color,
  MeshAttachment,
  RegionAttachment,
  SkeletonClipping,
} from '@esotericsoftware/spine-core';
import type { Engine, Mesh, Renderer, Texture, Transform } from '@galacean/effects';
import { math } from '@galacean/effects';
import { SpineMesh } from './spine-mesh';

export interface SlotGroupProps {
  meshName: string,
  /**
   * 包含父节点的世界变换
   */
  transform: Transform,
  /**
   * 用于给 mesh 排序
   */
  listIndex: number,
  /**
   * png 是否已经预乘 alpha
   */
  pma: boolean,
  /**
   * mask 相关参数
   */
  renderer: {},
  engine: Engine,
}
export class SlotGroup {
  /**
   * 根据绘制顺序排列的插槽数组
   */
  private readonly slotList: Slot[] = [];
  /**
   * 顶点数据
   */
  private vertices: number[] = [];
  private clipper: SkeletonClipping = new SkeletonClipping();
  private tempColor: Color = new Color();
  private tempDark: Color = new Color();
  /**
   * 最新创建的 mesh
   */
  private currentMesh?: SpineMesh;
  /**
   * 世界变换矩阵
   */
  private wm = math.Matrix4.fromIdentity();

  meshName: string;
  listIndex: number;
  /**
   * png 是否已经预乘 alpha
   */
  pma: boolean;
  /**
   * mask 相关参数
   */
  renderer: {};
  /**
   * 包含父节点的世界变换
   */
  transform: Transform;
  /**
   * 当前绘制对应使用的 mesh 数组
   */
  meshGroups: SpineMesh[] = [];
  /**
   * 需要添加到 renderPass 的 mesh，在初始/插槽顺序变化时有增加
   */
  meshToAdd: Mesh[] = [];
  /**
   * 引擎对象
   */
  engine: Engine;

  /**
   * 默认顶点绘制顺序
   */
  static QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
  /**
   * 每个顶点的数据：x,y,r,g,b,a,u,v,r,g,b,a
   */
  static VERTEX_SIZE = 12;
  /**
   * 每个 SpineMesh 最多容纳的三角形数量
   */
  static MAX_VERTICES = 10920;

  /**
   *
   * @param drawOrder
   * @param props
   */
  constructor (drawOrder: Slot[], props: SlotGroupProps) {
    this.slotList = drawOrder;
    this.meshName = props.meshName;
    this.transform = props.transform;
    this.listIndex = props.listIndex;
    this.pma = props.pma;
    this.renderer = props.renderer;
    this.engine = props.engine;
  }

  resetMeshes () {
    this.meshToAdd.length = 0;
  }

  /**
   * 按照 drawOrder 遍历 slot，根据 region、mesh、clip 附件更新 mesh 的 geometry 和 material 信息
   */
  update () {
    const clipper = this.clipper;
    const pma = this.pma;

    let vertices = this.vertices;
    let uvs: NumberArrayLike;
    let triangles: number[] = [];

    let finalVertices: number[] = [];
    let finalVerticesLength = 0;
    let finalIndices: number[] = [];
    let finalIndicesLength = 0;
    let currentIndex = 0;

    this.currentMesh = this.meshGroups[currentIndex];
    this.meshGroups.map(sp => sp.startUpdate());

    for (const slot of this.slotList) {
      const vertexSize = clipper.isClipping() ? 2 : SlotGroup.VERTEX_SIZE;
      const attachment = slot.getAttachment();
      let attachmentColor: Color | null;
      let texture: Texture | null;
      let numFloats = 0;

      finalVertices = [];
      finalIndices = [];
      finalVerticesLength = 0;
      finalIndicesLength = 0;

      if (!slot.bone.active) {
        clipper.clipEndWithSlot(slot);
        continue;
      }

      /**
       * RegionAttachment：包含一个纹理（texture）区域和一个偏移 SRT，这个偏移量用于对齐相对于附件的骨骼区域
       */
      if (attachment instanceof RegionAttachment) {
        const region = attachment;

        attachmentColor = region.color;
        vertices = this.vertices;
        numFloats = vertexSize << 2;
        region.computeWorldVertices(slot, vertices, 0, vertexSize);
        triangles = SlotGroup.QUAD_TRIANGLES;
        uvs = region.uvs;
        // @ts-expect-error
        texture = region.region.page.texture;
      } else if (attachment instanceof MeshAttachment) {
        const mesh = attachment;

        attachmentColor = mesh.color;
        vertices = this.vertices;
        numFloats = (mesh.worldVerticesLength >> 1) * vertexSize;
        mesh.computeWorldVertices(slot, 0, mesh.worldVerticesLength, vertices, 0, vertexSize);
        triangles = mesh.triangles;
        uvs = mesh.uvs;
        // @ts-expect-error
        texture = mesh.region.page.texture;
      } else if (attachment instanceof ClippingAttachment) {
        // 剪裁应用于绘制顺序中从裁剪附件开始到裁剪附件的结束插槽之间的所有插槽（包括这两个位置）。
        clipper.clipStart(slot, attachment);
        continue;
      } else {
        clipper.clipEndWithSlot(slot);
        continue;
      }

      if (texture) {
        const skeleton = slot.bone.skeleton;
        const skeletonColor = skeleton.color;
        const slotColor = slot.color;
        const color = this.tempColor;
        const darkColor = this.tempDark;
        // const attachmentName = `${slot.data.name}-${attachment.name}`;

        // 设置颜色，全部进行 alpha 预乘，设置对应的 blendMode
        color.set(skeletonColor.r * slotColor.r * attachmentColor.r,
          skeletonColor.g * slotColor.g * attachmentColor.g,
          skeletonColor.b * slotColor.b * attachmentColor.b,
          skeletonColor.a * slotColor.a * attachmentColor.a);
        if (pma) {
          color.r *= color.a;
          color.g *= color.a;
          color.b *= color.a;
        }

        if (!slot.darkColor) {
          darkColor.set(0, 0, 0, 1);
        } else {
          if (pma) {
            darkColor.r = slot.darkColor.r * color.a;
            darkColor.g = slot.darkColor.g * color.a;
            darkColor.b = slot.darkColor.b * color.a;
            darkColor.a = 1.0;
          } else {
            darkColor.setFromColor(slot.darkColor);
            darkColor.a = 0.0;
          }
        }

        // 顶点裁剪
        if (clipper.isClipping()) {
          clipper.clipTriangles(vertices, numFloats, triangles, triangles.length, uvs, color, darkColor, true);
          finalVertices = clipper.clippedVertices;
          finalVerticesLength = finalVertices.length;
          finalIndices = clipper.clippedTriangles;
          finalIndicesLength = finalIndices.length;
        } else {
          for (let v = 2, u = 0, n = numFloats; v < n; v += vertexSize, u += 2) {
            vertices[v] = color.r;
            vertices[v + 1] = color.g;
            vertices[v + 2] = color.b;
            vertices[v + 3] = color.a;
            vertices[v + 4] = uvs[u];
            vertices[v + 5] = uvs[u + 1];
            vertices[v + 6] = darkColor.r;
            vertices[v + 7] = darkColor.g;
            vertices[v + 8] = darkColor.b;
            vertices[v + 9] = darkColor.a;
          }
          finalVertices = vertices.slice(0, numFloats);
          finalVerticesLength = numFloats;
          finalIndices = triangles;
          finalIndicesLength = triangles.length;
        }
        if (finalVerticesLength == 0 || finalIndicesLength == 0) {
          clipper.clipEndWithSlot(slot);
          continue;
        }

        const index = this.findMeshIndex(currentIndex, slot.data.blendMode, texture, finalIndicesLength);

        if (index === -1) {
          const newMesh = this.currentMesh = new SpineMesh({
            blendMode: slot.data.blendMode,
            texture,
            name: this.meshName,
            priority: this.listIndex += 0.01,
            pma,
            renderer: this.renderer,
            engine: this.engine,
          });

          currentIndex = this.meshGroups.length;
          this.meshGroups.push(newMesh);
          this.meshToAdd.push(newMesh.mesh);
        } else {
          currentIndex = index;
          this.currentMesh = this.meshGroups[index];
        }
        this.currentMesh.updateMesh(finalVertices, finalIndices, finalVerticesLength);
      }
      clipper.clipEndWithSlot(slot);
    }

    clipper.clipEnd();
    this.wm = this.transform.getWorldMatrix();
    this.meshGroups.map(sp => sp.endUpdate(this.wm));
  }

  /**
   * @since 2.0.0
   * @internal
   * @param renderer
   */
  render (renderer: Renderer) {
    this.meshGroups.forEach(spineMesh => {
      const mesh = spineMesh.mesh;

      mesh.geometry.flush();
      mesh.material.initialize();
      renderer.drawGeometry(mesh.geometry, mesh.material);
    });
  }

  /**
   * * 从 startIndex 开始，找到材质和顶点数符合限制的 SpineMesh
   */
  private findMeshIndex (startIndex: number, blendMode: BlendMode, texture: Texture, vertexNum: number): number {
    let res = -1;

    for (let i = startIndex; i < this.meshGroups.length; i++) {
      const mesh = this.meshGroups[i];

      if (mesh && mesh.blending === blendMode && mesh.texture === texture && (vertexNum + mesh.indicesNum < SlotGroup.MAX_VERTICES)) {
        res = i;

        break;
      }
    }

    return res;
  }
}
