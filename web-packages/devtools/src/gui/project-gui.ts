import type { FSFileItem } from '@advjs/gui';
import { curFileList, saveFile } from '@advjs/gui';
import type { GeometryData } from '@galacean/effects';
import { DataType, generateUuid, glContext, loadImage } from '@galacean/effects';
import type * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
//@ts-expect-error
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export async function onFileDrop (files: FSFileItem[], curDirHandle: FileSystemDirectoryHandle) {
  for (const fileItem of files) {
    const { file } = fileItem;

    if (!file) {
      return;
    }

    // fileItem.icon = ''

    if (file.type === 'application/json') {
      importModelJson(file, curDirHandle);
    } else if (file.type === 'image/png') {
      importPng(file, curDirHandle);
    } else if (file.name.endsWith('.fbx')) {
      await importFBX(file, curDirHandle);
    }

    return files;
  }
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

function modelJsonConverter (json: string): string {
  const sourceJson = JSON.parse(json);
  let vertices;
  let uvs;
  let indices;

  for (const verticesData of sourceJson.vertices) {
    if (verticesData.name === 'position_buffer') {
      vertices = verticesData.values;
    } else if (verticesData.name === 'texcoord_buffer') {
      uvs = verticesData.values;
    }
  }
  for (const data of sourceJson.connectivity) {
    if (data.name === 'triangles') {
      indices = data.indices;
    }
  }
  const geometryData: GeometryData = { id: generateUuid(), dataType: DataType.Geometry };

  geometryData.vertices = vertices;
  geometryData.uvs = uvs;
  geometryData.indices = indices;
  const geometryAsset = { exportObjects: [geometryData] };

  return JSON.stringify(geometryAsset);
}

function importModelJson (file: File, curDirHandle: FileSystemDirectoryHandle) {
  const reader = new FileReader();

  // 定义文件读取成功后的回调函数
  reader.onload = async (event: ProgressEvent<FileReader>) => {
  // event.target.result 包含文件的内容
    if (event.target) {
      const fileContent = event.target.result;
      const geometryAsset = modelJsonConverter(fileContent as string);

      await saveFile(createJsonFile(geometryAsset, file.name), curDirHandle);
    }
  };

  // 定义文件读取失败的回调函数
  reader.onerror = event => {
    console.error('文件读取出错:', reader.error);
  };

  // 以文本格式读取文件
  reader.readAsText(file);
}

function importPng (file: File, curDirHandle: FileSystemDirectoryHandle) {
  // 创建FileReader实例
  const reader = new FileReader();

  // 文件读取成功完成后触发的事件
  reader.onload = async function (e) {
    const result = e.target?.result;

    const textureData = { id: generateUuid(), source: result, dataType: DataType.Texture, flipY: true, wrapS: glContext.REPEAT, wrapT: glContext.REPEAT };
    const textureAsset = JSON.stringify({ exportObjects:[textureData] });

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

  let i = 0;

  for (const modelData of modelDatas) {
    const geometryData: GeometryData = {
      id: generateUuid(),
      dataType: DataType.Geometry,
      ...modelData,
    };
    const geometryAsset = JSON.stringify({ id:generateUuid(), exportObjects: [geometryData] });

    await saveFile(createJsonFile(geometryAsset, file.name + i++ + '.json'), curDirHandle);
  }
}

// 定义返回类型
interface ModelData {
  vertices: number[],
  uvs: number[],
  indices: number[],
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

          // 确保有UV属性
          if (geometry.attributes.uv) {
            const uvAttribute = geometry.attributes.uv;

            uvs = Array.from(uvAttribute.array);
          }

          // 确保有索引
          if (geometry.index) {
            indices = Array.from(geometry.index.array);
          }
          modelDatas.push({
            vertices,
            uvs,
            indices,
          });
        }
      });

      resolve(modelDatas);
    }, undefined, error => {
      reject(error);
    });
  });
}

// // 使用示例：
// const fbxFilePath = 'path/to/your/model.fbx';

// parseFBX(fbxFilePath)
//   .then(data => {
//     console.log('Vertices:', data.vertices);
//     console.log('UVs:', data.uvs);
//     console.log('Indices:', data.indices);
//   })
//   .catch(error => {
//     console.error('An error occurred while parsing the FBX file:', error);
//   });