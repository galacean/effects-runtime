import { spec, generateGUID, Downloader, TextureSourceType, getStandardJSON, glType2VertexFormatType, glContext } from '@galacean/effects';
import type {
  Engine, Player, Renderer, JSONValue, TextureCubeSourceOptions, GeometryProps,
} from '@galacean/effects';
import { PBRShaderGUID, UnlitShaderGUID } from '../runtime';
import { Color, Quaternion, Vector3 } from '../runtime/math';
import { deserializeGeometry } from '@galacean/effects-helper';
import type { ModelTreeContent } from '../index';
import { typedArrayFromBinary } from '@galacean/effects-helper';

export class JSONConverter {
  newScene: spec.JSONScene;

  engine: Engine;
  renderer: Renderer;
  downloader: Downloader;
  treeInfo = new TreeInfo();

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

    // @ts-expect-error
    sceneJSON.textures.forEach(tex => {
      if (tex.source === undefined) {
        tex.source = 0;
      }
    });

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
      ...oldScene,
      version: '3.0',
      playerVersion: {
        web: '3.0',
        native: '3.0',
      },
      type: 'ge',
      compositions: [],
      images: [],
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
    this.setItem(newScene, oldScene);
    this.setComposition(newScene, oldScene);

    return newScene;
  }

  setImage (newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    const newImages: spec.Image[] = [];

    oldScene.images.forEach(image => {
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
      } else if (comp.dataType === spec.DataType.LightComponent) {
        newComponents.push(this.createLightComponent(comp, newScene));
      } else if (comp.dataType === spec.DataType.CameraComponent) {
        newComponents.push(comp);
        console.warn('Find camera component', comp);
      } else if (comp.dataType === spec.DataType.TreeComponent) {
        const treeComp = comp as unknown as ModelTreeContent;

        this.createItemsFromTreeComponent(comp, newScene, oldScene);
        treeComp.options.tree.animation = undefined;
        treeComp.options.tree.animations = undefined;
        newComponents.push(comp);
      } else if (comp.dataType !== spec.DataType.MeshComponent) {
        newComponents.push(comp);
      }
    }

    for (const comp of oldScene.components) {
      if (comp.dataType === spec.DataType.MeshComponent) {
        newComponents.push(this.createMeshComponent(comp, newScene, oldScene));
      }
    }
  }

  setItem (newScene: spec.JSONScene, oldScene: spec.JSONScene) {

  }

  setComposition (newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    newScene.items = oldScene.items;
    newScene.items.push(...this.treeInfo.getAllTreeNodeList());
    newScene.compositionId = oldScene.compositionId;
    newScene.compositions = oldScene.compositions;

    newScene.items.forEach(item => {
      // @ts-expect-error
      if (item.type === 'root') {
        // @ts-expect-error
        item.type = 'ECS';
      }
    });

    // @ts-expect-error
    newScene.compositions[0].items = newScene.items.map(item => {
      return { id: item.id } as spec.DataPath;
    });
  }

  private async loadJSON (url: string) {
    return new Promise<JSONValue>((resolve, reject) => {
      this.downloader.downloadJSON(
        url,
        resolve,
        (status, responseText) => {
          reject(new Error(`Couldn't load JSON ${JSON.stringify(url)}: status ${status}, ${responseText}`));
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

    const geometryPropsList: GeometryProps[] = [];
    const materialDatas: spec.MaterialData[] = [];

    meshOptions.primitives.forEach(prim => {
      const geomProps = deserializeGeometry(prim.geometry, oldScene.bins as unknown as ArrayBuffer[]);
      const material = this.getMaterialData(prim.material, oldScene);

      if (geomProps.indices?.data instanceof Uint8Array) {
        const oldIndices = geomProps.indices.data;
        const newIndices = new Uint16Array(oldIndices.length);

        for (let i = 0; i < oldIndices.length; i++) {
          newIndices[i] = oldIndices[i];
        }

        geomProps.indices.data = newIndices;
      }

      geometryPropsList.push(geomProps);
      materialDatas.push(material);
    });

    const geometryData = getGeometryDataFromPropsList(geometryPropsList);

    if (!geometryData) {
      throw new Error('no primitives');
    }

    newScene.geometries.push(geometryData);
    newScene.materials.push(...materialDatas);

    const meshComponent: spec.ModelMeshComponentData = {
      id: component.id,
      dataType: component.dataType,
      item: component.item,
      geometry: { id: geometryData.id },
      materials: materialDatas.map(mat => {
        const data: spec.DataPath = {
          id: mat.id,
        };

        return data;
      }),
    };

    if (meshOptions.skin) {
      let parentItemId = component.item.id;

      for (const item of oldScene.items) {
        if (item.id === component.item.id) {
          parentItemId = item.parentId as string;
        }
      }

      if (parentItemId === component.item.id) {
        throw new Error(`Can't item ${component.item}`);
      }

      const treeItem = this.treeInfo.getTreeItemByNodeId(parentItemId);
      const treeNodeList = this.treeInfo.getTreeNodeListByNodeId(parentItemId);

      if (!treeItem || !treeNodeList) {
        throw new Error(`Can't find tree node list for ${component.item}`);
      }
      const rootBoneItem = this.setupBoneData(geometryData, meshOptions.skin, oldScene, treeItem, treeNodeList);

      meshComponent.rootBone = { id: rootBoneItem.id };
    }

    if (meshOptions.weights !== undefined) {
      meshComponent.morph = {
        weights: meshOptions.weights,
      };
    }

    return meshComponent;
  }

  private createItemsFromTreeComponent (component: spec.ComponentData, newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    let treeItem = oldScene.items[0];

    oldScene.items.forEach(item => {
      if (item.id === component.item.id) {
        treeItem = item;
      }
    });

    const treeComp = component as unknown as ModelTreeContent;
    const treeData = treeComp.options.tree;
    const treeNodeList: spec.VFXItemData[] = [];

    treeData.nodes.forEach((node, index) => {
      const item: spec.VFXItemData = {
        id: generateGUID(),
        parentId: treeItem.id,
        name: node.name ?? `node${index}`,
        duration: treeItem.duration,
        // @ts-expect-error
        type: 'ECS',
        dataType: spec.DataType.VFXItemData,
        visible: treeItem.visible,
        endBehavior: treeItem.endBehavior,
        delay: treeItem.delay,
        content: {},
        renderLevel: treeItem.renderLevel,
        pn: treeItem.pn,
        pluginName: treeItem.pluginName,
        transform: this.getTransformData(node.transform),
        components: [],
      };

      treeNodeList.push(item);
      newScene.items.push(item);
    });

    treeData.nodes.forEach((node, index) => {
      const item = treeNodeList[index];

      node.children?.forEach(child => {
        const childItem = treeNodeList[child];

        childItem.parentId = item.id;
      });
    });

    oldScene.items.forEach(item => {
      if (item.parentId) {
        const index = item.parentId.indexOf('^');

        if (index >= 0) {
          const parentId = item.parentId.substring(0, index);
          const subIndex = +item.parentId.substring(index + 1);

          if (parentId === treeItem.id) {
            item.parentId = treeNodeList[subIndex].id;
          }
        }
      }
    });

    this.treeInfo.add(treeItem, treeNodeList);

    this.createAnimationComponent(treeData as any, treeItem, newScene, oldScene);
  }

  private createLightComponent (component: spec.ComponentData, scene: spec.JSONScene): spec.ModelLightComponentData {
    const lightOptions = (component as unknown as spec.ModelLightContent).options;

    const lightComponent: spec.ModelLightComponentData = {
      id: component.id,
      dataType: component.dataType,
      item: component.item,
      lightType: lightOptions.lightType as spec.LightType,
      color: {
        r: lightOptions.color[0] / 255.0,
        g: lightOptions.color[1] / 255.0,
        b: lightOptions.color[2] / 255.0,
        a: lightOptions.color[3] / 255.0,
      },
      intensity: lightOptions.intensity,
    };

    if (lightOptions.lightType === 'point') {
      lightComponent.range = lightOptions.range;
    } else if (lightOptions.lightType === 'spot') {
      lightComponent.range = lightOptions.range;
      lightComponent.innerConeAngle = lightOptions.innerConeAngle;
      lightComponent.outerConeAngle = lightOptions.outerConeAngle;
    }

    return lightComponent;
  }

  private createAnimationComponent (treeOptions: spec.ModelTreeOptions<'json'>, treeItem: spec.VFXItemData, newScene: spec.JSONScene, oldScene: spec.JSONScene) {
    const { animation, animations } = treeOptions;

    const animationComponent: spec.AnimationComponentData = {
      id: generateGUID(),
      dataType: spec.DataType.AnimationComponent,
      item: { id: treeItem.id },
      animation,
      animationClips: [],
    };

    if (animations && animations.length) {
      // FIXME: calcuate tree item duration
      const bins = oldScene.bins as unknown as ArrayBuffer[];

      animations.forEach(anim => {
        const clipData: spec.AnimationClipData = {
          id: generateGUID(),
          name: anim.name,
          dataType: spec.DataType.AnimationClip,
          positionCurves: [],
          rotationCurves: [],
          scaleCurves: [],
          floatCurves: [],
        };

        let totalAnimationTime = 0;

        anim.tracks.forEach(track => {
          const inputArray = typedArrayFromBinary(bins, track.input) as Float32Array;

          totalAnimationTime = Math.max(totalAnimationTime, inputArray[inputArray.length - 1]);
        });

        anim.tracks.forEach(track => {
          const inputArray = typedArrayFromBinary(bins, track.input);
          const outputArray = typedArrayFromBinary(bins, track.output) as Float32Array;

          if (!(inputArray instanceof Float32Array)) {
            throw new Error(`Type of inputArray should be float32, ${inputArray}`);
          }
          if (!(outputArray instanceof Float32Array)) {
            throw new Error(`Type of outputArray should be float32, ${outputArray}`);
          }
          if (track.interpolation !== 'LINEAR') {
            throw new Error(`Invalid interpolation type ${track.interpolation}`);
          }

          if (track.path === 'rotation') {
            const points: spec.vec4[] = [];
            const controlPoints: spec.vec4[] = [];
            const lineValue: spec.LineKeyframeValue[] = [];

            for (let i = 0; i < inputArray.length; i++) {
              points.push([
                outputArray[i * 4],
                outputArray[i * 4 + 1],
                outputArray[i * 4 + 2],
                outputArray[i * 4 + 3],
              ]);

              if (i > 0) {
                const p0 = Quaternion.fromArray(points[i - 1]);
                const p3 = Quaternion.fromArray(points[i]);
                const p1 = new Quaternion();
                const p2 = new Quaternion();

                p1.slerpQuaternions(p0, p3, 1 / 3);
                p2.slerpQuaternions(p0, p3, 2 / 3);

                controlPoints.push(p1.toArray());
                controlPoints.push(p2.toArray());
              }

              lineValue.push([
                spec.BezierKeyframeType.LINE,
                [inputArray[i], i],
              ]);
            }

            const node = this.treeInfo.getTreeNode(treeItem.id, track.node);
            const path = this.treeInfo.getNodePath(node.id);

            const keyFrames: spec.BezierCurveQuat = [
              spec.ValueType.BEZIER_CURVE_QUAT,
              [lineValue, points, controlPoints],
            ];

            clipData.rotationCurves.push({ path, keyFrames });
          } else if (track.path === 'weights') {
            const node = this.treeInfo.getTreeNode(treeItem.id, track.node);
            let path = this.treeInfo.getNodePath(node.id);

            if (node.components.length === 0) {
              for (let i = 0; i < oldScene.items.length; i++) {
                const child = oldScene.items[i];

                if (child.parentId === node.id) {
                  path += '/' + child.name;

                  break;
                }
              }
            }
            const component = outputArray.length / inputArray.length;

            for (let c = 0; c < component; c++) {
              const lineValue: spec.LineKeyframeValue[] = [];

              for (let i = 0; i < inputArray.length; i++) {
                lineValue.push([
                  spec.BezierKeyframeType.LINE,
                  [inputArray[i], outputArray[i * component + c]],
                ]);
              }

              const keyFrames: spec.BezierValue = [
                spec.ValueType.BEZIER_CURVE,
                lineValue,
              ];

              clipData.floatCurves.push({
                path,
                className: 'ModelMeshComponent',
                property: `morphWeights.${c}`,
                keyFrames,
              });
            }
          } else {
            const points: spec.vec3[] = [];
            const controlPoints: spec.vec3[] = [];
            const lineValue: spec.LineKeyframeValue[] = [];

            for (let i = 0; i < inputArray.length; i++) {
              points.push([
                outputArray[i * 3],
                outputArray[i * 3 + 1],
                outputArray[i * 3 + 2],
              ]);

              if (i > 0) {
                const p0 = Vector3.fromArray(points[i - 1]);
                const p3 = Vector3.fromArray(points[i]);
                const p1 = new Vector3().lerpVectors(p0, p3, 1 / 3);
                const p2 = new Vector3().lerpVectors(p0, p3, 2 / 3);

                controlPoints.push(p1.toArray());
                controlPoints.push(p2.toArray());
              }

              lineValue.push([
                spec.BezierKeyframeType.LINE,
                [inputArray[i], i],
              ]);
            }

            const node = this.treeInfo.getTreeNode(treeItem.id, track.node);
            const path = this.treeInfo.getNodePath(node.id);

            const keyFrames: spec.BezierCurvePath = [
              spec.ValueType.BEZIER_CURVE_PATH,
              [lineValue, points, controlPoints],
            ];

            if (track.path === 'translation') {
              clipData.positionCurves.push({ path, keyFrames });
            } else {
              clipData.scaleCurves.push({ path, keyFrames });
            }
          }
        });

        // @ts-expect-error
        newScene.animations.push(clipData);

        animationComponent.animationClips.push({ id: clipData.id });
      });
    }

    treeItem.components.push({ id: animationComponent.id });
    newScene.components.push(animationComponent);
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
        stringTags: {},
        macros: [],
        ints: {},
        floats,
        vector4s: {},
        colors,
        textures,
      };

      this.setupMaterial(material, newMaterial);

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
        stringTags: {},
        macros: [],
        ints: {},
        floats,
        vector4s: {},
        colors,
        textures,
      };

      this.setupMaterial(material, newMaterial);

      return newMaterial;
    }
  }

  private setupMaterial (oldMat: spec.MaterialOptions<'json'>, newMat: spec.MaterialData) {
    if (oldMat.blending === spec.MaterialBlending.translucent) {
      newMat.stringTags['RenderType'] = spec.RenderType.Transparent;
    } else {
      newMat.stringTags['RenderType'] = spec.RenderType.Opaque;
    }

    if (oldMat.blending === spec.MaterialBlending.masked) {
      newMat.floats['AlphaClip'] = 1;
      newMat.floats['_Cutoff'] = oldMat.alphaCutOff ?? 0;
    } else {
      newMat.floats['AlphaClip'] = 0;
    }

    if (oldMat.side === spec.SideMode.BACK) {
      newMat.stringTags['RenderFace'] = spec.RenderFace.Back;
    } else if (oldMat.side === spec.SideMode.DOUBLE) {
      newMat.stringTags['RenderFace'] = spec.RenderFace.Both;
    } else {
      newMat.stringTags['RenderFace'] = spec.RenderFace.Front;
    }

    if (oldMat.type === spec.MaterialType.pbr) {
      newMat.floats['_SpecularAA'] = oldMat.useSpecularAA ? 1 : 0;
    }

    newMat.stringTags['ZWrite'] = String(oldMat.depthMask ?? true);
    newMat.stringTags['ZTest'] = String(true);
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

  private getTransformData (transform?: spec.BaseItemTransform) {
    const result: spec.TransformData = {
      position: { x: 0, y: 0, z: 0 },
      eulerHint: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };

    if (transform?.position) {
      result.position.x = transform.position[0];
      result.position.y = transform.position[1];
      result.position.z = transform.position[2];
    }

    if (transform?.quat) {
      // @ts-expect-error
      result.quat = {};
      // @ts-expect-error
      result.quat.x = transform.quat[0];
      // @ts-expect-error
      result.quat.y = transform.quat[1];
      // @ts-expect-error
      result.quat.z = transform.quat[2];
      // @ts-expect-error
      result.quat.w = transform.quat[3];
    } else if (transform?.rotation) {
      result.eulerHint.x = transform.rotation[0];
      result.eulerHint.y = transform.rotation[1];
      result.eulerHint.z = transform.rotation[2];
    }

    if (transform?.scale) {
      result.scale.x = transform.scale[0];
      result.scale.y = transform.scale[1];
      result.scale.z = transform.scale[2];
    }

    return result;
  }

  private setupBoneData (geom: spec.GeometryData, skin: spec.SkinOptions<'json'>, oldScene: spec.JSONScene, treeItem: spec.VFXItemData, treeNodeList: spec.VFXItemData[]) {
    const bins = oldScene.bins as unknown as ArrayBuffer[];
    const { joints, skeleton, inverseBindMatrices } = skin;

    if (!inverseBindMatrices) {
      throw new Error(`inverseBindMatrices is undefined ${skin}`);
    }
    const bindMatrixArray = typedArrayFromBinary(bins, inverseBindMatrices) as Float32Array;

    geom.inverseBindMatrices = Array.from(bindMatrixArray);

    const id2Node: Record<string, spec.VFXItemData> = {};

    let rootBoneItem = treeItem;

    if (skeleton !== undefined) {
      rootBoneItem = treeNodeList[skeleton];
    } else {
      console.warn('Root bone is missing');
    }

    joints.forEach(joint => {
      const node = treeNodeList[joint];

      if (node !== rootBoneItem && node.parentId === rootBoneItem.parentId) {
        console.error('Find invalid node for rootBoneItem and adjust rootBoneItem');
        rootBoneItem = treeItem;
      }
    });

    treeNodeList.forEach(node => {
      id2Node[node.id] = node;
    });

    geom.rootBoneName = rootBoneItem.name;

    const boneNames: string[] = [];

    joints.forEach(joint => {
      let currentItem = treeNodeList[joint];
      const nodeList: string[] = [];

      while (currentItem && currentItem != rootBoneItem) {
        nodeList.push(currentItem.name);
        if (currentItem.parentId) {
          currentItem = id2Node[currentItem.parentId];
        } else {
          break;
        }
      }

      boneNames.push(nodeList.reverse().join('/'));
    });

    geom.boneNames = boneNames;

    return rootBoneItem;
  }
}

class TreeInfo {
  tree2NodeList: Record<string, spec.VFXItemData[]> = {};
  nodeList2Tree: Record<string, spec.VFXItemData> = {};
  nodeId2Node: Record<string, spec.VFXItemData> = {};
  node2Path: Record<string, string> = {};

  add (treeItem: spec.VFXItemData, treeNodeList: spec.VFXItemData[]) {
    if (this.tree2NodeList[treeItem.id]) {
      throw new Error(`Find duplicate treeItem id: ${treeItem.id}`);
    }

    this.tree2NodeList[treeItem.id] = treeNodeList;
    treeNodeList.forEach(node => {
      if (this.nodeList2Tree[node.id]) {
        throw new Error(`Find duplicate tree node id: ${node.id}`);
      }
      this.nodeList2Tree[node.id] = treeItem;
      this.nodeId2Node[node.id] = node;
    });

    treeNodeList.forEach(node => {
      this.setNodePath(node);
    });
  }

  setNodePath (node: spec.VFXItemData) {
    if (node.parentId) {
      if (this.node2Path[node.parentId]) {
        this.node2Path[node.id] = this.node2Path[node.parentId] + '/' + node.name;
      } else if (this.nodeId2Node[node.parentId]) {
        this.setNodePath(this.nodeId2Node[node.parentId]);
        this.node2Path[node.id] = this.node2Path[node.parentId] + '/' + node.name;
      } else {
        this.node2Path[node.id] = node.name;
      }
    } else {
      this.node2Path[node.id] = node.name;
    }
  }

  getTreeNodeListByTreeId (id: string) {
    return this.tree2NodeList[id];
  }

  getTreeNodeListByNodeId (id: string) {
    const treeItem = this.nodeList2Tree[id];

    if (!treeItem) {
      throw new Error(`Invalid id ${id}`);
    }

    return this.getTreeNodeListByTreeId(treeItem.id);
  }

  getTreeItemByNodeId (id: string) {
    return this.nodeList2Tree[id];
  }

  getTreeNode (treeId: string, nodeIndex: number) {
    const nodeList = this.getTreeNodeListByTreeId(treeId);

    return nodeList[nodeIndex];
  }

  getAllTreeNodeList () {
    const nodeList: spec.VFXItemData[] = [];

    Object.keys(this.tree2NodeList).forEach(key => {
      nodeList.push(...this.tree2NodeList[key]);
    });

    return nodeList;
  }

  getNodePath (id: string) {
    return this.node2Path[id];
  }
}

export interface ModelData {
  vertices: spec.TypedArray,
  uvs: spec.TypedArray,
  normals: spec.TypedArray,
  indices: spec.TypedArray,
  name: string,
}

export function getGeometryDataFromOptions (geomOptions: GeometryProps) {
  let vertexCount = 0;
  let verticesType: spec.VertexFormatType = spec.VertexFormatType.Float32;
  let verticesNormalize = false;
  let uvsType: spec.VertexFormatType = spec.VertexFormatType.Float32;
  let uvsNormalize = false;
  let normalsType: spec.VertexFormatType = spec.VertexFormatType.Float32;
  let normalsNormalize = false;
  const modelData: ModelData = {
    vertices: new Float32Array(),
    uvs: new Float32Array(),
    normals: new Float32Array(),
    indices: new Float32Array(),
    name: geomOptions.name ?? '<empty>',
  };

  for (const attrib in geomOptions.attributes) {
    const attribData = geomOptions.attributes[attrib];

    if (attrib === 'aPosition') {
      // @ts-expect-error
      vertexCount = attribData.data.length / attribData.size;
      // @ts-expect-error
      modelData.vertices = attribData.data;
      verticesNormalize = attribData.normalize ?? false;
      verticesType = glType2VertexFormatType(attribData.type ?? glContext.FLOAT);
    } else if (attrib === 'aNormal') {
      // @ts-expect-error
      modelData.normals = attribData.data;
      normalsNormalize = attribData.normalize ?? false;
      normalsType = glType2VertexFormatType(attribData.type ?? glContext.FLOAT);
    } else if (attrib === 'aUV1') {
      // @ts-expect-error
      modelData.uvs = attribData.data;
      uvsNormalize = attribData.normalize ?? false;
      uvsType = glType2VertexFormatType(attribData.type ?? glContext.FLOAT);
    }
  }

  const verticesOffset = getOffset(verticesType, 3, vertexCount);
  const uvsOffset = getOffset(uvsType, 2, vertexCount);
  const normalsOffset = getOffset(normalsType, 3, vertexCount);

  if (geomOptions.indices) {
    modelData.indices = geomOptions.indices.data;
  } else if (vertexCount <= 65535) {
    const indices = new Uint16Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      indices[i] = i;
    }
    modelData.indices = indices;
  } else {
    const indices = new Uint32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      indices[i] = i;
    }
    modelData.indices = indices;
  }

  let indicesType: spec.IndexFormatType = spec.IndexFormatType.UInt16;

  if (modelData.indices.BYTES_PER_ELEMENT === 4) {
    indicesType = spec.IndexFormatType.UInt32;
  }

  const geometryData: spec.GeometryData = {
    id: generateGUID(),
    dataType: spec.DataType.Geometry,
    vertexData: {
      vertexCount: vertexCount,
      channels: [
        {
          semantic: spec.VertexBufferSemantic.Position,
          offset: 0,
          format: verticesType,
          dimension: 3,
          normalize: verticesNormalize,
        },
        {
          semantic: spec.VertexBufferSemantic.Uv,
          offset: verticesOffset,
          format: uvsType,
          dimension: 2,
          normalize: uvsNormalize,
        },
        {
          semantic: spec.VertexBufferSemantic.Normal,
          offset: verticesOffset + uvsOffset,
          format: normalsType,
          dimension: 3,
          normalize: normalsNormalize,
        },
      ],
    },
    subMeshes: [],
    mode: spec.GeometryType.TRIANGLES,
    indexFormat: indicesType,
    indexOffset: verticesOffset + uvsOffset + normalsOffset,
    buffer: encodeVertexData(modelData),
  };

  return geometryData;
}

