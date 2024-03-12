import type { FSFileItem } from '@advjs/gui';
import { saveFile } from '@advjs/gui';
import type { EffectsObjectData, EffectsPackageData, GeometryData } from '@galacean/effects';
import { DataType, generateGUID, glContext } from '@galacean/effects';
import type * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import type { FSDirItem } from '@advjs/gui';
//@ts-expect-error
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { ref } from 'vue';
import { assetDatabase, loadJson } from '../utils/ge';
import { readFileAsText } from '../utils/asset-database';

export const curDir = ref<FSDirItem>();

export async function onFileDrop (files: FSFileItem[]) {
  const curDirHandle = curDir.value!.handle;

  for (const fileItem of files) {
    const { file } = fileItem;

    if (!file) {
      return [];
    }

    // fileItem.icon = ''

    if (file.type === 'application/json') {
      importEAsset(file, curDirHandle);
    } else if (file.type === 'image/png') {
      importPng(file, curDirHandle);
    } else if (file.name.endsWith('.fbx')) {
      await importFBX(file, curDirHandle);
    }

  }

  return files;
}

export async function onRootFolderSelect (rootDirectoryHandle: FileSystemDirectoryHandle) {
  assetDatabase.rootDirectoryHandle = rootDirectoryHandle;
  if (rootDirectoryHandle.name !== 'assets') {
    console.warn('请选择asset文件夹');

    return;
  }

  await assetDatabase.importAllAssetsInFolder('assets');
}

export async function onFileDblClick (item: FSFileItem) {
  const file = await item.handle!.getFile();
  const text = await readFileAsText(file);

  await loadJson(JSON.parse(text));
}

export function base64ToFile (base64: string, filename = 'base64File', contentType = '') {
  // 去掉 Base64 字符串的 Data URL 部分（如果存在）
  const base64WithoutPrefix = base64.split(',')[1] || base64;

  // 将 base64 编码的字符串转换为二进制字符串
  const byteCharacters = atob(base64WithoutPrefix);
  // 创建一个 8 位无符号整数值的数组，即“字节数组”
  const byteArrays = [];

  // 切割二进制字符串为多个片段，并将每个片段转换成一个字节数组
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    byteArrays.push(byteArray);
  }

  // 使用字节数组创建 Blob 对象
  const blob = new Blob(byteArrays, { type: contentType });

  // 创建 File 对象
  const file = new File([blob], filename, { type: contentType });

  return file;
}

function createJsonFile (json: string, fileName: string) {
  // 将字符串转换为Blob
  const newBlob = new Blob([json], { type: 'application/json' });

  // 创建File对象，需要提供Blob、文件名和最后修改时间
  const newFile = new File([newBlob], fileName, { type: 'application/json', lastModified: Date.now() });

  return newFile;
}

function importEAsset (file: File, curDirHandle: FileSystemDirectoryHandle) {
  const reader = new FileReader();

  // 定义文件读取成功后的回调函数
  reader.onload = async (event: ProgressEvent<FileReader>) => {
    // event.target.result 包含文件的内容
    if (event.target) {
      const fileContent = event.target.result as string;
      const eAsset: EffectsPackageData = JSON.parse(fileContent);

      eAsset.fileSummary.guid = generateGUID();
      for (const data of eAsset.exportObjects) {
        data.id = generateGUID();
      }

      let fileName = file.name;

      const fileNames = await getAllFileNames(curDirHandle);

      while (fileNames.has(fileName)) {
        fileName = incrementFileName(fileName);
      }
      await saveFile(createJsonFile(JSON.stringify(eAsset, null, 2), fileName), curDirHandle);
    }
  };

  // 定义文件读取失败的回调函数
  reader.onerror = event => {
    console.error('文件读取出错:', reader.error);
  };

  // 以文本格式读取文件
  reader.readAsText(file);
}

async function getAllFileNames (directoryHandle: FileSystemDirectoryHandle): Promise<Set<string>> {
  const fileNames: Set<string> = new Set();

  // 使用异步迭代器遍历目录句柄中的条目
  for await (const [name, entry] of directoryHandle) {
    // 如果条目是文件，将其名称添加到 fileNames 数组中
    if (entry.kind === 'file') {
      fileNames.add(name);
    }
  }

  return fileNames;
}

