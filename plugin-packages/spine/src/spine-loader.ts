import { DestroyOptions, AbstractPlugin } from '@galacean/effects';
import type {
  spec,
  Composition,
  Scene,
  VFXItem,
  RenderFrame, SceneLoadOptions,
} from '@galacean/effects';
import type { SkeletonData } from './core';
import { Skeleton, TextureAtlas } from './core';
import type { SlotGroup } from './slot-group';
import type { SpineMesh } from './spine-mesh';
import type { SpineContent } from './spine-vfx-item';
import { SpineVFXItem } from './spine-vfx-item';
import { createSkeletonData, getAnimationList, getSkinList } from './utils';

/**
 *
 */
export interface SpineResource {
  atlas: TextureAtlas,
  /**
   * 创建纹理的选项
   */
  texturesOptions: spec.TextureDefine[],
  /**
   * 给 VFXItem 用于创建 skeleton 实例
   */
  skeletonFile: DataView | string,
  /**
   * 给 VFXItem 用于创建 skeleton 实例
   */
  skeletonType: 'json' | 'skel',
  /**
   * 给编辑器用
   */
  skeletonData: SkeletonData,
  /**
   * 缓存给编辑器用
   */
  skeletonInstance: Skeleton | null,
  /**
   * 编辑器用 spineData 的索引
   */
  id?: string,
  skinList: string[],
  animationList: string[],
  /**
   * 指向 `compsition.images` 的纹理索引数组
   */
  images: number[],
}

/**
 *
 */
export class SpineLoader extends AbstractPlugin {
  private slotGroups: SlotGroup[] = [];
  private meshToRemove: SpineMesh[] = [];

  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions) {
    return Promise.resolve();
  }

  static override async prepareResource (scene: Scene): Promise<void> {
    const scn = scene;
    const jsonScene = scn.jsonScene;

    if (!(scn && jsonScene && jsonScene.spines)) {
      throw new Error('scene not contain spine content');
    }

    const spineData: SpineResource[] = [];
    const bins = scn.bins;
    const textDecoder = new TextDecoder('utf-8');
    let bufferLength;
    let start;
    let index;

    for (const spineIndexData of jsonScene.spines) {
      // 编辑器的逻辑
      // @ts-expect-error
      if (spineIndexData.spineData) {

        // @ts-expect-error
        spineData.push(spineIndexData.spineData);
        continue;
      }

      // @ts-expect-error
      const { atlas: atlasPointer, skeleton: skeletonPointer, images, skeletonType, id = '' } = spineIndexData;
      const texturesOptions = images.map((pointer: number) => jsonScene.textures![pointer]);

      [index, start = 0, bufferLength] = atlasPointer[1];
      const atlasBuffer = bins[index];
      const atlasText = bufferLength ? textDecoder.decode(new Uint8Array(atlasBuffer, start, bufferLength)) : textDecoder.decode(new Uint8Array(atlasBuffer, start));
      const atlas = new TextureAtlas(atlasText);

      [index, start = 0, bufferLength] = skeletonPointer[1];
      const skeletonBuffer = bins[index];
      let skeletonFile;

      if (skeletonType === 'json') {
        skeletonFile = bufferLength ? textDecoder.decode(new Uint8Array(skeletonBuffer, start, bufferLength)) : textDecoder.decode(new Uint8Array(skeletonBuffer, start));
      } else {
        skeletonFile = bufferLength ? new DataView(skeletonBuffer, start, bufferLength) : new DataView(skeletonBuffer, start);
      }

      const skeletonData = createSkeletonData(atlas, skeletonFile, skeletonType); //VFXItem用此skeletonData新建skeleton实例会造成纹理丢失
      const skinList = getSkinList(skeletonData);
      const animationList = getAnimationList(skeletonData);

      spineData.push({
        atlas,
        skeletonFile,
        skeletonData,
        images,
        texturesOptions,
        skeletonType,
        skeletonInstance: new Skeleton(skeletonData),
        skinList,
        animationList,
        id,
      });
    }
    // @ts-expect-error
    jsonScene.spines = spineData;

    return;
  }

  override onCompositionConstructed (composition: Composition, scene: Scene): void {
    this.slotGroups = [];
    const textures = composition.textures;

    if (!scene.jsonScene.spines) {
      return;
    }
    const spineDatas = scene.jsonScene.spines as unknown as SpineResource[];

    spineDatas.map(({ atlas, images }, index) => {
      const pageCount = atlas.pages.length;

      if (images.length !== pageCount) {
        throw new Error('atlas.page\'s length not equal spine.textures\' length');
      }
      for (let i = 0; i < pageCount; i++) {
        const page = atlas.pages[i];
        const tex = textures[images[i]];

        if (!tex) {
          throw new Error(`Can not find page ${page.name}'s texture, check the texture name`);
        }
        page.setTexture(tex);

      }
    });
    composition.loaderData.spineDatas = spineDatas;
  }

  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<SpineContent>) {
    if (item instanceof SpineVFXItem && item.content) {
      this.slotGroups.push(item.content);
    }
  }

  override onCompositionItemRemoved (composition: Composition, item: VFXItem<SpineContent>) {
    if (item instanceof SpineVFXItem && item.content) {
      item.spineDataCache = undefined;
      this.meshToRemove.push(...item.content.meshGroups);
    }

  }

  override onCompositionDestroyed (composition: Composition) {
    if (composition.reusable || composition.keepResource) {
      this.slotGroups.map(slotGroup => {
        slotGroup && slotGroup.meshGroups.map(mesh => mesh.mesh.dispose({ material: { textures: DestroyOptions.keep } }));
      });
    } else {
      if (composition.loaderData.spineDatas) {
        delete composition.loaderData.spineDatas;
      }
    }
  }

  override prepareRenderFrame (composition: Composition, renderFrame: RenderFrame): boolean {
    this.meshToRemove.map(spineMesh => renderFrame.removeMeshFromDefaultRenderPass(spineMesh.mesh));
    this.slotGroups.length && this.slotGroups.map(slotGroup => {
      if (slotGroup) {
        slotGroup.meshToAdd.forEach(mesh => {
          mesh.getVisible() && renderFrame.addMeshToDefaultRenderPass(mesh);
        });
        slotGroup.resetMeshes();
      }
    });

    this.meshToRemove.length = 0;

    return false;
  }
}

