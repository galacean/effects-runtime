import { spec, generateGUID, Downloader, TextureSourceType, getStandardJSON } from '@galacean/effects';
import type { Engine, Player, Renderer, JSONValue, TextureCubeSourceOptions, GeometryProps } from '@galacean/effects';
import { CullMode, PBRShaderGUID, RenderType, UnlitShaderGUID } from '../runtime';
import { Color } from '../runtime/math';
import { deserializeGeometry } from '@galacean/effects-helper';
import type { ModelTreeContent } from '../index';

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
    this.setComposition(newScene, oldScene);

    return newScene;
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

          const newMipmaps = loadedMipmaps.map(mipmaps => mipmaps.map(img => {
            const id = generateGUID();
            const sceneImage: spec.Image = {
              url: img,
              // @ts-expect-error
              id,
            };

            newScene.images.push(sceneImage);
            const dataPath: spec.DataPath = { id };

            return dataPath;
          }));

          const newTex = {
            keepImageSource: false,
            ...tex,
            ...{
              mipmaps: newMipmaps,
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
    const newComponents = newScene.components;

    for (const comp of oldScene.components) {
      if (comp.dataType === spec.DataType.SkyboxComponent) {
        newComponents.push(this.createSkyboxComponent(comp, newScene));
      } else if (comp.dataType === spec.DataType.MeshComponent) {
        newComponents.push(this.createMeshComponent(comp, newScene, oldScene));
      } else if (comp.dataType === spec.DataType.LightComponent) {
        newComponents.push(comp);
        console.warn('Find light component', comp);
      } else if (comp.dataType === spec.DataType.CameraComponent) {
        newComponents.push(comp);
        console.warn('Find camera component', comp);
      } else if (comp.dataType === spec.DataType.TreeComponent) {
        const treeComp = comp as unknown as ModelTreeContent;

        treeComp.options.tree.animation = undefined;
        treeComp.options.tree.animations = undefined;
        newComponents.push(comp);
      } else {
        newComponents.push(comp);
      }
    }
  }

  setComposition (newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    newScene.items = oldScene.items;
    newScene.compositionId = oldScene.compositionId;
    newScene.compositions = oldScene.compositions;
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

    return URL.createObjectURL((new Blob([new Uint8Array(bin, start, length)])));
  }

  private createSkyboxComponent (component: spec.ComponentData, scene: spec.JSONScene): spec.SkyboxComponentData {
    const skyboxOptions = (component as unknown as spec.SkyboxContent<'json'>).options;
    let irradianceCoeffs;

    if (skyboxOptions.irradianceCoeffs) {
      irradianceCoeffs = [];
      skyboxOptions.irradianceCoeffs.forEach(coeffs => irradianceCoeffs.push(...coeffs));
    }

    let diffuseImage;

    if (skyboxOptions.diffuseImage) {
      // @ts-expect-error
      diffuseImage = { id: scene.textures[skyboxOptions.diffuseImage].id } as spec.DataPath;
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
        id: scene.textures[skyboxOptions.specularImage].id,
      },
      specularImageSize: skyboxOptions.specularImageSize,
      specularMipCount: skyboxOptions.specularMipCount,
    };

    return skyboxComponent;
  }

  private createMeshComponent (component: spec.ComponentData, newScene: spec.JSONScene, oldScene: spec.JSONScene): spec.ModelMeshComponentData {
    const meshOptions = (component as unknown as spec.ModelMeshItemContent<'json'>).options;
    const primitives: spec.PrimitiveData[] = [];

    meshOptions.primitives.forEach(prim => {
      const geometryData = this.getGeometryData(prim.geometry, oldScene);
      const materialData = this.getMaterialData(prim.material, oldScene);

      newScene.geometries.push(geometryData);
      newScene.materials.push(materialData);
      primitives.push({
        geometry: { id: geometryData.id },
        material: { id: materialData.id },
      });
    });

    const meshComponent: spec.ModelMeshComponentData = {
      id: component.id,
      dataType: component.dataType,
      item: component.item,
      primitives,
    };

    return meshComponent;
  }

  private getGeometryData (geometry: spec.GeometryOptionsJSON, scene: spec.JSONScene) {
    const geomOptions = deserializeGeometry(geometry, scene.bins as unknown as ArrayBuffer[]);

    return getGeometryDataFromOptions(geomOptions);
  }

  private getMaterialData (material: spec.MaterialOptions<'json'>, scene: spec.JSONScene) {
    if (material.type === spec.MaterialType.unlit) {
      const floats: Record<string, number> = {};

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
      };

      const textures: Record<string, spec.MaterialTextureProperty> = {};

      if (material.baseColorTexture) {
        textures['_BaseColorSampler'] = this.getTextureData(scene, floats, material.baseColorTexture, material.baseColorTextureTransform);
      }

      const newMaterial: spec.MaterialData = {
        id: generateGUID(),
        name: material.name,
        dataType: spec.DataType.Material,
        shader: {
          id: UnlitShaderGUID,
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
        textures['_BaseColorSampler'] = this.getTextureData(scene, floats, material.baseColorTexture, material.baseColorTextureTransform);
      }

      if (material.metallicRoughnessTexture) {
        textures['_MetallicRoughnessSampler'] = this.getTextureData(scene, floats, material.metallicRoughnessTexture, material.metallicRoughnessTextureTransform);
      }

      if (material.normalTexture) {
        textures['_NormalSampler'] = this.getTextureData(scene, floats, material.normalTexture, material.normalTextureTransform);
      }

      if (material.occlusionTexture) {
        textures['_OcclusionSampler'] = this.getTextureData(scene, floats, material.occlusionTexture, material.occlusionTextureTransform);
      }

      if (material.emissiveTexture) {
        textures['_EmissiveSampler'] = this.getTextureData(scene, floats, material.emissiveTexture, material.emissiveTextureTransform);
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

  private getTextureData (scene: spec.JSONScene, floats: Record<string, number>, texIndex: number, texTransform?: spec.ModelTextureTransform) {
    const id = scene.textures![texIndex].id ?? '0';
    const texProperty: spec.MaterialTextureProperty = {
      texture: { id },
    };

    if (texTransform) {
      if (texTransform.scale) {
        texProperty.scale = {
          x: texTransform.scale[0],
          y: texTransform.scale[1],
        };
      }
      if (texTransform.offset) {
        texProperty.offset = {
          x: texTransform.offset[0],
          y: texTransform.offset[1],
        };
      }
      if (texTransform.rotation) {
        floats['_BaseColorRotation'] = texTransform.rotation;
      }
    }

    return texProperty;
  }
}

interface ModelData {
  vertices: number[],
  uvs: number[],
  normals: number[],
  indices: number[],
  name: string,
}

function getGeometryDataFromOptions (geomOptions: GeometryProps) {
  let vertexCount = 0;
  const modelData: ModelData = {
    vertices: [],
    uvs: [],
    normals: [],
    indices: [],
    name: geomOptions.name ?? '<empty>',
  };

  for (const attrib in geomOptions.attributes) {
    const attribData = geomOptions.attributes[attrib];

    if (attrib === 'a_Position') {
      // @ts-expect-error
      vertexCount = attribData.data.length / attribData.size;
      // @ts-expect-error
      modelData.vertices = array2Number(attribData.data);
    } else if (attrib === 'a_Normal') {
      // @ts-expect-error
      modelData.normals = array2Number(attribData.data);
    } else if (attrib === 'a_UV1') {
      // @ts-expect-error
      modelData.uvs = array2Number(attribData.data);
    }
  }

  if (geomOptions.indices) {
    // @ts-expect-error
    modelData.indices = array2Number(geomOptions.indices.data);
  } else {
    throw Error('indices is required');
  }

  const geometryData: spec.GeometryData = {
    id: generateGUID(),
    dataType: spec.DataType.Geometry,
    vertexData: {
      vertexCount: vertexCount,
      channels: [
        {
          offset: 0,
          format: 0,
          dimension: 3,
        },
        {
          offset: vertexCount * 3 * 4,
          format: 0,
          dimension: 2,
        },
        {
          offset: vertexCount * 5 * 4,
          format: 0,
          dimension: 3,
        },
      ],
    },
    mode: spec.GeometryType.TRIANGLES,
    indexFormat: 0,
    indexOffset: vertexCount * 8 * 4,
    buffer: encodeVertexData(modelData),
  };

  return geometryData;
}

function encodeVertexData (modelData: ModelData): string {
  const vertices = new Float32Array(modelData.vertices);
  const uvs = new Float32Array(modelData.uvs);
  const normals = new Float32Array(modelData.normals);
  const indices = new Uint16Array(modelData.indices);

  // 计算新 ArrayBuffer 的总大小（以字节为单位）
  const totalSize = vertices.byteLength + uvs.byteLength + normals.byteLength + indices.byteLength;

  // 创建一个足够大的 ArrayBuffer 来存储两个数组的数据
  const buffer = new ArrayBuffer(totalSize);

  // 创建一个视图来按照 Float32 格式写入数据
  let floatView = new Float32Array(buffer, 0, vertices.length);

  floatView.set(vertices);
  floatView = new Float32Array(buffer, vertices.byteLength, uvs.length);
  floatView.set(uvs);
  floatView = new Float32Array(buffer, vertices.byteLength + uvs.byteLength, normals.length);
  floatView.set(normals);

  // 创建一个视图来按照 Uint16 格式写入数据，紧接着 Float32 数据之后
  const uint16View = new Uint16Array(buffer, vertices.byteLength + uvs.byteLength + normals.byteLength, indices.length);

  uint16View.set(indices);

  // 创建一个 Uint8Array 视图以便逐字节访问 ArrayBuffer 的数据
  const uint8View = new Uint8Array(buffer);

  // 将 Uint8Array 转换为二进制字符串
  let binaryString = '';

  for (let i = 0; i < uint8View.length; i++) {
    binaryString += String.fromCharCode(uint8View[i]);
  }

  // 使用 btoa 函数将二进制字符串转换为 Base64 编码的字符串
  return btoa(binaryString);
}

function array2Number (array: Float32Array | Uint16Array): number[] {
  const result: number[] = [];

  array.forEach(v => result.push(v));

  return result;
}
