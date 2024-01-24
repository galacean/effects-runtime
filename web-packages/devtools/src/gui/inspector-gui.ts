import type { AGUIPropertiesPanelProps, AGUIPropertyProps } from '@advjs/gui';
import { Toast } from '@advjs/gui';
import type { Component, EffectsObject, EffectsPackageData, Engine, EffectComponent, Material, ShaderData } from '@galacean/effects';
import { ParticleSystem, RendererComponent, Texture, glContext, loadImage, type VFXItem, type VFXItemContent } from '@galacean/effects';
import { ref } from 'vue';
import { assetDatabase, inspectorGui } from '../utils';
import { EffectsPackage } from '@galacean/effects-assets';
import { readFileAsText } from '../utils/asset-database';

export const formData = ref({
  input: 'test',
  inputNumber: 10,
  checkbox: true,
  select: '',
  select2: 'option1',
  slider: 10,
  numberField: 10,
  numberSlider: 10,
  vector2: {
    x: 0,
    y: 0,
  },
  vector3: {
    x: 0,
    y: 0,
    z: 0,
  },
  vector4: {
    x: 0,
    y: 0,
    z: 0,
    w: 0,
  },
  color: '#0099ff',
  file: '',
});

export class InspectorGui {
  gui: any;
  item: VFXItem<VFXItemContent>;
  itemDirtyFlag = false;
  componentProperties: AGUIPropertiesPanelProps[] = [];
  serializedObjects: SerializedObject[] = [];

  constructor () {}

  setItem (item: VFXItem<VFXItemContent>) {
    if (this.item === item) {
      return;
    }
    this.item = item;
    this.itemDirtyFlag = true;

    this.componentProperties = components.value;
    this.componentProperties.length = 0;
    this.serializedObjects = [];

    this.addComponentGui(item.transform as unknown as Component);
    for (const component of item.components) {
      if (component instanceof ParticleSystem) {
        continue;
      }
      this.addComponentGui(component);
    }
    if (item.getComponent(RendererComponent)) {
      const material = item.getComponent(RendererComponent)!.material;

      this.addMateraiGui(material);
    }
  }

  addComponentGui (component: Component) {
    const serializedObject = new SerializedObject(component);
    const serializedData = serializedObject.serializedData;

    this.serializedObjects.push(serializedObject);
    const properties: AGUIPropertyProps[] = [];

    this.componentProperties.push({ title: component.constructor.name, properties });
    for (const key of Object.keys(serializedData)) {
      const value = serializedData[key];

      if (!value) {
        continue;
      }

      this.addGuiProperty(properties, key, serializedData);
    }
  }

  addGuiProperty (guiProperties: AGUIPropertyProps[], key: string, object: any, name?: string) {
    const value = object[key];

    if (value === undefined) {
      return;
    }
    if (!name) {
      name = key;
    }

    if (typeof value === 'number') {
      guiProperties.push({
        type: 'number',
        name,
        key,
        object });
    } else if (typeof value === 'boolean') {
      guiProperties.push({
        type: 'checkbox',
        name,
        key,
        object });
    } else if (this.checkVector3(value)) {
      guiProperties.push({
        type: 'vector',
        name,
        key,
        object });
    } else if (this.checkGUID(value)) {
      guiProperties.push({
        type: 'file',
        name,
        placeholder: 'Placeholder',
        key,
        object,
        onFileChange (file) {
          // eslint-disable-next-line no-console
          console.log(file);
        },
      });
    } else if (value instanceof Array) {
      for (let i = 0;i < value.length;i++) {
        this.addGuiProperty(guiProperties, String(i), value, 'material' + i);
      }
    } else if (value instanceof Object) {
      for (const key of Object.keys(value)) {
        this.addGuiProperty(guiProperties, key, value[key]);
      }
    }
  }

  addMateraiGui (material: Material) {
    const serializedObject = new SerializedObject(material);

    serializedObject.serializedData = {
      blending:false,
      zTest:false,
      zWrite:false,
      ...serializedObject.serializedData,
    };
    const serializedData = serializedObject.serializedData;

    this.serializedObjects.push(serializedObject);
    const properties: AGUIPropertyProps[] = [];

    this.componentProperties.push({ title: 'Material', properties });
    for (const key of Object.keys(serializedData)) {
      const value = serializedData[key];

      if (value === undefined) {
        continue;
      }

      this.addGuiProperty(properties, key, serializedData);
    }

    this.parseMaterialProperties(properties, material, serializedObject);
  }