export function getGeometryDataFromPropsList (geomPropsList: GeometryProps[]) {
  if (geomPropsList.length <= 0) {
    return;
  }

  let totalCount = 0;
  const subMeshes: spec.SubMesh[] = [];

  for (let i = 0; i < geomPropsList.length; i++) {
    const count = getDrawCount(geomPropsList[i]);
    const offset = totalCount + (geomPropsList[i].drawStart ?? 0);
    const scale = geomPropsList[0].indices?.data.BYTES_PER_ELEMENT ?? 1;

    subMeshes.push({ offset: offset * scale, indexCount: count, vertexCount: count });
    if (i) {
      const geom0 = geomPropsList[0];
      const geom1 = geomPropsList[i];

      let isSame = true;

      Object.keys(geom0.attributes).forEach(name => {
        const attrib = geom0.attributes[name];
        // @ts-expect-error
        const array1 = attrib.data as spec.TypedArray;
        // @ts-expect-error
        const array2 = geom1.attributes[name].data as spec.TypedArray;

        if (array1.length !== array2.length || array1[0] !== array2[0]) {
          isSame = false;
        }
      });

      if (isSame) {
        if (geom0.indices && geom1.indices) {
          geom0.indices.data = mergeTypedArray(geom0.indices.data, geom1.indices.data);
        }
      } else {
        if (geom0.indices && geom1.indices) {
          const vertexCount = getVertexCount(geom0);

          geom0.indices.data = mergeTypedArray(geom0.indices.data, geom1.indices.data, vertexCount);
        }

        Object.keys(geom0.attributes).forEach(name => {
          const attrib = geom0.attributes[name];
          // @ts-expect-error
          const array1 = attrib.data as spec.TypedArray;
          // @ts-expect-error
          const array2 = geom1.attributes[name].data as spec.TypedArray;

          // @ts-expect-error
          attrib.data = mergeTypedArray(array1, array2);
        });
      }

    }
    totalCount = offset + count;
  }

  return createGeometryData(geomPropsList[0], subMeshes);
}

