import type { Material, ShaderData } from '@galacean/effects';
import { EffectComponent, ItemBehaviour, RendererComponent, type VFXItem, type VFXItemContent } from '@galacean/effects';
import { assetDataBase } from './asset-data-base';

export class InspectorGui {
  gui: any;
  item: VFXItem<VFXItemContent>;
  itemDirtyFlag = false;

  guiControllers: any[] = [];

  constructor () {
    //@ts-expect-error
    this.gui = new dat.GUI();
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
      this.gui = new dat.GUI();
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
        const folder = this.gui.addFolder(component.constructor.name);

        if (component instanceof RendererComponent) {
          const controller = folder.add(component, '_enabled');
          const controller2 = folder.add({ Material:'21' }, 'Material', { Material1:'21', Material2:'22', Material3:'23' }).onChange((value: string)=>{
            // @ts-expect-error
            assetDataBase.assetsData[component.instanceId].materials[0].id = value;
            component.fromData(assetDataBase.assetsData[component.instanceId], this.item.composition?.deserializer, { effectsObjects:assetDataBase.assetsData });
          });

          this.guiControllers.push(controller);
        }

        if (component instanceof ItemBehaviour) {
          const controller = folder.add(component, '_enabled');

          this.guiControllers.push(controller);
        }

        if (component.constructor.name === 'TimelineComponent') {
          const controller = folder.add(component, 'time');
          const controller2 = folder.add(component, 'reusable');

          this.guiControllers.push(controller);
          this.guiControllers.push(controller2);
        }

        folder.open();
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
        const Color: Record<string, number[]> = {};

        Color[uniformName] = [0, 0, 0, 0];
        gui.addColor(Color, uniformName).name(inspectorName).onChange((value: number[]) => {
          materialData.vector4s[uniformName] = [value[0] / 255, value[1] / 255, value[2] / 255, value[3] / 255];
          this.item.getComponent(EffectComponent)?.material.fromData(materialData);
        });
      }
    }
  }

  // dat gui 参数及修改
  private setMaterialGui (material: Material) {
    const materialGUI = this.gui.addFolder('Material');

    this.parseMaterialProperties(material, this.gui);
    materialGUI.open();
  }
}