import { spec, generateGUID, Downloader, loadImage, TextureSourceType, getStandardJSON } from '@galacean/effects';
import type { Engine, Player, Renderer, JSONValue, TextureCubeSourceOptions } from '@galacean/effects';
import { CullMode, PBRShaderGUID, RenderType } from '../runtime';
import { Color } from '../runtime/math';

export class JsonConverter {
  newScene: spec.JSONScene;

  engine: Engine;
  renderer: Renderer;
  downloader: Downloader;

  constructor (player: Player) {
    this.engine = player.renderer.engine;
    this.renderer = player.renderer;
    this.downloader = new Downloader();
  }

  async processScene (sceneData: string | Object) {
    let sceneJSON;

    if (sceneData instanceof Object) {
      sceneJSON = sceneData;
    } else {
      sceneJSON = await this.loadJSON(sceneData);
    }

    const oldScene = getStandardJSON(sceneJSON);
    const binFiles: ArrayBuffer[] = [];

    if (oldScene.bins) {
      for (const bin of oldScene.bins) {
        binFiles.push(await this.loadBins(bin.url));
      }
    }
    // @ts-expect-error
    oldScene.bins = binFiles;

    const newScene: spec.JSONScene = {
      version: '3.0',
      playerVersion: {
        web: '3.0',
        native: '3.0',
      },
      type: 'ge',
      compositions: [],
      compositionId: oldScene.compositionId,
      images: [],
      shapes: [],
      plugins: oldScene.plugins,
      textures: [],
      items: [],
      components: [],
      materials: [],
      shaders: [],
      geometries: [],
    };

    this.setImage(newScene, oldScene);
    await this.setTexture(newScene, oldScene);
    this.setComponent(newScene, oldScene);
  }

  setImage (newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    const newImages: spec.Image[] = [];

    oldScene.images.forEach(image => {
      // @ts-expect-error
      image.id = generateGUID();
      newImages.push(image);
    });

    newScene.images = newImages;
  }

  async setTexture (newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    const newTextures: spec.TextureDefine[] = [];
    const bins = oldScene.bins as unknown as ArrayBuffer[];

    if (oldScene.textures) {
      for (const tex of oldScene.textures) {
        if (tex.target === 34067) {
          const { mipmaps, target } = tex as spec.SerializedTextureCube;
          const jobs = mipmaps.map(mipmap => Promise.all(mipmap.map(pointer => this.loadMipmapImage(pointer, bins))));
          const loadedMipmaps = await Promise.all(jobs);

          const newTex = {
            keepImageSource: false,
            ...tex,
            ...{
              mipmaps: loadedMipmaps,
              sourceFrom: {
                target,
                type: TextureSourceType.mipmaps,
                mipmaps: mipmaps.map(mipmap => mipmap.map(pointer => [pointer[1][1], pointer[1][2]])),
              },
            } as TextureCubeSourceOptions,
          };

          // @ts-expect-error
          newTextures.push(newTex);
        } else {
          // @ts-expect-error
          const source = tex.source as any;

          if (typeof source === 'number') {
            // @ts-expect-error
            tex.source = { id: newScene.images[source].id };
          }
          newTextures.push(tex);
        }
      }
    }

    newScene.textures = newTextures;
  }

  setComponent (newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    const newComponents: spec.ComponentData[] = [];

    for (const comp of oldScene.components) {
      if (comp.dataType === spec.DataType.SkyboxComponent) {
        newComponents.push(this.createSkyboxComponent(comp));
      } else if (comp.dataType === spec.DataType.MeshComponent) {
        newComponents.push(comp);
      } else if (comp.dataType === spec.DataType.TreeComponent) {
        newComponents.push(comp);
      } else {
        newComponents.push(comp);
      }
    }
  }

  setComposition (newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    // const oldCompositions = oldScene.compositions;
    // const newCompositions: spec.Composition[] = [];
    // oldCompositions.forEach(comp => {
    //   // const newComp: spec.Composition = {
    //   //   ...comp
    //   // };
    //   // comp.items.forEach(item => {

    //   // })
    // })
  }

  private async loadJSON (url: string) {
    return new Promise<JSONValue>((resolve, reject) => {
      this.downloader.downloadJSON(
        url,
        resolve,
        (status, responseText) => {
          reject(`Couldn't load JSON ${JSON.stringify(url)}: status ${status}, ${responseText}`);
        });
    });
  }

