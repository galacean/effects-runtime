import { Engine, Geometry, BufferUsage, glContext, RenderingDevice } from '@galacean/effects-core';
import type { ShaderVariant, VertexElement } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/gpu-vertex-layout', () => {
  let engine: Engine;
  let device: RenderingDeviceWebGL;
  const position: VertexElement = {
    name: 'aPosition', slot: 0, type: glContext.FLOAT, size: 2,
    byteOffset: 0, normalized: false, divisor: 0,
  };

  beforeEach(() => {
    engine = new Engine(document.createElement('canvas'), { glType: 'webgl2' });
    device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
  });

  afterEach(() => {
    engine.dispose();
  });

  it('shares descriptors without buffer references and disposes the cache with the device', () => {
    const elements = [{ ...position }];
    const strides = [8];
    const layout = device.getVertexLayout(elements, strides);
    const count = device['resources'].length;

    expect(device.getVertexLayout([{ ...position }], [8])).equals(layout);
    expect(device['resources'].length).equals(count);
    elements[0].byteOffset = 4;
    strides[0] = 16;
    expect(layout.getElement('aPosition')!.byteOffset).equals(0);
    expect(layout.getStride(0)).equals(8);
    expect(layout.getElement('aPosition')).not.to.have.property('buffer');
    expect(device.getVertexLayout(elements, strides)).not.equals(layout);
    layout.releaseGPU();
    expect(layout.getElement('aPosition')).deep.equals(position);
    device.dispose();
    expect(layout.device).equals(null);
    expect(layout.isDestroyed).equals(true);
    expect(device['resources'].length).equals(0);
    expect(device['vertexLayouts'].size).equals(0);
    layout.dispose();
  });

  it('separates uncached creation from lookup and isolates device caches', () => {
    const otherDevice = new RenderingDevice(engine);
    const created = device.createVertexLayout([position], [8]);
    const layout = device.getVertexLayout([position], [8]);
    const otherLayout = otherDevice.getVertexLayout([position], [8]);

    expect(created).not.equals(layout);
    expect(otherLayout).not.equals(layout);
    expect(otherLayout.device).equals(otherDevice);
    created.dispose();
    expect(device.getVertexLayout([position], [8])).equals(layout);
    device.dispose();
    expect(layout.isDestroyed).equals(true);
    expect(otherLayout.isDestroyed).equals(false);
    expect(otherDevice.getVertexLayout([position], [8])).equals(otherLayout);
    otherDevice.dispose();
    expect(otherLayout.isDestroyed).equals(true);
    expect(otherDevice['vertexLayouts'].size).equals(0);
  });

  it('combines buffer descriptions by slot and restores their layout references', () => {
    const first = device.createBuffer();
    const second = device.createBuffer();
    const firstLayout = device.getVertexLayout([position], [8]);
    const secondLayout = device.getVertexLayout([{ ...position, name: 'aOffset', size: 3, divisor: 2 }], [12]);
    const description = {
      data: new Float32Array([0, 1, 2, 3]), usage: BufferUsage.Dynamic,
      type: glContext.FLOAT, byteStride: 8, instanceDivisor: 0, vertexLayout: firstLayout,
    };

    first.initialize(description);
    second.initialize({ ...description, data: new Float32Array([1, 2, 3]), byteStride: 12,
      instanceDivisor: 2, vertexLayout: secondLayout });
    const geometry = new Geometry(engine);

    geometry.setVertexBuffers([first, second]);
    const layout = geometry.getVertexLayout()!;

    expect(layout.getElement('aPosition')!.slot).equals(0);
    expect(layout.getElement('aOffset')!.slot).equals(1);
    expect(layout.getStride(0)).equals(8);
    expect(layout.getStride(1)).equals(12);
    expect(geometry.getAttributeBuffer('aOffset')).equals(second);
    expect(secondLayout.getElement('aOffset')!.slot).equals(0);
    first.releaseGPU();
    expect(first.vertexLayout).equals(undefined);
    expect(first.byteStride).equals(0);
    first.initialize(description);
    expect(first.vertexLayout).equals(firstLayout);
    expect(device.getVertexLayout([first, second])).equals(layout);
    geometry.dispose();
    expect(first.isDestroyed).equals(false);
    first.dispose();
    second.dispose();
  });

  it('binds interleaved attributes and an instanced stream using layout slots', () => {
    const geometry = new Geometry(engine, {
      attributes: {
        aPosition: { data: new Float32Array(8), size: 2, stride: 16 },
        aUV: { dataSource: 'aPosition', size: 2, type: glContext.FLOAT, stride: 16, offset: 8 },
        aInstance: { data: new Float32Array([1, 2, 3]), size: 3, instanceDivisor: 1 },
      },
    });
    const layout = geometry.getVertexLayout()!;
    const buffers = geometry.getVertexBuffers();
    const shader = {
      key: 'vertex-layout-test',
      program: {
        getAttributesNames: () => ['aUV', 'aInstance', 'aPosition'],
        getAttributeLocation: (index: number) => index,
      },
    } as unknown as ShaderVariant;
    const vao = device.recordVertexArrayObject(buffers, null, shader, layout)!;
    const gl = device.gl;

    expect(buffers.length).equals(2);
    expect(layout.getElement('aPosition')!.slot).equals(layout.getElement('aUV')!.slot);
    expect(buffers[0]!.vertexLayout!.getElement('aUV')!.slot).equals(0);
    device.bindVertexArrayObject(vao, null);
    expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).equals(buffers[0]!.underlyingResource);
    expect(gl.getVertexAttrib(1, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).equals(buffers[1]!.underlyingResource);
    expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).equals(16);
    expect(gl.getVertexAttribOffset(0, gl.VERTEX_ATTRIB_ARRAY_POINTER)).equals(8);
    expect(gl.getVertexAttrib(1, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).equals(12);
    expect(gl.getVertexAttrib(1, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)).equals(1);
    expect(gl.getError()).equals(gl.NO_ERROR);
    device.releaseVertexArrayObject(vao);
    geometry.dispose();
  });
});
