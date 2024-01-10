import { curFileList, listFilesInDirectory } from '@advjs/gui/client/components/explorer/useAssetsExplorer';
import type { GeometryData } from '@galacean/effects';
import { DataType, generateUuid } from '@galacean/effects';

export async function onFileDrop (files: File[], curDirHandle: FileSystemHandle) {
  // console.log(files[0]).
  //   await saveFile(files[0], curDirHandle);

  const file = files[0];
  // 创建一个FileReader实例
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

function createJsonFile (content: string, fileName: string) {
  // 将字符串转换为Blob
  const newBlob = new Blob([content], { type: 'application/json' });

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
  const res: GeometryData = { id: generateUuid(), dataType: DataType.Geometry };

  res.vertices = vertices;
  res.uvs = uvs;
  res.indices = indices;

  return JSON.stringify({ exportObjects: [res] });
}