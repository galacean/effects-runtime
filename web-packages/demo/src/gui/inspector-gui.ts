import type { EffectComponentData, Material, MaterialData, SceneData, ShaderData } from '@galacean/effects';
import { EffectComponent, ItemBehaviour, RendererComponent, Texture, TimelineComponent, glContext, loadImage, type VFXItem, type VFXItemContent, SerializedObject, generateUuid } from '@galacean/effects';
import type { AssetData } from './asset-data-base';
import { assetDataBase } from './asset-data-base';

export class InspectorGui {
  gui: any;
  item: VFXItem<VFXItemContent>;
  itemDirtyFlag = false;

  sceneData: SceneData;
  guiControllers: any[] = [];

  constructor () {
    //@ts-expect-error
    this.gui = new GUI();
    this.gui.addFolder('Inspector');

    this.sceneData = assetDataBase.assetsData;
    // setInterval(this.updateInspector, 500);
  }

  setItem (item: VFXItem<VFXItemContent>) {
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

      this.guiControllers.push(positionFolder.add(transformData.position, 'x').step(0.05).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(positionFolder.add(transformData.position, 'y').step(0.05).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(positionFolder.add(transformData.position, 'z').step(0.05).onChange(() => { transform.fromData(transformData); }));

      this.guiControllers.push(rotationFolder.add(transformData.rotation, 'x').step(0.05).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(rotationFolder.add(transformData.rotation, 'y').step(0.05).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(rotationFolder.add(transformData.rotation, 'z').step(0.05).onChange(() => { transform.fromData(transformData); }));

      this.guiControllers.push(scaleFolder.add(transformData.scale, 'x').step(0.05).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(scaleFolder.add(transformData.scale, 'y').step(0.05).onChange(() => { transform.fromData(transformData); }));
      this.guiControllers.push(scaleFolder.add(transformData.scale, 'z').step(0.05).onChange(() => { transform.fromData(transformData); }));

      for (const component of this.item.components) {
        const componentFolder = this.gui.addFolder(component.constructor.name);

        if (component instanceof RendererComponent) {
          const controller = componentFolder.add(component, '_enabled');

          this.guiControllers.push(controller);
        }

        if (component instanceof EffectComponent) {
          componentFolder.add({
            click: async () => {

              await selectJsonFile((data: AssetData) => {
                for (const effectsObject of data.exportObjects) {
                  assetDataBase.addData(effectsObject);

                  const effectComponent = this.item.getComponent(RendererComponent);

                  if (effectComponent) {
                    const guid = effectComponent.instanceId;

                    (assetDataBase.assetsData[guid] as EffectComponentData).materials[0] = { id:effectsObject.id };
                    this.item.engine.deserializer.deserializeTaggedProperties(assetDataBase.assetsData[guid], effectComponent.taggedProperties);
                    effectComponent.fromData(effectComponent.taggedProperties);
                  }
                }
                this.itemDirtyFlag = true;
              });
            },
          }, 'click').name('Material');

          componentFolder.add({
            click: async () => {
              await selectJsonFile((data: AssetData) => {
                for (const effectsObject of data.exportObjects) {
                  assetDataBase.addData(effectsObject);
                  const effectComponent = this.item.getComponent(EffectComponent);

                  if (effectComponent) {
                    const guid = effectComponent.instanceId;

                    (assetDataBase.assetsData[guid] as EffectComponentData).geometry = { id:effectsObject.id };
                    this.item.engine.deserializer.deserializeTaggedProperties(assetDataBase.assetsData[guid], effectComponent.taggedProperties);
                    effectComponent.fromData(effectComponent.taggedProperties);
                  }
                }
              });
            },
          }, 'click').name('Geometry');
        }

        if (component instanceof ItemBehaviour) {
          const controller = componentFolder.add(component, '_enabled');

          this.guiControllers.push(controller);
        }

        if (component instanceof TimelineComponent) {
          const controller = componentFolder.add(component, 'time');
          const controller2 = componentFolder.add(component, 'reusable');

          this.guiControllers.push(controller);
          this.guiControllers.push(controller2);
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

  private parseMaterialProperties (material: Material, gui: any, serializeObject: SerializedObject) {
    const serializedData = serializeObject.serializedData;
    const shaderProperties = (material.shaderSource as ShaderData).properties;

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
        this.guiControllers.push(gui.addColor(serializedData.vector4s, uniformName).name(inspectorName).onChange(() => {
          serializeObject.applyModifiedProperties();
        }));
      } else if (type === '2D') {
        const controller = this.gui.add({
          click: async () => {
            // @ts-expect-error
            const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
            const file = await fileHandle[0].getFile();
            const image = await loadImage(file);

            image.width = 50;
            image.height = 50;
            image.id = inspectorName;
            const lastImage = document.getElementById(inspectorName);

            if (lastImage) {
              controller.domElement.removeChild(lastImage);
            }
            controller.domElement.appendChild(image);

            const texture = Texture.create(this.item.engine, { image: image, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT });

            serializeObject.serializedData.textures[uniformName] = { id:texture.instanceId };
            serializeObject.engine.deserializer.addInstance(texture.instanceId, texture);
            this.item?.getComponent(RendererComponent)?.material.setTexture(uniformName, texture);
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
  // @ts-expect-error
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