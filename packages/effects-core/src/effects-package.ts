import * as flatbuffers from 'flatbuffers';
import * as spec from '@galacean/effects-specification';
import {
  FBEffectsObjectDataT, FBEffectsPackageData, FBEffectsPackageDataT, FBGeometryData,
  FBGeometryDataT, FBSubMeshT, FBVertexChannelT, FBVertexDataT,
} from './__definations__';

interface FileSummary {
  assetType: string,
  guid: string,
}

/**
 * @since 2.0.0
 * @internal
 */
export class EffectsPackage {
  fileSummary: FileSummary;
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

      if (effectsObjectData.dataType === spec.DataType.Geometry) {
        fbEffectsObjectData = new FBEffectsObjectDataT(
          'Geometry',
          this.geometryDataToBinary(effectsObjectData as spec.GeometryData) as unknown as number[],
        );
      }

      if (!fbEffectsObjectData) {
        continue;
      }
      exportObjects.push(fbEffectsObjectData);
    }
    effectsPackage.exportObjects = exportObjects;

    FBEffectsPackageData.finishFBEffectsPackageDataBuffer(fbb, effectsPackage.pack(fbb));

    return fbb.asUint8Array(); // Of type `Uint8Array`.
  }

  deserializeFromBinary (buffer: Uint8Array) {
    const buf = new flatbuffers.ByteBuffer(buffer);
    const fbEffectsPackage = FBEffectsPackageData.getRootAsFBEffectsPackageData(buf);

    for (let i = 0; i < fbEffectsPackage.exportObjectsLength(); i++) {
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

      if (dataType === spec.DataType.Geometry) {
        effectsObjectData = this.binaryToGeometryData(dataBuffer);
      }

      if (!effectsObjectData) {
        continue;
      }
      this.exportObjectDatas.push(effectsObjectData);
    }
  }

  private geometryDataToBinary (geometryData: spec.GeometryData): Uint8Array {
    const fbb = new flatbuffers.Builder(1);
    const fbGeometryData = new FBGeometryDataT();
    const {
      indexFormat, indexOffset, mode, id, vertexData,
      boneNames = [],
      rootBoneName = '',
      inverseBindMatrices = [],
      binaryData = [],
    } = geometryData;

    fbGeometryData.indexFormat = indexFormat;
    fbGeometryData.indexOffset = indexOffset;
    fbGeometryData.mode = mode;
    fbGeometryData.id = id;
    fbGeometryData.boneNames = boneNames;
    fbGeometryData.rootBoneName = rootBoneName;
    fbGeometryData.inverseBindMatrices = inverseBindMatrices;
    fbGeometryData.binaryData = binaryData as unknown as number[];
    const fbVertexdata = new FBVertexDataT();

    fbVertexdata.vertexCount = vertexData.vertexCount;
    fbVertexdata.channels = [];
    for (const channel of vertexData.channels) {
      const { semantic, offset, format, dimension, normalize } = channel;
      const fbChannel = new FBVertexChannelT(
        semantic,
        offset,
        format,
        dimension,
        normalize,
      );

      fbVertexdata.channels.push(fbChannel);
    }
    fbGeometryData.vertexData = fbVertexdata;
    const fbSubMeshes = [];

    for (const subMesh of geometryData.subMeshes) {
      const { offset, indexCount, vertexCount } = subMesh;
      const fbSubMesh = new FBSubMeshT(
        offset,
        indexCount,
        vertexCount,
      );

      fbSubMeshes.push(fbSubMesh);
    }
    fbGeometryData.subMeshes = fbSubMeshes;

    FBEffectsPackageData.finishFBEffectsPackageDataBuffer(fbb, fbGeometryData.pack(fbb));

    return fbb.asUint8Array(); // Of type `Uint8Array`.
  }

  private binaryToGeometryData (buffer: Uint8Array): spec.GeometryData {
    const buf = new flatbuffers.ByteBuffer(buffer);
    const fbGeometryData = FBGeometryData.getRootAsFBGeometryData(buf);
    const vertexData: spec.VertexData = {
      vertexCount: 0,
      channels: [],
    };
    const fbVertexData = fbGeometryData.vertexData();

    if (fbVertexData) {
      vertexData.vertexCount = fbVertexData.vertexCount();

      for (let i = 0; i < fbVertexData.channelsLength(); i++) {
        const channel = fbVertexData.channels(i);

        if (!channel) {
          continue;
        }
        const vertexChannel: spec.VertexChannel = {
          semantic: channel.semantic() ?? '',
          offset: channel.offset(),
          format: channel.format(),
          dimension: channel.dimension(),
          normalize:channel.normalize(),
        };

        vertexData.channels.push(vertexChannel);
      }
    }

    const subMeshes: spec.SubMesh[] = [];

    for (let i = 0; i < fbGeometryData.subMeshesLength(); i++) {
      const fbSubMesh = fbGeometryData.subMeshes(i);

      if (!fbSubMesh) {
        continue;
      }
      const subMesh: spec.SubMesh = {
        offset: fbSubMesh.offset(),
        vertexCount: fbSubMesh.vertexCount(),
        indexCount: fbSubMesh.indexCount(),
      };

      subMeshes.push(subMesh);
    }

    const boneNames = [];

    for (let i = 0; i < fbGeometryData.boneNamesLength(); i++) {
      const boneName = fbGeometryData.boneNames(i);

      boneNames.push(boneName);
    }

    const inverseBindMatricesArray = fbGeometryData.inverseBindMatricesArray();
    const geometryData: spec.GeometryData = {
      vertexData,
      indexFormat: fbGeometryData.indexFormat(),
      indexOffset: fbGeometryData.indexOffset(),
      subMeshes,
      mode: fbGeometryData.mode(),
      buffer: fbGeometryData.buffer() ?? '',
      boneNames,
      rootBoneName: fbGeometryData.rootBoneName() ?? '',
      inverseBindMatrices: inverseBindMatricesArray ? Array.from(inverseBindMatricesArray) : undefined,
      binaryData: fbGeometryData.binaryDataArray() ?? undefined,
      id: fbGeometryData.id() ?? '',
      dataType: spec.DataType.Geometry,
    };

    return geometryData;
  }
}
