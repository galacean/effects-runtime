import { LOG_TYPE } from '../config';
import type { Texture2DSourceOptionsCompressed, TextureDataType } from './types';
import { TextureSourceType } from './types';
import { glContext } from '../gl';

const HEADER_LEN = 12 + 13 * 4; // identifier + header elements (not including key value meta-data pairs)
const COMPRESSED_2D = 0; // uses a gl.compressedTexImage2D()
//const COMPRESSED_3D = 1; // uses a gl.compressedTexImage3D()
const TEX_2D = 2; // uses a gl.texImage2D()

//const TEX_3D = 3; // uses a gl.texImage3D()
export class KTXTexture {
  glType: number;
  glTypeSize: number;
  glFormat: number;
  glInternalFormat: number;
  glBaseInternalFormat: number;
  pixelWidth: number;
  pixelHeight: number;
  loadType: number;
  pixelDepth: number;
  numberOfArrayElements: number;
  numberOfFaces: number;
  numberOfMipmapLevels: number;
  bytesOfKeyValueData: number;

  constructor (
    private readonly arrayBuffer: ArrayBuffer,
    facesExpected: number,
    private readonly baseOffset = 0,
  ) {
    // Test that it is a ktx formatted file, based on the first 12 bytes, character representation is:
    // '´', 'K', 'T', 'X', ' ', '1', '1', 'ª', '\r', '\n', '\x1A', '\n'
    // 0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
    const identifier = new Uint8Array(this.arrayBuffer, this.baseOffset, 12);

    if (
      identifier[0] !== 0xab ||
      identifier[1] !== 0x4b ||
      identifier[2] !== 0x54 ||
      identifier[3] !== 0x58 ||
      identifier[4] !== 0x20 ||
      identifier[5] !== 0x31 ||
      identifier[6] !== 0x31 ||
      identifier[7] !== 0xbb ||
      identifier[8] !== 0x0d ||
      identifier[9] !== 0x0a ||
      identifier[10] !== 0x1a ||
      identifier[11] !== 0x0a
    ) {
      throw Error('texture missing KTX identifier');
    }

    // load the reset of the header in native 32 bit uint
    const dataSize = Uint32Array.BYTES_PER_ELEMENT;
    const headerDataView = new DataView(this.arrayBuffer, this.baseOffset + 12, 13 * dataSize);
    const endianness = headerDataView.getUint32(0, true);
    const littleEndian = endianness === 0x04030201;

    this.glType = headerDataView.getUint32(1 * dataSize, littleEndian); // must be 0 for compressed textures
    this.glTypeSize = headerDataView.getUint32(2 * dataSize, littleEndian); // must be 1 for compressed textures
    this.glFormat = headerDataView.getUint32(3 * dataSize, littleEndian); // must be 0 for compressed textures
    this.glInternalFormat = headerDataView.getUint32(4 * dataSize, littleEndian); // the value of arg passed to gl.compressedTexImage2D(,,x,,,,)
    this.glBaseInternalFormat = headerDataView.getUint32(5 * dataSize, littleEndian); // specify GL_RGB, GL_RGBA, GL_ALPHA, etc (un-compressed only)
    this.pixelWidth = headerDataView.getUint32(6 * dataSize, littleEndian); // level 0 value of arg passed to gl.compressedTexImage2D(,,,x,,,)
    this.pixelHeight = headerDataView.getUint32(7 * dataSize, littleEndian); // level 0 value of arg passed to gl.compressedTexImage2D(,,,,x,,)
    this.pixelDepth = headerDataView.getUint32(8 * dataSize, littleEndian); // level 0 value of arg passed to gl.compressedTexImage3D(,,,,,x,,)
    this.numberOfArrayElements = headerDataView.getUint32(9 * dataSize, littleEndian); // used for texture arrays
    this.numberOfFaces = headerDataView.getUint32(10 * dataSize, littleEndian); // used for cubemap textures, should either be 1 or 6
    this.numberOfMipmapLevels = headerDataView.getUint32(11 * dataSize, littleEndian); // number of levels; disregard possibility of 0 for compressed textures
    this.bytesOfKeyValueData = headerDataView.getUint32(12 * dataSize, littleEndian); // the amount of space after the header for meta-data

    // value of zero is an indication to generate mipmaps @ runtime.  Not usually allowed for compressed, so disregard.
    this.numberOfMipmapLevels = Math.max(1, this.numberOfMipmapLevels);

    if (this.pixelHeight === 0 || this.pixelDepth !== 0) {
      console.warn({
        content: 'only 2D textures currently supported',
        type: LOG_TYPE,
      });

      return;
    }
    if (this.numberOfArrayElements !== 0) {
      console.warn({
        content: 'texture arrays not currently supported',
        type: LOG_TYPE,
      });

      return;
    }
    if (this.numberOfFaces !== facesExpected) {
      console.warn({
        content: 'number of faces expected' + facesExpected + ', but found ' + this.numberOfFaces,
        type: LOG_TYPE,
      });

      return;
    }
    // we now have a completely validated file, so could use existence of loadType as success
    // would need to make this more elaborate & adjust checks above to support more than one load type
    if (this.glType === 0) {
      this.loadType = COMPRESSED_2D;
    } else {
      this.loadType = TEX_2D;
    }
  }

  mipmaps (loadMipmaps: boolean): TextureDataType[] {
    const mipmaps: TextureDataType[] = [];
    // initialize width & height for level 1
    let dataOffset = HEADER_LEN + this.bytesOfKeyValueData;
    let width = this.pixelWidth;
    let height = this.pixelHeight;
    const mipmapCount = loadMipmaps ? this.numberOfMipmapLevels : 1;

    for (let level = 0; level < mipmapCount; level++) {
      const imageSize = new Int32Array(this.arrayBuffer, this.baseOffset + dataOffset, 1)[0]; // size per face, since not supporting array cubemaps

      for (let face = 0; face < this.numberOfFaces; face++) {
        const data = new Uint8Array(this.arrayBuffer, this.baseOffset + dataOffset + 4, imageSize);

        mipmaps.push({
          data,
          width,
          height,
        });

        dataOffset += imageSize + 4; // size of the image + 4 for the imageSize field
        dataOffset += 3 - ((imageSize + 3) % 4); // add padding for odd sized image
      }
      width = Math.max(1.0, width * 0.5);
      height = Math.max(1.0, height * 0.5);
    }

    return mipmaps;
  }
}

export function getKTXTextureOptions (data: ArrayBuffer): Texture2DSourceOptionsCompressed {
  const tex = new KTXTexture(data, 1);
  const { numberOfMipmapLevels, pixelWidth, pixelHeight, glType, numberOfFaces, glInternalFormat, glFormat } = tex;
  const useMipmaps = numberOfMipmapLevels >= Math.floor(Math.log2(Math.max(pixelWidth, pixelHeight)) + 1);

  return {
    sourceType: TextureSourceType.compressed,
    type: glType,
    target: numberOfFaces === 6 ? glContext.TEXTURE_CUBE_MAP : glContext.TEXTURE_2D,
    internalFormat: glInternalFormat,
    format: glFormat,
    mipmaps: tex.mipmaps(useMipmaps),
  };
}
