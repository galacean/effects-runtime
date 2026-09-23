import { BufferDataType } from './gpu-buffer';

/** Vertex attribute semantics and data type constants. */
export class VertexBuffer {
  static readonly PositionKind = 'aPos';
  static readonly NormalKind = 'aNormal';
  static readonly TangentKind = 'aTangent';
  static readonly UVKind = 'aUV';
  static readonly UV2Kind = 'aUV2';
  static readonly UV3Kind = 'aUV3';
  static readonly UV4Kind = 'aUV4';
  static readonly UV5Kind = 'aUV5';
  static readonly UV6Kind = 'aUV6';
  static readonly ColorKind = 'aColor';
  static readonly JointsKind = 'aJoints';
  static readonly WeightsKind = 'aWeights';

  static readonly BYTE = BufferDataType.Byte;
  static readonly UNSIGNED_BYTE = BufferDataType.UnsignedByte;
  static readonly SHORT = BufferDataType.Short;
  static readonly UNSIGNED_SHORT = BufferDataType.UnsignedShort;
  static readonly INT = BufferDataType.Int;
  static readonly UNSIGNED_INT = BufferDataType.UnsignedInt;
  static readonly FLOAT = BufferDataType.Float;
}
