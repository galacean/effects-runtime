import { curFileList, listFilesInDirectory } from '@advjs/gui/client/components/explorer/useAssetsExplorer';
import type { GeometryData } from '@galacean/effects';
import { DataType, generateUuid, glContext, loadImage } from '@galacean/effects';

export async function onFileDrop (files: File[], curDirHandle: FileSystemHandle) {
  const file = files[0];

  if (file.type === 'application/json') {
    importModelJson(file, curDirHandle);
  } else if (file.type === 'image/png') {
    importPng(file, curDirHandle);
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

async function saveFile (file: File, curDirHandle: FileSystemHandle) {
  // create a new handle
  //@ts-expect-error
  const newFileHandle = await curDirHandle.value?.getFileHandle(file.name, { create: true });

  if (!newFileHandle) { return; }

  // create a FileSystemWritableFileStream to write to
  const writableStream = await newFileHandle.createWritable();

  // write our file
  await writableStream.write(file);

  // close the file and write the contents to disk.
  await writableStream.close();
  //@ts-expect-error
  curFileList.value = await listFilesInDirectory(curDirHandle.value!, {
    showFiles: true,
  });
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

function importModelJson (file: File, curDirHandle: FileSystemHandle) {
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

function importPng (file: File, curDirHandle: FileSystemHandle) {
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