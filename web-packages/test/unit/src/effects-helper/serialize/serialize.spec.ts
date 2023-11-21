// @ts-nocheck
import { loadImage, getDefaultTextureFactory, TextureSourceType } from '@galacean/effects';
import { serializeTextures, serializeGeometries, deserializeGeometry, concatArrayBuffers, typedArrayFromBinary } from '@galacean/effects-helper';

const { expect } = chai;

const cube1 = {
  type: TextureSourceType.image,
  target: WebGLRenderingContext.TEXTURE_CUBE_MAP,
  map: [
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posx_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negx_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posy_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negy_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posz_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negz_6_4x4.jpg',
  ],
};
const cube2 = {
  type: TextureSourceType.mipmaps,
  target: WebGLRenderingContext.TEXTURE_CUBE_MAP,
  maps: [[
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posx_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negx_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posy_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negy_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posz_6_4x4.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negz_6_4x4.jpg',
  ], [
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posx_7_2x2.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negx_7_2x2.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posy_7_2x2.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negy_7_2x2.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_posz_7_2x2.jpg',
    'https://gw.alipayobjects.com/zos/gltf-asset/66768539337973/specular_negz_7_2x2.jpg',
  ]],
};

describe('serialize', () => {
  it('serialize geometry props', () => {
    const aPoint = new Float32Array([1, 2, 3, 4]);
    const aIndex = new Uint8Array([0, 1, 2, 2, 3, 0]);
    const geometryProps = {
      attributes: {
        aPoint: {
          data: aPoint,
          size: 4,
        },
        aTex: {
          dataSource: 'aPoint',
          offset: 2,
          size: 2,
        },
      },
      drawCount: 1,
      drawStart: 2,
      mode: 6,
      indices: { data: aIndex, releasable: true },
    };
    const result = serializeGeometries([geometryProps]);

    expect(geometryProps.indices).to.deep.equals({ data: aIndex, releasable: true });
    expect(geometryProps.attributes.aPoint).to.deep.equals({ data: aPoint, size: 4 });
    expect(result.version).to.eql('1.0');
    expect(result.data.byteLength).to.eql(aPoint.byteLength + padding4(aIndex.byteLength));

    const geometry = result.geometries[0];

    expect(geometry).to.contains({
      drawCount: 1,
      drawStart: 2,
      mode: 6,
    });
    expect(geometry.indices).to.deep.equals({ releasable: true, data: [20, [0, 0, aIndex.byteLength, 'u8']] });
    expect(geometry.attributes).to.deep.equals({
      aPoint: {
        data: [20, [0, padding4(aIndex.byteLength), aPoint.byteLength, 'f32']], // [20,[0,8,16,'f32']]
        size: 4,
      },
      aTex: {
        dataSource: 'aPoint',
        offset: 2,
        size: 2,
      },
    });

    const deserializedOptions = deserializeGeometry(result.geometries[0], [result.data]);

    expect(deserializedOptions).to.deep.equals(geometryProps);
  });

  it('geometry combine same data', function () {
    const aPoint = new Float32Array([1, 2, 3, 4]);
    const aIndex = new Uint8Array([0, 1, 2, 2, 3, 0]);
    const geometryOptions = {
      attributes: {
        aPoint: {
          data: aPoint,
          size: 4,
        },
      },
      drawCount: 1,
      drawStart: 2,
      mode: 6,
      indices: { data: aIndex, releasable: true },
    };

    const result = serializeGeometries([geometryOptions, geometryOptions]);

    expect(geometryOptions.indices).to.deep.equals({ data: aIndex, releasable: true });
    expect(geometryOptions.attributes.aPoint).to.deep.equals({
      data: aPoint,
      size: 4,
    });
    expect(result.data.byteLength).to.eql(aPoint.byteLength + padding4(aIndex.byteLength));

    const geo0 = deserializeGeometry(result.geometries[0], [result.data]);
    const geo1 = deserializeGeometry(result.geometries[1], [result.data]);

    expect(geo0.indices.data.buffer).to.eql(geo1.indices.data.buffer);
    expect(geo0.indices.data).to.deep.equals(geo1.indices.data);
    expect(geo0.indices.data == geo1.indices.data).to.be.false;
  });

  it('serialize 2D texture source from', async () => {
    const textureOptions = {
      sourceFrom: {
        url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*nTluS753DssAAAAAAAAAAAAAARQnAQ',
        type: 2,
      },
      image: null,
    };
    const result = await serializeTextures([textureOptions]);

    expect(result.images.length).to.eql(1);
    expect(result.images[0]).to.be.instanceof(ArrayBuffer);
    expect(result.textures[0]).to.deep.equals({ source: 0 });
  });

  it('serialize 2D texture image', async () => {
    const options = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*nTluS753DssAAAAAAAAAAAAAARQnAQ',
    }, { flipY: true });

    delete options.sourceFrom;
    const result = await serializeTextures([options]);

    expect(result.images.length).to.eql(1);
    expect(result.images[0]).to.be.instanceof(ArrayBuffer);
    expect(result.textures[0]).to.deep.equals({ source: 0, sourceType: TextureSourceType.image, flipY: true });
  });

  it('serialize multiple textures options', async () => {
    const image = await loadImage('https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*nTluS753DssAAAAAAAAAAAAAARQnAQ');
    const options = { flipY: true, image };
    const options1 = { minFilter: WebGLRenderingContext.NEAREST, image };
    const result = await serializeTextures([options, options1]);

    expect(result.images.length).to.eql(1);
    expect(result.images[0]).to.be.instanceof(ArrayBuffer);
    expect(result.textures[0]).to.deep.equals({ source: 0, flipY: true });
    expect(result.textures[1]).to.deep.equals({ source: 0, minFilter: WebGLRenderingContext.NEAREST });
  });

  it('concat buffers without pointers remap', () => {
    const buffer0 = new Float32Array([1, 2, 3]);
    const buffer1 = new Float32Array([4, 5, 6]);
    const buffer2 = new Uint8Array([7, 8]);
    const result = concatArrayBuffers([buffer0, buffer2, buffer1]);

    expect(result.data.byteLength).to.eql(buffer0.byteLength + buffer1.byteLength + padding4(buffer2.byteLength));
    expect(result.pointers.length).to.eql(3);
    expect(result.pointers[0][1]).to.deep.equals([0, 0, 12, 'f32']);
    expect(result.pointers[1][1]).to.deep.equals([0, 12, 2, 'u8']);
    expect(result.pointers[2][1]).to.deep.equals([0, 16, 12, 'f32']);
  });

  it('concat buffers with pointers remap', () => {
    const buffer0 = new ArrayBuffer(7);
    const buffer1 = new ArrayBuffer(3);
    const buffer2 = new Uint8Array(11);
    const p0 = [20, [0, 0, 3]];
    const p1 = [20, [0, 3]];
    const p2 = [20, [1]];
    const p3 = [20, [2, 0, 2]];
    const p4 = [20, [2, 3, 7]];
    const p5 = [20, [2, 10]];
    const result = concatArrayBuffers([buffer0, buffer1, buffer2], [p0, p1, p2, p3, p4, p5]);

    expect(result.data.byteLength).to.eql(padding4(buffer0.byteLength) + padding4(buffer1.byteLength) + padding4(buffer2.byteLength));
    expect(result.pointers[0]).to.deep.equals([20, [0, 0, 3]]);
    expect(result.pointers[1]).to.deep.equals([20, [0, 3, 4]]);
    expect(result.pointers[2]).to.deep.equals([20, [0, 8, 3]]);
    expect(result.pointers[3]).to.deep.equals([20, [0, 12, 2, 'u8']]);
    expect(result.pointers[4]).to.deep.equals([20, [0, 15, 7, 'u8']]);
    expect(result.pointers[5]).to.deep.equals([20, [0, 22, 1, 'u8']]);
  });

  it('concat buffers with pointers rewrite', () => {
    const buffer0 = new ArrayBuffer(7);
    const buffer1 = new ArrayBuffer(3);
    const buffer2 = new Uint8Array(11);
    const p0 = [20, [0, 0, 3]];
    const p1 = [20, [0, 3]];
    const p2 = [20, [1]];
    const p3 = [20, [2, 0, 2]];
    const p4 = [20, [2, 3, 7]];
    const p5 = [20, [2, 10]];
    const result = concatArrayBuffers([buffer0, buffer1, buffer2], [p0, p1, p2, p3, p4, p5], true);

    expect(result.data.byteLength).to.eql(padding4(buffer0.byteLength) + padding4(buffer1.byteLength) + padding4(buffer2.byteLength));
    expect(p0).to.deep.equals([20, [0, 0, 3]]);
    expect(p1).to.deep.equals([20, [0, 3, 4]]);
    expect(p2).to.deep.equals([20, [0, 8, 3]]);
    expect(p3).to.deep.equals([20, [0, 12, 2, 'u8']]);
    expect(p4).to.deep.equals([20, [0, 15, 7, 'u8']]);
    expect(p5).to.deep.equals([20, [0, 22, 1, 'u8']]);
  });

  it('reconstruct buffers', () => {
    const buffer0 = new Float32Array([1, 2, 3]);
    const buffer1 = new Uint16Array([4, 5, 6]);
    const buffer2 = new Uint8Array([7, 8]);
    const result = concatArrayBuffers([buffer0, buffer1, buffer2]);
    const buffers = [result.data];
    const a0 = typedArrayFromBinary(buffers, result.pointers[0]);
    const a1 = typedArrayFromBinary(buffers, result.pointers[1]);
    const a2 = typedArrayFromBinary(buffers, result.pointers[2]);

    expect(a0).to.deep.equals(buffer0);
    expect(a1).to.deep.equals(buffer1);
    expect(a2).to.deep.equals(buffer2);
  });

  it('serialize cube texture with mipmap 1', async () => {
    const options = await getDefaultTextureFactory().loadSource(cube1, {
      wrapS: WebGLRenderingContext.CLAMP_TO_EDGE,
      magFilter: WebGLRenderingContext.NEAREST,
    });
    const result = await serializeTextures([options]);

    expect(result.bins[0].byteLength).to.eql(padding4(744 + 147));
    expect(result.textures[0]).to.deep.equals({
      'wrapS': 33071,
      'magFilter': 9728,
      'sourceType': 7,
      'target': 34067,
      'mipmaps': [[
        [20, [0, 0, 149]],
        [20, [0, 152, 149]],
        [20, [0, 304, 149]],
        [20, [0, 456, 133]],
        [20, [0, 592, 149]],
        [20, [0, 744, 147]],
      ]],
    });
  });

  it('serialize cube texture with mipmap 2', async () => {
    const options = await getDefaultTextureFactory().loadSource(cube2, {
      wrapS: WebGLRenderingContext.REPEAT,
      magFilter: WebGLRenderingContext.NEAREST,
    });
    const result = await serializeTextures([options]);

    expect(result.bins[0].byteLength).to.eql(1484);
    expect(result.textures[0]).to.deep.equals({
      'wrapS': 10497,
      'magFilter': 9728,
      'sourceType': 7,
      'target': 34067,
      'mipmaps': [[
        [20, [0, 0, 149]],
        [20, [0, 152, 149]],
        [20, [0, 304, 149]],
        [20, [0, 456, 133]],
        [20, [0, 592, 149]],
        [20, [0, 744, 147]],
      ], [
        [20, [0, 892, 97]],
        [20, [0, 992, 95]],
        [20, [0, 1088, 97]],
        [20, [0, 1188, 97]],
        [20, [0, 1288, 97]],
        [20, [0, 1388, 96]],
      ]],
    });
  });

  it('serialize 2 cube textures with mipmap 1', async () => {
    const options = await getDefaultTextureFactory().loadSource(cube1, {
      wrapS: WebGLRenderingContext.CLAMP_TO_EDGE,
      magFilter: WebGLRenderingContext.NEAREST,
    });
    const result = await serializeTextures([options, Object.assign({}, options)]);

    expect(result.bins[0].byteLength).to.eql(padding4((744 + 147)));
    expect(result.bins[1].byteLength).to.eql(padding4((744 + 147)));
    expect(result.textures[0]).to.deep.equals({
      'wrapS': 33071,
      'magFilter': 9728,
      'sourceType': 7,
      'target': 34067,
      'mipmaps': [[
        [20, [0, 0, 149]],
        [20, [0, 152, 149]],
        [20, [0, 304, 149]],
        [20, [0, 456, 133]],
        [20, [0, 592, 149]],
        [20, [0, 744, 147]],
      ]],
    });
    expect(result.textures[1]).to.deep.equals({
      'wrapS': 33071,
      'magFilter': 9728,
      'sourceType': 7,
      'target': 34067,
      'mipmaps': [[
        [20, [1, 0, 149]],
        [20, [1, 152, 149]],
        [20, [1, 304, 149]],
        [20, [1, 456, 133]],
        [20, [1, 592, 149]],
        [20, [1, 744, 147]],
      ]],
    });
  });

  it('serialize 2 cube textures mix', async () => {
    const options1 = await getDefaultTextureFactory().loadSource(cube1, {
      wrapS: WebGLRenderingContext.CLAMP_TO_EDGE,
      magFilter: WebGLRenderingContext.NEAREST,
    });
    const options2 = await getDefaultTextureFactory().loadSource(cube2, {
      wrapS: WebGLRenderingContext.REPEAT,
      magFilter: WebGLRenderingContext.NEAREST,
    });
    const result = await serializeTextures([options1, options2]);

    expect(result.bins[0].byteLength).to.eql(892);
    expect(result.bins[1].byteLength).to.eql(1484);
    expect(result.textures[0]).to.deep.equals({
      'wrapS': 33071,
      'magFilter': 9728,
      'sourceType': 7,
      'target': 34067,
      'mipmaps': [[[20, [0, 0, 149]], [20, [0, 152, 149]], [20, [0, 304, 149]], [20, [0, 456, 133]], [20, [0, 592, 149]], [20, [0, 744, 147]]]],
    });
    expect(result.textures[1]).to.deep.equals({
      'wrapS': 10497,
      'magFilter': 9728,
      'sourceType': 7,
      'target': 34067,
      'mipmaps': [[[20, [1, 0, 149]], [20, [1, 152, 149]], [20, [1, 304, 149]], [20, [1, 456, 133]], [20, [1, 592, 149]], [20, [1, 744, 147]]], [[20, [1, 892, 97]], [20, [1, 992, 95]], [20, [1, 1088, 97]], [20, [1, 1188, 97]], [20, [1, 1288, 97]], [20, [1, 1388, 96]]]],
    });
  });
});

function padding4 (n) {
  return Math.ceil(n / 4) * 4;
}
