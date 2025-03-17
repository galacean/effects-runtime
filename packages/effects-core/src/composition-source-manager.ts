import * as spec from '@galacean/effects-specification';
import type { SceneBindingData } from './comp-vfx-item';
import type { Engine } from './engine';
import { passRenderLevel } from './pass-render-level';
import type { PluginSystem } from './plugin-system';
import type { Scene, SceneRenderLevel } from './scene';
import { getGeometryByShape } from './shape';
import type { Texture } from './texture';
import type { Disposable } from './utils';
import type { VFXItemData } from './asset-loader';

interface RendererOptionsWithMask extends spec.RendererOptions {
  mask?: number,
}

export interface ContentOptions {
  id: string,
  duration: number,
  name: string,
  endBehavior: spec.EndBehavior,
  items: spec.DataPath[],
  camera: spec.CameraOptions,
  startTime: number,
  timelineAsset: spec.DataPath,
  sceneBindings: SceneBindingData[],
}

/**
 * 合成资源管理
 */
export class CompositionSourceManager implements Disposable {
  composition?: spec.CompositionData;
  sourceContent?: spec.CompositionData;
  refCompositionProps: Map<string, spec.CompositionData> = new Map();
  renderLevel?: SceneRenderLevel;
  pluginSystem?: PluginSystem;
  totalTime: number;
  imgUsage: Record<string, number> = {};
  textures: Texture[];
  jsonScene?: spec.JSONScene;
  mask = 0;
  engine: Engine;

  private refCompositions: Map<string, spec.CompositionData> = new Map();

  constructor (
    scene: Scene,
    engine: Engine,
  ) {
    this.engine = engine;
    // 资源
    const { jsonScene, renderLevel, textureOptions, pluginSystem, totalTime } = scene;
    const { compositions, compositionId } = jsonScene;

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
    this.textures = cachedTextures;
    this.sourceContent = this.getContent(this.composition);
  }

  private getContent (composition: spec.CompositionData): spec.CompositionData {
    const compositionData: spec.CompositionData = {
      ...composition,
    };

    this.assembleItems(compositionData);

    if (isNaN(compositionData.endBehavior)) {
      compositionData.endBehavior = spec.EndBehavior.freeze;
    }

    if (!compositionData.startTime) {
      compositionData.startTime = 0;
    }

    return compositionData;
  }

  private assembleItems (composition: spec.CompositionData) {
    this.mask++;
    const componentMap: Record<string, spec.ComponentData> = {};
    const items: spec.DataPath[] = [];

    if (!this.jsonScene) {
      return;
    }

    for (const component of this.jsonScene.components) {
      componentMap[component.id] = component;
    }

    for (const itemDataPath of composition.items) {
      const sourceItemData = this.engine.jsonSceneData[itemDataPath.id] as VFXItemData;
      const itemProps = sourceItemData;

      if (passRenderLevel(sourceItemData.renderLevel, this.renderLevel)) {
        if (
          itemProps.type === spec.ItemType.sprite ||
          itemProps.type === spec.ItemType.particle ||
          itemProps.type === spec.ItemType.spine ||
          itemProps.type === spec.ItemType.text ||
          itemProps.type === spec.ItemType.video ||
          //@ts-expect-error
          itemProps.type === spec.ItemType.shape
        ) {
          for (const componentPath of itemProps.components) {
            const componentData = componentMap[componentPath.id] as spec.SpriteComponentData | spec.ParticleSystemData;

            this.preProcessItemContent(componentData);
          }
        }

        // 处理预合成的渲染顺序
        if (itemProps.type === spec.ItemType.composition) {
          const refId = (sourceItemData.content as spec.CompositionContent).options.refId;
          const composition = this.refCompositions.get(refId);

          if (!composition) {
            throw new Error(`Invalid ref composition id: ${refId}.`);
          }
          const ref = this.getContent(composition);

          this.engine.addEffectsObjectData(ref as unknown as spec.EffectsObjectData);
          if (!this.refCompositionProps.has(refId)) {
            this.refCompositionProps.set(refId, ref);
          }
        }
        items.push(itemDataPath);
      } else {
        // 非预合成元素未达到渲染等级的转化为空节点。
        // 预合成元素有根据 item type 的子元素加载判断，没法保留空节点，这边先整体过滤掉。
        if (itemProps.type !== spec.ItemType.composition) {
          itemProps.components = [];
          items.push(itemDataPath);
        }
      }
    }
    composition.items = items;
  }

  private preProcessItemContent (
    renderContent: spec.SpriteComponentData | spec.ParticleSystemData | spec.ParticleContent,
  ) {
    if (renderContent.renderer) {
      renderContent.renderer = this.changeTex(renderContent.renderer);

      if (!('mask' in renderContent.renderer)) {
        this.processMask(renderContent.renderer);
      }

      const split = renderContent.splits && !renderContent.textureSheetAnimation ? renderContent.splits[0] : undefined;
      const shape = renderContent.renderer.shape;
      let shapeData;

      if (Number.isInteger(shape)) {
        shapeData = this.jsonScene?.shapes[shape as number];
      } else if (shape) {
        shapeData = shape as spec.ShapeGeometry;
      }

      if (shapeData !== undefined && !('aPoint' in shapeData && 'index' in shapeData)) {
        // @ts-expect-error 类型转换问题
        renderContent.renderer.shape = getGeometryByShape(shapeData, split);
      }
    }

    if ('trails' in renderContent && renderContent.trails !== undefined) {
      renderContent.trails = this.changeTex(renderContent.trails);
    }
  }

  private changeTex<T extends spec.RendererOptions | spec.ParticleTrail> (renderer: T) {
    if (!renderer.texture) {
      return renderer;
    }
    const texIdx = renderer.texture.id;

    if (texIdx !== undefined) {
      this.addTextureUsage(texIdx);
    }

    return renderer;
  }

  private addTextureUsage (texId: string) {
    const imageUsage = this.imgUsage ?? {};

    if (texId && imageUsage) {
      if (!Object.prototype.hasOwnProperty.call(imageUsage, texId)) {
        imageUsage[texId] = 0;
      }
      imageUsage[texId]++;
    }
  }

  /**
   * 处理蒙版和遮挡关系写入 stencil 的 ref 值
   */
  private processMask (renderer: RendererOptionsWithMask) {
    const maskMode = renderer.maskMode;

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
