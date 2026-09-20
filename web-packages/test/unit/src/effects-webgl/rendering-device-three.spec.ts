import { Buffer, Engine, Geometry, Renderer, RenderingDevice } from '@galacean/effects';
import { RenderingDeviceThree } from '../../../../../packages/effects-threejs/src/rendering-device-three';
import type { ThreeDataBuffer } from '../../../../../packages/effects-threejs/src/three-data-buffer';
import { getThreeGeometry, disposeThreeGeometries } from '../../../../../packages/effects-threejs/src/three-geometry';

const { expect } = chai;

describe('threejs/rendering-device', () => {
  let engine: Engine;
  let gl: WebGL2RenderingContext;

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
      (engine.renderingDevice as RenderingDeviceThree).setContext(gl);
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
    expect(engine.renderingDevice).to.be.instanceOf(RenderingDeviceThree);
    expect(engine.renderer.getWidth()).equals(31);
    expect(engine.renderer.getHeight()).equals(17);
    engine.onDraw();
    engine.dispose();
    const pixel = new Uint8Array(4);

    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    expect(Array.from(pixel)).deep.equals([255, 0, 0, 255]);
    expect(gl.isContextLost()).equals(false);
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
    engine.updateDynamicIndexBuffer(geometry.getIndexBuffer()!, new Uint16Array([2, 1, 0]));
    expect(getThreeGeometry(geometry)).equals(native);
    expect(native.index!.array).deep.equals(new Uint16Array([2, 1, 0]));
    geometry.dispose();
    expect(disposed).equals(0);
    engine.dispose();
    disposeThreeGeometries(engine);
    disposeThreeGeometries(engine);
    expect(disposed).equals(1);
    expect(engine.renderingDevice.disposed).equals(true);
  });
});
