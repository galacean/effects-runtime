import type { Composition, EffectsObjectData, VFXItem, VFXItemContent } from '@galacean/effects';
import { DataType, Player, TimelineComponent, spec } from '@galacean/effects';
import json from './assets/custom-material';
import { assetDataBase } from './gui/asset-data-base';
import { Input } from './gui/input';
import { InspectorGui } from './gui/inspector-gui';
import { OrbitController } from './gui/orbit-controller';
import { TreeGui } from './gui/tree-gui';

const container = document.getElementById('J-container');
const treeGui = new TreeGui();
const inspectorGui = new InspectorGui();

let player: Player;
let composition: Composition;
let orbitController: OrbitController;
let input: Input;

(async () => {
  try {
    player = new Player({ container });
    //@ts-expect-error
    composition = await player.loadScene(json);

    for (const resourceData of Object.values(assetDataBase.assetsData)) {
      player.renderer.engine.deserializer.assetDatas[resourceData.id] = resourceData;
    }

    treeGui.setComposition(composition);
    input = new Input(container!);
    input.startup();
    orbitController = new OrbitController(composition.camera, input);

    inputControllerUpdate();
  } catch (e) {
    console.error('biz', e);
  }
})();

setInterval(() => {
  guiMainLoop();
}, 100);

function guiMainLoop () {
  if (treeGui.activeItem) {
    inspectorGui.setItem(treeGui.activeItem);
  }
  treeGui.update();
  inspectorGui.update();
}

function inputControllerUpdate () {
  orbitController.update();
  input.refreshStatus();
  requestAnimationFrame(inputControllerUpdate);
}

async function saveJSONFile (json: any) {
  // 创建一个包含JSON数据的对象
  const myData = json;

  // 将JSON对象转换为字符串
  const jsonStr = JSON.stringify(myData, null, 2);

  try {
    // 显示文件保存对话框，用户可以选择文件夹并输入文件名
    //@ts-expect-error
    const handle = await window.showSaveFilePicker({
      suggestedName: 'trail-demo.scene.json',
      types: [
        {
          description: 'JSON files',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });

    // 创建一个FileSystemWritableFileStream来写入选定的文件
    const writableStream = await handle.createWritable();

    // 写入JSON字符串数据
    await writableStream.write(jsonStr);

    // 关闭文件流
    await writableStream.close();
  } catch (error) {
    console.error('文件保存失败', error);
  }
}

async function loadJSONFile () {
  //@ts-expect-error
  const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
  const file = await fileHandle[0].getFile();
  const reader = new FileReader();

  reader.onload = async () => {
    if (typeof reader.result !== 'string') {
      return;
    }
    const data = JSON.parse(reader.result);

    for (const resourceData of Object.values(assetDataBase.assetsData)) {
      player.renderer.engine.deserializer.assetDatas[resourceData.id] = resourceData;
    }
    player.destroyCurrentCompositions();
    composition = await player.loadScene(data);
    treeGui.setComposition(composition);
    orbitController.setup(composition.camera, input);
  };
  reader.readAsText(file);
}

function serializeScene (composition: Composition, json: any) {
  const deserializer = composition.getEngine().deserializer;
  let serializedDatas: Record<string, EffectsObjectData> = {};

  for (const itemData of json.items) {
    if (itemData.type === spec.ItemType.sprite || itemData.type === spec.ItemType.particle) {
      continue;
    }
    const item = deserializer.getInstance(itemData.id) as VFXItem<VFXItemContent>;

    deserializer.serializeEffectObject(item);
    for (const component of item.components) {
      if (component instanceof TimelineComponent) {
        continue;
      }
      serializedDatas = {
        ...serializedDatas,
        ...deserializer.serializeEffectObject(component),
      };
    }
  }

  let effectsObjectDataMap: Record<string, EffectsObjectData> = {};

  for (const data of json.components) {
    effectsObjectDataMap[data.id] = data;
  }
  for (const data of json.geometries) {
    effectsObjectDataMap[data.id] = data;
  }
  for (const data of json.materials) {
    effectsObjectDataMap[data.id] = data;
  }
  for (const data of json.textures) {
    effectsObjectDataMap[data.id] = data;
  }

  effectsObjectDataMap = {
    ...effectsObjectDataMap,
    ...serializedDatas,
  };

  json.components = [];
  json.geometries = [];
  json.materials = [];
  json.textures = [];
  for (const data of Object.values(effectsObjectDataMap)) {
    if (!data.id) {
      continue;
    }
    switch (data.dataType) {
      case DataType.EffectComponent:
        json.components.push(data);

        break;
      case DataType.SpriteComponent:
        json.components.push(data);

        break;
      case DataType.ParticleSystem:
        json.components.push(data);

        break;
      case DataType.Material:
        json.materials.push(data);

        break;
      case DataType.Geometry:
        json.geometries.push(data);

        break;
      case DataType.Texture:
        json.textures.push(data);

        break;
    }
  }
}

const body = document.querySelector('body');
const saveButton = document.createElement('button');

body?.appendChild(saveButton);
saveButton.textContent = '保存场景json';
saveButton.onclick = async () => {
  serializeScene(composition, json);
  await saveJSONFile(json);
};

const loadButton = document.createElement('button');

body?.appendChild(loadButton);
loadButton.textContent = '加载场景json';
loadButton.onclick = async () => {
  await loadJSONFile();
};