// @ts-nocheck
import { GPUCapability, TextureSourceType, getDefaultTextureFactory, loadImage } from '@galacean/effects-core';
import { GLTexture, GLPipelineContext, GLRenderer } from '@galacean/effects-webgl';
import { set } from 'husky';
import { sleep } from '../utils';
import { getTextureGPUInfo, getTextureMemory } from './texture-utils';

const COMPRESSED_RGBA_ASTC_6x6_KHR = 37812;
const { assert, expect } = chai;

describe('webgl/gl-texture', () => {
  let renderer, gl, canvas, pipelineContext, engine;

  before(() => {
    canvas = document.createElement('canvas');
    renderer = new GLRenderer(canvas, 'webgl');
    gl = renderer.context.gl;
    pipelineContext = new GLPipelineContext(renderer.engine, gl);
    engine = renderer.engine;
  });

  after(() => {
    // runs once after the last test in this block
    renderer.dispose();
    renderer = null;
    engine = null;
    canvas.remove();
    canvas = null;
    gl = null;
    pipelineContext.dispose();
  });

  it('load 2d astc ktx file', async () => {
    const ret = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.compressed,
      url: 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/RCFCUBLGCIMW/-901396496-767d5.ktx',
    });

    expect(ret.target).is.eql(gl.TEXTURE_2D);
    expect(ret.internalFormat).is.eql(COMPRESSED_RGBA_ASTC_6x6_KHR);
    const source = ret;

    expect(source.mipmaps[0].width).is.eql(512);
    expect(source.mipmaps[0].height).is.eql(512);
    const mipmaps = source.mipmaps;

    expect(mipmaps.length).is.eql(10);
    for (let i = 0; i < mipmaps.length; i++) {
      expect(mipmaps[i].data.byteLength).is.eql(byteLengthForASTC(ret.internalFormat, mipmaps[i].width, mipmaps[i].height), 'mipmap ' + i);
    }
  });

  it('load binary cube texture', async () => {
    const cube = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.mipmaps,
      target: gl.TEXTURE_CUBE_MAP,
      bin: 'https://mdn.alipayobjects.com/mars/afts/file/A*pGF4QJqDT3wAAAAAAAAAAAAADlB4AQ',
      mipmaps: [[[0, 24661], [24664, 26074], [50740, 26845], [77588, 24422], [102012, 24461], [126476, 27099]], [[153576, 7699], [161276, 7819], [169096, 8919], [178016, 7004], [185020, 7657], [192680, 8515]], [[201196, 2305], [203504, 2388], [205892, 2789], [208684, 2147], [210832, 2351], [213184, 2541]], [[215728, 755], [216484, 810], [217296, 902], [218200, 727], [218928, 775], [219704, 835]], [[220540, 292], [220832, 301], [221136, 317], [221456, 285], [221744, 301], [222048, 307]], [[222356, 147], [222504, 147], [222652, 149], [222804, 149], [222956, 149], [223108, 149]], [[223260, 96], [223356, 96], [223452, 96], [223548, 97], [223648, 97], [223748, 97]], [[223848, 83], [223932, 83], [224016, 83], [224100, 83], [224184, 83], [224268, 83]]],
    });

    expect(cube).to.contains({
      sourceType: TextureSourceType.mipmaps,
      target: gl.TEXTURE_CUBE_MAP,
    });
    expect(cube.sourceFrom).to.deep.equals({
      type: TextureSourceType.mipmaps,
      target: gl.TEXTURE_CUBE_MAP,
      bin: 'https://mdn.alipayobjects.com/mars/afts/file/A*pGF4QJqDT3wAAAAAAAAAAAAADlB4AQ',
      mipmaps: [[[0, 24661], [24664, 26074], [50740, 26845], [77588, 24422], [102012, 24461], [126476, 27099]], [[153576, 7699], [161276, 7819], [169096, 8919], [178016, 7004], [185020, 7657], [192680, 8515]], [[201196, 2305], [203504, 2388], [205892, 2789], [208684, 2147], [210832, 2351], [213184, 2541]], [[215728, 755], [216484, 810], [217296, 902], [218200, 727], [218928, 775], [219704, 835]], [[220540, 292], [220832, 301], [221136, 317], [221456, 285], [221744, 301], [222048, 307]], [[222356, 147], [222504, 147], [222652, 149], [222804, 149], [222956, 149], [223108, 149]], [[223260, 96], [223356, 96], [223452, 96], [223548, 97], [223648, 97], [223748, 97]], [[223848, 83], [223932, 83], [224016, 83], [224100, 83], [224184, 83], [224268, 83]]],
    });
    gl.getError();//clear last error
    const texture = new GLTexture(engine, cube);

    texture.initialize();
    expect(gl.getError()).to.eql(0);
    expect(getDefaultTextureFactory().canOffloadTexture(texture.sourceFrom)).to.be.true;
    expect(texture.width).to.eql(128);
    expect(texture.height).to.eql(128);

    texture.offloadData();
    expect(texture.width).to.eql(1);
    expect(texture.height).to.eql(1);
    expect(gl.getError()).to.eql(0);
    await getDefaultTextureFactory().reload(texture);
    expect(gl.getError()).to.eql(0);
    expect(texture.width).to.eql(128);
    expect(texture.height).to.eql(128);
    const gpuInfo = getTextureGPUInfo(texture, cube);

    expect(gpuInfo).to.deep.equals(
      [gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_CUBE_MAP, [[128, 128], [64, 64], [32, 32], [16, 16], [8, 8], [4, 4], [2, 2], [1, 1]]]
    );
    expect(getTextureMemory(texture, gpuInfo)).to.eql((128 * 128 + 64 * 64 + 32 * 32 + 16 * 16 + 8 * 8 + 4 * 4 + 2 * 2 + 1) * 4 * 6);
  });

  it('upload 2d astc', async () => {
    const ret = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.compressed,
      url: 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/RCFCUBLGCIMW/-901396496-767d5.ktx',
    });
    const texture = new GLTexture(engine, ret);

    texture.initialize();
    expect(texture.width).is.eql(512);
    expect(texture.height).is.eql(512);
    expect(texture.textureBuffer).is.not.null;
    expect(texture.gl).is.not.null;
    expect(texture.sourceType).is.eql(TextureSourceType.compressed);
    expect((texture.source).mipmaps).is.undefined;
    expect((texture.source).data).is.undefined;
    const gpuInfo = getTextureGPUInfo(texture, ret);

    expect(gpuInfo).to.deep.equals(
      [37812, 0, gl.TEXTURE_2D, [[512, 512], [256, 256], [128, 128], [64, 64], [32, 32], [16, 16], [8, 8], [4, 4], [2, 2], [1, 1]]]
    );
    const mipmaps = gpuInfo[3];
    let memory = 0;

    for (let i = 0; i < mipmaps.length; i++) {
      const mipmap = mipmaps[i];

      memory += byteLengthForASTC(37812, mipmap[0], mipmap[1]);
    }

    expect(getTextureMemory(texture, gpuInfo)).to.eql(memory);
  });

  it('create GL Texture 2D with one pixel value [255, 100, 50, 0]', () => {
    const writePixelData = [255, 100, 50, 0];
    const buffer = new Uint8Array([1, 2, ...writePixelData, 3, 4]);
    const texture = new GLTexture(engine, {
      data: { width: 1, height: 1, data: new Uint8Array(buffer.buffer, 2 * Uint8Array.BYTES_PER_ELEMENT, 4) },
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
    });

    texture.initialize();
    expect(texture.sourceType).is.eql(TextureSourceType.data);
    expect(texture.width).is.eql(1);
    expect(texture.height).is.eql(1);
    expect(texture.source.format).is.eql(gl.RGBA);
    expect(texture.source.internalFormat).is.eql(gl.RGBA);
    expect(texture.source.type).is.eql(gl.UNSIGNED_BYTE);
    expect(texture.source.target).is.eql(gl.TEXTURE_2D);
    expect((texture.source).data).is.undefined;
    const spy = chai.spy(() => {
    });

    const gpuInfo = getTextureGPUInfo(texture, {});

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_2D, [[1, 1]]]);
    bindFrameBuffer(gl, texture, function (gl) {
      const readPixelData = new Uint8Array(4);

      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelData);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      expect(readPixelData).to.deep.equal(new Uint8Array(writePixelData));
      spy();
    });
    expect(spy).has.been.called.once;
  });

  it('create GL Texture cube  with one pixel value [255, 100, 50, 0]', () => {
    const writePixelData = [255, 100, 50, 0];
    const buffer = new Uint8Array([1, 2, ...writePixelData, 3, 4]);
    const data = { width: 1, height: 1, data: new Uint8Array(buffer.buffer, 2 * Uint8Array.BYTES_PER_ELEMENT, 4) };
    const texture = new GLTexture(engine, {
      cube: [data, data, data, data, data, data],
      sourceType: TextureSourceType.data,
      format: gl.RGBA,
      target: gl.TEXTURE_CUBE_MAP,
      type: gl.UNSIGNED_BYTE,
      flipY: true,
    });

    texture.initialize();
    const gpuInfo = getTextureGPUInfo(texture, {});

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_CUBE_MAP, [[1, 1]]]);
    expect(getTextureMemory(texture, gpuInfo)).to.eql(6 * 4);
    expect(texture.sourceType).is.eql(TextureSourceType.data);
    expect(texture.width).is.eql(1);
    expect(texture.height).is.eql(1);
    expect(texture.source.format).is.eql(gl.RGBA);
    expect(texture.source.internalFormat).is.eql(gl.RGBA);
    expect(texture.source.type).is.eql(gl.UNSIGNED_BYTE);
    expect(texture.source.target).is.eql(gl.TEXTURE_CUBE_MAP);
    expect((texture.source).data).is.undefined;
    expect(texture.textureBuffer).is.eql(gl.getParameter(gl.TEXTURE_BINDING_CUBE_MAP));
    expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.eql(true);
  });

  const mipmap0 = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*U3E7TLGloVQAAAAAAAAAAAAAARQnAQ';
  const mipmap1 = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*7pG2QJud_sEAAAAAAAAAAAAAARQnAQ';
  const mipmap2 = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*Wp-AQa-DWTwAAAAAAAAAAAAAARQnAQ';
  const mipmap3 = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*8ghRRICMVG0AAAAAAAAAAAAAARQnAQ';
  const mipmap4 = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*L_bES6yo3XoAAAAAAAAAAAAAARQnAQ';

  it('create GL Texture2D from pot image', async () => {
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*drkFS6EDl_8AAAAAAAAAAAAAARQnAQ',
    });
    const texture = new GLTexture(engine, texOptions);

    expect((texOptions).image).is.instanceof(HTMLImageElement);
    expect((texOptions).image?.width).is.eql(128);
    expect((texOptions).image?.height).is.eql(128);
    expect(texture.source.target).to.eql(gl.TEXTURE_2D);
    expect(texture.width).is.undefined;
    expect(texture.height).is.undefined;
    texture.initialize();
    const gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.eql(false);
    expect(texture.width).is.eql(128);
    expect(texture.height).is.eql(128);
    expect((texture.source).data).is.undefined;
    const spy = chai.spy(() => {
    });

    expect(getTextureMemory(texture, gpuInfo)).to.eql(128 * 128 * 4);
    bindFrameBuffer(gl, texture, function (gl) {
      const readPixelData = new Uint8Array(4);

      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelData);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      expect(readPixelData).to.deep.equal(new Uint8Array([0, 0, 0, 255]));
      spy();
    });
    expect(spy).has.been.called.once;
  });

  it('create GL Texture2D mipmap images', async () => {
    const filter = {
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.NEAREST,
      wrapS: gl.REPEAT,
      wrapT: gl.MIRRORED_REPEAT,
      anisotropic: 1,
      flipY: true,
    };
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.mipmaps,
      urls: [mipmap0, mipmap1, mipmap2, mipmap3, mipmap4],
    }, filter);
    const texture = new GLTexture(engine, texOptions);

    expect(texture.source.target).is.eql(gl.TEXTURE_2D);
    texture.initialize();
    const gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_2D, [[64, 64], [32, 32], [16, 16], [8, 8], [4, 4]]]);
    expect(getTextureMemory(texture, gpuInfo)).to.deep.equal(4 * (64 ** 2 + 32 ** 2 + 16 ** 2 + 8 ** 2 + 4 ** 2));
    expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.eql(true);
    expect((texture.source).mipmaps).is.undefined;
    expect([texture.width, texture.height]).to.deep.equal([64, 64]);
    checkTextureBinding(gl, texture.textureBuffer, gl.TEXTURE_2D, filter);
  });

  it('create GL TextureCube mipmap images', async () => {
    const filter = {
      minFilter: gl.LINEAR,
      magFilter: gl.NEAREST,
      wrapS: gl.REPEAT,
      wrapT: gl.MIRRORED_REPEAT,
    };
    const cube = a => [a, a, a, a, a, a];
    const maps = [
      cube(mipmap0),
      cube(mipmap1),
      cube(mipmap2),
      cube(mipmap3),
      cube(mipmap4),
    ];
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.mipmaps,
      target: gl.TEXTURE_CUBE_MAP,
      maps,
    }, filter);
    const texture = new GLTexture(engine, texOptions);

    expect(texture.source.target).is.eql(gl.TEXTURE_CUBE_MAP);
    texture.initialize();
    const gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_CUBE_MAP, [[64, 64], [32, 32], [16, 16], [8, 8], [4, 4]]]);
    expect(getTextureMemory(texture, gpuInfo)).to.deep.equal(24 * (64 ** 2 + 32 ** 2 + 16 ** 2 + 8 ** 2 + 4 ** 2));
    expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.eql(false);
    expect((texture.source).mipmaps).is.undefined;
    expect([texture.width, texture.height]).to.deep.equal([64, 64]);
    checkTextureBinding(gl, texture.textureBuffer, gl.TEXTURE_CUBE_MAP, filter);
  });

  it('create GL TextureCube pot cube image', async () => {
    const image = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*drkFS6EDl_8AAAAAAAAAAAAAARQnAQ';
    const filter = {
      minFilter: gl.LINEAR,
      magFilter: gl.NEAREST,
      wrapS: gl.REPEAT,
      wrapT: gl.MIRRORED_REPEAT,
      flipY: false,
    };
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      target: gl.TEXTURE_CUBE_MAP,
      map: [image, image, image, image, image, image],
    }, filter);
    const texture = new GLTexture(engine, texOptions);

    expect(texture.source.target).is.eql(gl.TEXTURE_CUBE_MAP);
    texture.initialize();
    const gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_CUBE_MAP, [[128, 128]]]);
    expect(getTextureMemory(texture, gpuInfo)).to.deep.equal(24 * (128 ** 2));
    expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.eql(false);
    expect((texture.source).cube).is.undefined;
    expect([texture.width, texture.height]).to.deep.equal([128, 128]);
    checkTextureBinding(gl, texture.textureBuffer, gl.TEXTURE_CUBE_MAP, filter);
  });

  function checkTextureBinding (gl, texture, target, filters) {
    expect(gl.getParameter(target === gl.TEXTURE_2D ? gl.TEXTURE_BINDING_2D : gl.TEXTURE_BINDING_CUBE_MAP)).to.eql(texture, 'texture binding');
    const map = {
      minFilter: gl.TEXTURE_MIN_FILTER,
      magFilter: gl.TEXTURE_MAG_FILTER,
      wrapS: gl.TEXTURE_WRAP_S,
      wrapT: gl.TEXTURE_WRAP_T,
    };

    Object.keys(filters).forEach(key => {
      const value = filters[key];

      if (key !== 'flipY' && key !== 'anisotropic') {
        expect(gl.getTexParameter(target, map[key])).to.eql(value, key);
      }
    });

    const textureAnisotropicExt = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    const maxTextureAnisotropy = textureAnisotropicExt ? gl.getParameter(textureAnisotropicExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;

    if (maxTextureAnisotropy) {
      const currentAnistropic = filters['anisotropic'] || (target === gl.TEXTURE_2D ? 4 : 1);

      expect(gl.getTexParameter(target, textureAnisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT)).to.eql(currentAnistropic, 'anisotropic');
    }
  }

  it('create GL Texture from non-pot image without resize', async () => {
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*WBQXT6fanRgAAAAAAAAAAAAAARQnAQ',
    });
    const texture = new GLTexture(engine, texOptions);
    const image = (texOptions).image;

    expect(image).is.instanceof(HTMLImageElement);
    expect(image.width).is.eql(1063);
    expect(image.height).is.eql(256);
    expect(texture.width).is.undefined;
    expect(texture.height).is.undefined;
    expect(texture.source.minFilter).is.eql(gl.NEAREST);
    expect(texture.source.magFilter).is.eql(gl.NEAREST);
    expect(texture.source.wrapS).is.eql(gl.CLAMP_TO_EDGE);
    expect(texture.source.wrapT).is.eql(gl.CLAMP_TO_EDGE);
    texture.initialize();
    const gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_2D, [[1063, 256]]]);
    expect(getTextureMemory(texture, gpuInfo)).to.deep.equal(4 * (1063 * 256));

    expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.eql(false);
    expect(texture.width).is.eql(1063);
    expect(texture.height).is.eql(256);
    expect((texture.source).image).is.undefined;
    const spy = chai.spy(() => {
    });

    bindFrameBuffer(gl, texture, function (gl) {
      const readPixelData = new Uint8Array(4);

      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelData);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      expect(readPixelData).to.deep.equal(new Uint8Array([255, 162, 66, 255]));
      spy();
    });
    expect(spy).has.been.called.once;
  });

  it('create GL Texture from non-pot image with resize', async () => {
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*WBQXT6fanRgAAAAAAAAAAAAAARQnAQ',
    }, {
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.MIRRORED_REPEAT,
      wrapT: gl.REPEAT,
    });
    const texture = new GLTexture(engine, texOptions);
    const image = (texOptions).image;

    expect(image).is.instanceof(HTMLImageElement);
    expect(image.width).is.eql(1063);
    expect(image.height).is.eql(256);
    expect(texture.width).is.undefined;
    expect(texture.height).is.undefined;
    expect(texture.source.minFilter).is.eql(gl.LINEAR_MIPMAP_LINEAR);
    expect(texture.source.magFilter).is.eql(gl.LINEAR);
    expect(texture.source.wrapS).is.eql(gl.MIRRORED_REPEAT);
    expect(texture.source.wrapT).is.eql(gl.REPEAT);
    texture.initialize();

    // FIXME 异步创建 Texture 导致的 Size 获取问题
    // const gpuInfo = getTextureGPUInfo(texture, texOptions);
    //
    // expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.eql(false);
    // expect(texture.width).is.eql(1024);
    // expect(texture.height).is.eql(256);
    // expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_2D, [[1024, 256]]]);
    // expect(getTextureMemory(texture, gpuInfo)).to.deep.equal(4 * (1024 * 256));

    const spy = chai.spy(() => {
    });

    expect((texture.source).image).is.undefined;
    bindFrameBuffer(gl, texture, function (gl) {
      const readPixelData = new Uint8Array(4);

      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelData);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      expect(readPixelData).to.deep.equal(new Uint8Array([255, 162, 66, 255]));
      spy();
    });
    expect(spy).has.been.called.once;
  });

  it('test texture destroy', async () => {
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*WBQXT6fanRgAAAAAAAAAAAAAARQnAQ',
    }, {
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.MIRRORED_REPEAT,
      wrapT: gl.REPEAT,
    });
    const texture = new GLTexture(engine, texOptions);

    texture.initialize();
    const glTex = texture.textureBuffer;

    expect(glTex).to.be.an.instanceof(WebGLTexture);
    const spy = chai.spy(() => {
    });

    gl.deleteTexture = spy;
    texture.dispose();
    expect(getTextureMemory(texture, {})).to.eql(0);
    expect(spy).to.been.called.with(glTex);
    expect(texture.textureBuffer).to.not.exist;
    expect(texture.destroyed).to.equal(true);
  });

  it('offload image texture', async () => {
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*drkFS6EDl_8AAAAAAAAAAAAAARQnAQ',
    });
    const texture = new GLTexture(engine, texOptions);

    texture.initialize();
    let gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(texture.width).to.eql(128);
    expect(texture.height).to.eql(128);
    expect(getTextureMemory(texture, gpuInfo)).to.eql(128 ** 2 * 4);
    texture.offloadData();
    gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(getTextureMemory(texture, gpuInfo)).to.eql(1 ** 2 * 4);
    expect(texture.width).to.eql(1);
    expect(texture.height).to.eql(1);
    await texture.reloadData();
    gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(texture.width).to.eql(128);
    expect(texture.height).to.eql(128);
    expect(getTextureMemory(texture, gpuInfo)).to.eql(128 ** 2 * 4);
  });

  it('pre multiply alpha', async () => {
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*drkFS6EDl_8AAAAAAAAAAAAAARQnAQ',
    });

    texOptions.premultiplyAlpha = true;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    expect(gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL)).to.eql(false);
    new GLTexture(engine, texOptions).initialize();
    expect(gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL)).to.eql(true);
  });

  it('generate 2d mipmap images', async () => {
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      url: 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*drkFS6EDl_8AAAAAAAAAAAAAARQnAQ',
    });

    texOptions.premultiplyAlpha = true;
    (texOptions).generateMipmap = true;
    const texture = new GLTexture(engine, texOptions);
    const spy = chai.spy(function (target) {
    });

    gl.generateMipmap = spy;

    texture.initialize();

    const gpuInfo = getTextureGPUInfo(texture, texOptions);

    expect(spy).to.have.been.called.with(texture.source.target);
    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_2D, [
      [128, 128],
    ]]);
    expect(getTextureMemory(texture, gpuInfo)).to.eql(4 * 128 ** 2);
  });

  it('generate cube mipmap images', async () => {
    const image = await loadImage('https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*drkFS6EDl_8AAAAAAAAAAAAAARQnAQ');
    const texOptions = {
      sourceType: TextureSourceType.image,
      target: gl.TEXTURE_CUBE_MAP,
      cube: [image, image, image, image, image, image],
      generateMipmap: true,
    };
    const tex = new GLTexture(engine, texOptions);
    const spy = chai.spy(function (target) {
    });

    gl.generateMipmap = spy;

    tex.initialize();
    const gpuInfo = getTextureGPUInfo(tex, texOptions);

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_CUBE_MAP, [
      [128, 128],
    ]]);
    expect(getTextureMemory(tex, gpuInfo)).to.eql(24 * (128 ** 2));

    expect(spy).to.have.been.called.with(tex.source.target);
  });

  it('load 2d cube', async () => {
    const image = 'https://gw.alipayobjects.com/mdn/lifeNews_f/afts/img/A*drkFS6EDl_8AAAAAAAAAAAAAARQnAQ';
    const filter = {
      minFilter: gl.LINEAR,
      magFilter: gl.NEAREST,
      wrapS: gl.REPEAT,
      wrapT: gl.MIRRORED_REPEAT,
      flipY: false,
    };
    const texOptions = await getDefaultTextureFactory().loadSource({
      type: TextureSourceType.image,
      target: gl.TEXTURE_CUBE_MAP,
      map: [image, image, image, image, image, image],
    }, filter);

    expect(texOptions.sourceType).to.eql(TextureSourceType.image);
    const cube = (texOptions).cube;

    expect(cube).to.be.an('array').with.lengthOf(6);
    expect(!!texOptions.keepImageSource).to.be.false;
    const spy = chai.spy((cube[0]).close);
    const texture = new GLTexture(engine, texOptions);

    texture.initialize();

    expect(spy).to.has.been.called;
    expect((texture.source).image).not.exist;
    expect(cube.every(c => c.width === 128 && c.height === 128)).to.be.true;
    texture.dispose();
  });
});

