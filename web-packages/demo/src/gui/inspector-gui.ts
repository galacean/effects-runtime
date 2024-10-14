import type { EffectComponentData, EffectsObject, Engine, Material, SceneData, VFXItem } from '@galacean/effects';
import { EffectComponent, Behaviour, RendererComponent, SerializationHelper, Texture, generateGUID, glContext, loadImage, spec } from '@galacean/effects';

export class InspectorGui {
  gui: any;
  item: VFXItem;
  itemDirtyFlag = false;

  sceneData: SceneData;
  guiControllers: any[] = [];

  constructor () {
    //@ts-expect-error
    this.gui = new GUI();
    this.gui.addFolder('Inspector');

    // setInterval(this.updateInspector, 500);
  }

  setItem (item: VFXItem) {
    if (this.item === item) {
      return;
    }
    this.item = item;
    this.itemDirtyFlag = true;
  }

  update = () => {
    if (this.item && this.itemDirtyFlag) {
      this.guiControllers = [];
      this.gui.destroy();
      //@ts-expect-error
      this.gui = new GUI();
      this.gui.add(this.item, 'name');

      const transformFolder = this.gui.addFolder('Transform');
      const positionFolder = transformFolder.addFolder('Position');
      const rotationFolder = transformFolder.addFolder('Rotation');
      const scaleFolder = transformFolder.addFolder('Scale');

      transformFolder.open();
      positionFolder.open();
      rotationFolder.open();
      scaleFolder.open();

      const transform = this.item.transform;
      const transformData = transform.toData();

      this.guiControllers.push(positionFolder.add(transformData.position, 'x').name('x').step(0.03).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(positionFolder.add(transformData.position, 'y').name('y').step(0.03).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(positionFolder.add(transformData.position, 'z').name('z').step(0.03).onChange(() => { transform.fromData(transformData); }));

      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(transformData.rotation, 'x').name('x').step(0.03).onChange(() => { transform.fromData(transformData); }));
      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(transformData.rotation, 'y').name('y').step(0.03).onChange(() => { transform.fromData(transformData); }));
      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(transformData.rotation, 'z').name('z').step(0.03).onChange(() => { transform.fromData(transformData); }));

      this.guiControllers.push(scaleFolder.add(transformData.scale, 'x').name('x').step(0.03).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(scaleFolder.add(transformData.scale, 'y').name('y').step(0.03).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(scaleFolder.add(transformData.scale, 'z').name('z').step(0.03).onChange(() => { transform.fromData(transformData); }));

      for (const component of this.item.components) {
        const componentFolder = this.gui.addFolder(component.constructor.name);

        if (component instanceof RendererComponent) {
          const controller = componentFolder.add(component, '_enabled');

          this.guiControllers.push(controller);
        }

        if (component instanceof EffectComponent) {
          componentFolder.add({
            click: async () => {
              await selectJsonFile((data: spec.EffectsPackageData) => {
                for (const effectsObjectData of data.exportObjects) {
                  this.item.engine.jsonSceneData[effectsObjectData.id] = effectsObjectData;
                  const effectComponent = this.item.getComponent(RendererComponent);

                  if (effectComponent) {
                    const guid = effectComponent.getInstanceId();

                    (this.item.engine.jsonSceneData[guid] as EffectComponentData).materials[0] = { id: effectsObjectData.id };
                    SerializationHelper.deserialize(this.item.engine.jsonSceneData[guid], effectComponent);
                  }
                }
                this.itemDirtyFlag = true;
              });
            },
          }, 'click').name('Material');

          componentFolder.add({
            click: async () => {
              await selectJsonFile((data: spec.EffectsPackageData) => {
                for (const effectsObjectData of data.exportObjects) {
                  this.item.engine.jsonSceneData[effectsObjectData.id] = effectsObjectData;
                  const effectComponent = this.item.getComponent(EffectComponent);

                  if (effectComponent) {
                    const guid = effectComponent.getInstanceId();

                    (this.item.engine.jsonSceneData[guid] as EffectComponentData).geometry = { id: effectsObjectData.id };
                    SerializationHelper.deserialize(this.item.engine.jsonSceneData[guid], effectComponent);
                  }
                }
              });
            },
          }, 'click').name('Geometry');
        }

        if (component instanceof Behaviour) {
          const controller = componentFolder.add(component, '_enabled');

          this.guiControllers.push(controller);
        }

        componentFolder.open();
      }
      const rendererComponent = this.item.getComponent(RendererComponent);

      if (rendererComponent) {
        for (const material of rendererComponent.materials) {
          this.setMaterialGui(material);
        }
      }

      this.itemDirtyFlag = false;
    }

    if (this.item) {
      const rendererComponent = this.item.getComponent(RendererComponent);

      if (rendererComponent) {
        for (const material of rendererComponent.materials) {
          // material.toData();
        }
      }
    }

    for (const controller of this.guiControllers) {
      controller.updateDisplay();
    }
  };

  // const properties = `
  // _2D("2D", 2D) = "" {}
  // _Color("Color",Color) = (1,1,1,1)
  // _Value("Value",Range(0,10)) = 2.5
  // _Float("Float",Float) = 0
  // _Vector("Vector",Vector) = (0,0,0,0)
  // _Rect("Rect",Rect) = "" {}
  // _Cube("Cube",Cube) = "" {}
  // `;

  private parseMaterialProperties (material: Material, gui: any, serializeObject: SerializedObject) {
    const serializedData = serializeObject.serializedData;
    const shaderProperties = (material.shaderSource as spec.ShaderData).properties;

    if (!shaderProperties) {
      return;
    }
    const lines = shaderProperties.split('\n');

    for (const property of lines) {
      // 提取材质属性信息
      // 如 “_Float1("Float2", Float) = 0”
      // 提取出 “_Float1” “Float2” “Float” “0”
      const regex = /\s*(.+?)\s*\(\s*"(.+?)"\s*,\s*(.+?)\s*\)\s*=\s*(.+)\s*/;
      const matchResults = property.match(regex);

      if (!matchResults) {
        return;
      }
      const uniformName = matchResults[1];
      const inspectorName = matchResults[2];
      const type = matchResults[3];
      const value = matchResults[4];

      // 提取 Range(a, b) 的 a 和 b
      const match = type.match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);

      if (match) {
        const start = Number(match[1]);
        const end = Number(match[2]);

        // materialData.floats[uniformName] = Number(value);
        this.guiControllers.push(gui.add(serializedData.floats, uniformName, start, end).onChange(() => {
          // this.item.getComponent(RendererComponent)?.material.fromData(materialData);
          serializeObject.applyModifiedProperties();
        }));
      } else if (type === 'Float') {
        // materialData.floats[uniformName] = Number(value);
        this.guiControllers.push(gui.add(serializedData.floats, uniformName).name(inspectorName).onChange(() => {
          serializeObject.applyModifiedProperties();
        }));
      } else if (type === 'Color') {
        this.guiControllers.push(gui.addColor({ color: [0, 0, 0, 0] }, 'color').name(inspectorName).onChange((value: number[]) => {
          serializeObject.serializedData['vector4s'][uniformName] = { x: value[0], y: value[1], z: value[2], w: value[3] };
          serializeObject.applyModifiedProperties();
        }));
      } else if (type === '2D') {
        const controller = this.gui.add({
          click: async () => {
            const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
            const file = await fileHandle[0].getFile();
            const assetUuid = generateGUID();

            // 生成纹理资产对象
            const reader = new FileReader();

            reader.onload = async function (e) {
              const result = e.target?.result;
              const textureData = { id: assetUuid, source: result, dataType: spec.DataType.Texture, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT };

              serializeObject.engine.jsonSceneData[textureData.id] = textureData;
            };
            reader.onerror = event => {
              console.error('文件读取出错:', reader.error);
            };

            reader.readAsDataURL(file);

            // 加载 image
            const image = await loadImage(file);

            image.width = 50;
            image.height = 50;
            image.id = inspectorName;
            const lastImage = document.getElementById(inspectorName);

            if (lastImage) {
              controller.domElement.removeChild(lastImage);
            }
            controller.domElement.appendChild(image);

            // 根据 image 生成纹理对象
            const texture = Texture.create(this.item.engine, { image: image, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT });

            texture.setInstanceId(assetUuid);
            serializeObject.engine.addInstance(texture);
            serializeObject.serializedData.textures[uniformName] = { id: texture.getInstanceId() };
            serializeObject.applyModifiedProperties();
          },
        }, 'click').name(inspectorName);
      }
    }
  }

