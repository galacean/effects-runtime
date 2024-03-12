import type { EffectsObject, Engine } from '@galacean/effects';
import { Database, loadImage, type EffectsPackageData, SerializationHelper } from '@galacean/effects';
import { EffectsPackage } from '@galacean/effects-assets';
import { base64ToFile } from '../gui/project-gui';

export class AssetDatabase extends Database {
  engine: Engine;
  rootDirectoryHandle: FileSystemDirectoryHandle;

  // readonly effectsPackageDatas: Record<string, EffectsPackageData> = {}; // TODO 增加达到存储上限，自动清除缓存
  readonly effectsPackages: Record<string, EffectsPackage> = {}; // TODO 暂时无法使用，场景的对象会在结束后销毁，导致无法缓存
  readonly packageGuidToPathMap: Record<string, string> = {};
  readonly pathToPackageGuidMap: Record<string, string> = {};
  readonly objectToPackageGuidMap: Record<string, string> = {};
  readonly dirtyPackageSet: Set<string> = new Set<string>();

  constructor (engine: Engine) {
    super();
    this.engine = engine;
  }

  // loadObject<T extends EffectsObject> (path: string, classConstructor: (engine: Engine) => T) {

  // }

  override async loadGUID (guid: string): Promise<EffectsObject | undefined> {
    const packageGuid = this.objectToPackageGuidMap[guid];

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
    const fileHandle = await this.getFileHandle(path);

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
    const packageData = JSON.parse(res) as EffectsPackageData;
    const guid = packageData.fileSummary.guid;

    // TODO 纹理 image 特殊逻辑，待移除
    if (packageData.fileSummary.assetType === 'Texture') {
      await this.convertImageData(packageData);
    }

    for (const objectData of packageData.exportObjects) {
      this.engine.addEffectsObjectData(objectData);
    }

    const effectsPackage = new EffectsPackage(this.engine);

    this.effectsPackages[guid] = effectsPackage;
    effectsPackage.fileSummary = packageData.fileSummary;
    for (const objectData of packageData.exportObjects) {
      effectsPackage.exportObjects.push(await this.engine.assetLoader.loadGUIDAsync(objectData.id));
    }

    return effectsPackage;
  }

  async convertImageData (packageData: EffectsPackageData) {
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
      let effectsPackage = this.effectsPackages[dirtyPackageGuid];

      if (!effectsPackage) {
        effectsPackage = (await this.loadPackage(this.GUIDToAssetPath(dirtyPackageGuid)))!;
      }

      const assetData = SerializationHelper.serializeTaggedProperties(effectsPackage) as EffectsPackageData;
      const path = this.GUIDToAssetPath(dirtyPackageGuid);

      console.info(assetData, path);

      await this.saveAsset(assetData, path);
    }

    this.dirtyPackageSet.clear();
  }

  async saveAsset (assetData: EffectsPackageData, path: string) {
    const fileHandle = await this.getFileHandle(path, true);

    if (!fileHandle) {

      return;
    }

    const writableStream = await fileHandle.createWritable();

    await writableStream.write(JSON.stringify(assetData, null, 2));
    await writableStream.close();
    console.info('save ' + path);
  }

  // TODO 只加载 filesummary 到 map
  async importAsset (path: string) {
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
    const packageData = JSON.parse(res) as EffectsPackageData;

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

    this.packageGuidToPathMap[guid] = path;
    this.pathToPackageGuidMap[path] = guid;

    for (const objectData of packageData.exportObjects) {
      this.objectToPackageGuidMap[objectData.id] = guid;
    }
    // this.dirtyPackageSet.add(guid);

    // TODO 加入到场景资产 SceneData 中

    // eslint-disable-next-line no-console
    console.log('import ' + guid + ' : ' + path);

    fileReader.readAsText(file);
  }

  async importAllAssetsInFolder (path: string) {
    const directoryHandle = await this.getDirectoryHandle(path);
    //@ts-expect-error
    const entries = directoryHandle.values();

    for await (const entry of entries) {
      if (entry.kind === 'file') {
        const fileName = entry.name;

        if (!fileName.endsWith('.json')) {
          continue;
        }
        await this.importAsset(path + '/' + entry.name);
      } else if (entry.kind === 'directory') {
        await this.importAllAssetsInFolder(path + '/' + entry.name);
      }
    }

  }

  checkPath (path: string): boolean {
    let res = true;

    if (!path.startsWith('assets')) {
      console.error('路径请使用 assets/xxx/... 格式');
      res = false;
    }

    return res;
  }

  setDirty (object: EffectsObject) {
    const packageGuid = this.objectToPackageGuidMap[object.getInstanceId()];

    if (!packageGuid) {
      return;
    }

    this.dirtyPackageSet.add(packageGuid);
  }

  private async getFileHandle (relativePath: string, create = false) {
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

  private async getDirectoryHandle (relativePath: string) {
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
    return this.packageGuidToPathMap[guid];
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