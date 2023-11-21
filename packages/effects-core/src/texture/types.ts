import type * as spec from '@galacean/effects-specification';

type DataRange = [start: number, length: number];
type ImageSource = HTMLImageElement | HTMLCanvasElement;

export enum TextureLoadAction {
  whatever = 0,
  //preserve previous attachment
  //load = 1,
  //clear attachment
  clear = 2,
}

export enum TextureSourceType {
  none = 0,
  data = 1,
  image = 2,
  compressed = 3,
  video = 4,
  canvas = 5,
  framebuffer = 6,
  mipmaps = 7
}

export type TextureSourceCubeData = [
  TEXTURE_CUBE_MAP_POSITIVE_X: ImageSource | { data: spec.TypedArray, width: number, height: number },
  TEXTURE_CUBE_MAP_NEGATIVE_X: ImageSource | { data: spec.TypedArray, width: number, height: number },
  TEXTURE_CUBE_MAP_POSITIVE_Y: ImageSource | { data: spec.TypedArray, width: number, height: number },
  TEXTURE_CUBE_MAP_NEGATIVE_Y: ImageSource | { data: spec.TypedArray, width: number, height: number },
  TEXTURE_CUBE_MAP_POSITIVE_Z: ImageSource | { data: spec.TypedArray, width: number, height: number },
  TEXTURE_CUBE_MAP_NEGATIVE_Z: ImageSource | { data: spec.TypedArray, width: number, height: number }
];

export type TextureCubeSourceURLMap = [
  TEXTURE_CUBE_MAP_POSITIVE_X: string,
  TEXTURE_CUBE_MAP_NEGATIVE_X: string,
  TEXTURE_CUBE_MAP_POSITIVE_Y: string,
  TEXTURE_CUBE_MAP_NEGATIVE_Y: string,
  TEXTURE_CUBE_MAP_POSITIVE_Z: string,
  TEXTURE_CUBE_MAP_NEGATIVE_Z: string
];

export type TextureFactorySource2DBinaryMipmapsFrom = {
  target?: WebGLRenderingContext['TEXTURE_2D'],
  type: TextureSourceType.mipmaps,
  bin: string,
  mipmaps: DataRange[],
};

export type TextureFactorySourceCubeBinaryMipmapsFrom = {
  target: WebGLRenderingContext['TEXTURE_CUBE_MAP'],
  type: TextureSourceType.mipmaps,
  bin: string,
  mipmaps: [
    TEXTURE_CUBE_MAP_POSITIVE_X: DataRange,
    TEXTURE_CUBE_MAP_NEGATIVE_X: DataRange,
    TEXTURE_CUBE_MAP_POSITIVE_Y: DataRange,
    TEXTURE_CUBE_MAP_NEGATIVE_Y: DataRange,
    TEXTURE_CUBE_MAP_POSITIVE_Z: DataRange,
    TEXTURE_CUBE_MAP_NEGATIVE_Z: DataRange
  ][],
};

export interface TextureFactorySource2DFrom {
  type: TextureSourceType.image | TextureSourceType.video,
  url: string,
  target?: WebGLRenderingContext['TEXTURE_2D'],
}

export type TextureFactorySourceCubeFrom = {
  type: TextureSourceType.image,
  map: TextureCubeSourceURLMap | string[],
  target: WebGLRenderingContext['TEXTURE_CUBE_MAP'],
};

export interface TextureFactorySourceCubeMipmapsFrom {
  type: TextureSourceType.mipmaps,
  target: WebGLRenderingContext['TEXTURE_CUBE_MAP'],
  maps: TextureCubeSourceURLMap[] | string[][],
}

export interface TextureFactorySource2DMipmapsFrom {
  type: TextureSourceType.mipmaps,
  target?: WebGLRenderingContext['TEXTURE_2D'],
  urls: string[],
}

export interface TextureFactorySourceFromCompressed {
  type: TextureSourceType.compressed,
  url: string,

