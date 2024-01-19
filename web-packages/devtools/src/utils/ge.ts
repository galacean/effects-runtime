import type { Composition, EffectsObjectData, VFXItemConstructor } from '@galacean/effects';
import { DataType, EffectComponent, Player, TimelineComponent, VFXItem } from '@galacean/effects';
import { G_QUAD, M_DUCK, S_TRAIL } from '@galacean/effects-assets';
import demoJson from '../assets/scenes/trail-demo.scene.json';
import { Input } from '../gui/input';
import { InspectorGui } from '../gui/inspector-gui';
import { OrbitController } from '../gui/orbit-controller';
import { TreeGui } from '../gui/tree-gui';
import { AssetDatabase } from './asset-database';

export const treeGui = new TreeGui();
export let assetDatabase: AssetDatabase;
const inspectorGui = new InspectorGui();
let input: Input;
let orbitController: OrbitController;
let composition: Composition;
let player: Player;
let json = demoJson;

export async function initGEPlayer (canvas: HTMLCanvasElement) {
  player = new Player({ canvas, interactive: true, notifyTouch: true, env:'editor' });
  player.ticker.setFPS(120);

  const trailShaderData = S_TRAIL.exportObjects[0];
  const trailMaterialData = M_DUCK.exportObjects[0];
  const quadGeometryData = G_QUAD.exportObjects[0];

  const engine = player.renderer.engine;

  engine.database = new AssetDatabase(engine);
  assetDatabase = engine.database as AssetDatabase;

  engine.addEffectsObjectData(trailShaderData);
  engine.addEffectsObjectData(trailMaterialData);
  engine.addEffectsObjectData(quadGeometryData);

  //@ts-expect-error
  composition = await player.loadScene(json);

  createEffectVFXItem(composition);
  createEffectVFXItem(composition);
  createEffectVFXItem(composition);
  createEffectVFXItem(composition);
  createEffectVFXItem(composition);
  createEffectVFXItem(composition);
  createEffectVFXItem(composition);

  // const effectItem = new VFXItem(engine);

  // effectItem.duration = 1000;
  // //@ts-expect-error
  // effectItem.type = 'ECS';
  // const effectComponent = effectItem.addComponent(EffectComponent);

  // effectComponent.geometry = engine.deserializer.loadGUID(quadGeometryData.id);
  // effectComponent.material = engine.deserializer.loadGUID(trailMaterialData.id);
  // composition.addItem(effectItem);

  setInterval(() => {
    guiMainLoop();
  }, 100);

  treeGui.setComposition(composition);
  input = new Input(canvas);
  input.startup();
  orbitController = new OrbitController(composition.camera, input);
  inputControllerUpdate();
}

function createEffectVFXItem (composition: Composition, parent?: VFXItem<VFXItemConstructor>) {
  const engine = composition.getEngine();
  const effectItem = new VFXItem(engine);

  effectItem.duration = 1000;
  //@ts-expect-error
  effectItem.type = 'ECS';
  const effectComponent = effectItem.addComponent(EffectComponent);

  const trailShaderData = S_TRAIL.exportObjects[0];
  const trailMaterialData = M_DUCK.exportObjects[0];
  const quadGeometryData = G_QUAD.exportObjects[0];

  effectComponent.geometry = engine.deserializer.loadGUID(quadGeometryData.id);
  effectComponent.material = engine.deserializer.loadGUID(trailMaterialData.id);
  composition.addItem(effectItem);
}

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
      suggestedName: 'test.scene.json',
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

async function selectAndLoadJSONFile () {
  //@ts-expect-error
  const fileHandle: FileSystemFileHandle[] = await window.showOpenFilePicker();
  const file = await fileHandle[0].getFile();
  const reader = new FileReader();

  reader.onload = async () => {
    if (typeof reader.result !== 'string') {
      return;
    }
    const data = JSON.parse(reader.result);

    await loadJson(data);
  };
  reader.readAsText(file);
}

export async function loadJson (data: any) {
  json = data;
  player.destroyCurrentCompositions();
  composition = await player.loadScene(data);
  treeGui.setComposition(composition);
  orbitController.setup(composition.camera, input);
}

function buildProject (composition: Composition, json: any) {
  const deserializer = composition.getEngine().deserializer;
  let serializedDatas: Record<string, EffectsObjectData> = {};

  for (const item of composition.items) {
    serializedDatas = {
      ...serializedDatas,
      ...deserializer.serializeEffectObject(item),
    };
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
  for (const data of json.items) {
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
  json.items = [];
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
        //@ts-expect-error
        data.image = undefined;
        json.textures.push(data);

        break;
      case DataType.VFXItemData:
        json.items.push(data);

        break;
    }
  }

  json.compositions[0].items = [];
  for (const item of json.items) {
    json.compositions[0].items.push({ id:item.id });
  }
}

async function saveScene (composition: Composition, json: any) {
  const deserializer = composition.getEngine().deserializer;
  let serializedDatas: Record<string, EffectsObjectData> = {};

  for (const item of composition.items) {
    serializedDatas = {
      ...serializedDatas,
      ...deserializer.serializeEffectObject(item),
    };
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
  for (const data of json.items) {
    effectsObjectDataMap[data.id] = data;
  }

  effectsObjectDataMap = {
    ...effectsObjectDataMap,
    ...serializedDatas,
  };

  json.components = [];
  // json.geometries = [];
  // json.materials = [];
  json.textures = [];
  json.items = [];
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
      case DataType.Texture:
        //@ts-expect-error
        data.image = undefined;
        json.textures.push(data);

        break;
      case DataType.VFXItemData:
        json.items.push(data);

        break;
    }
  }

  json.compositions[0].items = [];
  for (const item of json.items) {
    json.compositions[0].items.push({ id:item.id });
  }

  await assetDatabase.saveAssets();
}

const body = document.querySelector('body');
const saveButton = document.createElement('button');

saveButton.style.position = 'fixed';
saveButton.style.bottom = '20px';
saveButton.style.right = '20px';
saveButton.style.padding = '10px 15px';
saveButton.style.backgroundColor = '#007bff';
saveButton.style.color = 'white';
saveButton.style.border = 'none';
saveButton.style.borderRadius = '5px';
saveButton.style.cursor = 'pointer';

// 添加悬停效果
saveButton.addEventListener('mouseover', () => {
  saveButton.style.backgroundColor = '#1fa404';
});

// 当鼠标移出时恢复原来的背景颜色
saveButton.addEventListener('mouseout', () => {
  saveButton.style.backgroundColor = '#007bff';
});

body?.appendChild(saveButton);
saveButton.textContent = '保存场景json';
saveButton.onclick = async () => {
  await saveScene(composition, json);
  await saveJSONFile(json);
};

const loadButton = document.createElement('button');

loadButton.style.position = 'fixed';
loadButton.style.bottom = '20px';
loadButton.style.right = '160px';
loadButton.style.padding = '10px 15px';
loadButton.style.backgroundColor = '#007bff';
loadButton.style.color = 'white';
loadButton.style.border = 'none';
loadButton.style.borderRadius = '5px';
loadButton.style.cursor = 'pointer';

// 添加悬停效果
loadButton.addEventListener('mouseover', () => {
  loadButton.style.backgroundColor = '#1fa404';
});

// 当鼠标移出时恢复原来的背景颜色
loadButton.addEventListener('mouseout', () => {
  loadButton.style.backgroundColor = '#007bff';
});

body?.appendChild(loadButton);
loadButton.textContent = '加载场景json';
loadButton.onclick = async () => {
  // await importAssets(player.renderer.engine);
  await selectAndLoadJSONFile();
};