import * as spec from '@galacean/effects-specification';
import type { Engine } from './engine';
import { passRenderLevel } from './pass-render-level';
import type { PluginSystem } from './plugin-system';
import type { GlobalVolume } from './render';
import type { Scene } from './scene';
import type { ShapeData } from './shape';
import { getGeometryByShape } from './shape';
import type { TextureSourceOptions } from './texture';
import { Texture } from './texture';
import type { Disposable } from './utils';
import { isObject } from './utils';
import type { VFXItemProps } from './vfx-item';

let listOrder = 0;

export interface ContentOptions {
  id: string,
  duration: number,
  name: string,
  endBehavior: spec.CompositionEndBehavior,
  items: VFXItemProps[],
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
  mask = 0;
  textureOptions: Record<string, any>[];
  engine: Engine;

  constructor (
    scene: Scene,
    engine: Engine,
  ) {
    this.engine = engine;
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

    this.mask++;
    const componentMap: Record<string, any> = {};

    //@ts-expect-error
    for (const component of this.jsonScene.components) {
      componentMap[component.id] = component;
    }

    for (const itemDataPath of composition.items) {
      //@ts-expect-error
      const sourceItemData: VFXItemProps = this.engine.sceneData[itemDataPath.id];
      const itemProps: Record<string, any> = sourceItemData;

      if (passRenderLevel(sourceItemData.renderLevel, this.renderLevel)) {

        if (itemProps.type === spec.ItemType.sprite ||
          itemProps.type === spec.ItemType.particle) {
          for (const componentPath of itemProps.components) {
            const componentData = componentMap[componentPath.id];

            this.preProcessItemContent(componentData);
          }
        } else {
          const renderContent = itemProps.content;

          if (renderContent) {
            this.preProcessItemContent(renderContent);
          }
        }

        const pn = sourceItemData.pn;
        const { plugins = [] } = this.jsonScene as spec.JSONScene;

        itemProps.listIndex = listOrder++;
        if (pn !== undefined && Number.isInteger(pn)) {
          itemProps.pluginName = plugins[pn];
        }

        // 处理预合成的渲染顺序
        if (itemProps.type === spec.ItemType.composition) {
          const maskRef = ++this.mask;
          const refId = (sourceItemData.content as spec.CompositionContent).options.refId;

          if (!this.refCompositions.get(refId)) {
            throw new Error('Invalid Ref Composition id: ' + refId);
          }
          const ref = this.getContent(this.refCompositions.get(refId)!);

          if (!this.refCompositionProps.has(refId)) {
            this.refCompositionProps.set(refId, ref as unknown as VFXItemProps);
          }

          ref.items.forEach((item: Record<string, any>) => {
            item.listIndex = listOrder++;
            this.processMask(item.content, maskRef);
          });
          itemProps.items = ref.items;

        }

        items.push(itemProps as VFXItemProps);
      }
    }

    return items;
  }

  private preProcessItemContent (renderContent: any) {
    if (renderContent.renderer) {
      renderContent.renderer = this.changeTex(renderContent.renderer);

      if (!renderContent.renderer.mask) {
        this.processMask(renderContent.renderer, this.mask);
      }

      const split = renderContent.splits && !renderContent.textureSheetAnimation && renderContent.splits[0];

      if (Number.isInteger(renderContent.renderer.shape)) {
        // TODO: scene.shapes 类型问题？
        renderContent.renderer.shape = getGeometryByShape(this.jsonScene?.shapes[renderContent.renderer.shape] as unknown as ShapeData, split);
      } else if (renderContent.renderer.shape && isObject(renderContent.renderer.shape)) {
        renderContent.renderer.shape = getGeometryByShape(renderContent.renderer.shape, split);
      }
    }

    if (renderContent.trails) {
      renderContent.trails = this.changeTex(renderContent.trails);
    }
  }

  private changeTex (renderer: Record<string, number>) {
    const texIdx = renderer.texture;
    const ret = renderer;

    if (texIdx !== undefined) {
      //@ts-expect-error
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

  /**
   * 处理蒙版和遮挡关系写入 stencil 的 ref 值
   */
  private processMask (renderer: Record<string, number>, maskRef: number) {
    if (!renderer.mask) {
      const maskMode: spec.MaskMode = renderer.maskMode;

      if (maskMode !== spec.MaskMode.NONE) {
        renderer.mask = maskRef;
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
