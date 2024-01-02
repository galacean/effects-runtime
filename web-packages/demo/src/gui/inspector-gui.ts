import type { EffectComponentData, Material, ShaderData } from '@galacean/effects';
import { EffectComponent, ItemBehaviour, RendererComponent, TimelineComponent, type VFXItem, type VFXItemContent } from '@galacean/effects';
import type { EffectsAssetData } from './asset-data-base';
import { assetDataBase } from './asset-data-base';

export class InspectorGui {
  gui: any;
  item: VFXItem<VFXItemContent>;
  itemDirtyFlag = false;

  guiControllers: any[] = [];

  constructor () {
    //@ts-expect-error
    this.gui = new GUI();
    this.gui.addFolder('Inspector');
    // setInterval(this.updateInspector, 500);
  }

  setItem (item: VFXItem<VFXItemContent>) {
    if (this.item === item) {
      return;
    }
    this.item = item;
    this.itemDirtyFlag = true;
  }

  update = ()=> {
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

      // @ts-expect-error
      this.guiControllers.push(positionFolder.add(this.item.transform.position, 'x').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(positionFolder.add(this.item.transform.position, 'y').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(positionFolder.add(this.item.transform.position, 'z').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));

      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(this.item.transform.rotation, 'x').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(this.item.transform.rotation, 'y').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(this.item.transform.rotation, 'z').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));

      // @ts-expect-error
      this.guiControllers.push(scaleFolder.add(this.item.transform.scale, 'x').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(scaleFolder.add(this.item.transform.scale, 'y').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(scaleFolder.add(this.item.transform.scale, 'z').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));

      for (const component of this.item.components) {
        const componentFolder = this.gui.addFolder(component.constructor.name);

        if (component instanceof RendererComponent) {
          const controller = componentFolder.add(component, '_enabled');

          this.guiControllers.push(controller);
        }

        if (component instanceof EffectComponent) {
          componentFolder.add({ click: async ()=>{
            // @ts-expect-error
            const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
            const file = await fileHandle[0].getFile();
            const reader = new FileReader();

            reader.onload = () => {
              if (typeof reader.result !== 'string') {
                return;
              }
              const data = JSON.parse(reader.result) as EffectsAssetData;

              for (const effectsObject of data.exportObjects) {
                assetDataBase.addData(effectsObject);
                const effectComponent = this.item.getComponent(RendererComponent);

                if (effectComponent) {
                  const guid = effectComponent.instanceId;

                  (assetDataBase.assetsData[guid] as EffectComponentData).materials[0].id = effectsObject.id;
                  effectComponent.fromData(assetDataBase.assetsData[guid], this.item.composition?.deserializer, { effectsObjects:assetDataBase.assetsData });
                }
              }
              this.itemDirtyFlag = true;
            };
            reader.readAsText(file);
          } }, 'click').name('Material');

          componentFolder.add({ click: async ()=>{
            // @ts-expect-error
            const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
            const file = await fileHandle[0].getFile();
            const reader = new FileReader();

            reader.onload = () => {
              if (typeof reader.result !== 'string') {
                return;
              }
              const data = JSON.parse(reader.result) as EffectsAssetData;

              for (const effectsObject of data.exportObjects) {
                assetDataBase.addData(effectsObject);
                const effectComponent = this.item.getComponent(EffectComponent);

                if (effectComponent) {
                  const guid = effectComponent.instanceId;

                  (assetDataBase.assetsData[guid] as EffectComponentData).geometry.id = effectsObject.id;
                  effectComponent.fromData(assetDataBase.assetsData[guid], this.item.composition?.deserializer, { effectsObjects:assetDataBase.assetsData });
                }
              }

            };
            reader.readAsText(file);

            // console.log(file);
          } }, 'click').name('Geometry');
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

    for (const controller of this.guiControllers) {
      controller.updateDisplay();
    }
  };

  private parseMaterialProperties (material: Material, gui: any) {

    //@ts-expect-error
    const materialData = material.toData({ effectsObjects:{} });
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
        gui.add(materialData.floats, uniformName, start, end).onChange(() => {
          this.item.getComponent(EffectComponent)?.material.fromData(materialData);
        });
      } else if (type === 'Float') {
        materialData.floats[uniformName] = Number(value);
        gui.add(materialData.floats, uniformName).onChange(() => {
          this.item.getComponent(EffectComponent)?.material.fromData(materialData);
        });
      } else if (type === 'Color') {
        gui.addColor(materialData.vector4s, uniformName).name(inspectorName).onChange(() => {
          this.item.getComponent(EffectComponent)?.material.fromData(materialData);
        });
      }
    }
  }

  // dat gui 参数及修改
  private setMaterialGui (material: Material) {
    const materialGUI = this.gui.addFolder('Material');

    materialGUI.open();
    // @ts-expect-error
    materialGUI.add(material.glMaterialState, 'blending');
    // @ts-expect-error
    materialGUI.add(material.glMaterialState, 'depthTest');
    // @ts-expect-error
    materialGUI.add(material.glMaterialState, 'depthMask');
    this.parseMaterialProperties(material, materialGUI);
  }
}