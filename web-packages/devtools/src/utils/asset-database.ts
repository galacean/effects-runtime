import type { EffectsObject, Engine } from '@galacean/effects';
import { Database, type EffectsPackageData } from '@galacean/effects';
import { EffectsPackage } from '@galacean/effects-assets';

export class AssetDatabase extends Database {
  engine: Engine;
  rootDirectoryHandle: FileSystemDirectoryHandle;

  readonly effectsPackageDatas: Record<string, EffectsPackageData> = {};
  readonly effectsPackages: Record<string, EffectsPackage> = {};
  readonly packageGuidToPathMap: Record<string, string> = {};
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
    let effectsPackage = this.effectsPackages[packageGuid];

    if (!effectsPackage) {
      const path = this.GUIDToAssetPath(packageGuid);
      const loadedPackage = await this.loadPackage(path);

      if (!loadedPackage) {
        return;
      }
      effectsPackage = loadedPackage;
    }
    for (const effectsObject of effectsPackage.exportObjects) {
      if (effectsObject.instanceId === guid) {
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
    let res: string;

    try {
      res = await this.readFileAsText(file);
    } catch (error) {
      console.error('读取文件出错:', error);

      return;
    }
    const packageData = JSON.parse(res) as EffectsPackageData;
    const effectsPackage = new EffectsPackage();
    const guid = packageData.fileSummary.guid;

    this.effectsPackages[guid] = effectsPackage;
    effectsPackage.fileSummary = packageData.fileSummary;

    for (const objectData of packageData.exportObjects) {
      this.engine.addEffectsObjectData(objectData);
    }

    for (const objectData of packageData.exportObjects) {
      effectsPackage.exportObjects.push(this.engine.deserializer.loadGUID(objectData.id));
    }

    return effectsPackage;
  }

  async saveAssets () {
    for (const dirtyPackageGuid of this.dirtyPackageSet) {
      const assetData = this.effectsPackageDatas[dirtyPackageGuid];
      const path = this.GUIDToAssetPath(dirtyPackageGuid);

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
    // console.log('save ' + path);
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
      res = await this.readFileAsText(file);
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

    this.effectsPackageDatas[guid] = packageData;
    this.packageGuidToPathMap[guid] = path;

    for (const objectData of packageData.exportObjects) {
      this.objectToPackageGuidMap[objectData.id] = guid;
    }
    this.dirtyPackageSet.add(guid);

    // TODO 加入到场景资产 SceneData 中

    // console.log('import ' + path);

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
    const packageGuid = this.objectToPackageGuidMap[object.instanceId];

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

  private readFileAsText (file: File): Promise<string> {
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

  GUIDToAssetPath (guid: string) {
    return this.packageGuidToPathMap[guid];
  }
}

export async function importAssets (engine: Engine) {
  const handle = await window.showDirectoryPicker();
  const assetDatabase = engine.database as AssetDatabase;

  assetDatabase.rootDirectoryHandle = handle;
  if (handle.name !== 'assets') {
    console.warn('请选择asset文件夹');

    return;
  }

  await assetDatabase.importAllAssetsInFolder('assets');

  // console.log(await assetDatabase.loadGuid('908d3df4192f4fb2bc1dcc7158caffc9'));
  // setTimeout(async ()=>{await assetDatabase.saveAssets();}, 1000);
}