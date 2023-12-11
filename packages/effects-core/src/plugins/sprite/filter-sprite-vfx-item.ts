import * as spec from '@galacean/effects-specification';
import { Matrix4, Vector4 } from '@galacean/effects-math/es/core/index';
import type { FilterDefine } from '../../filter';
import { createFilter } from '../../filter';
import type { Composition } from '../../composition';
import { SpriteVFXItem } from './sprite-vfx-item';
import type { SpriteItem } from './sprite-item';

let seed = 1;

export class FilterSpriteVFXItem extends SpriteVFXItem {
  private filter: FilterDefine;
  private filterOptions: spec.FilterParams;

  override get type (): spec.ItemType {
    return spec.ItemType.filter;
  }

  override onConstructed (props: spec.FilterItem) {
    super.onConstructed(props);
    this.filterOptions = props.content.filter;
    this.cachePrefix = 'filter:' + seed++;
    // @ts-expect-error
    this.sprite.renderer.texture = this.composition.renderFrame.transparentTexture;
  }

  override onItemUpdate (dt: number, lifetime: number) {
    super.onItemUpdate(dt, lifetime);

    const mesh = this._content?.mesh;

    if (mesh) {
      const { variables } = this.filter.mesh;

      if (variables) {
        const material = mesh.mesh.material;

        // TODO 考虑其他的variable类型
        for (const key of Object.keys(variables)) {
          const value = variables[key](lifetime);

          if ((value as Float32Array).length > 4) {
            material.setMatrix(key, Matrix4.fromArray(value as spec.mat4));
          } else {
            material.setVector4(key, Vector4.fromArray(value as spec.vec4));
          }
        }
      }
    }
    this.filter.onItemUpdate?.(dt, this);
  }

  override onItemRemoved (composition: Composition, content?: SpriteItem) {
    this.filter.onItemRemoved?.(this);
    super.onItemRemoved(composition, content);
  }

  protected override doCreateContent (composition: Composition): SpriteItem {
    const spriteItem = super.doCreateContent(composition);
    const filter = createFilter(this.filterOptions, composition);

    this.filter = filter;
    spriteItem.renderInfo.filter = filter;
    spriteItem.filter = filter;
    spriteItem.renderInfo.cacheId = spriteItem.renderInfo.cacheId.replace('$F$', filter.mesh.shaderCacheId ?? '');
    const { variables } = filter.mesh;

    if (!filter.mesh.uniformValues) {
      filter.mesh.uniformValues = {};
    }
    if (variables) {
      Object.keys(variables).forEach(uniformName => {
        const func = variables[uniformName];

        filter.mesh.uniformValues![uniformName] = func(0);
      });
    }

    return spriteItem;
  }
}
