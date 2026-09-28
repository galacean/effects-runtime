/** Standard vertex semantics. Values retain the existing shader attribute names. */
export enum VertexElementType {
  Position = 'aPos',
  Normal = 'aNormal',
  Tangent = 'aTangent',
  TexCoord0 = 'aUV',
  TexCoord1 = 'aUV2',
  TexCoord2 = 'aUV3',
  TexCoord3 = 'aUV4',
  TexCoord4 = 'aUV5',
  TexCoord5 = 'aUV6',
  Color = 'aColor',
  BlendIndices = 'aJoints',
  BlendWeights = 'aWeights',
}
