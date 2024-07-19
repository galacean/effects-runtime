import type { Engine, spec } from '@galacean/effects';
import { Player } from '@galacean/effects';
import { EffectsObject, base64ToFile } from '@galacean/effects';
import { Database, loadImage, SerializationHelper } from '@galacean/effects';
import { previewScene } from '../asset/preview-scene';

export class AssetDatabase extends Database {
  engine: Engine;
  static rootDirectoryHandle: FileSystemDirectoryHandle;

  // readonly effectsPackageDatas: Record<string, EffectsPackageData> = {}; // TODO 增加达到存储上限，自动清除缓存
  // readonly effectsPackages: Record<string, EffectsPackage> = {}; // TODO 暂时无法使用，场景的对象会在结束后销毁，导致无法缓存
  private static packageGuidToPathMap: Record<string, string> = {};
  private static pathToPackageGuidMap: Record<string, string> = {};
  private static objectToPackageGuidMap: Record<string, string> = {};
  readonly dirtyPackageSet: Set<string> = new Set<string>();

  constructor (engine: Engine) {
    super();
    this.engine = engine;
  }

  // loadObject<T extends EffectsObject> (path: string, classConstructor: (engine: Engine) => T) {

  // }

  override async loadGUID (guid: string): Promise<EffectsObject | undefined> {
    const packageGuid = AssetDatabase.objectToPackageGuidMap[guid];

    if (!packageGuid) {
      return;
    }
    // let effectsPackage = this.effectsPackages[packageGuid];  // 合成播放完会把对象设置为销毁，无法复用
    let effectsPackage: EffectsPackage | undefined;

    if (!effectsPackage) {
      const path = this.GUIDToAssetPath(packageGuid);
      const loadedPackage = await this.loadPackage(path);

      if (!loadedPackage) {
        return;
      }
      effectsPackage = loadedPackage;
    }
    for (const effectsObject of effectsPackage.exportObjects) {
      if (effectsObject.getInstanceId() === guid) {
        return effectsObject;
      }
    }
  }

  async loadPackage (path: string) {
    const fileHandle = await AssetDatabase.getFileHandle(path);

    if (!fileHandle) {
      console.warn('未找到资产 ' + path);

      return;
    }
    const file = await fileHandle.getFile();
    const effectsPackage = await this.loadPackageFile(file);

    return effectsPackage;
  }

  async loadPackageFile (file: File) {
    let res: string;

    try {
      res = await readFileAsText(file);
    } catch (error) {
      console.error('读取文件出错:', error);

      return;
    }
    const packageData = JSON.parse(res) as spec.EffectsPackageData;
    const guid = packageData.fileSummary.guid;

    // TODO 纹理 image 特殊逻辑，待移除
    if (packageData.fileSummary.assetType === 'Texture') {
      await this.convertImageData(packageData);
    }

    for (const objectData of packageData.exportObjects) {
      this.engine.addEffectsObjectData(objectData);
    }

    const effectsPackage = new EffectsPackage(this.engine);

    // this.effectsPackages[guid] = effectsPackage;
    effectsPackage.fileSummary = packageData.fileSummary;
    for (const objectData of packageData.exportObjects) {
      effectsPackage.exportObjects.push(await this.engine.assetLoader.loadGUIDAsync(objectData.id));
    }

    return effectsPackage;
  }

  async convertImageData (packageData: spec.EffectsPackageData) {
    const textureData = packageData.exportObjects[0];

    //@ts-expect-error
    const imageFile = base64ToFile(textureData.source);

    // 加载 image
    const image = await loadImage(imageFile);

    //@ts-expect-error
    textureData.image = image;
  }

  async saveAssets () {
    for (const dirtyPackageGuid of this.dirtyPackageSet) {
      // let effectsPackage = this.effectsPackages[dirtyPackageGuid];
      let effectsPackage;

      if (!effectsPackage) {
        effectsPackage = (await this.loadPackage(this.GUIDToAssetPath(dirtyPackageGuid)))!;
      }

      const assetData = SerializationHelper.serializeTaggedProperties(effectsPackage) as spec.EffectsPackageData;
      const path = this.GUIDToAssetPath(dirtyPackageGuid);

      console.info(assetData, path);

      await this.saveAsset(assetData, path);
    }

    this.dirtyPackageSet.clear();
  }

  async saveAsset (assetData: spec.EffectsPackageData, path: string) {
    const fileHandle = await AssetDatabase.getFileHandle(path, true);

    if (!fileHandle) {

      return;
    }

    const writableStream = await fileHandle.createWritable();

    await writableStream.write(JSON.stringify(assetData, null, 2));
    await writableStream.close();
    console.info('save ' + path);
  }

  // TODO 只加载 filesummary 到 map
  static async importAsset (path: string) {
    const fileHandle = await this.getFileHandle(path);

    if (!fileHandle) {
      return;
    }

    const file = await fileHandle.getFile();
    const fileReader = new FileReader();

    let res: string;

    try {
      res = await readFileAsText(file);
    } catch (error) {
      console.error('读取文件出错:', error);

      return;
    }
    const packageData = JSON.parse(res) as spec.EffectsPackageData;

    if (!packageData.exportObjects) {
      return;
    }

    // packageData = {
    //   fileSummary:{
    //     guid:generateUuid(),
    //   },
    //   ...packageData,
    // };
    // packageData.id = undefined;
    const guid = packageData.fileSummary.guid;

    AssetDatabase.packageGuidToPathMap[guid] = path;
    AssetDatabase.pathToPackageGuidMap[path] = guid;

    for (const objectData of packageData.exportObjects) {
      AssetDatabase.objectToPackageGuidMap[objectData.id] = guid;
    }
    // this.dirtyPackageSet.add(guid);

    // TODO 加入到场景资产 SceneData 中

    // eslint-disable-next-line no-console
    console.log('import ' + guid + ' : ' + path);

    fileReader.readAsText(file);
  }

