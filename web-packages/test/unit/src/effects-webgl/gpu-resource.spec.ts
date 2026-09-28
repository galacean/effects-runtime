import { Engine, GPUResource, Texture, TextureSourceType, glContext } from '@galacean/effects';
import type { TextureSourceOptions } from '@galacean/effects';
import type { GPUTextureWebGL, RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/gpu-resource', () => {
  let engine: Engine;
  let device: RenderingDeviceWebGL;
  let gl: WebGL2RenderingContext;
  const source: TextureSourceOptions = {
    sourceType: TextureSourceType.data,
    data: { width: 1, height: 1, data: new Uint8Array([12, 34, 56, 255]) },
    format: glContext.RGBA,
    internalFormat: glContext.RGBA,
    type: glContext.UNSIGNED_BYTE,
  };

  beforeEach(() => {
    engine = new Engine(document.createElement('canvas'), {
      glType: 'webgl2', ownsCanvas: false, manualRender: true, doNotHandleContextLost: false,
    });
    device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    gl = device.gl;
  });

  afterEach(() => {
    engine.dispose();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });

  function readPixel (texture: GPUTextureWebGL): number[] {
    const framebuffer = gl.createFramebuffer();
    const pixel = new Uint8Array(4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.textureBuffer, 0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);

    return Array.from(pixel);
  }

  it('registers without allocating and unregisters an uninitialized resource once', () => {
    const baseline = device['resources'].length;
    const texture = device.createTexture();
    let releases = 0;

    texture.on('releasing', () => releases++);
    expect(texture).instanceOf(GPUResource);
    expect(texture.device).equals(device);
    expect(device['resources'].length).equals(baseline + 1);
    expect(texture.isInitialized).equals(false);
    expect(texture.textureBuffer).equals(undefined);
    texture.releaseGPU();
    texture.dispose();
    texture.dispose();
    expect(releases).equals(0);
    expect(texture.device).equals(null);
    expect(texture.isDestroyed).equals(true);
    expect(device['resources'].length).equals(baseline);
  });

  it('notifies before deletion, clears state and caches, and can upload again', () => {
    const baseline = device['resources'].length;
    const texture = device.createTexture();

    texture.initialize(source);
    const handle = texture.textureBuffer;
    let releases = 0;

    const unsubscribe = texture.on('releasing', resource => {
      expect(resource).equals(texture);
      expect(resource.device).equals(device);
      expect(texture.isInitialized).equals(true);
      expect(gl.isTexture(handle)).equals(true);
      releases++;
    });

    device.activeTexture(gl.TEXTURE0 + 2);
    texture.bind();
    device.activeTexture(gl.TEXTURE0 + 3);
    texture.bind();
    texture.releaseGPU();
    texture.releaseGPU();
    unsubscribe();
    expect(releases).equals(1);
    expect(gl.isTexture(handle)).equals(false);
    expect(Object.values(device.textureUnitDict)).not.to.include(handle);
    expect(texture.textureBuffer).equals(null);
    expect(texture.target).equals(0);
    expect(texture.width).equals(0);
    expect(texture.height).equals(0);
    expect(texture.isInitialized).equals(false);
    expect(texture.device).equals(device);
    expect(device['resources'].length).equals(baseline + 1);

    texture.initialize(source);
    expect(texture.textureBuffer).not.equals(handle);
    expect(texture.isInitialized).equals(true);
    expect(readPixel(texture)).deep.equals([12, 34, 56, 255]);
    texture.dispose();
    expect(device['resources'].length).equals(baseline);
  });

  it('releases the previous allocation and propagates initialization errors', () => {
    const texture = device.createTexture();

    texture.initialize(source);
    const previous = texture.textureBuffer;
    let releases = 0;
    const deleted: Array<WebGLTexture | null> = [];
    const deleteTexture = gl.deleteTexture.bind(gl);
    const upload = gl.texImage2D;

    texture.on('releasing', () => releases++);
    gl.deleteTexture = handle => { deleted.push(handle); deleteTexture(handle); };
    gl.texImage2D = () => { throw new Error('upload failed'); };
    expect(() => texture.initialize(source)).to.throw('upload failed');
    gl.texImage2D = upload;
    gl.deleteTexture = deleteTexture;
    expect(releases).equals(1);
    expect(deleted.length).equals(1);
    expect(deleted[0]).equals(previous);
    const failedHandle = texture.textureBuffer;

    expect(failedHandle).to.be.instanceOf(WebGLTexture);
    expect(gl.isTexture(failedHandle)).equals(true);
    expect(texture.isInitialized).equals(false);
    expect(texture.device).equals(device);
    // Fatal upload errors discard the context; afterEach releases this test's context.
    texture.dispose();
  });

  it('keeps the asset identity and source while its allocation is released and restored', () => {
    const asset = new Texture(engine, { ...source });
    const id = asset.getInstanceId();

    asset.initialize();
    const texture = asset.getGPUTexture() as GPUTextureWebGL;
    const handle = texture.textureBuffer;

    texture.releaseGPU();
    expect(asset.width).equals(1);
    expect(texture.width).equals(0);
    asset.initialize();
    expect(asset.getGPUTexture()).equals(texture);
    expect(asset.getInstanceId()).equals(id);
    expect(texture.textureBuffer).not.equals(handle);
    expect(readPixel(texture)).deep.equals([12, 34, 56, 255]);
    asset.dispose();
  });

  it('closes the device before later owner disposal without touching host resources', () => {
    const asset = new Texture(engine, { ...source });

    asset.initialize();
    const texture = asset.getGPUTexture() as GPUTextureWebGL;
    const unused = device.createTexture();
    const handle = texture.textureBuffer;
    const hostTexture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, hostTexture);
    let releases = 0;

    texture.on('releasing', () => {
      releases++;
      expect(texture.device).equals(device);
      expect(gl.isTexture(handle)).equals(true);
      expect(device.disposed).equals(false);
    });
    device.dispose();
    expect(releases).equals(1);
    expect(device.disposed).equals(true);
    expect(device['resources'].length).equals(0);
    expect(texture.device).equals(null);
    expect(unused.device).equals(null);
    expect(texture.isDestroyed).equals(false);
    expect(gl.isTexture(handle)).equals(false);
    expect(gl.isTexture(hostTexture)).equals(true);
    expect(gl.isContextLost()).equals(false);
    asset.dispose();
    unused.dispose();
    device.dispose();
    expect(releases).equals(1);
    expect(texture.isDestroyed).equals(true);
    gl.deleteTexture(hostTexture);
  });
});
