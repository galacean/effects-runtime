import type { AGUIPropertiesPanelProps, AGUIPropertyProps } from '@advjs/gui';
import { Toast } from '@advjs/gui';
import type { Component, EffectsObject, EffectsPackageData, Engine, EffectComponent } from '@galacean/effects';
import { type VFXItem, type VFXItemContent } from '@galacean/effects';
import { ref } from 'vue';
import { assetDatabase, inspectorGui } from '../utils';
import { EffectsPackage } from '@galacean/effects-assets';
import { readFileAsText } from '../utils/asset-database';

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
      this.addComponentGui(component);
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

      if (typeof serializedData[key] === 'number') {
        properties.push({
          type: 'number',
          name: key,
          value });
      } else if (this.checkVector3(value)) {
        properties.push({
          type: 'vector',
          name: key,
          value });
      } else if (this.checkGUID(value)) {
        properties.push({
          type: 'file',
          name: key,
          placeholder: 'Placeholder',
          onFileChange (file) {
            // eslint-disable-next-line no-console
            console.log(file);
          },
        });
      }
    }
  }

  checkVector3 (property: Record<string, any>) {
    return Object.keys(property).length === 3 && property['x'] !== undefined && property['y'] !== undefined && property['z'] !== undefined ;
  }

  checkGUID (property: Record<string, any>) {
    return property instanceof Object && Object.keys(property).length === 1 && property.id !== undefined && property.id.length === 32;
  }

  serializedData: Record<string, any>;
  effectComponent: EffectComponent;

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
    this.serializedObjects[0].applyModifiedProperties();
  }
}

let count = 0;

export const components = ref<AGUIPropertiesPanelProps[]>([
  {
    icon: 'i-mdi-axis-arrow',
    title: 'Transform',
    properties: [
      {
        type: 'vector',
        name: 'Position',
        value: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      {
        type: 'vector',
        name: 'Rotation',
        value: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      {
        type: 'vector',
        name: 'Scale',
        value: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
    ],
  },

  {
    icon: 'i-ri:compasses-2-fill',
    title: 'Form Example',
    properties: [
      {
        type: 'input',
        name: 'Input',
        value: 'test',
      },
      {
        type: 'number',
        name: 'InputNumber',
        value: 10,
      },
      {
        type: 'checkbox',
        name: 'Checkbox',
        value: true,
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
        value: '',
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
        value: 'option1',
      },
      {
        name: 'Slider',
        type: 'slider',
        max: 100,
        min: 0,
        step: 1,
        value: 10,
      },
      {
        name: 'Number Slider',
        type: 'number-slider',
        max: 100,
        min: 0,
        step: 1,
        value: 10,
      },
      {
        name: 'divider',
        type: 'divider',
      },
      {
        type: 'vector',
        name: 'Vector2',
        value: {
          x: 0,
          y: 0,
        },
      },
      {
        type: 'vector',
        name: 'Vector3',
        value: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      {
        type: 'vector',
        name: 'Vector4',
        value: {
          x: 0,
          y: 0,
          z: 0,
          w: 0,
        },
      },
      {
        type: 'color',
        name: 'Color Picker',
        value: '#0099ff',
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
      },
      {
        type: 'file',
        name: 'Accept File',
        placeholder: 'Placeholder',
        onFileChange (file) {
          // eslint-disable-next-line no-console
          console.log(file);
        },
      },
      {
        type: 'file',
        name: 'Accept File 2',
        placeholder: 'Placeholder',
        onFileChange (file) {
          // eslint-disable-next-line no-console
          console.log(file);
        },
      },
    ],
  },
  {
    title: 'EffectComponent',
    properties: [
      {
        type: 'file',
        name: 'Material',
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

          inspectorGui.serializedData.materials = [{ id:packageData.exportObjects[0].id }];
          await inspectorGui.item.engine.deserializer.deserializeTaggedPropertiesAsync(inspectorGui.serializedData, inspectorGui.effectComponent.taggedProperties);
          inspectorGui.effectComponent.fromData(inspectorGui.effectComponent.taggedProperties);
          // eslint-disable-next-line no-console
        //   console.log(file);
        },
      },
      {
        type: 'file',
        name: 'Geometry',
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

          inspectorGui.serializedData.geometry = { id:packageData.exportObjects[0].id };
          await inspectorGui.item.engine.deserializer.deserializeTaggedPropertiesAsync(inspectorGui.serializedData, inspectorGui.effectComponent.taggedProperties);
          inspectorGui.effectComponent.fromData(inspectorGui.effectComponent.taggedProperties);
          // eslint-disable-next-line no-console
        //   console.log(file);
        },
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
    this.engine.deserializer.deserializeTaggedProperties(this.serializedData, this.target);
    // assetDatabase.setDirty(this.target);
  }
}

export class SerializedProperty {
  value: number | string | Object;
}