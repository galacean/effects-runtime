import type { TextureSourceOptions, spec } from '@galacean/effects';
import { Asset, Buffer, Engine, Geometry, Renderer, RenderingDevice, Texture, TextureSourceType, VertexBuffer, glContext } from '@galacean/effects';
import { RenderingDeviceThree } from '../../../../../packages/effects-threejs/src/rendering-device-three';
import type { ThreeDataBuffer } from '../../../../../packages/effects-threejs/src/three-data-buffer';
import { getThreeGeometry, disposeThreeGeometries } from '../../../../../packages/effects-threejs/src/three-geometry';

import { GPUTextureThree } from '../../../../../packages/effects-threejs/src/gpu-texture-three';
import { ThreeMaterial } from '../../../../../packages/effects-threejs/src/material/three-material';

const { expect } = chai;

describe('threejs/rendering-device', () => {
  let engine: Engine;
  let gl: WebGL2RenderingContext;

  function createTexture (source: TextureSourceOptions): Texture {
    const texture = new Texture(engine, source);

    texture.initialize();

    return texture;
  }

  beforeEach(() => {
    const canvas = document.createElement('canvas');

    canvas.width = 31;
    canvas.height = 17;
    gl = canvas.getContext('webgl2')!;
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const createDevice = RenderingDevice.create;

    try {
      RenderingDevice.create = owner => new RenderingDeviceThree(owner);
      engine = new Engine(canvas, { manualRender: true, ownsCanvas: false });
      (engine.displayServer.renderingDevice as RenderingDeviceThree).setContext(gl);
    } finally {
      RenderingDevice.create = createDevice;
    }
  });

  afterEach(() => {
    engine.dispose();
    disposeThreeGeometries(engine);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });

  it('uses the shared engine and renderer without clearing or resizing the host canvas', () => {
    expect(engine.constructor).equals(Engine);
    expect(engine.renderer.constructor).equals(Renderer);
    expect(engine.displayServer.renderingDevice).to.be.instanceOf(RenderingDeviceThree);
    expect(engine.renderer.getWidth()).equals(31);
    expect(engine.renderer.getHeight()).equals(17);
    engine.onDraw();
    engine.dispose();
    const pixel = new Uint8Array(4);

    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    expect(Array.from(pixel)).deep.equals([255, 0, 0, 255]);
    expect(gl.isContextLost()).equals(false);
  });

  it('composes a texture asset with a device-created Three texture resource', () => {
    const device = engine.displayServer.renderingDevice;
    const unallocated = device.createTexture() as GPUTextureThree;

    expect(unallocated).to.be.instanceOf(GPUTextureThree);
    expect(unallocated).not.to.be.instanceOf(Asset);
    expect(unallocated.texture).to.equal(undefined);
    unallocated.dispose();

    const data = new Uint8Array([12, 34, 56, 255]);
    const texture = createTexture({ data: { width: 1, height: 1, data }, flipY: true, minFilter: glContext.LINEAR });
    const gpu = texture.getGPUTexture() as GPUTextureThree;
    const native = gpu.texture!;

    expect(texture.constructor).equals(Texture);
    expect(native).to.have.property('isDataTexture', true);
    expect(native.image.data).equals(data);
    expect(native.flipY).equals(true);
    expect(native.minFilter).equals(GPUTextureThree.toThreeJsTextureFilter(glContext.LINEAR));
    expect(native.version).equals(1);
    expect(texture.width).equals(1);
    texture.initialize();
    expect(gpu.texture).equals(native);
    texture.dispose();
    expect(gl.isContextLost()).equals(false);
  });

  it('replaces native textures on update and keeps material bindings borrowed', () => {
    const texture = createTexture({ data: { width: 1, height: 1, data: new Uint8Array(4) }, flipY: true });
    const gpu = texture.getGPUTexture() as GPUTextureThree;
    const oldTexture = gpu.texture!;
    const material = new ThreeMaterial(engine);
    let oldDisposed = 0;
    let replacementDisposed = 0;

    oldTexture.addEventListener('dispose', () => oldDisposed++);
    material.setTexture('_MainTex', texture);
    expect(material.getTexture('_MainTex')).equals(texture);
    expect(material.material.uniforms._MainTex.value).equals(oldTexture);
    texture.updateSource({ data: { width: 2, height: 1, data: new Uint8Array(8) } });
    expect(oldDisposed).equals(1);
    expect(texture.getGPUTexture()).equals(gpu);
    expect(gpu.texture).not.equals(oldTexture);
    expect(gpu.texture!.flipY).equals(true);
    expect(texture.width).equals(2);
    gpu.texture!.addEventListener('dispose', () => replacementDisposed++);
    material.setTexture('_MainTex', texture);
    expect(material.material.uniforms._MainTex.value).equals(gpu.texture);
    texture.initialize();
    expect(replacementDisposed).equals(0);
    material.onSetUniformValue('_MainTex', texture);
    expect(material.material.uniforms._MainTex.value).equals(gpu.texture);
    material.dispose();
    expect(replacementDisposed).equals(0);
    texture.dispose();
    expect(replacementDisposed).equals(1);
    expect(gl.isContextLost()).equals(false);
  });

  it('releases and reinitializes Three textures without unregistering the resource', () => {
    const device = engine.displayServer.renderingDevice;
    const baseline = device['resources'].length;
    const gpu = device.createTexture() as GPUTextureThree;
    const source: TextureSourceOptions = { data: { width: 2, height: 1, data: new Uint8Array(8) } };

    gpu.initialize(source);
    const native = gpu.texture!;
    let nativeDisposals = 0;
    let releases = 0;

    native.addEventListener('dispose', () => nativeDisposals++);
    const unsubscribe = gpu.on('releasing', () => {
      expect(gpu.texture).equals(native);
      expect(gpu.device).equals(device);
      expect(nativeDisposals).equals(0);
      releases++;
    });

    gpu.releaseGPU();
    gpu.releaseGPU();
    unsubscribe();
    expect(releases).equals(1);
    expect(nativeDisposals).equals(1);
    expect(gpu.texture).equals(undefined);
    expect(gpu.width).equals(0);
    expect(gpu.height).equals(0);
    expect(gpu.isInitialized).equals(false);
    expect(gpu.device).equals(device);
    expect(device['resources'].length).equals(baseline + 1);
    gpu.initialize(source);
    expect(gpu.texture).not.equals(native);
    expect(gpu.isInitialized).equals(true);
    gpu.dispose();
    gpu.dispose();
    expect(gpu.device).equals(null);
    expect(device['resources'].length).equals(baseline);
  });

  it('detaches remaining Three textures on device close and leaves the host context usable', () => {
    const device = engine.displayServer.renderingDevice;
    const texture = createTexture({ data: { width: 1, height: 1, data: new Uint8Array(4) } });
    const gpu = texture.getGPUTexture() as GPUTextureThree;
    const native = gpu.texture!;
    const unused = device.createTexture();
    let nativeDisposals = 0;

    native.addEventListener('dispose', () => {
      expect(gpu.device).equals(device);
      nativeDisposals++;
    });
    device.dispose();
    expect(device['resources'].length).equals(0);
    expect(gpu.device).equals(null);
    expect(unused.device).equals(null);
    expect(gpu.isDestroyed).equals(false);
    expect(gpu.texture).equals(undefined);
    texture.dispose();
    unused.dispose();
    device.dispose();
    expect(nativeDisposals).equals(1);
    expect(gl.isContextLost()).equals(false);
    expect(gl.canvas.width).equals(31);
    expect(gl.canvas.height).equals(17);
    gl.clearColor(0, 1, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixel = new Uint8Array(4);

    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    expect(Array.from(pixel)).deep.equals([0, 255, 0, 255]);
  });

  it('initializes a deserialized texture through the material entry point', () => {
    const texture = new Texture(engine);
    const canvas = document.createElement('canvas');

    canvas.width = 3;
    canvas.height = 2;
    texture.fromData({ id: 'three-texture-asset', image: canvas } as unknown as spec.EffectsObjectData);
    const material = new ThreeMaterial(engine);

    material.setTexture('_MainTex', texture);
    const native = (texture.getGPUTexture() as GPUTextureThree).texture!;

    expect(material.material.uniforms._MainTex.value).equals(native);
    expect(texture.getInstanceId()).equals('three-texture-asset');
    expect(native.image).equals(canvas);
    expect(texture.width).equals(3);
    expect(texture.height).equals(2);
    texture.initialize();
    expect((texture.getGPUTexture() as GPUTextureThree).texture).equals(native);
    material.dispose();
    texture.dispose();
  });

  it('preserves the default, compressed, video and framebuffer native texture types', async () => {
    const blank = createTexture({});
    const compressed = createTexture({
      sourceType: TextureSourceType.compressed,
      mipmaps: [{ width: 4, height: 4, data: new Uint8Array(16) }],
    });
    const video = createTexture({ video: document.createElement('video') });
    const framebuffer = createTexture({
      sourceType: TextureSourceType.framebuffer,
      data: { width: 8, height: 4 },
    });

    expect((blank.getGPUTexture() as GPUTextureThree).texture!.image.data).deep.equals(new Uint8Array(4).fill(255));
    expect((compressed.getGPUTexture() as GPUTextureThree).texture).to.have.property('isCompressedTexture', true);
    expect(compressed.width).equals(4);
    const nativeVideo = (video.getGPUTexture() as GPUTextureThree).texture;

    expect(nativeVideo).to.have.property('isVideoTexture', true);
    await video.uploadCurrentVideoFrame();
    expect((video.getGPUTexture() as GPUTextureThree).texture).equals(nativeVideo);
    expect((framebuffer.getGPUTexture() as GPUTextureThree).texture).to.have.property('isFramebufferTexture', true);
    expect(framebuffer.width).equals(8);
    expect(framebuffer.height).equals(4);
    blank.dispose();
    compressed.dispose();
    video.dispose();
    framebuffer.dispose();
  });

  it('creates and updates native Three buffers through the engine device', () => {
    const buffer = new Buffer(engine, new Float32Array([0, 1, 2, 3]), true, 2);
    const dataBuffer = buffer.getBuffer() as ThreeDataBuffer;
    const native = dataBuffer.resource!;

    expect(native.array).deep.equals(new Float32Array([0, 1, 2, 3]));
    buffer.updateDirectly(new Float32Array([8, 9]), 2);
    expect(native.array).deep.equals(new Float32Array([0, 1, 8, 9]));
    expect(native.version).equals(1);
    buffer.dispose();
    expect(dataBuffer.resource).equals(undefined);
  });

  it('uses the vertex binding stride for tightly packed buffers', () => {
    const geometry = new Geometry(engine);
    const positions = new Float32Array([-0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0]);

    geometry.setVerticesBuffer(new VertexBuffer(engine, positions, 'aPos', { size: 3 }));
    const attribute = getThreeGeometry(geometry).getAttribute('aPos');

    if (!('getX' in attribute)) {
      throw new Error('Expected a CPU-backed vertex attribute.');
    }

    expect(attribute.count).equals(3);
    expect([attribute.getX(1), attribute.getY(1), attribute.getZ(1)]).deep.equals([-0.5, -0.5, 0]);
    expect([attribute.getX(2), attribute.getY(2), attribute.getZ(2)]).deep.equals([0.5, 0.5, 0]);
    geometry.dispose();
  });

  it('preserves native geometry attributes and index updates and disposes its cache once', () => {
    const geometry = new Geometry(engine, {
      attributes: { aPosition: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1]) } },
      indices: { data: new Uint16Array([0, 1, 2]) },
      drawCount: 3,
    });
    const native = getThreeGeometry(geometry);
    let disposed = 0;

    native.addEventListener('dispose', () => disposed++);
    expect(native.getAttribute('aPosition').count).equals(3);
    expect(native.index!.array).deep.equals(new Uint16Array([0, 1, 2]));
    engine.displayServer.renderingDevice.updateDynamicIndexBuffer(geometry.getIndexBuffer()!, new Uint16Array([2, 1, 0]));
    expect(getThreeGeometry(geometry)).equals(native);
    expect(native.index!.array).deep.equals(new Uint16Array([2, 1, 0]));
    geometry.dispose();
    expect(disposed).equals(0);
    engine.dispose();
    disposeThreeGeometries(engine);
    disposeThreeGeometries(engine);
    expect(disposed).equals(1);
    expect(engine.displayServer.renderingDevice.disposed).equals(true);
  });
});
