import type { AGUIPropertiesPanelProps, AGUIPropertyProps } from '@advjs/gui';
import { Toast } from '@advjs/gui';
import type { Component, EffectsObject, EffectsPackageData, Engine, Material, ShaderData } from '@galacean/effects';
import { ParticleSystem, RendererComponent, Transform, getMergedStore, type VFXItem, type VFXItemContent } from '@galacean/effects';
import { EffectsPackage } from '@galacean/effects-assets';
import { reactive, ref } from 'vue';
import { assetDatabase } from '../utils';
import { readFileAsText } from '../utils/asset-database';

export const formData = {
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
  color2: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
  file: '',
};

export class InspectorGui {
  gui: any;
  item: VFXItem<VFXItemContent>;
  itemDirtyFlag = false;
  componentProperties: AGUIPropertiesPanelProps[] = [];
  serializedObjects: SerializedObject[] = [];

  constructor () { }

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

  async refresh () {
    for (const serializedObject of this.serializedObjects) {
      await serializedObject.applyModifiedProperties();
    }
    this.componentProperties = components.value;
    this.componentProperties.length = 0;
    this.serializedObjects = [];

    const item = this.item;

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

    serializedObject.serializedData = reactive(serializedObject.serializedData);
    const serializedData = serializedObject.serializedData;

    this.serializedObjects.push(serializedObject);
    const properties: AGUIPropertyProps[] = [];

    this.componentProperties.push({ title: component.constructor.name, properties });

    const serializedProperties = getMergedStore(component);

    for (const key of Object.keys(serializedProperties)) {
      this.addGuiProperty(properties, key, serializedData);
    }

    for (const key of Object.keys(component.taggedProperties)) {
      this.addGuiProperty(properties, key, serializedData);
    }
  }

  addGuiProperty (guiProperties: AGUIPropertyProps[], key: string, object: any, name?: string) {
    if (!object || object[key] === undefined) {
      return;
    }
    if (!name) {
      name = key;
    }
    const value = object[key];

    if (typeof value === 'number') {
      guiProperties.push({
        type: 'number-field',
        name,
        max: 1000000,
        min: -1000000,
        step: 0.03,
        key,
        object,
      });
    } else if (typeof value === 'boolean') {
      guiProperties.push({
        type: 'checkbox',
        name,
        key,
        object,
      });
    } else if (this.checkVector3(value)) {
      guiProperties.push({
        type: 'vector',
        name,
        key,
        object,
      });
    } else if (this.checkEuler(value)) {
      guiProperties.push({
        type: 'vector',
        name,
        key,
        object,
      });
    } else if (this.checkGUID(value)) {
      guiProperties.push({
        type: 'file',
        name,
        placeholder: 'Placeholder',
        key:'file',
        object:{ file:'' },
        onFileChange: async fileItem => {
          const file = await (fileItem?.handle as FileSystemFileHandle).getFile();

          let res: string;

          try {
            res = await readFileAsText(file);
          } catch (error) {
            console.error('读取文件出错:', error);

            return;
          }
          const packageData = JSON.parse(res) as EffectsPackageData;
          const guid = packageData.fileSummary.guid;

          // TODO 纹理 image 特殊逻辑，待移除
          if (packageData.fileSummary.assetType === 'Texture') {
            await assetDatabase.convertImageData(packageData);
          }

          for (const objectData of packageData.exportObjects) {
            assetDatabase.engine.addEffectsObjectData(objectData);
          }

          const effectsPackage = new EffectsPackage(assetDatabase.engine);

          assetDatabase.effectsPackages[guid] = effectsPackage;
          effectsPackage.fileSummary = packageData.fileSummary;
          for (const objectData of packageData.exportObjects) {
            effectsPackage.exportObjects.push(await assetDatabase.engine.deserializer.loadGUIDAsync(objectData.id));
          }

          object[key] = { id:packageData.exportObjects[0].id };

          await this.refresh();
        },
      });
    } else if (value instanceof Array) {
      for (let i = 0; i < value.length; i++) {
        this.addGuiProperty(guiProperties, String(i), value, key + i);
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
      blending: false,
      zTest: false,
      zWrite: false,
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
        if (!serializedData.colors[uniformName]) {
          serializedData.colors[uniformName] = { r:1.0, g:1.0, b:1.0, a:1.0 };
        }
        guiProperties.push({
          name: inspectorName,
          type: 'color',
          object: serializedData.colors,
          key: uniformName,
          rgbScale:1,
        });
      } else if (type === '2D') {
        guiProperties.push({
          type: 'file',
          name: inspectorName,
          object:{ file:'' },
          key:'file',
          placeholder: 'Placeholder',
          async onFileChange (fileItem) {
            const file = await (fileItem?.handle as FileSystemFileHandle).getFile();

            let res: string;

            try {
              res = await readFileAsText(file);
            } catch (error) {
              console.error('读取文件出错:', error);

              return;
            }
            const packageData = JSON.parse(res) as EffectsPackageData;
            const guid = packageData.fileSummary.guid;

            // TODO 纹理 image 特殊逻辑，待移除
            if (packageData.fileSummary.assetType === 'Texture') {
              await assetDatabase.convertImageData(packageData);
            }

            for (const objectData of packageData.exportObjects) {
              assetDatabase.engine.addEffectsObjectData(objectData);
            }

            const effectsPackage = new EffectsPackage(assetDatabase.engine);

            assetDatabase.effectsPackages[guid] = effectsPackage;
            effectsPackage.fileSummary = packageData.fileSummary;
            for (const objectData of packageData.exportObjects) {
              effectsPackage.exportObjects.push(await assetDatabase.engine.deserializer.loadGUIDAsync(objectData.id));
            }

            serializedData.textures[uniformName] = { id:packageData.exportObjects[0].id };
            // await inspectorGui.item.engine.deserializer.deserializeTaggedPropertiesAsync(serializedData, material);
            // material.fromData(material.taggedProperties as EffectsObjectData);
          // eslint-disable-next-line no-console
            //   console.log(file);
          },
        });
      }
    }
  }

  checkVector3 (property: Record<string, any>) {
    return Object.keys(property).length === 3 && property['x'] !== undefined && property['y'] !== undefined && property['z'] !== undefined;
  }

  checkEuler (property: Record<string, any>) {
    return Object.keys(property).length === 4 && property['x'] !== undefined && property['y'] !== undefined && property['z'] !== undefined;
  }

  checkGUID (property: Record<string, any>) {
    return property instanceof Object && Object.keys(property).length === 1 && property.id !== undefined && property.id.length === 32;
  }

  async update () {
    if (!this.item) {
      return;
    }

    for (const serializedObject of this.serializedObjects) {
      await serializedObject.applyModifiedProperties();

      serializedObject.update();
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
        key: 'color2',
        rgbScale: 1,
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
]);

export class SerializedObject {
  engine: Engine;
  serializedData: Record<string, any> = {};
  serializedProperties: Record<string, SerializedProperty> = {};
  target: EffectsObject;

  constructor (target: EffectsObject) {
    this.target = target;
    this.engine = target.engine;
    this.serializedData = {};
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

  async applyModifiedProperties () {
    await this.engine.deserializer.deserializeTaggedPropertiesAsync(this.serializedData, this.target);
    // assetDatabase.setDirty(this.target);
  }
}

export class SerializedProperty {
  value: number | string | Object;
}