  private parseMaterialProperties (guiProperties: AGUIPropertyProps[], material: Material, serializeObject: SerializedObject) {
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
        guiProperties.push({
          name: inspectorName,
          type: 'number-slider',
          max: end,
          min: start,
          step: 0.01,
          object: serializedData.floats,
          key: uniformName,
        });
      } else if (type === 'Float') {
        guiProperties.push({
          name: inspectorName,
          type: 'number',
          object: serializedData.floats,
          key: uniformName,
        });
      } else if (type === 'Color') {
        guiProperties.push({
          name: inspectorName,
          type: 'color',
          object: serializedData.colors,
          key: uniformName,
        });
      } else if (type === '2D') {
      //   const item = this.item;
      //   const controller = this.gui.add({
      //     click: async () => {
      //       const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
      //       const file = await fileHandle[0].getFile();

        //       // 生成纹理资产对象
        //       const reader = new FileReader();

        //       reader.onload = async function (e) {
        //         const result = e.target?.result as string;
        //         // const textureData = { id: assetGuid, source: result, dataType: DataType.Texture, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT };
        //         const textureData = (JSON.parse(result) as EffectsPackageData).exportObjects[0];

        //         serializeObject.engine.addEffectsObjectData(textureData);

        //         // @ts-expect-error
        //         const imageFile = base64ToFile(textureData.source);

        //         // 加载 image
        //         const image = await loadImage(imageFile);

        //         image.width = 50;
        //         image.height = 50;
        //         image.id = inspectorName;
        //         const lastImage = document.getElementById(inspectorName);

        //         if (lastImage) {
        //           controller.domElement.removeChild(lastImage);
        //         }
        //         controller.domElement.appendChild(image);

        //         // 根据 image 生成纹理对象
        //         const texture = Texture.create(item.engine, { image: image, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT });

        //         texture.setInstanceId(textureData.id);
        //         serializeObject.engine.deserializer.addInstance(texture);
        //         serializeObject.serializedData.textures[uniformName] = { id: texture.getInstanceId() };
        //         serializeObject.applyModifiedProperties();
        //       };
        //       reader.onerror = event => {
        //         console.error('文件读取出错:', reader.error);
        //       };

      //       reader.readAsText(file);
      //     },
      //   }, 'click').name(inspectorName);
      }
    }
  }

  // dat gui 参数及修改
  // private setMaterialGui (material: Material) {
  //   const materialGUI = this.gui.addFolder('Material');

  //   materialGUI.open();
  //   const serializeObject = new SerializedObject(material);
  //   const serializedData = serializeObject.serializedData;

  //   serializedData.blending = false;
  //   serializedData.zTest = false;
  //   serializedData.zWrite = false;
  //   serializeObject.update();

  //   this.guiControllers.push(materialGUI.add(serializedData, 'blending').onChange(() => {
  //     serializeObject.applyModifiedProperties();
  //   }));
  //   this.guiControllers.push(materialGUI.add(serializedData, 'zTest').onChange(() => {
  //     serializeObject.applyModifiedProperties();
  //   }));
  //   this.guiControllers.push(materialGUI.add(serializedData, 'zWrite').onChange(() => {
  //     serializeObject.applyModifiedProperties();
  //   }));
  //   this.parseMaterialProperties(material, materialGUI, serializeObject);
  // }

  checkVector3 (property: Record<string, any>) {
    return Object.keys(property).length === 3 && property['x'] !== undefined && property['y'] !== undefined && property['z'] !== undefined ;
  }

  checkGUID (property: Record<string, any>) {
    return property instanceof Object && Object.keys(property).length === 1 && property.id !== undefined && property.id.length === 32;
  }

  async update () {
    if (!this.item) {
      return;
    }

    // if (!this.serializedData) {
    //   return;
    // }

    // const transformData = {
    //   position:[0],
    // };

    // //@ts-expect-error
    // transformData.position = [components.value[0].properties[0].value!.x, components.value[0].properties[0].value!.y, components.value[0].properties[0].value!.z];
    // this.item.transform.fromData(transformData);
    // const position = components.value[0].properties[0].value;
    for (const serializedObject of this.serializedObjects) {
      serializedObject.applyModifiedProperties();
    }
  }
}

