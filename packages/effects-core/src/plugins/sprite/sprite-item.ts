import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';
import type { ColorPlayableAssetData } from '../../animation';
import { ColorPlayable } from '../../animation';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { TextureSourceType, type Texture2DSourceOptionsVideo } from '../../texture';
import type { FrameContext } from '../timeline';
import { Playable, PlayableAsset, TrackMixerPlayable, TrackAsset } from '../timeline';
import type { VFXItem } from '../../vfx-item';
import type { Geometry } from '../../render';
import { rotateVec2 } from '../../shape';
import { MaskableGraphic, EffectComponent } from '../../components';

/**
 * 图层元素基础属性, 经过处理后的 spec.SpriteContent.options
 */
export type SpriteItemOptions = {
  startColor: spec.vec4,
  renderLevel?: spec.RenderLevel,
};

export type splitsDataType = [r: number, x: number, y: number, w: number, h: number | undefined][];

const singleSplits: splitsDataType = [[0, 0, 1, 1, 0]];

let seed = 0;

@effectsClass(spec.DataType.SpriteColorPlayableAsset)
export class SpriteColorPlayableAsset extends PlayableAsset {
  data: ColorPlayableAssetData;

  override createPlayable (): Playable {
    const spriteColorPlayable = new ColorPlayable();

    spriteColorPlayable.create(this.data);

    return spriteColorPlayable;
  }

  override fromData (data: ColorPlayableAssetData): void {
    this.data = data;
  }
}

export class ComponentTimeTrack extends TrackAsset {
  override createTrackMixer (): TrackMixerPlayable {
    return new TrackMixerPlayable();
  }
}

export class SpriteComponentTimeTrack extends ComponentTimeTrack {
  override updateAnimatedObject (boundObject: object): object {

    return (boundObject as VFXItem).getComponent(SpriteComponent);
  }
}

export class EffectComponentTimeTrack extends ComponentTimeTrack {
  override updateAnimatedObject (boundObject: object): object {
    return (boundObject as VFXItem).getComponent(EffectComponent);
  }
}

export class ComponentTimePlayableAsset extends PlayableAsset {
  override createPlayable (): Playable {
    const componentTimePlayable = new ComponentTimePlayable();

    return componentTimePlayable;
  }
}

export class ComponentTimePlayable extends Playable {
  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!('time' in boundObject)) {
      return;
    }

    boundObject.time = this.time;
  }
}

/**
 * Sprite component class
 */
@effectsClass(spec.DataType.SpriteComponent)
export class SpriteComponent extends MaskableGraphic {
  time = 0;
  duration = 1;
  /**
   * @internal
  */
  splits: splitsDataType = singleSplits;

  protected textureSheetAnimation?: spec.TextureSheetAnimation;

  constructor (engine: Engine, props?: spec.SpriteComponentData) {
    super(engine);

    this.name = 'MSprite' + seed++;
    if (props) {
      this.fromData(props);
    }
  }

  override onUpdate (dt: number): void {
    let time = this.time;
    const duration = this.duration;
    const textureAnimation = this.textureSheetAnimation;
    // TODO: Update textureAnimation spec.
    // @ts-expect-error
    const loop = textureAnimation?.loop ?? true;

    if (time > duration && loop) {
      time = time % duration;
    }

    const life = Math.min(Math.max(time / duration, 0.0), 1.0);
    const { video } = this.renderer.texture.source as Texture2DSourceOptionsVideo;

    if (video) {
      if (time === 0) {
        video.pause();
      } else {
        video.play().catch(e => { this.engine.renderErrors.add(e); });
      }
      this.renderer.texture.uploadCurrentVideoFrame();
    }
    if (textureAnimation) {
      const total = textureAnimation.total || (textureAnimation.row * textureAnimation.col);
      let texRectX = 0;
      let texRectY = 0;
      let texRectW = 1;
      let texRectH = 1;
      let flip;

      if (this.splits) {
        const sp = this.splits[0];

        flip = sp[4];
        texRectX = sp[0];
        texRectY = sp[1];
        if (flip) {
          texRectW = sp[3];
          texRectH = sp[2];
        } else {
          texRectW = sp[2];
          texRectH = sp[3];
        }
      }
      let dx, dy;

      if (flip) {
        dx = 1 / textureAnimation.row * texRectW;
        dy = 1 / textureAnimation.col * texRectH;
      } else {
        dx = 1 / textureAnimation.col * texRectW;
        dy = 1 / textureAnimation.row * texRectH;
      }
      let texOffset;

      if (textureAnimation.animate) {
        const frameIndex = Math.round(life * (total - 1));
        const yIndex = Math.floor(frameIndex / textureAnimation.col);
        const xIndex = frameIndex - yIndex * textureAnimation.col;

        texOffset = flip ? [dx * yIndex, dy * (textureAnimation.col - xIndex)] : [dx * xIndex, dy * (1 + yIndex)];
      } else {
        texOffset = [0, dy];
      }
      this.material.getVector4('_TexOffset')?.setFromArray([
        texRectX + texOffset[0],
        texRectH + texRectY - texOffset[1],
        dx, dy,
      ]);
    }

    this.time = time + dt / 1000;
  }

  override onDisable (): void {
    super.onDisable();
    this.time = 0;
  }