  private async loadBins (url: string) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.downloader.downloadBinary(
        url,
        resolve,
        (status, responseText) => {
          reject(`Couldn't load bins ${JSON.stringify(url)}: status ${status}, ${responseText}`);
        });
    });
  }

  private async loadMipmapImage (pointer: spec.BinaryPointer, bins: ArrayBuffer[]) {
    const [index, start, length] = pointer[1];
    const bin = bins[index];

    if (!bin) {
      throw new Error(`invalid bin pointer: ${JSON.stringify(pointer)}`);
    }

    return loadImage(new Blob([new Uint8Array(bin, start, length)]));
  }

  private createSkyboxComponent (component: spec.ComponentData): spec.SkyboxComponentData {
    const skyboxOptions = (component as unknown as spec.SkyboxContent<'json'>).options;
    let irradianceCoeffs;

    if (skyboxOptions.irradianceCoeffs) {
      irradianceCoeffs = [];
      skyboxOptions.irradianceCoeffs.forEach(coeffs => irradianceCoeffs.push(...coeffs));
    }

    let diffuseImage;

    if (skyboxOptions.diffuseImage) {
      // @ts-expect-error
      diffuseImage = { id: newScene.textures[skyboxOptions.diffuseImage].id } as spec.DataPath;
    }

    const skyboxComponent: spec.SkyboxComponentData = {
      id: component.id,
      dataType: component.dataType,
      item: component.item,
      renderable: skyboxOptions.renderable,
      intensity: skyboxOptions.intensity,
      reflectionsIntensity: skyboxOptions.reflectionsIntensity,
      irradianceCoeffs: irradianceCoeffs,
      diffuseImage,
      specularImage: {
        // @ts-expect-error
        id: newScene.textures[skyboxOptions.specularImage].id,
      },
      specularImageSize: skyboxOptions.specularImageSize,
      specularMipCount: skyboxOptions.specularMipCount,
    };

    return skyboxComponent;
  }

  private createMeshComponent (component: spec.ComponentData): spec.ModelMeshComponentData {
    const meshOptions = (component as unknown as spec.ModelMeshItemContent<'json'>).options;
    const primitives: spec.PrimitiveData[] = [];

    meshOptions.primitives.forEach(prim => {

    });

    const meshComponent: spec.ModelMeshComponentData = {
      id: component.id,
      dataType: component.dataType,
      item: component.item,
      primitives,
    };

    return meshComponent;
  }

  private createMaterial (material: spec.MaterialOptions<'json'>, scene: spec.JSONScene) {
    if (material.type === spec.MaterialType.unlit) {
      return material;
    } else {
      const floats: Record<string, number> = {
        '_MetallicFactor': material.metallicFactor,
        '_RoughnessFactor': material.roughnessFactor,
      };

      if (material.useSpecularAA !== undefined) {
        floats['_SpecularAA'] = material.useSpecularAA ? 1 : 0;
      }
      if (material.normalTextureScale !== undefined) {
        floats['_NormalScale'] = material.normalTextureScale;
      }
      if (material.occlusionTextureStrength !== undefined) {
        floats['_OcclusionStrength'] = material.occlusionTextureStrength;
      }
      if (material.emissiveIntensity !== undefined) {
        floats['_EmissiveIntensity'] = material.emissiveIntensity;
      }
      if (material.alphaCutOff !== undefined) {
        floats['_AlphaCutoff'] = material.alphaCutOff;
      }
      const colors: Record<string, Color> = {
        '_BaseColorFactor': new Color(
          material.baseColorFactor[0],
          material.baseColorFactor[1],
          material.baseColorFactor[2],
          material.baseColorFactor[3],
        ).divide(255),
        '_EmissiveFactor': new Color(
          material.emissiveFactor[0],
          material.emissiveFactor[1],
          material.emissiveFactor[2],
          material.emissiveFactor[3],
        ).divide(255),
      };

      const textures: Record<string, spec.MaterialTextureProperty> = {};

      if (material.baseColorTexture) {
        if (material.baseColorTextureTransform) {
          textures['_BaseColorSampler'] = {
            // @ts-expect-error
            texture: { id: scene.textures[material.baseColorTexture].id },
          };
        } else {
          textures['_BaseColorSampler'] = {
            // @ts-expect-error
            texture: { id: scene.textures[material.baseColorTexture].id },
          };
        }
      }

      const newMaterial: spec.MaterialData = {
        id: generateGUID(),
        name: material.name,
        dataType: spec.DataType.Material,
        shader: {
          id: PBRShaderGUID,
        },
        stringTags: this.getStringTags(material),
        macros: [],
        ints: {},
        floats,
        vector4s: {},
        colors,
        textures,
      };

      return newMaterial;
    }
  }

  private getStringTags (material: spec.MaterialOptions<'json'>): Record<string, string> {
    const stringTags: Record<string, string> = {};

    stringTags['ZWrite'] = String(material.depthMask ?? true);
    stringTags['ZTest'] = String(true);
    if (material.blending === spec.MaterialBlending.masked) {
      throw Error('Alpha mask not support');
    } else if (material.blending === spec.MaterialBlending.translucent) {
      stringTags['RenderType'] = RenderType.Blend;
    } else {
      stringTags['RenderType'] = RenderType.Opaque;
    }
    if (material.side === spec.SideMode.BACK) {
      stringTags['Cull'] = CullMode.Back;
    } else if (material.side === spec.SideMode.DOUBLE) {
      stringTags['Cull'] = CullMode.Double;
    } else {
      stringTags['Cull'] = CullMode.Front;
    }

    return stringTags;
  }

  private getTextureData (scene: spec.JSONScene, material: spec.MaterialData, name: string, texIndex: number, texTransform: spec.ModelTextureTransform) {

  }
}