  static async importAllAssets (rootFolder: FileSystemDirectoryHandle) {
    AssetDatabase.packageGuidToPathMap = {};
    AssetDatabase.pathToPackageGuidMap = {};
    AssetDatabase.objectToPackageGuidMap = {};
    await AssetDatabase.importAllAssetsInPath(rootFolder.name);
  }

  private static async importAllAssetsInPath (path: string) {
    const directoryHandle = await AssetDatabase.getDirectoryHandle(path);
    //@ts-expect-error
    const entries = directoryHandle.values();

    for await (const entry of entries) {
      if (entry.kind === 'file') {
        const fileName = entry.name;

        if (!fileName.endsWith('.json')) {
          continue;
        }
        await AssetDatabase.importAsset(path + '/' + entry.name);
      } else if (entry.kind === 'directory') {
        await AssetDatabase.importAllAssetsInPath(path + '/' + entry.name);
      }
    }

  }

  static checkPath (path: string): boolean {
    let res = true;

    if (!path.startsWith('assets')) {
      console.error('错误路径 ' + path + ' 路径请使用 assets/xxx/... 格式');
      res = false;
    }

    return res;
  }

  setDirty (object: EffectsObject) {
    const packageGuid = AssetDatabase.objectToPackageGuidMap[object.getInstanceId()];

    if (!packageGuid) {
      return;
    }

    this.dirtyPackageSet.add(packageGuid);
  }

  private static async getFileHandle (relativePath: string, create = false) {
    if (!this.checkPath(relativePath)) {
      return;
    }
    if (!this.rootDirectoryHandle) {
      console.error('未指定根目录');

      return;
    }
    // 将相对路径分割成各个组成部分
    const pathParts = relativePath.split('/');
    let currentHandle = this.rootDirectoryHandle;

    // 最后一个是文件名，搜索目录时跳过
    for (let i = 1;i < pathParts.length - 1;i++) {
      const part = pathParts[i];

      if (part === '' || part === '.') {
        // 如果是空字符串或点（当前目录），则跳过
        continue;
      } else {
        // 获取当前目录下的条目句柄
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }
    }
    const fileName = pathParts[pathParts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName, { create });

    return fileHandle;
  }

  private static async getDirectoryHandle (relativePath: string) {
    // if (!AssetDatabase.checkPath(relativePath)) {
    //   return;
    // }
    if (!AssetDatabase.rootDirectoryHandle) {
      console.error('未指定根目录');

      return;
    }
    // 将相对路径分割成各个组成部分
    const pathParts = relativePath.split('/');
    let currentHandle = AssetDatabase.rootDirectoryHandle;

    // 最后一个是文件名，搜索目录时跳过
    for (let i = 1;i < pathParts.length;i++) {
      const part = pathParts[i];

      if (part === '' || part === '.') {
        // 如果是空字符串或点（当前目录），则跳过
        continue;
      } else {
        // 获取当前目录下的条目句柄
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }
    }

    return currentHandle;
  }

  GUIDToAssetPath (guid: string) {
    return AssetDatabase.packageGuidToPathMap[guid];
  }
}

export async function readFileAsText (file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.readAsText(file);
  });
}

export class EffectsPackage extends EffectsObject {
  fileSummary: fileSummary;
  exportObjects: EffectsObject[] = [];

  override toData () {
    this.taggedProperties.fileSummary = this.fileSummary;
    this.taggedProperties.exportObjects = [];

    for (const obj of this.exportObjects) {
      obj.toData();
      this.taggedProperties.exportObjects.push(obj.taggedProperties);
    }
  }
}

interface fileSummary {
  guid: string,
  assetType: string,
}

export function generateAssetScene (packageData: spec.EffectsPackageData): spec.JSONScene | undefined {
  const clonePreviewScene = JSON.parse(JSON.stringify(previewScene)) as spec.JSONScene;

  const assetType = packageData.fileSummary.assetType;

  if (assetType === 'Geometry') {
    const geometryData = packageData.exportObjects[0];

    geometryData.id = clonePreviewScene.geometries[0].id;
    clonePreviewScene.geometries[0] = geometryData as spec.GeometryData;

    return clonePreviewScene;
  } else if (assetType === 'Material') {
    const materialData = packageData.exportObjects[0];

    materialData.id = clonePreviewScene.materials[0].id;
    clonePreviewScene.materials[0] = materialData as spec.MaterialData;

    return clonePreviewScene;
  }
}

export function createPreviewPlayer (): Player {
  // 创建一个新的 div 元素
  const newDiv = document.createElement('div');

  // 设置 div 的样式
  newDiv.style.width = '100px';
  newDiv.style.height = '100px';
  newDiv.style.backgroundColor = 'black';

  // 将 div 添加到页面中
  document.body.appendChild(newDiv);

  return new Player({ container:newDiv });
}
