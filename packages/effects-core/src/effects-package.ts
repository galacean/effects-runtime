import type { SubMesh, VertexChannel, VertexData } from '@galacean/effects-specification';
import { DataType, type GeometryData } from '@galacean/effects-specification';
import * as flatbuffers from 'flatbuffers';
import type { spec } from '.';
import { FBEffectsObjectDataT, FBEffectsPackageData, FBEffectsPackageDataT, FBGeometryData, FBGeometryDataT, FBSubMeshT, FBVertexChannelT, FBVertexDataT } from './definations';

export class EffectsPackage {
  fileSummary: fileSummary;
  exportObjectDatas: spec.EffectsObjectData[] = [];

  addData (effectsObjectData: spec.EffectsObjectData) {
    this.exportObjectDatas.push(effectsObjectData);
  }

  serializeToBinary (): Uint8Array {
    const fbb = new flatbuffers.Builder(1);
    const effectsPackage = new FBEffectsPackageDataT();
    const exportObjects = [];

    for (const effectsObjectData of this.exportObjectDatas) {
      let fbEffectsObjectData;

      if (effectsObjectData.dataType === DataType.Geometry) {
        fbEffectsObjectData = new FBEffectsObjectDataT('Geometry', this.geometryDataToBinary(effectsObjectData as GeometryData) as unknown as number[]);
      }

      if (!fbEffectsObjectData) {
        continue;
      }
      exportObjects.push(fbEffectsObjectData);
    }
    effectsPackage.exportObjects = exportObjects;

    FBEffectsPackageData.finishFBEffectsPackageDataBuffer(fbb, effectsPackage.pack(fbb));
    const buffer = fbb.asUint8Array(); // Of type `Uint8Array`.

    return buffer;
  }

  deserializeFromBinary (buffer: Uint8Array) {
    const buf = new flatbuffers.ByteBuffer(buffer);
    const fbEffectsPackage = FBEffectsPackageData.getRootAsFBEffectsPackageData(buf);

    for (let i = 0;i < fbEffectsPackage.exportObjectsLength();i++) {
      const fbEffectsObjectData = fbEffectsPackage.exportObjects(i);

      if (!fbEffectsObjectData) {
        continue;
      }

      const dataBuffer = fbEffectsObjectData.dataArray();
      const dataType = fbEffectsObjectData.dataType();

      if (!dataBuffer) {
        continue;
      }
      let effectsObjectData;

      if (dataType === DataType.Geometry) {
        effectsObjectData = this.binaryToGeometryData(dataBuffer);
      }

      if (!effectsObjectData) {
        continue;
      }
      this.exportObjectDatas.push(effectsObjectData);
    }
  }

  private geometryDataToBinary (geometryData: GeometryData): Uint8Array {
    const fbb = new flatbuffers.Builder(1);
    const fbGeometryData = new FBGeometryDataT();

    fbGeometryData.buffer = geometryData.buffer;
    fbGeometryData.indexFormat = geometryData.indexFormat;
    fbGeometryData.indexOffset = geometryData.indexOffset;
    fbGeometryData.mode = geometryData.mode;
    fbGeometryData.buffer = geometryData.buffer;
    fbGeometryData.id = geometryData.id;
    fbGeometryData.boneNames = geometryData.boneNames ?? [];
    fbGeometryData.rootBoneName = geometryData.rootBoneName ?? '';
    fbGeometryData.inverseBindMatrices = geometryData.inverseBindMatrices ?? [];
    fbGeometryData.binaryData = geometryData.binaryData as unknown as number[] ?? [];
    const fbVertexdata = new FBVertexDataT();

    fbVertexdata.vertexCount = geometryData.vertexData.vertexCount;
    fbVertexdata.channels = [];
    for (const channel of geometryData.vertexData.channels) {
      const fbChannel = new FBVertexChannelT(
        channel.semantic,
        channel.offset,
        channel.format,
        channel.dimension,
        channel.normalize
      );

      fbVertexdata.channels.push(fbChannel);
    }
    fbGeometryData.vertexData = fbVertexdata;
    const fbSubMeshes = [];

    for (const subMesh of geometryData.subMeshes) {
      const fbSubMesh = new FBSubMeshT(
        subMesh.offset,
        subMesh.indexCount,
        subMesh.vertexCount
      );

      fbSubMeshes.push(fbSubMesh);
    }
    fbGeometryData.subMeshes = fbSubMeshes;

    FBEffectsPackageData.finishFBEffectsPackageDataBuffer(fbb, fbGeometryData.pack(fbb));

    const buffer = fbb.asUint8Array(); // Of type `Uint8Array`.

    return buffer;
  }

  private binaryToGeometryData (buffer: Uint8Array): GeometryData {
    const buf = new flatbuffers.ByteBuffer(buffer);
    const fbGeometryData = FBGeometryData.getRootAsFBGeometryData(buf);

    const vertexData: VertexData = {
      vertexCount: 0,
      channels: [],
    };
    const fbVertexData = fbGeometryData.vertexData();

    if (fbVertexData) {
      vertexData.vertexCount = fbVertexData.vertexCount();

      for (let i = 0;i < fbVertexData.channelsLength();i++) {
        const channel = fbVertexData.channels(i);

        if (!channel) {
          continue;
        }
        const vertexChannel: VertexChannel = {
          semantic: channel.semantic() ?? '',
          offset: channel.offset(),
          format: channel.format(),
          dimension: channel.dimension(),
        };

        vertexData.channels.push(vertexChannel);
      }
    }

    const subMeshes: spec.SubMesh[] = [];

    for (let i = 0;i < fbGeometryData.subMeshesLength();i++) {
      const fbSubMesh = fbGeometryData.subMeshes(i);

      if (!fbSubMesh) {
        continue;
      }
      const subMesh: SubMesh = {
        offset: fbSubMesh.offset(),
        vertexCount: fbSubMesh.vertexCount(),
      };

      subMeshes.push(subMesh);
    }

    const boneNames = [];

    for (let i = 0;i < fbGeometryData.boneNamesLength();i++) {
      const boneName = fbGeometryData.boneNames(i);

      boneNames.push(boneName);
    }
    const inverseBindMatricesArray = fbGeometryData.inverseBindMatricesArray();

    const geometryData: GeometryData = {
      vertexData: vertexData,
      indexFormat: fbGeometryData.indexFormat(),
      indexOffset: fbGeometryData.indexOffset(),
      subMeshes: subMeshes,
      mode: fbGeometryData.mode(),
      buffer: fbGeometryData.buffer() ?? '',
      boneNames: boneNames,
      rootBoneName: fbGeometryData.rootBoneName() ?? '',
      inverseBindMatrices: inverseBindMatricesArray ? Array.from(inverseBindMatricesArray) : undefined,
      binaryData: fbGeometryData.binaryDataArray() ?? undefined,
      id: fbGeometryData.id() ?? '',
      dataType: DataType.Geometry,
    };

    return geometryData;
  }
}

interface fileSummary {
  assetType: string,
  guid: string,
}