function incrementFileName (fileName: string) {
  // 正则表达式用于匹配文件名中的数字
  const regex = /(.*?)(\((\d+)\))?.json$/;
  const match = fileName.match(regex);

  let increasedName = '';

  if (match && match[1]) {
    // 如果存在匹配的数字，则将该数字增加1
    if (match[2]) {
      const baseName = match[1];
      const number = parseInt(match[3], 10) + 1;

      increasedName = `${baseName}(${number}).json`;
    } else {
      // 没有数字，添加 (1) 到文件名
      const baseName = match[1];

      increasedName = `${baseName}(1).json`;
    }
  }

  return increasedName;
}

function importPng (file: File, curDirHandle: FileSystemDirectoryHandle) {
  // 创建FileReader实例
  const reader = new FileReader();

  // 文件读取成功完成后触发的事件
  reader.onload = async function (e) {
    const result = e.target?.result;

    const textureData = { id: generateGUID(), source: result, dataType: DataType.Texture, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT };
    const textureAsset = JSON.stringify(createPackageData([textureData], 'Texture'), null, 2);

    await saveFile(createJsonFile(textureAsset, file.name + '.json'), curDirHandle);
  };

  // 定义文件读取失败的回调函数
  reader.onerror = event => {
    console.error('文件读取出错:', reader.error);
  };

  // 读取文件内容，将文件内容转换为Base64字符串
  reader.readAsDataURL(file);
}

async function importFBX (file: File, curDirHandle: FileSystemDirectoryHandle) {
  const url = URL.createObjectURL(file);
  const modelDatas = await parseFBX(url);

  for (const modelData of modelDatas) {
    const geometryData: GeometryData = {
      id: generateGUID(),
      dataType: DataType.Geometry,
      vertices: modelData.vertices,
      uvs: modelData.uvs,
      normals: modelData.normals,
      indices: modelData.indices,
    };
    const geometryAsset = JSON.stringify(createPackageData([geometryData], 'Geometry'), null, 2);

    await saveFile(createJsonFile(geometryAsset, modelData.name + '.json'), curDirHandle);
  }
}

// 定义返回类型
interface ModelData {
  vertices: number[],
  uvs: number[],
  normals: number[],
  indices: number[],
  name: string,
}

async function parseFBX (fbxFilePath: string): Promise<ModelData[]> {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();

    loader.load(fbxFilePath, object => {
      const modelDatas: ModelData[] = [];
      // 初始化返回数据结构
      let vertices: number[] = [];
      let uvs: number[] = [];
      let indices: number[] = [];
      let normals: number[] = [];

      object.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          let geometry = mesh.geometry;

          // 转为带索引的 BufferGeometry
          geometry = BufferGeometryUtils.mergeVertices(geometry);
          // 确保有位置属性
          if (geometry.attributes.position) {
            const positionAttribute = geometry.attributes.position;

            vertices = Array.from(positionAttribute.array);
          }

          for (let i = 0; i < vertices.length; i++) {
            // 单位 cm 转为 m
            vertices[i] *= mesh.scale.x / 100;
          }

          // 确保有UV属性
          if (geometry.attributes.uv) {
            const uvAttribute = geometry.attributes.uv;

            uvs = Array.from(uvAttribute.array);
          }

          if (geometry.attributes.normal) {
            const normalAttribute = geometry.attributes.normal;

            normals = Array.from(normalAttribute.array);
          }

          // 确保有索引
          if (geometry.index) {
            indices = Array.from(geometry.index.array);
          }
          modelDatas.push({
            vertices,
            uvs,
            normals,
            indices,
            name: mesh.name,
          });
        }
      });

      resolve(modelDatas);
    }, undefined, error => {
      reject(error);
    });
  });
}

function createPackageData (effectsObjectDatas: EffectsObjectData[], assetType = 'any') {
  const newPackageData: EffectsPackageData = {
    fileSummary: { guid: generateGUID(), assetType },
    exportObjects: effectsObjectDatas,
  };

  return newPackageData;
}
