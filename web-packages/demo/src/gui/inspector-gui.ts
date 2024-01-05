import type { EffectComponentData, Material, MaterialData, SceneData, ShaderData } from '@galacean/effects';
import { EffectComponent, ItemBehaviour, RendererComponent, Texture, TimelineComponent, glContext, loadImage, type VFXItem, type VFXItemContent } from '@galacean/effects';
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

    this.sceneData = { effectsObjects: assetDataBase.assetsData };
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
      const transformData = transform.toData(this.sceneData);

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

                    (assetDataBase.assetsData[guid] as EffectComponentData).materials[0].id = effectsObject.id;
                    effectComponent.fromData(assetDataBase.assetsData[guid], this.item.composition?.deserializer, this.sceneData);
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

                    (assetDataBase.assetsData[guid] as EffectComponentData).geometry.id = effectsObject.id;
                    effectComponent.fromData(assetDataBase.assetsData[guid], this.item.composition?.deserializer, this.sceneData);
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
          //@ts-expect-error
          material.toData(this.sceneData);
        }
      }
    }

    for (const controller of this.guiControllers) {
      controller.updateDisplay();
    }
  };

  private parseMaterialProperties (material: Material, gui: any) {

    //@ts-expect-error
    const materialData = material.toData(this.sceneData);

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

        materialData.floats[uniformName] = Number(value);
        this.guiControllers.push(gui.add(materialData.floats, uniformName, start, end).onChange(() => {
          this.item.getComponent(RendererComponent)?.material.fromData(materialData);
        }));
      } else if (type === 'Float') {
        materialData.floats[uniformName] = Number(value);
        this.guiControllers.push(gui.add(materialData.floats, uniformName).name(inspectorName).onChange(() => {
          this.item.getComponent(RendererComponent)?.material.fromData(materialData);
        }));
      } else if (type === 'Color') {
        this.guiControllers.push(gui.addColor(materialData.vector4s, uniformName).name(inspectorName).onChange(() => {
          this.item.getComponent(RendererComponent)?.material.fromData(materialData);
        }));
      } else if (type === '2D') {
        this.gui.add({
          click: async () => {
            // @ts-expect-error
            const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
            const file = await fileHandle[0].getFile();

            const image = await loadImage(file);

            const texture = Texture.create(this.item.engine, { image: image, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT });

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
    const materialData: MaterialData = {
      blending: false,
      zTest: false,
      zWrite: false,
      //@ts-expect-error
      ...material.toData(this.sceneData),
    };

    this.guiControllers.push(materialGUI.add(materialData, 'blending').onChange(() => {
      this.item.getComponent(RendererComponent)?.material.fromData(materialData);
    }));
    this.guiControllers.push(materialGUI.add(materialData, 'zTest').onChange(() => {
      this.item.getComponent(RendererComponent)?.material.fromData(materialData);
    }));
    this.guiControllers.push(materialGUI.add(materialData, 'zWrite').onChange(() => {
      this.item.getComponent(RendererComponent)?.material.fromData(materialData);
    }));
    this.parseMaterialProperties(material, materialGUI);
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