function bindFrameBuffer (gl, texture, callback) {
  const framebuffer = gl.createFramebuffer();

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  // attach texture to framebuffer
  const glTexture = texture.textureBuffer;

  if (glTexture) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glTexture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status == gl.FRAMEBUFFER_COMPLETE) {
      callback(gl);
    }
  }
  gl.deleteFramebuffer(framebuffer);
}

function byteLengthForASTC (type, width, height) {
  if (type === COMPRESSED_RGBA_ASTC_6x6_KHR) {
    return Math.floor((width + 5) / 6) * Math.floor((height + 5) / 6) * 16;
  }
  throw Error('not implement:https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_compressed_texture_astc');
}

describe('webgl2/gl-texture', () => {
  let canvas, gl, renderer, fakeRenderer, imageHTMLElement, pipelineContext, engine;

  before(() => {
    canvas = document.createElement('canvas');
    renderer = new GLRenderer(canvas, 'webgl2');

    fakeRenderer = renderer.glRenderer;
    engine = renderer.engine;
    gl = fakeRenderer.gl;
    pipelineContext = new GLPipelineContext(engine, gl);
    imageHTMLElement = document.createElement('img');
    imageHTMLElement.src = '../../../assets/colors.png';
  });

  after(() => {
    // runs once after the last test in this block
    fakeRenderer.dispose();
    fakeRenderer = null;
    renderer.dispose();
    engine = null;
    renderer = null;
    canvas.remove();
    canvas = null;
    gl = null;
    pipelineContext.dispose();
  });

  it('GLTexture2D default value', () => {
    const defaultTexture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      data: { width: 0, height: 0 },
    });

    defaultTexture.initialize();
    assert.equal(defaultTexture.width, 0);
    assert.equal(defaultTexture.height, 0);
    expect(defaultTexture.textureBuffer).is.instanceof(WebGLTexture);

    defaultTexture.dispose();
  });

  it('create GLTexture2D with one pixel value [255, 100, 50, 0]', () => {
    const writePixelData = new Uint8Array([255, 100, 50, 0]);
    const onePixelTexture2D = new GLTexture(engine, {
      format: gl.RGBA,
      internalFormat: gl.RGBA,
      data: { data: writePixelData, width: 1, height: 1 },
    });

    onePixelTexture2D.initialize();
    const framebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // attach texture to framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, onePixelTexture2D.textureBuffer, 0);
    const canRead = (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE);

    const gpuInfo = getTextureGPUInfo(onePixelTexture2D, {});

    expect(gpuInfo).to.deep.equals([gl.RGBA, gl.UNSIGNED_BYTE, gl.TEXTURE_2D, [[1, 1]]]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (canRead) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      const readPixelData = new Uint8Array(4);

      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readPixelData);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      assert.equal(readPixelData[0], writePixelData[0]);
      assert.equal(readPixelData[1], writePixelData[1]);
      assert.equal(readPixelData[2], writePixelData[2]);
      assert.equal(readPixelData[3], writePixelData[3]);
    }

    gl.deleteFramebuffer(framebuffer);
    onePixelTexture2D.dispose();
  });

  it('create GLTexture2D from HTMLImageElement', () => {
    const imgeElementTexture = new GLTexture(engine, { image: imageHTMLElement });

    imgeElementTexture.initialize();
    imgeElementTexture.dispose();
  });
});
