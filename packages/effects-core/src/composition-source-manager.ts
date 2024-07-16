import * as spec from '@galacean/effects-specification';
import type { SceneBindingData } from './comp-vfx-item';
import type { Engine } from './engine';
import { passRenderLevel } from './pass-render-level';
import type { PluginSystem } from './plugin-system';
import type { GlobalVolume } from './render';
import type { Scene, SceneRenderLevel } from './scene';
import type { ShapeData } from './shape';
import { getGeometryByShape } from './shape';
import type { Texture } from './texture';
import type { Disposable } from './utils';
import { isObject } from './utils';
import type { VFXItemProps } from './vfx-item';

let listOrder = 0;

export interface ContentOptions {
  id: string,
  duration: number,
  name: string,
  endBehavior: spec.EndBehavior,
  items: VFXItemProps[],
  camera: spec.CameraOptions,
  startTime: number,
  globalVolume: GlobalVolume,
  timelineAsset: spec.DataPath,
  sceneBindings: SceneBindingData[],
}

/**
 * 合成资源管理
 */
export class CompositionSourceManager implements Disposable {
  composition?: spec.CompositionData;
  refCompositions: Map<string, spec.CompositionData> = new Map();
  sourceContent?: ContentOptions;
  refCompositionProps: Map<string, VFXItemProps> = new Map();
  renderLevel?: SceneRenderLevel;
  pluginSystem?: PluginSystem;
  totalTime: number;
  imgUsage: Record<string, number[]>;
  textures: Texture[];
  jsonScene?: spec.JSONScene;
  mask = 0;
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
      throw new Error('scene.textures expected.');
    }
    const cachedTextures = textureOptions as Texture[];

    for (const comp of compositions) {
      if (comp.id === compositionId) {
        this.composition = comp;
      } else {
        this.refCompositions.set(comp.id, comp);
      }
    }

    if (!this.composition) {
      throw new Error(`Invalid composition id: ${compositionId}.`);
    }
    this.jsonScene = jsonScene;
    this.renderLevel = renderLevel;
    this.pluginSystem = pluginSystem;
    this.totalTime = totalTime ?? 0;
    this.imgUsage = imgUsage ?? {};
    this.textures = cachedTextures;
    listOrder = 0;
    this.sourceContent = this.getContent(this.composition);
  }

  private getContent (composition: spec.CompositionData): ContentOptions {
    // TODO: specification 中补充 globalVolume 类型
    // @ts-expect-error
    const { id, duration, name, endBehavior, camera, globalVolume, startTime = 0 } = composition;
    const items = this.assembleItems(composition);

    return {
      ...composition,
      id,
      duration,
      name,
      endBehavior: isNaN(endBehavior) ? spec.EndBehavior.freeze : endBehavior,
      // looping,
      items,
      camera,
      startTime,
      globalVolume,
    };
  }

  private assembleItems (composition: spec.CompositionData) {
    const items: any[] = [];

    this.mask++;
    const componentMap: Record<string, any> = {};

    //@ts-expect-error
    for (const component of this.jsonScene.components) {
      componentMap[component.id] = component;
    }

    for (const itemDataPath of composition.items) {
      //@ts-expect-error
      const sourceItemData: VFXItemProps = this.engine.jsonSceneData[itemDataPath.id];
      const itemProps: Record<string, any> = sourceItemData;

      if (passRenderLevel(sourceItemData.renderLevel, this.renderLevel)) {
        itemProps.listIndex = listOrder++;

        if (
          itemProps.type === spec.ItemType.sprite ||
          itemProps.type === spec.ItemType.particle
        ) {
          for (const componentPath of itemProps.components) {
            const componentData = componentMap[componentPath.id];

            this.preProcessItemContent(componentData);
          }
        }

        // 处理预合成的渲染顺序
        if (itemProps.type === spec.ItemType.composition) {
          const refId = (sourceItemData.content as spec.CompositionContent).options.refId;

          if (!this.refCompositions.get(refId)) {
            throw new Error(`Invalid ref composition id: ${refId}.`);
          }
          const ref = this.getContent(this.refCompositions.get(refId)!);

          if (!this.refCompositionProps.has(refId)) {
            this.refCompositionProps.set(refId, ref as unknown as VFXItemProps);
          }
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
        this.processMask(renderContent.renderer);
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
    if (!renderer.texture) {
      return renderer;
    }
    //@ts-expect-error
    const texIdx = renderer.texture.id;

    if (texIdx !== undefined) {
      //@ts-expect-error
      this.addTextureUsage(texIdx) || texIdx;
    }

    return renderer;
  }

  private addTextureUsage (texIdx: number) {
    const texId = texIdx;
    // FIXME: imageUsage 取自 scene.imgUsage，类型为 Record<string, number[]>，这里给的 number，类型对不上
    const imageUsage = this.imgUsage as unknown as Record<string, number> ?? {};

    if (texId && imageUsage) {
      // eslint-disable-next-line no-prototype-builtins
      if (!imageUsage.hasOwnProperty(texId)) {
        imageUsage[texId] = 0;
      }
      imageUsage[texId]++;
    }
  }

  /**
   * 处理蒙版和遮挡关系写入 stencil 的 ref 值
   */
  private processMask (renderer: Record<string, number>) {
    const maskMode: spec.MaskMode = renderer.maskMode;

    if (maskMode === spec.MaskMode.NONE) {
      return;
    }
    if (!renderer.mask) {
      if (maskMode === spec.MaskMode.MASK) {
        renderer.mask = ++this.mask;
      } else if (
        maskMode === spec.MaskMode.OBSCURED ||
        maskMode === spec.MaskMode.REVERSE_OBSCURED
      ) {
        renderer.mask = this.mask;
      }
    }
  }

  dispose (): void {
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
