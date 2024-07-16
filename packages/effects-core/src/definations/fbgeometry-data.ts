// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';

import type { FBSubMeshT } from './fbsub-mesh.js';
import { FBSubMesh } from './fbsub-mesh.js';
import type { FBVertexDataT } from './fbvertex-data.js';
import { FBVertexData } from './fbvertex-data.js';

export class FBGeometryData implements flatbuffers.IUnpackableObject<FBGeometryDataT> {
  bb: flatbuffers.ByteBuffer | null = null;
  bb_pos = 0;
  __init (i: number, bb: flatbuffers.ByteBuffer): FBGeometryData {
    this.bb_pos = i;
    this.bb = bb;

    return this;
  }

  static getRootAsFBGeometryData (bb: flatbuffers.ByteBuffer, obj?: FBGeometryData): FBGeometryData {
    return (obj || new FBGeometryData()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }

  static getSizePrefixedRootAsFBGeometryData (bb: flatbuffers.ByteBuffer, obj?: FBGeometryData): FBGeometryData {
    bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);

    return (obj || new FBGeometryData()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
  }

  id (): string | null;
  id (optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
  id (optionalEncoding?: any): string | Uint8Array | null {
    const offset = this.bb!.__offset(this.bb_pos, 4);

    return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
  }

  name (): string | null;
  name (optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
  name (optionalEncoding?: any): string | Uint8Array | null {
    const offset = this.bb!.__offset(this.bb_pos, 6);

    return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
  }

  vertexData (obj?: FBVertexData): FBVertexData | null {
    const offset = this.bb!.__offset(this.bb_pos, 8);

    return offset ? (obj || new FBVertexData()).__init(this.bb!.__indirect(this.bb_pos + offset), this.bb!) : null;
  }

  indexFormat (): number {
    const offset = this.bb!.__offset(this.bb_pos, 10);

    return offset ? this.bb!.readInt32(this.bb_pos + offset) : 0;
  }

  indexOffset (): number {
    const offset = this.bb!.__offset(this.bb_pos, 12);

    return offset ? this.bb!.readInt32(this.bb_pos + offset) : 0;
  }

  subMeshes (index: number, obj?: FBSubMesh): FBSubMesh | null {
    const offset = this.bb!.__offset(this.bb_pos, 14);

    return offset ? (obj || new FBSubMesh()).__init(this.bb!.__indirect(this.bb!.__vector(this.bb_pos + offset) + index * 4), this.bb!) : null;
  }

  subMeshesLength (): number {
    const offset = this.bb!.__offset(this.bb_pos, 14);

    return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
  }

  mode (): number {
    const offset = this.bb!.__offset(this.bb_pos, 16);

    return offset ? this.bb!.readInt32(this.bb_pos + offset) : 0;
  }

  buffer (): string | null;
  buffer (optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
  buffer (optionalEncoding?: any): string | Uint8Array | null {
    const offset = this.bb!.__offset(this.bb_pos, 18);

    return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
  }

  binaryData (index: number): number | null {
    const offset = this.bb!.__offset(this.bb_pos, 20);

    return offset ? this.bb!.readUint8(this.bb!.__vector(this.bb_pos + offset) + index) : 0;
  }

  binaryDataLength (): number {
    const offset = this.bb!.__offset(this.bb_pos, 20);

    return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
  }

  binaryDataArray (): Uint8Array | null {
    const offset = this.bb!.__offset(this.bb_pos, 20);

    return offset ? new Uint8Array(this.bb!.bytes().buffer, this.bb!.bytes().byteOffset + this.bb!.__vector(this.bb_pos + offset), this.bb!.__vector_len(this.bb_pos + offset)) : null;
  }

  boneNames (index: number): string;
  boneNames (index: number, optionalEncoding: flatbuffers.Encoding): string | Uint8Array;
  boneNames (index: number, optionalEncoding?: any): string | Uint8Array | null {
    const offset = this.bb!.__offset(this.bb_pos, 22);

    return offset ? this.bb!.__string(this.bb!.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
  }

  boneNamesLength (): number {
    const offset = this.bb!.__offset(this.bb_pos, 22);

    return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
  }

  rootBoneName (): string | null;
  rootBoneName (optionalEncoding: flatbuffers.Encoding): string | Uint8Array | null;
  rootBoneName (optionalEncoding?: any): string | Uint8Array | null {
    const offset = this.bb!.__offset(this.bb_pos, 24);

    return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
  }

  inverseBindMatrices (index: number): number | null {
    const offset = this.bb!.__offset(this.bb_pos, 26);

    return offset ? this.bb!.readFloat32(this.bb!.__vector(this.bb_pos + offset) + index * 4) : 0;
  }

  inverseBindMatricesLength (): number {
    const offset = this.bb!.__offset(this.bb_pos, 26);

    return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
  }

  inverseBindMatricesArray (): Float32Array | null {
    const offset = this.bb!.__offset(this.bb_pos, 26);

    return offset ? new Float32Array(this.bb!.bytes().buffer, this.bb!.bytes().byteOffset + this.bb!.__vector(this.bb_pos + offset), this.bb!.__vector_len(this.bb_pos + offset)) : null;
  }

  static startFBGeometryData (builder: flatbuffers.Builder) {
    builder.startObject(12);
  }

  static addId (builder: flatbuffers.Builder, idOffset: flatbuffers.Offset) {
    builder.addFieldOffset(0, idOffset, 0);
  }

  static addName (builder: flatbuffers.Builder, nameOffset: flatbuffers.Offset) {
    builder.addFieldOffset(1, nameOffset, 0);
  }

  static addVertexData (builder: flatbuffers.Builder, vertexDataOffset: flatbuffers.Offset) {
    builder.addFieldOffset(2, vertexDataOffset, 0);
  }

  static addIndexFormat (builder: flatbuffers.Builder, indexFormat: number) {
    builder.addFieldInt32(3, indexFormat, 0);
  }

  static addIndexOffset (builder: flatbuffers.Builder, indexOffset: number) {
    builder.addFieldInt32(4, indexOffset, 0);
  }

  static addSubMeshes (builder: flatbuffers.Builder, subMeshesOffset: flatbuffers.Offset) {
    builder.addFieldOffset(5, subMeshesOffset, 0);
  }

  static createSubMeshesVector (builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset {
    builder.startVector(4, data.length, 4);
    for (let i = data.length - 1; i >= 0; i--) {
      builder.addOffset(data[i]);
    }

    return builder.endVector();
  }

  static startSubMeshesVector (builder: flatbuffers.Builder, numElems: number) {
    builder.startVector(4, numElems, 4);
  }

  static addMode (builder: flatbuffers.Builder, mode: number) {
    builder.addFieldInt32(6, mode, 0);
  }

  static addBuffer (builder: flatbuffers.Builder, bufferOffset: flatbuffers.Offset) {
    builder.addFieldOffset(7, bufferOffset, 0);
  }

  static addBinaryData (builder: flatbuffers.Builder, binaryDataOffset: flatbuffers.Offset) {
    builder.addFieldOffset(8, binaryDataOffset, 0);
  }

  static createBinaryDataVector (builder: flatbuffers.Builder, data: number[] | Uint8Array): flatbuffers.Offset {
    builder.startVector(1, data.length, 1);
    for (let i = data.length - 1; i >= 0; i--) {
      builder.addInt8(data[i]);
    }

    return builder.endVector();
  }

  static startBinaryDataVector (builder: flatbuffers.Builder, numElems: number) {
    builder.startVector(1, numElems, 1);
  }

  static addBoneNames (builder: flatbuffers.Builder, boneNamesOffset: flatbuffers.Offset) {
    builder.addFieldOffset(9, boneNamesOffset, 0);
  }

  static createBoneNamesVector (builder: flatbuffers.Builder, data: flatbuffers.Offset[]): flatbuffers.Offset {
    builder.startVector(4, data.length, 4);
    for (let i = data.length - 1; i >= 0; i--) {
      builder.addOffset(data[i]);
    }

    return builder.endVector();
  }

  static startBoneNamesVector (builder: flatbuffers.Builder, numElems: number) {
    builder.startVector(4, numElems, 4);
  }

  static addRootBoneName (builder: flatbuffers.Builder, rootBoneNameOffset: flatbuffers.Offset) {
    builder.addFieldOffset(10, rootBoneNameOffset, 0);
  }

  static addInverseBindMatrices (builder: flatbuffers.Builder, inverseBindMatricesOffset: flatbuffers.Offset) {
    builder.addFieldOffset(11, inverseBindMatricesOffset, 0);
  }

  static createInverseBindMatricesVector (builder: flatbuffers.Builder, data: number[] | Float32Array): flatbuffers.Offset;
  /**
 * @deprecated This Uint8Array overload will be removed in the future.
 */
  static createInverseBindMatricesVector (builder: flatbuffers.Builder, data: number[] | Uint8Array): flatbuffers.Offset;
  static createInverseBindMatricesVector (builder: flatbuffers.Builder, data: number[] | Float32Array | Uint8Array): flatbuffers.Offset {
    builder.startVector(4, data.length, 4);
    for (let i = data.length - 1; i >= 0; i--) {
      builder.addFloat32(data[i]);
    }

    return builder.endVector();
  }

  static startInverseBindMatricesVector (builder: flatbuffers.Builder, numElems: number) {
    builder.startVector(4, numElems, 4);
  }

  static endFBGeometryData (builder: flatbuffers.Builder): flatbuffers.Offset {
    const offset = builder.endObject();

    return offset;
  }

  unpack (): FBGeometryDataT {
    return new FBGeometryDataT(
      this.id(),
      this.name(),
      (this.vertexData() !== null ? this.vertexData()!.unpack() : null),
      this.indexFormat(),
      this.indexOffset(),
      this.bb!.createObjList<FBSubMesh, FBSubMeshT>(this.subMeshes.bind(this), this.subMeshesLength()),
      this.mode(),
      this.buffer(),
      this.bb!.createScalarList<number>(this.binaryData.bind(this), this.binaryDataLength()),
      this.bb!.createScalarList<string>(this.boneNames.bind(this), this.boneNamesLength()),
      this.rootBoneName(),
      this.bb!.createScalarList<number>(this.inverseBindMatrices.bind(this), this.inverseBindMatricesLength())
    );
  }

  unpackTo (_o: FBGeometryDataT): void {
    _o.id = this.id();
    _o.name = this.name();
    _o.vertexData = (this.vertexData() !== null ? this.vertexData()!.unpack() : null);
    _o.indexFormat = this.indexFormat();
    _o.indexOffset = this.indexOffset();
    _o.subMeshes = this.bb!.createObjList<FBSubMesh, FBSubMeshT>(this.subMeshes.bind(this), this.subMeshesLength());
    _o.mode = this.mode();
    _o.buffer = this.buffer();
    _o.binaryData = this.bb!.createScalarList<number>(this.binaryData.bind(this), this.binaryDataLength());
    _o.boneNames = this.bb!.createScalarList<string>(this.boneNames.bind(this), this.boneNamesLength());
    _o.rootBoneName = this.rootBoneName();
    _o.inverseBindMatrices = this.bb!.createScalarList<number>(this.inverseBindMatrices.bind(this), this.inverseBindMatricesLength());
  }
}

export class FBGeometryDataT implements flatbuffers.IGeneratedObject {
  constructor (
    public id: string | Uint8Array | null = null,
    public name: string | Uint8Array | null = null,
    public vertexData: FBVertexDataT | null = null,
    public indexFormat: number = 0,
    public indexOffset: number = 0,
    public subMeshes: (FBSubMeshT)[] = [],
    public mode: number = 0,
    public buffer: string | Uint8Array | null = null,
    public binaryData: (number)[] = [],
    public boneNames: (string)[] = [],
    public rootBoneName: string | Uint8Array | null = null,
    public inverseBindMatrices: (number)[] = []
  ) {}

  pack (builder: flatbuffers.Builder): flatbuffers.Offset {
    const id = (this.id !== null ? builder.createString(this.id) : 0);
    const name = (this.name !== null ? builder.createString(this.name) : 0);
    const vertexData = (this.vertexData !== null ? this.vertexData.pack(builder) : 0);
    const subMeshes = FBGeometryData.createSubMeshesVector(builder, builder.createObjectOffsetList(this.subMeshes));
    const buffer = (this.buffer !== null ? builder.createString(this.buffer) : 0);
    const binaryData = FBGeometryData.createBinaryDataVector(builder, this.binaryData);
    const boneNames = FBGeometryData.createBoneNamesVector(builder, builder.createObjectOffsetList(this.boneNames));
    const rootBoneName = (this.rootBoneName !== null ? builder.createString(this.rootBoneName) : 0);
    const inverseBindMatrices = FBGeometryData.createInverseBindMatricesVector(builder, this.inverseBindMatrices);

    FBGeometryData.startFBGeometryData(builder);
    FBGeometryData.addId(builder, id);
    FBGeometryData.addName(builder, name);
    FBGeometryData.addVertexData(builder, vertexData);
    FBGeometryData.addIndexFormat(builder, this.indexFormat);
    FBGeometryData.addIndexOffset(builder, this.indexOffset);
    FBGeometryData.addSubMeshes(builder, subMeshes);
    FBGeometryData.addMode(builder, this.mode);
    FBGeometryData.addBuffer(builder, buffer);
    FBGeometryData.addBinaryData(builder, binaryData);
    FBGeometryData.addBoneNames(builder, boneNames);
    FBGeometryData.addRootBoneName(builder, rootBoneName);
    FBGeometryData.addInverseBindMatrices(builder, inverseBindMatrices);

    return FBGeometryData.endFBGeometryData(builder);
  }
}
