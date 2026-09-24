import type { TextureSourceOptions, spec } from '@galacean/effects';
import { Asset, Engine, Geometry, Renderer, RenderingDevice, Texture, TextureSourceType, glContext } from '@galacean/effects';
import { RenderingDeviceThree } from '../../../../../packages/effects-threejs/src/rendering-device-three';
import type { GPUBufferThree } from '../../../../../packages/effects-threejs/src/gpu-buffer-three';
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

  it('preserves the default, compressed, video and framebuffer native texture types', () => {
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
    video.uploadCurrentVideoFrame();
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
    const device = engine.displayServer.renderingDevice;
    const buffer = device.createBuffer() as GPUBufferThree;

    buffer.initialize({ data: new Float32Array([0, 1, 2, 3]), usage: glContext.DYNAMIC_DRAW,
      type: glContext.FLOAT, byteStride: 8, instanceDivisor: 0 });
    const dataBuffer = buffer;
    const native = dataBuffer.resource!;

    expect(native.array).deep.equals(new Float32Array([0, 1, 2, 3]));
    device.updateDynamicVertexBuffer(buffer, new Float32Array([8, 9]), 8);
    expect(native.array).deep.equals(new Float32Array([0, 1, 8, 9]));
    expect(native.version).equals(1);
    buffer.dispose();
    expect(dataBuffer.resource).equals(undefined);
  });

  it('registers buffers without allocation and retains instancing across reinitialization', () => {
    const device = engine.displayServer.renderingDevice as RenderingDeviceThree;
    const baseline = device['resources'].length;
    const gpu = device.createBuffer();
    const description = {
      data: new Float32Array([1, 2, 3, 4]),
      usage: glContext.DYNAMIC_DRAW,
      type: glContext.FLOAT,
      byteStride: 8,
      instanceDivisor: 2,
    };

    expect(gpu.resource).equals(undefined);
    expect(device['resources'].length).equals(baseline + 1);
    gpu.initialize(description);
    const native = gpu.resource;

    expect(native).to.have.property('isInstancedInterleavedBuffer', true);
    expect(native).to.have.property('meshPerAttribute', 2);
    expect(native).to.have.property('stride', 2);
    gpu.releaseGPU();
    expect(gpu.resource).equals(undefined);
    expect(gpu.capacity).equals(0);
    gpu.initialize(description);
    expect(gpu.resource).not.equals(native);
    expect(gpu.resource!.array).deep.equals(description.data);
    gpu.dispose();
    gpu.dispose();
    expect(device['resources'].length).equals(baseline);
  });

  it('rebuilds cached native geometry on use after buffers are restored', () => {
    const geometry = new Geometry(engine, {
      attributes: { aPosition: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1]) } },
      indices: { data: new Uint32Array([0, 1, 2]) },
      drawCount: 3,
    });
    const device = engine.displayServer.renderingDevice;
    const native = getThreeGeometry(geometry);
    const gpu = geometry.getAttributeBuffer('aPosition')!;
    const index = geometry.getIndexBuffer()!;
    const baseline = device['resources'].length;
    let disposals = 0;

    native.addEventListener('dispose', () => disposals++);
    gpu.releaseGPU();
    expect(disposals).equals(0);
    expect(gpu.getListeners('releasing').length).equals(0);
    expect(index.getListeners('releasing').length).equals(0);
    geometry.restore();
    const rebuilt = getThreeGeometry(geometry);

    expect(disposals).equals(1);
    expect(rebuilt).not.equals(native);
    expect(rebuilt.getAttribute('aPosition').count).equals(3);
    expect(rebuilt.index!.array).deep.equals(new Uint32Array([0, 1, 2]));
    expect(geometry.getAttributeBuffer('aPosition')!).equals(gpu);
    expect(geometry.getIndexBuffer()).equals(index);
    expect(device['resources'].length).equals(baseline);
    geometry.dispose();
    disposeThreeGeometries(engine);
    expect(disposals).equals(1);
  });

  it('refreshes each geometry sharing a reinitialized vertex buffer without subscriptions', () => {
    const buffer = engine.displayServer.renderingDevice.createBuffer() as GPUBufferThree;
    const description = { data: new Float32Array([0, 0, 1, 0, 0, 1]), usage: glContext.DYNAMIC_DRAW,
      type: glContext.FLOAT, byteStride: 8, instanceDivisor: 0 };

    buffer.initialize(description);
    const geometries = [new Geometry(engine), new Geometry(engine)];

    const layout = engine.displayServer.renderingDevice.getVertexLayout([
      { name: 'aPosition', slot: 0, type: glContext.FLOAT, size: 2, byteOffset: 0, normalized: false, divisor: 0 },
    ], [8]);

    for (const geometry of geometries) {
      geometry.setVertexBuffers([buffer], layout);
    }
    const originals = geometries.map(getThreeGeometry);
    const gpu = buffer;
    let disposals = 0;

    for (const native of originals) {
      native.addEventListener('dispose', () => disposals++);
    }
    expect(gpu.getListeners('releasing').length).equals(0);
    buffer.initialize(description);
    expect(geometries[0].getAttributeBuffer('aPosition')).equals(gpu);
    expect(disposals).equals(0);
    for (let i = 0; i < geometries.length; i++) {
      const rebuilt = getThreeGeometry(geometries[i]);

      expect(rebuilt).not.equals(originals[i]);
      expect(rebuilt.getAttribute('aPosition')).to.have.property('data', gpu.resource);
      expect(getThreeGeometry(geometries[i])).equals(rebuilt);
      expect(disposals).equals(i + 1);
    }
    gpu.releaseGPU();
    for (const geometry of geometries) {
      expect(getThreeGeometry(geometry).getAttribute('aPosition')).equals(undefined);
    }
    buffer.initialize(description);
    for (const geometry of geometries) {
      expect(getThreeGeometry(geometry).getAttribute('aPosition')).to.have.property('data', gpu.resource);
      geometry.dispose();
    }
    buffer.dispose();
    disposeThreeGeometries(engine);
    expect(disposals).equals(2);
  });

  it('rebuilds Three geometry when buffer slots or the separate layout change', () => {
    const geometry = new Geometry(engine, {
      attributes: {
        aPosition: { data: new Float32Array([1, 2, 3, 4]), size: 2, stride: 16 },
        aUV: { data: new Float32Array([5, 6, 7, 8]), size: 2, stride: 8 },
      },
    });
    const initial = getThreeGeometry(geometry);
    const buffers = geometry.getVertexBuffers();
    const layout = geometry.getVertexLayout()!;
    let disposals = 0;

    initial.addEventListener('dispose', () => disposals++);
    geometry.setVertexBuffers([buffers[1], buffers[0]], layout);
    const swapped = getThreeGeometry(geometry);

    expect(swapped).not.equals(initial);
    expect(disposals).equals(1);
    const swappedPosition = swapped.getAttribute('aPosition');
    const swappedUV = swapped.getAttribute('aUV');

    expect('getX' in swappedPosition && swappedPosition.getX(0)).equals(5);
    expect('getX' in swappedUV && swappedUV.getX(0)).equals(1);
    swapped.addEventListener('dispose', () => disposals++);
    const changedLayout = engine.displayServer.renderingDevice.getVertexLayout(
      layout.elements.map(element => element.name === 'aPosition' ? { ...element, byteOffset: 8 } : element),
      [16, 8],
    );

    geometry.setVertexBuffers(geometry.getVertexBuffers(), changedLayout);
    const changed = getThreeGeometry(geometry);

    expect(changed).not.equals(swapped);
    const changedPosition = changed.getAttribute('aPosition');

    expect('getX' in changedPosition && changedPosition.getX(0)).equals(7);
    expect(disposals).equals(2);
    expect(getThreeGeometry(geometry)).equals(changed);
    geometry.dispose();
  });

  it('refreshes the cached index when the same GPUBuffer replaces its native buffer', () => {
    const geometry = new Geometry(engine, {
      attributes: { aPosition: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1]) } },
      indices: { data: new Uint16Array([0, 1, 2]) },
      drawCount: 3,
    });
    const native = getThreeGeometry(geometry);
    const gpu = geometry.getIndexBuffer() as GPUBufferThree;
    let disposals = 0;

    native.addEventListener('dispose', () => disposals++);
    gpu.initialize({
      data: new Uint32Array([2, 1, 0]), index: true, usage: glContext.STATIC_DRAW,
      type: glContext.UNSIGNED_INT, byteStride: 0, instanceDivisor: 0,
    });
    expect(geometry.getIndexBuffer()).equals(gpu);
    expect(disposals).equals(0);
    const rebuilt = getThreeGeometry(geometry);

    expect(rebuilt).not.equals(native);
    expect(rebuilt.index).equals(gpu.resource);
    expect(rebuilt.index!.array).deep.equals(new Uint32Array([2, 1, 0]));
    expect(getThreeGeometry(geometry)).equals(rebuilt);
    expect(disposals).equals(1);
    gpu.releaseGPU();
    expect(getThreeGeometry(geometry).index).equals(null);
    geometry.dispose();
    disposeThreeGeometries(engine);
    expect(disposals).equals(1);
  });

  it('detaches unowned Three buffers when the device closes', () => {
    const device = engine.displayServer.renderingDevice as RenderingDeviceThree;
    const buffer = device.createBuffer();
    const unused = device.createBuffer();

    buffer.initialize({ data: [0, 65535], index: true, usage: glContext.STATIC_DRAW,
      type: glContext.UNSIGNED_INT, byteStride: 0, instanceDivisor: 0 });
    expect(buffer.is32Bits).equals(true);
    device.dispose();
    expect(buffer.resource).equals(undefined);
    expect(buffer.capacity).equals(0);
    expect(buffer.device).equals(null);
    expect(unused.device).equals(null);
    buffer.dispose();
    unused.dispose();
    expect(device['resources'].length).equals(0);
    expect(gl.isContextLost()).equals(false);
  });

  it('uses the vertex binding stride for tightly packed buffers', () => {
    const geometry = new Geometry(engine);
    const positions = new Float32Array([-0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0]);

    geometry.setAttribute('aPos', { data: positions, size: 3 });
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