function getOffset (formatType: spec.VertexFormatType, dimension: number, count: number) {
  switch (formatType) {
    case spec.VertexFormatType.Int8:
    case spec.VertexFormatType.UInt8:
      return dimension * count;
    case spec.VertexFormatType.Int16:
    case spec.VertexFormatType.UInt16:
      return dimension * count * 2;
    default:
      return dimension * count * 4;
  }
}

function createGeometryData (props: GeometryProps, subMeshes: spec.SubMesh[]) {
  let totalByteLength = 0;

  for (const attrib in props.attributes) {
    const attribData = props.attributes[attrib];

    // @ts-expect-error
    totalByteLength += attribData.data.byteLength;
  }

  if (props.indices) {
    totalByteLength += props.indices.data.byteLength;
  }

  let vertexCount = 0;
  let bufferOffset = 0;
  const buffer = new Uint8Array(totalByteLength);
  const vertexChannels: spec.VertexChannel[] = [];

  for (const attrib in props.attributes) {
    const attribData = props.attributes[attrib];
    const semantic = vertexBufferSemanticMap[attrib];

    if (!semantic) {
      throw new Error(`Invalid attrib ${attrib}`);
    }

    // @ts-expect-error
    vertexCount = attribData.data.length / attribData.size;
    const vertexChannel: spec.VertexChannel = {
      semantic,
      offset: bufferOffset,
      format: glType2VertexFormatType(attribData.type ?? glContext.FLOAT),
      dimension: attribData.size,
      normalize: attribData.normalize,
    };

    vertexChannels.push(vertexChannel);
    // @ts-expect-error
    const data = attribData.data as spec.TypedArray;
    const subBuffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    buffer.set(subBuffer, bufferOffset);
    bufferOffset += subBuffer.byteLength;
  }

  const geometryData: spec.GeometryData = {
    id: generateGUID(),
    dataType: spec.DataType.Geometry,
    vertexData: {
      vertexCount: vertexCount,
      channels: vertexChannels,
    },
    subMeshes,
    mode: spec.GeometryType.TRIANGLES,
    indexFormat: spec.IndexFormatType.UInt16,
    indexOffset: -1,
    buffer: '',
  };

  if (props.indices) {
    const indices = props.indices.data;
    const subBuffer = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);

    buffer.set(subBuffer, bufferOffset);
    geometryData.indexOffset = bufferOffset;
    if (indices instanceof Uint32Array) {
      geometryData.indexFormat = spec.IndexFormatType.UInt32;
    }
  }

  geometryData.buffer = toBase64String(buffer);

  return geometryData;
}

