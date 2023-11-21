import * as spec from '@galacean/effects-specification';
import type { vec3 } from '@galacean/effects-specification';
import { trianglesFromRect, vec3MulMat4 } from '../../math';
import { VFXItem } from '../../vfx-item';
import type { Composition } from '../../composition';
import type { HitTestTriangleParams, BoundingBoxTriangle } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import { TextItem } from './text-item';
import type { SpriteRenderData } from '../sprite/sprite-mesh';
import { TextMesh } from './text-mesh';

export class TextVFXItem extends VFXItem<TextItem> {
  override composition: Composition;
  public cachePrefix?: string;
  textContext: spec.TextContent;

  override get type (): spec.ItemType {
    return spec.ItemType.text;
  }

  override onConstructed (props: spec.TextItem) {
    this.textContext = props.content;
  }

  override onLifetimeBegin (composition: Composition, content: TextItem) {
    this._contentVisible = true;
    content.active = true;

  }

  override onItemRemoved (composition: Composition, content?: TextItem) {
    this._contentVisible = false;

    if (content) {
      delete content.mesh;
      composition.destroyTextures(content.getTextures());
    }
  }

  override handleVisibleChanged (visible: boolean) {
    if (this.content) {
      this.content.visible = visible;
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
   * 获取图层包围盒的类型和世界坐标
   * @returns
   */
  override getBoundingBox (): BoundingBoxTriangle | void {
    const item: TextItem = this.content;

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
    const ui = item && item.interaction;

    if ((force || ui) && item.mesh?.mesh && item) {
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

    return new TextItem(this.textContext, { emptyTexture }, this);
  }

  createWireframeMesh (item: TextItem, color: spec.vec4): TextMesh {
    const spMesh = new TextMesh(this.composition.getEngine(), { wireframe: true, ...item.renderInfo }, this.composition);

    spMesh.setItems([item]);
    spMesh.mesh.material.setVector3('uFrameColor', [color[0], color[1], color[2]]);
    spMesh.mesh.priority = 999;

    return spMesh;
  }
}
