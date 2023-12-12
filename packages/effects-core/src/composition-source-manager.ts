import * as spec from '@galacean/effects-specification';
import type { TextureSourceOptions } from './texture';
import { Texture } from './texture';
import { passRenderLevel } from './pass-render-level';
import type { ShapeData } from './shape';
import { getGeometryByShape } from './shape';
import type { Disposable } from './utils';
import { isObject } from './utils';
import type { Scene } from './scene';
import type { PluginSystem } from './plugin-system';
import type { Engine } from './engine';
import type { GlobalVolume } from './render';
import type { VFXItemProps } from './vfx-item';

let listOrder = 0;

export interface ContentOptions {
  id: string,
  duration: number,
  name: string,
  endBehavior: spec.CompositionEndBehavior,
  items: any[],
  camera: spec.CameraOptions,
  startTime: number,
  globalVolume: GlobalVolume,
}

/**
 * 合成资源管理
 */
export class CompositionSourceManager implements Disposable {
  composition?: spec.Composition;
  refCompositions: Map<string, spec.Composition> = new Map();
  sourceContent?: ContentOptions;
  refCompositionProps: Map<string, VFXItemProps> = new Map();
  renderLevel?: spec.RenderLevel;
  pluginSystem?: PluginSystem;
  totalTime: number;
  imgUsage: Record<string, number[]>;
  textures: Texture[];
  jsonScene?: spec.JSONScene;
  mask: number;
  textureOptions: Record<string, any>[];

  constructor (
    scene: Scene,
    engine: Engine,
  ) {
    // 资源
    const { jsonScene, renderLevel, textureOptions, pluginSystem, totalTime } = scene;
    const { compositions, imgUsage, compositionId } = jsonScene;

    if (!textureOptions) {
      throw new Error('scene.textures expected');
    }
    const cachedTextures = textureOptions.map(option => option && (option instanceof Texture ? option : Texture.create(engine, option as unknown as TextureSourceOptions)));

    // 缓存创建的Texture对象
    // @ts-expect-error
    scene.textureOptions = cachedTextures;
    cachedTextures?.forEach(tex => tex?.initialize());
    for (const comp of compositions) {
      if (comp.id === compositionId) {
        this.composition = comp;
      } else {
        this.refCompositions.set(comp.id, comp);
      }
    }

    if (!this.composition) {
      throw new Error('Invalid composition id: ' + compositionId);
    }
    this.jsonScene = jsonScene;
    this.renderLevel = renderLevel;
    this.pluginSystem = pluginSystem;
    this.totalTime = totalTime ?? 0;
    this.imgUsage = imgUsage ?? {};
    this.textures = cachedTextures;
    this.mask = 0;
    listOrder = 0;
    this.textureOptions = textureOptions;
    this.sourceContent = this.getContent(this.composition);
  }

  private getContent (composition: spec.Composition): ContentOptions {
    // TODO: specification 中补充 globalVolume 类型
    // @ts-expect-error
    const { id, duration, name, endBehavior, camera, globalVolume, startTime = 0 } = composition;
    const items = this.assembleItems(composition);

    return {
      id,
      duration,
      name,
      endBehavior: isNaN(endBehavior) ? spec.END_BEHAVIOR_PAUSE : endBehavior,
      // looping,
      items,
      camera,
      startTime,
      globalVolume,
    };
  }

