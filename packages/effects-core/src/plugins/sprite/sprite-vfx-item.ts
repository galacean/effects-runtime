import * as spec from '@galacean/effects-specification';
import type { vec3 } from '@galacean/effects-specification';
import { trianglesFromRect, vec3MulMat4 } from '../../math';
import { VFXItem } from '../../vfx-item';
import type { Composition } from '../../composition';
import type { HitTestTriangleParams, BoundingBoxTriangle } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import type { SpriteGroup } from './sprite-group';
import type { SpriteItemProps } from './sprite-item';
import { SpriteItem } from './sprite-item';
import type { SpriteRenderData } from './sprite-mesh';
import { SpriteMesh } from './sprite-mesh';

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
    const pos: vec3 = [0, 0, 0];

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
    const triangles = trianglesFromRect([0, 0, 0], size[0] / 2, size[1] / 2);

    triangles.forEach(triangle => {
      triangle.forEach(p => {
        vec3MulMat4(p, p, worldMatrix);
      });
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
    spMesh.mesh.material.setVector3('uFrameColor', [color[0], color[1], color[2]]);
    spMesh.mesh.priority = 999;

    return spMesh;
  }
}