  override onDestroy (): void {
    const texture = this.renderer.texture;
    const source = texture.source;

    if (source.sourceType === TextureSourceType.video && source?.video) {
      source.video.pause();
      source.video.src = '';
      source.video.load();
    }
  }

  protected updateGeometry (geometry: Geometry) {
    const split: number[] = this.textureSheetAnimation ? [0, 0, 1, 1, this.splits[0][4] as number] : this.splits[0] as number[];
    const uvTransform = split;
    const x = uvTransform[0];
    const y = uvTransform[1];
    const isRotate90 = Boolean(uvTransform[4]);
    const width = isRotate90 ? uvTransform[3] : uvTransform[2];
    const height = isRotate90 ? uvTransform[2] : uvTransform[3];
    const angle = isRotate90 ? -Math.PI / 2 : 0;

    const aUV = geometry.getAttributeData('aUV');
    const aPos = geometry.getAttributeData('aPos');
    const indices = geometry.getIndexData();

    const tempPosition: spec.vec2 = [0, 0];

    if (aUV && aPos && indices) {
      const vertexCount = aUV.length / 2;

      for (let i = 0; i < vertexCount; i++) {
        const positionOffset = i * 3;
        const uvOffset = i * 2;
        const positionX = aPos[positionOffset];
        const positionY = aPos[positionOffset + 1];

        tempPosition[0] = positionX;
        tempPosition[1] = positionY;
        rotateVec2(tempPosition, tempPosition, angle);

        aUV[uvOffset] = (tempPosition[0] + 0.5) * width + x;
        aUV[uvOffset + 1] = (tempPosition[1] + 0.5) * height + y;
      }

      this.geometry.setAttributeData('aPos', aPos.slice());
      this.geometry.setAttributeData('aUV', aUV.slice());
      this.geometry.setIndexData(indices.slice());
      this.geometry.setDrawCount(indices.length);
    }

    this.geometry.subMeshes.length = 0;
    for (const subMesh of geometry.subMeshes) {
      this.geometry.subMeshes.push({
        offset: subMesh.offset,
        indexCount: subMesh.indexCount,
        vertexCount: subMesh.vertexCount,
      });
    }
  }

  /**
   * @deprecated
   * 原有打包纹理拆分逻辑，待移除
   */
  protected updateGeometryFromMultiSplit () {
    const { splits, textureSheetAnimation } = this;
    const sx = 1, sy = 1;
    const geometry = this.defaultGeometry;

    const originData = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];
    const aUV = [];
    const index = [];
    const position = [];
    const col = 2;
    const row = 2;

    for (let x = 0; x < col; x++) {
      for (let y = 0; y < row; y++) {
        const base = (y * 2 + x) * 4;
        // @ts-expect-error
        const split: number[] = textureSheetAnimation ? [0, 0, 1, 1, splits[0][4]] : splits[y * 2 + x];
        const texOffset = split[4] ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];
        const dw = ((x + x + 1) / col - 1) / 2;
        const dh = ((y + y + 1) / row - 1) / 2;
        const tox = split[0];
        const toy = split[1];
        const tsx = split[4] ? split[3] : split[2];
        const tsy = split[4] ? split[2] : split[3];
        const origin = [
          originData[0] / col + dw,
          originData[1] / row + dh,
          originData[2] / col + dw,
          originData[3] / row + dh,
          originData[4] / col + dw,
          originData[5] / row + dh,
          originData[6] / col + dw,
          originData[7] / row + dh,
        ];

        aUV.push(
          texOffset[0] * tsx + tox, texOffset[1] * tsy + toy,
          texOffset[2] * tsx + tox, texOffset[3] * tsy + toy,
          texOffset[4] * tsx + tox, texOffset[5] * tsy + toy,
          texOffset[6] * tsx + tox, texOffset[7] * tsy + toy,
        );
        position.push((origin[0]) * sx, (origin[1]) * sy, 0.0,
          (origin[2]) * sx, (origin[3]) * sy, 0.0,
          (origin[4]) * sx, (origin[5]) * sy, 0.0,
          (origin[6]) * sx, (origin[7]) * sy, 0.0);
        index.push(base, 1 + base, 2 + base, 2 + base, 1 + base, 3 + base);
      }
    }
    geometry.setAttributeData('aPos', new Float32Array(position));
    geometry.setIndexData(new Uint16Array(index));
    geometry.setAttributeData('aUV', new Float32Array(aUV));
    geometry.setDrawCount(index.length);
  }

  override fromData (data: spec.SpriteComponentData): void {
    super.fromData(data);

    const splits = data.splits ?? singleSplits;
    const textureSheetAnimation = data.textureSheetAnimation;

    this.splits = splits;
    this.textureSheetAnimation = textureSheetAnimation;

    // @ts-expect-error
    const geometry = data.geometry ? this.engine.findObject<Geometry>(data.geometry) : this.defaultGeometry;

    if (splits.length === 1) {
      this.updateGeometry(geometry);
    } else {
      // TODO: 原有打包纹理拆分逻辑，待移除
      //-------------------------------------------------------------------------
      this.updateGeometryFromMultiSplit();
    }

    this.interaction = data.interaction;

    const startColor = data.options.startColor || [1, 1, 1, 1];

    this.material.setColor('_Color', new Color().setFromArray(startColor));

    //@ts-expect-error
    this.duration = data.duration ?? this.item.duration;
  }
}