  // dat gui 参数及修改
  private setMaterialGui (material: Material) {
    const materialGUI = this.gui.addFolder('Material');

    materialGUI.open();
    const serializeObject = new SerializedObject(material);
    const serializedData = serializeObject.serializedData;

    serializedData.blending = false;
    serializedData.zTest = false;
    serializedData.zWrite = false;
    serializeObject.update();

    this.guiControllers.push(materialGUI.add(serializedData, 'blending').onChange(() => {
      serializeObject.applyModifiedProperties();
    }));
    this.guiControllers.push(materialGUI.add(serializedData, 'zTest').onChange(() => {
      serializeObject.applyModifiedProperties();
    }));
    this.guiControllers.push(materialGUI.add(serializedData, 'zWrite').onChange(() => {
      serializeObject.applyModifiedProperties();
    }));
    this.parseMaterialProperties(material, materialGUI, serializeObject);
  }
}

async function selectJsonFile (callback: (data: any) => void) {
  const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
  const file = await fileHandle[0].getFile();
  const reader = new FileReader();

  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      return;
    }
    const data = JSON.parse(reader.result);

    callback(data);
  };
  reader.readAsText(file);
}

export class SerializedObject {
  engine: Engine;
  serializedData: Record<string, any>;
  target: EffectsObject;

  constructor (target: EffectsObject) {
    this.target = target;
    this.engine = target.engine;
    this.serializedData = {};
    this.update();
  }

  update () {
    SerializationHelper.serialize(this.target, this.serializedData);
  }

  applyModifiedProperties () {
    SerializationHelper.deserialize(this.serializedData as spec.EffectsObjectData, this.target);
  }
}
