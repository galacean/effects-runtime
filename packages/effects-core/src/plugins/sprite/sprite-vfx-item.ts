import * as spec from '@galacean/effects-specification';
import { Vector3 } from '@galacean/effects-math/es/core/index';
import { VFXItem } from '../../vfx-item';
import type { Composition } from '../../composition';
import type { HitTestTriangleParams, BoundingBoxTriangle } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import type { SpriteGroup } from './sprite-group';
import type { SpriteItemProps } from './sprite-item';
import { SpriteItem } from './sprite-item';
import type { SpriteRenderData } from './sprite-mesh';
import { SpriteMesh } from './sprite-mesh';
import { trianglesFromRect } from '../../math';

export class SpriteVFXItem extends VFXItem<SpriteItem> {
  override composition: Composition;
  public cachePrefix?: string;
  protected sprite?: spec.SpriteContent | spec.FilterContent;

  override get type (): spec.ItemType {
    return spec.ItemType.sprite;
  }

  override onConstructed (props: spec.SpriteItem | spec.FilterItem) {
    this.sprite = props.content;
  }

  override onLifetimeBegin (composition: Composition, content: SpriteItem) {
    content.active = true;
  }

  override onItemRemoved (composition: Composition, content?: SpriteItem) {
    if (content) {
      delete content.mesh;
      composition.destroyTextures(content.getTextures());
    }
  }

  override onItemUpdate (dt: number, lifetime: number) {
    this.content?.updateTime(this.time);
  }

  override getCurrentPosition () {
    const pos = new Vector3();

    this.transform.assignWorldTRS(pos);

    return pos;
  }

  /**
   * @internal
   */
  override setColor (r: number, g: number, b: number, a: number) {
    this.content.setColor(r, g, b, a);
  }

  override setOpacity (opacity: number) {
    this.content.setOpacity(opacity);
  }

  /**
   * 获取图层包围盒的类型和世界坐标
   * @returns
   */
  override getBoundingBox (): BoundingBoxTriangle | void {
    const item: SpriteItem = this.content;

    if (!item || !this.transform) {
      return;
    }
    const worldMatrix = this.transform.getWorldMatrix();
    const size = item.startSize;
    const triangles = trianglesFromRect(Vector3.ZERO, size.x / 2, size.y / 2);

    triangles.forEach(triangle => {
      worldMatrix.transformPoint(triangle.p0 as Vector3);
      worldMatrix.transformPoint(triangle.p1 as Vector3);
      worldMatrix.transformPoint(triangle.p2 as Vector3);
    });

    return {
      type: HitTestType.triangle,
      area: triangles,
    };
  }

  override getHitTestParams (force?: boolean): HitTestTriangleParams | void {
    const item = this.content;
    const ig: SpriteGroup = this.composition?.loaderData.spriteGroup;
    const ui = item && item.interaction;

    if ((force || ui) && ig && item) {
      const area = this.getBoundingBox();

      if (area) {
        return {
          behavior: item.interaction?.behavior || 0,
          type: area.type,
          triangles: area.area,
          backfaceCulling: item.renderer.side === spec.SideMode.FRONT,
        };
      }
    }
  }

  override getRenderData (): SpriteRenderData {
    return this.content.getRenderData(this.content.time);
  }

  protected override doCreateContent (composition: Composition) {
    const { emptyTexture } = composition.getRendererOptions();

    return new SpriteItem(this.sprite as SpriteItemProps, { emptyTexture }, this);
  }

  createWireframeMesh (item: SpriteItem, color: spec.vec4): SpriteMesh {
    const spMesh = new SpriteMesh(this.composition.getEngine(), { wireframe: true, ...item.renderInfo }, this.composition);

    spMesh.setItems([item]);
    spMesh.mesh.material.setVector3('uFrameColor', Vector3.fromArray(color));
    spMesh.mesh.priority = 999;

    return spMesh;
  }
}