let count = 0;

const transformData = {
  position: {
    x: 0,
    y: 0,
    z: 0,
  },
};

export const components = ref<AGUIPropertiesPanelProps[]>([
  {
    icon: 'i-mdi-axis-arrow',
    title: 'Transform',
    properties: [
      {
        type: 'vector',
        name: 'Position',
        object: transformData,
        key: 'position',
      },
      // {
      //   type: 'vector',
      //   name: 'Rotation',
      //   value: {
      //     x: 0,
      //     y: 0,
      //     z: 0,
      //   },
      // },
      // {
      //   type: 'vector',
      //   name: 'Scale',
      //   value: {
      //     x: 0,
      //     y: 0,
      //     z: 0,
      //   },
      // },
    ],
  },

  {
    icon: 'i-ri:compasses-2-fill',
    title: 'Form Example',
    properties: [
      {
        type: 'input',
        name: 'Input',
        object: formData,
        key: 'input',
      },
      {
        type: 'number',
        name: 'InputNumber',
        object: formData,
        key: 'inputNumber',
      },
      {
        type: 'checkbox',
        name: 'Checkbox',
        object: formData,
        key: 'checkbox',
      },
      {
        type: 'select',
        name: 'Select',
        options: [
          {
            label: 'Option 1',
            value: 'option1',
          },
          {
            label: 'Option 2',
            value: 'option2',
          },
        ],
        object: formData,
        key: 'select',
      },
      {
        type: 'select',
        name: 'Select',
        options: [
          {
            label: 'Option 1',
            value: 'option1',
          },
          {
            label: 'Option 2',
            value: 'option2',
          },
        ],
        object: formData,
        key: 'select2',
      },
      {
        name: 'Slider',
        type: 'slider',
        max: 100,
        min: 0,
        step: 1,
        object: formData,
        key: 'slider',
      },
      {
        name: 'Number Field',
        type: 'number-field',
        max: 100,
        min: 0,
        step: 1,
        object: formData,
        key: 'numberField',
      },
      {
        name: 'Number Slider',
        type: 'number-slider',
        max: 100,
        min: 0,
        step: 1,
        object: formData,
        key: 'numberSlider',
      },
      {
        name: 'divider',
        type: 'divider',
      },
      {
        type: 'vector',
        name: 'Vector2',
        object: formData,
        key: 'vector2',
      },
      {
        type: 'vector',
        name: 'Vector3',
        object: formData,
        key: 'vector3',
      },
      {
        type: 'vector',
        name: 'Vector4',
        object: formData,
        key: 'vector4',
      },
      {
        type: 'color',
        name: 'Color Picker',
        object: formData,
        key: 'color',
      },
      {
        type: 'button',
        name: 'Button',
        label: 'Button Label',
        title: 'Alert Test',
        onClick () {
          // alert('Button clicked!')
          Toast({
            title: 'Button clicked!',
            description: 'Button clicked!',
            type: (['default', 'info', 'success', 'warning', 'error'] as const)[count++ % 5],
          });
        },
        object: formData,
        key: 'button',
      },
      {
        type: 'file',
        name: 'Accept File',
        placeholder: 'Placeholder',
        onFileChange (file) {
          // eslint-disable-next-line no-console
          console.log(file);
        },
        object: formData,
        key: 'file',
      },
    ],
  },
  // {
  //   title: 'EffectComponent',
  //   properties: [
  //     {
  //       type: 'file',
  //       name: 'Material',
  //       placeholder: 'Placeholder',
  //       async onFileChange (fileItem) {
  //         const file = await (fileItem?.handle as FileSystemFileHandle).getFile();

  //         let res: string;

  //         try {
  //           res = await readFileAsText(file);
  //         } catch (error) {
  //           console.error('读取文件出错:', error);

  //           return;
  //         }
  //         const packageData = JSON.parse(res) as EffectsPackageData;
  //         const guid = packageData.fileSummary.guid;

  //         // TODO 纹理 image 特殊逻辑，待移除
  //         if (packageData.fileSummary.assetType === 'Texture') {
  //           await assetDatabase.convertImageData(packageData);
  //         }

  //         for (const objectData of packageData.exportObjects) {
  //           assetDatabase.engine.addEffectsObjectData(objectData);
  //         }

  //         const effectsPackage = new EffectsPackage(assetDatabase.engine);

  //         assetDatabase.effectsPackages[guid] = effectsPackage;
  //         effectsPackage.fileSummary = packageData.fileSummary;
  //         for (const objectData of packageData.exportObjects) {
  //           effectsPackage.exportObjects.push(await assetDatabase.engine.deserializer.loadGUIDAsync(objectData.id));
  //         }

  //         inspectorGui.serializedData.materials = [{ id:packageData.exportObjects[0].id }];
  //         await inspectorGui.item.engine.deserializer.deserializeTaggedPropertiesAsync(inspectorGui.serializedData, inspectorGui.effectComponent.taggedProperties);
  //         inspectorGui.effectComponent.fromData(inspectorGui.effectComponent.taggedProperties);
  //         // eslint-disable-next-line no-console
  //       //   console.log(file);
  //       },
  //     },
  //     {
  //       type: 'file',
  //       name: 'Geometry',
  //       placeholder: 'Placeholder',
  //       async onFileChange (fileItem) {
  //         const file = await (fileItem?.handle as FileSystemFileHandle).getFile();

  //         let res: string;

  //         try {
  //           res = await readFileAsText(file);
  //         } catch (error) {
  //           console.error('读取文件出错:', error);

  //           return;
  //         }
  //         const packageData = JSON.parse(res) as EffectsPackageData;
  //         const guid = packageData.fileSummary.guid;

  //         // TODO 纹理 image 特殊逻辑，待移除
  //         if (packageData.fileSummary.assetType === 'Texture') {
  //           await assetDatabase.convertImageData(packageData);
  //         }

  //         for (const objectData of packageData.exportObjects) {
  //           assetDatabase.engine.addEffectsObjectData(objectData);
  //         }

  //         const effectsPackage = new EffectsPackage(assetDatabase.engine);

  //         assetDatabase.effectsPackages[guid] = effectsPackage;
  //         effectsPackage.fileSummary = packageData.fileSummary;
  //         for (const objectData of packageData.exportObjects) {
  //           effectsPackage.exportObjects.push(await assetDatabase.engine.deserializer.loadGUIDAsync(objectData.id));
  //         }

  //         inspectorGui.serializedData.geometry = { id:packageData.exportObjects[0].id };
  //         await inspectorGui.item.engine.deserializer.deserializeTaggedPropertiesAsync(inspectorGui.serializedData, inspectorGui.effectComponent.taggedProperties);
  //         inspectorGui.effectComponent.fromData(inspectorGui.effectComponent.taggedProperties);
  //         // eslint-disable-next-line no-console
  //       //   console.log(file);
  //       },
  //     },
  //   ],
  // },
]);

export class SerializedObject {
  engine: Engine;
  serializedData: Record<string, any> = {};
  serializedProperties: Record<string, SerializedProperty> = {};
  target: EffectsObject;

  constructor (target: EffectsObject) {
    this.target = target;
    this.engine = target.engine;
    this.update();
  }

  findProperty (name: string) {
    if (!this.serializedProperties[name]) {
      this.serializedProperties[name] = new SerializedProperty();
      this.serializedProperties[name].value = this.serializedData[name];
    }

    return this.serializedProperties[name];
  }

  update () {
    this.engine.deserializer.serializeTaggedProperties(this.target, this.serializedData);
  }

  applyModifiedProperties () {
    // if (this.serializedData.floats) {
    //   console.log(this.serializedData.colors._StartColor);
    // }
    // console.log(this.serializedData)
    this.engine.deserializer.deserializeTaggedProperties(this.serializedData, this.target);
    // assetDatabase.setDirty(this.target);
  }
}

export class SerializedProperty {
  value: number | string | Object;
}
