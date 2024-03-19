import type { Composition, EffectsObjectData } from '@galacean/effects';
import { DataType, Player, SerializationHelper, TimelineComponent } from '@galacean/effects';
import demoJson from '../assets/scenes/geometry-test-scene.json';
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
  let serializedDatas: Record<string, EffectsObjectData> = {};

  for (const item of composition.items) {
    serializedDatas = {
      ...serializedDatas,
      ...SerializationHelper.serializeEffectObject(item),
    };
    for (const component of item.components) {
      if (component instanceof TimelineComponent) {
        continue;
      }
      serializedDatas = {
        ...serializedDatas,
        ...SerializationHelper.serializeEffectObject(component),
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
  const assetLoader = composition.getEngine().assetLoader;
  let serializedDatas: Record<string, EffectsObjectData> = {};

  for (const item of composition.items) {
    serializedDatas = {
      ...serializedDatas,
      ...SerializationHelper.serializeEffectObject(item),
    };
    for (const component of item.components) {
      if (component instanceof TimelineComponent) {
        continue;
      }
      serializedDatas = {
        ...serializedDatas,
        ...SerializationHelper.serializeEffectObject(component),
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

function mergeAndEncodeToBase64 (floatArray: Float32Array, uint16Array: Uint16Array): string {
  // 计算新 ArrayBuffer 的总大小（以字节为单位）
  const totalSize = floatArray.byteLength + uint16Array.byteLength;

  // 创建一个足够大的 ArrayBuffer 来存储两个数组的数据
  const buffer = new ArrayBuffer(totalSize);

  // 创建一个视图来按照 Float32 格式写入数据
  const floatView = new Float32Array(buffer, 0, floatArray.length);

  floatView.set(floatArray);

  // 创建一个视图来按照 Uint16 格式写入数据，紧接着 Float32 数据之后
  const uint16View = new Uint16Array(buffer, floatArray.byteLength, uint16Array.length);

  uint16View.set(uint16Array);

  // 创建一个 Uint8Array 视图以便逐字节访问 ArrayBuffer 的数据
  const uint8View = new Uint8Array(buffer);

  // 将 Uint8Array 转换为二进制字符串
  let binaryString = '';

  for (let i = 0; i < uint8View.length; i++) {
    binaryString += String.fromCharCode(uint8View[i]);
  }

  // 使用 btoa 函数将二进制字符串转换为 Base64 编码的字符串
  return btoa(binaryString);
}

// 示例用法
const myFloats = new Float32Array([1.0, 0.5, -0.5, 2.5]);
const myUnsignedShorts = new Uint16Array([65535, 1024, 2048]);
const base64String = mergeAndEncodeToBase64(myFloats, myUnsignedShorts);

// eslint-disable-next-line no-console
console.log(base64String); // 输出 Base64 编码的字符串

function decodeBase64ToArrays (base64String: string, floatArrayLength: number, uint16ArrayLength: number): { floatArray: Float32Array, uint16Array: Uint16Array } {
  // 将 Base64 编码的字符串转换为二进制字符串
  const binaryString = atob(base64String);

  // 将二进制字符串转换为字节数组
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 创建 ArrayBuffer 并为其创建视图
  const buffer = bytes.buffer;

  // 根据提供的长度信息创建 Float32Array
  const floatView = new Float32Array(buffer, 0, floatArrayLength);

  // 根据提供的长度信息创建 Uint16Array，它紧随 Float32Array 数据之后
  const uint16View = new Uint16Array(buffer, floatArrayLength * 4, uint16ArrayLength);

  // 返回解码后的数组
  return { floatArray: floatView, uint16Array: uint16View };
}

// 示例用法
const floatArrayLength = 4; // Float32Array 的元素数量
const uint16ArrayLength = 3; // Uint16Array 的元素数量
const arrays = decodeBase64ToArrays(base64String, floatArrayLength, uint16ArrayLength);

// eslint-disable-next-line no-console
console.log(arrays.floatArray); // 输出 Float32Array
// eslint-disable-next-line no-console
console.log(arrays.uint16Array); // 输出 Uint16Array