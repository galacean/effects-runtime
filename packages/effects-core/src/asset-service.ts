import * as spec from '@galacean/effects-specification';
import type { Disposable } from './utils';
import type { Engine } from './engine';
import type { ImageLike, SceneLoadOptions } from './scene';
import { Scene } from './scene';
import type { Texture } from './texture';
import { generateWhiteTexture } from './texture';
import type { EffectsObject } from './effects-object';
import { Asset } from './asset';
import { Material } from './material';

/**
 *
 */
export class AssetService implements Disposable {
  private readonly builtinObjects: EffectsObject[] = [];

  /**
   *
   * @param engine
   */
  constructor (
    private readonly engine: Engine,
  ) {
    this.builtinObjects.push(generateWhiteTexture(engine));
  }

  /**
   * @param url
   * @param options
   * @returns
   */
  assembleSceneLoadOptions (
    url: Scene.LoadType,
    options: SceneLoadOptions = {},
  ) {
    let source: Scene.LoadType = url;

    // 加载多个合成链接并各自设置可选参数
    if (Scene.isURL(url)) {
      if (!Scene.isJSONObject(url)) {
        source = url.url;
      }
      if (Scene.isWithOptions(url)) {
        options = {
          ...options,
          ...url.options,
        };
      }
    }

    return {
      source,
      options,
    };
  }

  /**
   * 根据用户参数修改文本元素的原始数据
   * @param scene
   * @param options
   */
  updateTextVariables (
    scene: Scene,
    variables: spec.TemplateVariables = {},
  ) {
    scene.jsonScene.items.forEach(item => {
      if (item.type === spec.ItemType.text || item.type === spec.ItemType.richtext) {
        const textVariable = variables[item.name] as string;

        if (!textVariable) {
          return;
        }

        item.components.forEach(({ id }) => {
          const componentData = this.engine.findEffectsObjectData(id) as spec.TextComponentData;

          if (componentData?.dataType === spec.DataType.TextComponent || componentData?.dataType === spec.DataType.RichTextComponent) {
            componentData.options.text = textVariable;
          }
        });
      }
    });
  }

  initializeTexture (scene: Scene) {
    for (let i = 0; i < scene.textureOptions.length; i++) {
      scene.textures[i] = this.engine.findObject<Texture>({ id:scene.textureOptions[i].id });
      scene.textures[i].initialize();
    }
  }

  prepareAssets (
    scene: Scene,
    assets: Record<string, ImageLike>,
  ) {
    this.engine.clearResources();

    for (const assetId of Object.keys(assets)) {
      const asset = assets[assetId];
      const engineAsset = new Asset(this.engine);

      engineAsset.data = asset;
      engineAsset.setInstanceId(assetId);
    }

    // 加入 json 资产数据
    this.engine.addPackageDatas(scene);

    // 加入内置引擎对象
    for (const effectsObject of this.builtinObjects) {
      this.engine.addInstance(effectsObject);
    }
  }

  // TODO Material 单独存表, 加速查询
  createShaderVariant () {
    for (const guid of Object.keys(this.engine.objectInstance)) {
      const effectsObject = this.engine.objectInstance[guid];

      if (effectsObject instanceof Material) {
        effectsObject.createShaderVariant();
      }
    }
  }

  private destroyBuiltinObjects () {
    for (const effectsObject of this.builtinObjects) {
      effectsObject.dispose();
    }

    this.builtinObjects.length = 0;
  }

  /**
   *
   */
  dispose (): void {
    this.destroyBuiltinObjects();
    // Optionally remove references from engine if any
  }
}