  // TODO 临时添加，通过下层setTexture类型检查，考虑该类型是否需要target。
  target?: number,
}

export type TextureFactorySourceFrom =
  | TextureFactorySource2DBinaryMipmapsFrom
  | TextureFactorySourceCubeBinaryMipmapsFrom
  | TextureFactorySource2DFrom
  | TextureFactorySourceCubeFrom
  | TextureFactorySourceCubeMipmapsFrom
  | TextureFactorySource2DMipmapsFrom
  | TextureFactorySourceFromCompressed;

export interface TextureConfigOptions extends spec.TextureConfigOptionsBase {
  sourceFrom?: TextureFactorySourceFrom,
}

export interface TextureOptionsBase extends TextureConfigOptions, spec.TextureFormatOptions {
}

export interface TextureCubeSourceOptionsImage extends TextureOptionsBase {
  sourceType: TextureSourceType.image | TextureSourceType.data,
  target: WebGLRenderingContext['TEXTURE_CUBE_MAP'],
  cube: TextureSourceCubeData,
}

export interface TextureCubeSourceOptionsImageMipmaps extends TextureOptionsBase {
  sourceType?: TextureSourceType.mipmaps,
  mipmaps: TextureSourceCubeData[],
  target: WebGLRenderingContext['TEXTURE_CUBE_MAP'],
}

export type TextureCubeSourceOptions = TextureCubeSourceOptionsImage | TextureCubeSourceOptionsImageMipmaps;

export type TextureDataType = {
  data: spec.TypedArray,
  width: number,
  height: number,
};

export interface Texture2DSourceOptionsImage extends TextureOptionsBase {
  sourceType?: TextureSourceType.image,
  image: ImageSource,
  target?: WebGLRenderingContext['TEXTURE_2D'],
  generateMipmap?: boolean,
}

export interface Texture2DSourceOptionsData extends TextureOptionsBase {
  sourceType?: TextureSourceType.data,
  data: TextureDataType,
  target?: WebGLRenderingContext['TEXTURE_2D'],
}

export interface Texture2DSourceOptionsVideo extends TextureOptionsBase {
  sourceType?: TextureSourceType.video,
  video: HTMLVideoElement,
  target?: WebGLRenderingContext['TEXTURE_2D'],
  generateMipmap?: boolean,
}

export interface Texture2DSourceOptionsImageMipmaps extends TextureOptionsBase {
  sourceType?: TextureSourceType.mipmaps,
  mipmaps: (ImageSource | TextureDataType)[],
  target?: WebGLRenderingContext['TEXTURE_2D'],
}

export interface Texture2DSourceOptionsCompressed extends TextureOptionsBase {
  sourceType?: TextureSourceType.compressed,
  mipmaps: TextureDataType[],
  target?: WebGLRenderingContext['TEXTURE_2D'] | WebGLRenderingContext['TEXTURE_CUBE_MAP'],
}

export interface Texture2DSourceOptionsFrameBuffer extends TextureOptionsBase {
  sourceType: TextureSourceType.framebuffer,
  data?: { width: number, height: number },
  target?: WebGLRenderingContext['TEXTURE_2D'],
}

export interface Texture2DSourceOptionsNone extends TextureOptionsBase {
  sourceType?: TextureSourceType.none,
  target?: GLenum,
}

export type Texture2DSourceOptions =
  | Texture2DSourceOptionsImage
  | Texture2DSourceOptionsData
  | Texture2DSourceOptionsVideo
  | Texture2DSourceOptionsImageMipmaps
  | Texture2DSourceOptionsCompressed
  | Texture2DSourceOptionsFrameBuffer
  | Texture2DSourceOptionsNone;

// TODO texture的options太复杂，需要精简，构造函数很多参数传进去后没有给对象赋值，导致获取不到真实值（比如width和height）
export type TextureSourceOptions = Texture2DSourceOptions | TextureCubeSourceOptions;
