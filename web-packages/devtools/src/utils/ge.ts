import type { Composition } from '@galacean/effects';
import { Player, SerializationHelper, spec } from '@galacean/effects';
import demoJson from '../assets/scenes/trail-demo.scene.json';
import { Input } from '../gui/input';
import { InspectorGui } from '../gui/inspector-gui';
import { MenuGui } from '../gui/menu-gui';
import { OrbitController } from '../gui/orbit-controller';
import { TreeGui } from '../gui/tree-gui';
import { AssetDatabase } from './asset-database';

export const treeGui = new TreeGui();
export const menuGui = new MenuGui();
export let assetDatabase: AssetDatabase;
// const inspectorGuiOld = new InspectorGuiOld();
export const inspectorGui = new InspectorGui();
export let composition: Composition;

const orbitController = new OrbitController();

let input: Input;
let player: Player;
let json = demoJson;

export async function initGEPlayer (canvas: HTMLCanvasElement) {
  player = new Player({ canvas, interactive: true, notifyTouch: true, env:'editor' });
  player.ticker.setFPS(120);

  const engine = player.renderer.engine;

  engine.database = new AssetDatabase(engine);
  assetDatabase = engine.database as AssetDatabase;

  input = new Input(canvas);
  input.startup();
  await loadJson(json);

  await guiMainLoop();
  inputControllerUpdate();
}

async function guiMainLoop () {
  if (treeGui.activeItem) {
    // inspectorGuiOld.setItem(treeGui.activeItem);
    inspectorGui.setItem(treeGui.activeItem);
  }
  treeGui.update();
  // inspectorGuiOld.update();
  await inspectorGui.update();
  requestAnimationFrame(guiMainLoop);
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
  menuGui.setComposition(composition);
  orbitController.setup(composition.camera, input);
}

function buildProject (composition: Composition, json: any) {
  const assetLoader = composition.getEngine().assetLoader;
  let serializedDatas: Record<string, spec.EffectsObjectData> = {};

  for (const item of composition.items) {
    serializedDatas = {
      ...serializedDatas,
      ...SerializationHelper.serializeEffectObject(item),
    };
    for (const component of item.components) {
      serializedDatas = {
        ...serializedDatas,
        ...SerializationHelper.serializeEffectObject(component),
      };
    }
  }

  let effectsObjectDataMap: Record<string, spec.EffectsObjectData> = {};

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
      case spec.DataType.EffectComponent:
        json.components.push(data);

        break;
      case spec.DataType.SpriteComponent:
        json.components.push(data);

        break;
      case spec.DataType.ParticleSystem:
        json.components.push(data);

        break;
      case spec.DataType.Material:
        json.materials.push(data);

        break;
      case spec.DataType.Geometry:
        json.geometries.push(data);

        break;
      case spec.DataType.Texture:
        //@ts-expect-error
        data.image = undefined;
        json.textures.push(data);

        break;
      case spec.DataType.VFXItemData:
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
  const assetLoader = composition.getEngine().assetLoader;
  let serializedDatas: Record<string, spec.EffectsObjectData> = {};

  for (const item of composition.items) {
    serializedDatas = {
      ...serializedDatas,
      ...SerializationHelper.serializeEffectObject(item),
    };
    for (const component of item.components) {
      serializedDatas = {
        ...serializedDatas,
        ...SerializationHelper.serializeEffectObject(component),
      };
    }
  }

  let effectsObjectDataMap: Record<string, spec.EffectsObjectData> = {};

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
  // for (const data of json.items) {
  //   effectsObjectDataMap[data.id] = data;
  // }

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
      case spec.DataType.EffectComponent:
        json.components.push(data);

        break;
      case spec.DataType.SpriteComponent:
        json.components.push(data);

        break;
      case spec.DataType.ParticleSystem:
        json.components.push(data);

        break;
      case spec.DataType.Texture:
        //@ts-expect-error
        data.image = undefined;
        json.textures.push(data);

        break;
    }
  }

  for (const item of composition.items) {
    const data = effectsObjectDataMap[item.getInstanceId()];

    if (!data) {
      continue;
    }
    json.items.push(data);
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