function encodeVertexData (modelData: ModelData): string {
  const vertices = new Uint8Array(modelData.vertices.buffer, modelData.vertices.byteOffset, modelData.vertices.byteLength);
  const uvs = new Uint8Array(modelData.uvs.buffer, modelData.uvs.byteOffset, modelData.uvs.byteLength);
  const normals = new Uint8Array(modelData.normals.buffer, modelData.normals.byteOffset, modelData.normals.byteLength);
  const indices = new Uint8Array(modelData.indices.buffer, modelData.indices.byteOffset, modelData.indices.byteLength);

  // 计算新 ArrayBuffer 的总大小（以字节为单位）
  const totalSize = vertices.byteLength + uvs.byteLength + normals.byteLength + indices.byteLength;

  // 创建一个足够大的 ArrayBuffer 来存储两个数组的数据
  const buffer = new ArrayBuffer(totalSize);

  // 创建一个视图来按照 Float32 格式写入数据
  let floatView = new Uint8Array(buffer, 0, vertices.byteLength);

  floatView.set(vertices);
  floatView = new Uint8Array(buffer, vertices.byteLength, uvs.byteLength);
  floatView.set(uvs);
  floatView = new Uint8Array(buffer, vertices.byteLength + uvs.byteLength, normals.byteLength);
  floatView.set(normals);

  // 创建一个视图来按照 Uint16 格式写入数据，紧接着 Float32 数据之后
  const uint16View = new Uint8Array(buffer, vertices.byteLength + uvs.byteLength + normals.byteLength, indices.byteLength);

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

function toBase64String (array: Uint8Array) {
  // 将 Uint8Array 转换为二进制字符串
  let binaryString = '';

  for (let i = 0; i < array.length; i++) {
    binaryString += String.fromCharCode(array[i]);
  }

  // 使用 btoa 函数将二进制字符串转换为 Base64 编码的字符串
  return btoa(binaryString);
}

function getDrawCount (geomProps: GeometryProps) {
  if (geomProps.drawCount) {
    return geomProps.drawCount;
  } else if (geomProps.indices) {
    return geomProps.indices.data.length;
  } else {
    let drawCount = 0;

    // @ts-expect-error
    geomProps.attributes.forEach(attrib => {
      drawCount = attrib.data.length / attrib.size;
    });

    return drawCount;
  }
}

function getVertexCount (geomProps: GeometryProps) {
  let vertexCount = 0;

  Object.keys(geomProps.attributes).forEach(name => {
    const attrib = geomProps.attributes[name];

    // @ts-expect-error
    vertexCount = attrib.data.length / attrib.size;
  });

  return vertexCount;
}

function mergeTypedArray (array1: spec.TypedArray, array2: spec.TypedArray, offset?: number) {
  if (array1 instanceof Float32Array) {
    const result = new Float32Array(array1.length + array2.length);

    result.set(array1);
    result.set(array2, array1.length);

    return result;
  } else if (array1 instanceof Int32Array) {
    const result = new Int32Array(array1.length + array2.length);

    result.set(array1);
    result.set(array2, array1.length);

    return result;
  } else if (array1 instanceof Uint32Array) {
    const result = new Uint32Array(array1.length + array2.length);

    result.set(array1);
    result.set(array2, array1.length);
    if (offset) {
      for (let i = 0; i < array2.length; i++) {
        result[array1.length + i] += offset;
      }
    }

    return result;
  } else if (array1 instanceof Int16Array) {
    const result = new Int16Array(array1.length + array2.length);

    result.set(array1);
    result.set(array2, array1.length);

    return result;
  } else if (array1 instanceof Uint16Array) {
    const result = new Uint16Array(array1.length + array2.length);

    result.set(array1);
    result.set(array2, array1.length);
    if (offset) {
      for (let i = 0; i < array2.length; i++) {
        result[array1.length + i] += offset;
      }
    }

    return result;
  } else if (array1 instanceof Int8Array) {
    const result = new Int8Array(array1.length + array2.length);

    result.set(array1);
    result.set(array2, array1.length);

    return result;
  } else {
    const result = new Uint8Array(array1.length + array2.length);

    result.set(array1);
    result.set(array2, array1.length);

    return result;
  }
}

const vertexBufferSemanticMap: Record<string, string> = {
  aPos: 'POSITION',
  aUV: 'TEXCOORD0',
  aUV2: 'TEXCOORD1',
  aNormal: 'NORMAL',
  aTangent: 'TANGENT',
  aColor: 'COLOR',
  aJoints: 'JOINTS',
  aWeights: 'WEIGHTS',
  //
  a_Position: 'POSITION',
  a_UV: 'TEXCOORD0',
  a_UV1: 'TEXCOORD0',
  a_UV2: 'TEXCOORD1',
  a_Normal: 'NORMAL',
  a_Tangent: 'TANGENT',
  a_Color: 'COLOR',
  a_Joints: 'JOINTS',
  a_Joint1: 'JOINTS',
  a_Weights: 'WEIGHTS',
  a_Weight1: 'WEIGHTS',
  //
  a_Target_Position0: 'POSITION_BS0',
  a_Target_Position1: 'POSITION_BS1',
  a_Target_Position2: 'POSITION_BS2',
  a_Target_Position3: 'POSITION_BS3',
  a_Target_Position4: 'POSITION_BS4',
  a_Target_Position5: 'POSITION_BS5',
  a_Target_Position6: 'POSITION_BS6',
  a_Target_Position7: 'POSITION_BS7',
  a_Target_Normal0: 'NORMAL_BS0',
  a_Target_Normal1: 'NORMAL_BS1',
  a_Target_Normal2: 'NORMAL_BS2',
  a_Target_Normal3: 'NORMAL_BS3',
  a_Target_Tangent0: 'TANGENT_BS0',
  a_Target_Tangent1: 'TANGENT_BS1',
  a_Target_Tangent2: 'TANGENT_BS2',
  a_Target_Tangent3: 'TANGENT_BS3',
};