  private assembleItems (composition: spec.Composition) {
    const items: any[] = [];
    let mask = this.mask;

    if (isNaN(mask)) {
      mask = 0;
    }

    composition.items.forEach(item => {
      const option: Record<string, any> = {};
      const { visible, renderLevel: itemRenderLevel, type } = item;

      if (visible === false) {
        return;
      }

      const content = { ...item.content };

      if (content) {
        option.content = { ...content };

        if (passRenderLevel(itemRenderLevel, this.renderLevel)) {
          const renderContent = option.content;

          option.type = type;

          if (renderContent.renderer) {
            renderContent.renderer = this.changeTex(renderContent.renderer);

            if (!renderContent.renderer.mask) {
              const maskMode = renderContent.renderer.maskMode;

              if (maskMode === spec.MaskMode.MASK) {
                renderContent.renderer.mask = ++mask;
              } else if (maskMode === spec.MaskMode.OBSCURED || maskMode === spec.MaskMode.REVERSE_OBSCURED) {
                renderContent.renderer.mask = mask;
              }
            }

            const split = renderContent.splits && !renderContent.textureSheetAnimation && renderContent.splits[0];

            if (Number.isInteger(renderContent.renderer.shape)) {
              // TODO: scene.shapes 类型问题？
              renderContent.renderer.shape = getGeometryByShape(this.jsonScene?.shapes[renderContent.renderer.shape] as unknown as ShapeData, split);
            } else if (renderContent.renderer.shape && isObject(renderContent.renderer.shape)) {
              renderContent.renderer.shape = getGeometryByShape(renderContent.renderer.shape, split);
            }
          } else {
            option.content.renderer = { order: 0 };
          }
          if (renderContent.trails) {
            renderContent.trails = this.changeTex(renderContent.trails);
          }
          if (renderContent.filter) {
            renderContent.filter = { ...renderContent.filter };
          }

          const { name, delay = 0, id, parentId, duration, endBehavior, pluginName, pn, transform } = item;
          // FIXME: specification 下定义的 Item 不存在 refCount 类型定义
          // @ts-expect-error
          const { refCount } = item;
          const { plugins = [] } = this.jsonScene as spec.JSONScene;

          option.name = name;
          option.delay = delay;
          option.id = id;
          if (parentId) {
            option.parentId = parentId;
          }
          option.refCount = refCount;
          option.duration = duration;
          option.listIndex = listOrder++;
          option.endBehavior = endBehavior;
          if (pluginName) {
            option.pluginName = pluginName;
          } else if (pn !== undefined && Number.isInteger(pn)) {
            option.pluginName = plugins[pn];
          }
          if (transform) {
            option.transform = transform;
          }

          // 处理预合成的渲染顺序
          if (option.type === spec.ItemType.composition) {
            const refId = (item.content as spec.CompositionContent).options.refId;

            if (!this.refCompositions.get(refId)) {
              throw new Error('Invalid Ref Composition id: ' + refId);
            }
            if (!this.refCompositionProps.has(refId)) {
              this.refCompositionProps.set(refId, this.getContent(this.refCompositions.get(refId)!) as unknown as VFXItemProps);
            }
            const ref = this.refCompositionProps.get(refId)!;

            ref.items.forEach((item: Record<string, any>) => {
              item.listIndex = listOrder++;
            });
            option.items = ref.items;

          }
          items.push(option);
        }
      }
    });

    return items;
  }

  private changeTex (renderer: Record<string, number>) {
    const texIdx = renderer.texture;
    const ret: Record<string, any> = { ...renderer };

    if (texIdx !== undefined) {
      // ret._texture = ret.texture;
      ret.texture = this.addTextureUsage(texIdx) || texIdx;
    }

    return ret;
  }

  private addTextureUsage (texIdx: number): Texture | undefined {
    if (Number.isInteger(texIdx)) {
      const tex = this.textures?.[texIdx];
      const texId = tex?.id;
      // FIXME: imageUsage 取自 scene.imgUsage，类型为 Record<string, number[]>，这里给的 number，类型对不上
      const imageUsage = this.imgUsage as unknown as Record<string, number> ?? {};

      if (texId && imageUsage) {
        // eslint-disable-next-line no-prototype-builtins
        if (!imageUsage.hasOwnProperty(texId)) {
          imageUsage[texId] = 0;
        }
        imageUsage[texId]++;

        return tex;
      }
    }
  }

  dispose (): void {
    this.textureOptions = [];
    this.textures = [];
    this.composition = undefined;
    this.jsonScene = undefined;
    this.totalTime = 0;
    this.pluginSystem = undefined;
    this.sourceContent = undefined;
    this.refCompositions.clear();
    this.refCompositionProps.clear();
  }
}
