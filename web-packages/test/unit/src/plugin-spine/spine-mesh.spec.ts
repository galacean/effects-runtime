import type { Texture } from '@galacean/effects';
import {
  Engine, RenderingDevice, Transform, VertexElementType, math,
} from '@galacean/effects';
import {
  BlendMode, Physics, Skeleton, createSkeletonData,
} from '@galacean/effects-plugin-spine';
import { SpineMesh } from '../../../../../plugin-packages/spine/src/spine-mesh';
import { SlotGroup } from '../../../../../plugin-packages/spine/src/slot-group';
import { readAtlasData } from '../../../../../plugin-packages/spine/src/utils';
import { RenderingDeviceThree } from '../../../../../packages/effects-threejs/src/rendering-device-three';
import type { GPUBufferThree } from '../../../../../packages/effects-threejs/src/gpu-buffer-three';
import { disposeThreeGeometries, getThreeGeometry } from '../../../../../packages/effects-threejs/src/three-geometry';
import { readBufferContents } from '../effects-webgl/gl-utils';

const { expect } = chai;
const world = math.Matrix4.fromIdentity();

for (const backend of ['webgl', 'threejs']) {
  describe(`spine/mesh-submission/${backend}`, () => {
    let engine: Engine;
    let gl: WebGL2RenderingContext;
    let texture: Texture;
    let batches: SpineMesh[];
    let vertexUploads: number[];
    let indexUploads: number[];

    beforeEach(() => {
      const canvas = document.createElement('canvas');

      canvas.width = canvas.height = 32;
      gl = canvas.getContext('webgl2')!;
      const createDevice = RenderingDevice.create;

      try {
        if (backend === 'threejs') {
          RenderingDevice.create = owner => new RenderingDeviceThree(owner);
        }
        engine = new Engine(canvas, { manualRender: true, ownsCanvas: false, glType: 'webgl2', doNotHandleContextLost: false });
        if (backend === 'threejs') {
          (engine.displayServer.renderingDevice as RenderingDeviceThree).setContext(gl);
        }
      } finally {
        RenderingDevice.create = createDevice;
      }
      texture = engine.assetServer.whiteTexture;
      batches = [];
      vertexUploads = [];
      indexUploads = [];
      const device = engine.displayServer.renderingDevice;
      const updateVertices = device.updateDynamicVertexBuffer.bind(device);
      const updateIndices = device.updateDynamicIndexBuffer.bind(device);

      device.updateDynamicVertexBuffer = (buffer, data, offset, length) => {
        vertexUploads.push(ArrayBuffer.isView(data) ? data.byteLength : 0);
        updateVertices(buffer, data, offset, length);
      };
      device.updateDynamicIndexBuffer = (buffer, data, offset) => {
        indexUploads.push(data.length);
        updateIndices(buffer, data, offset);
      };
    });

    afterEach(() => {
      batches.forEach(batch => batch.dispose());
      disposeThreeGeometries(engine);
      engine.dispose();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    });

    function createBatch () {
      const batch = new SpineMesh({ engine, texture, blendMode: BlendMode.Normal, priority: 0 });

      batches.push(batch);
      batch.geometry.initialize();

      return batch;
    }

    function update (batch: SpineMesh, data: number[], indices: number[]) {
      batch.startUpdate();
      batch.updateMesh(data, indices, data.length);
      batch.endUpdate(world);
    }

    function vertices (count: number, offset = 0): number[] {
      return Array.from({ length: count * SlotGroup.VERTEX_SIZE }, (_, i) => i / 13 + offset);
    }

    function verifyBuffers (batch: SpineMesh) {
      const geometry = batch.geometry;

      geometry.initialize();
      const vertexBuffer = geometry.getAttributeBuffer(VertexElementType.Position)!;
      const indexBuffer = geometry.getIndexBuffer()!;
      const expectedVertices = batch['vertices']!.subarray(0, batch['verticesLength']);
      const expectedIndices = batch['indices']!.subarray(0, batch.indicesNum);

      expect(geometry.getAttributeData(VertexElementType.Position)).equals(batch['vertices']);
      expect(geometry.getIndexData()).equals(batch['indices']);
      expect(vertexBuffer.capacity).equals(SlotGroup.MAX_VERTICES * SlotGroup.VERTEX_SIZE * 4);
      expect(geometry.getDrawCount()).equals(batch.indicesNum);
      if (backend === 'threejs') {
        const native = getThreeGeometry(geometry);
        const data = (vertexBuffer as GPUBufferThree).resource!.array;

        expect(Array.from(data).slice(0, expectedVertices.length)).deep.equals(Array.from(expectedVertices));
        expect(Array.from(native.index!.array).slice(0, expectedIndices.length)).deep.equals(Array.from(expectedIndices));
        expect(native.drawRange.count).equals(batch.indicesNum);
      } else {
        const actualVertices = new Float32Array(expectedVertices.length);
        const actualIndices = new Uint16Array(expectedIndices.length);

        if (actualVertices.length) { readBufferContents(gl, vertexBuffer, actualVertices); }
        if (actualIndices.length) { readBufferContents(gl, indexBuffer, actualIndices, 0, true); }
        expect(actualVertices).deep.equals(expectedVertices);
        expect(actualIndices).deep.equals(expectedIndices);
        expect(gl.getError()).equals(gl.NO_ERROR);
      }
    }

    it('uploads only active vertices and reuses buffers for stable topology', () => {
      const batch = createBatch();
      const geometry = batch.geometry;
      const vertexBuffer = geometry.getAttributeBuffer(VertexElementType.Position)!;
      const indexBuffer = geometry.getIndexBuffer();

      update(batch, vertices(4), [0, 1, 2, 2, 3, 0]);
      verifyBuffers(batch);
      update(batch, vertices(4, 0.25), [0, 1, 2, 2, 3, 0]);
      verifyBuffers(batch);
      expect(vertexUploads).deep.equals([4 * 12 * 4, 4 * 12 * 4]);
      expect(indexUploads).deep.equals([6]);
      expect(geometry.getAttributeBuffer(VertexElementType.Position)).equals(vertexBuffer);
      expect(geometry.getIndexBuffer()).equals(indexBuffer);
    });

    it('detects changed indices with the same count and offsets appended attachments', () => {
      const batch = createBatch();

      update(batch, vertices(4), [0, 1, 2, 2, 3, 0]);
      update(batch, vertices(4), [0, 1, 3, 1, 2, 3]);
      expect(indexUploads).deep.equals([6, 6]);
      verifyBuffers(batch);

      batch.startUpdate();
      batch.updateMesh(vertices(3), [0, 1, 2], 3 * 12);
      batch.updateMesh(vertices(3, 0.5), [0, 1, 2], 3 * 12);
      batch.endUpdate(world);
      expect(Array.from(batch.geometry.getIndexData().subarray(0, 6))).deep.equals([0, 1, 2, 3, 4, 5]);
      verifyBuffers(batch);
    });

    it('shrinks, empties and regrows batches without clearing or uploading the unused tail', () => {
      const batch = createBatch();

      update(batch, vertices(6), [0, 1, 2, 3, 4, 5]);
      const tail = batch.geometry.getAttributeData(VertexElementType.Position)![60];

      update(batch, vertices(3, 1), [0, 1, 2]);
      expect(batch.geometry.getAttributeData(VertexElementType.Position)![60]).equals(tail);
      verifyBuffers(batch);
      update(batch, [], []);
      expect(vertexUploads).deep.equals([6 * 12 * 4, 3 * 12 * 4]);
      verifyBuffers(batch);
      update(batch, vertices(6, 2), [0, 1, 2, 3, 4, 5]);
      expect(indexUploads).deep.equals([6]);
      verifyBuffers(batch);
    });

    function createSkeleton () {
      const atlas = readAtlasData(new TextEncoder().encode(
        'test.png\nsize: 2,2\nfilter: Linear,Linear\nbody\nbounds: 0,0,2,2\n',
      ), [texture]);
      const attachment = {
        type: 'mesh', path: 'body', uvs: [0, 0, 1, 0, 1, 1, 0, 1],
        vertices: [-1, -1, 1, -1, 1, 1, -1, 1], triangles: [0, 1, 2, 2, 3, 0], hull: 4,
      };
      const data = createSkeletonData(atlas, {
        bones: [{ name: 'root' }, { name: 'clip', parent: 'root' }],
        slots: [
          { name: 'clip', bone: 'clip' },
          { name: 'body', bone: 'root', attachment: 'body' },
          { name: 'badge', bone: 'root', attachment: 'body' },
        ],
        skins: [
          { name: 'default', attachments: {
            clip: { clip: { type: 'clipping', end: 'badge', vertexCount: 4, vertices: [-0.7, -0.6, -0.7, 0.6, 0.7, 0.6, 0.7, -0.6] } },
            body: { body: attachment },
            badge: { body: { type: 'region', path: 'body', width: 0.3, height: 0.5 } },
          } },
          { name: 'alternate', attachments: {
            body: { body: { ...attachment, triangles: [0, 1, 3, 1, 2, 3] } },
          } },
        ],
      }, 'json');
      const skeleton = new Skeleton(data);
      const group = new SlotGroup(skeleton.drawOrder, {
        engine, transform: new Transform(), meshName: 'test', listIndex: 0, pma: true,
      });

      batches = group.meshGroups;
      const tick = () => {
        skeleton.updateWorldTransform(Physics.update);
        group.update();
        batches.forEach(verifyBuffers);
      };

      return { skeleton, tick };
    }

    it('handles real skin, draw-order and blend-mode changes', () => {
      const { skeleton, tick } = createSkeleton();

      tick();
      const indexBuffer = batches[0].geometry.getIndexBuffer();

      skeleton.setSkinByName('alternate');
      tick();
      expect(Array.from(batches[0].geometry.getIndexData().subarray(0, 6))).deep.equals([0, 1, 3, 1, 2, 3]);
      expect(batches[0].geometry.getIndexBuffer()).equals(indexBuffer);
      skeleton.drawOrder.reverse();
      tick();
      expect(Array.from(batches[0].geometry.getIndexData().subarray(0, 6))).deep.equals(SlotGroup.QUAD_TRIANGLES);
      skeleton.findSlot('badge')!.data.blendMode = BlendMode.Additive;
      tick();
      expect(batches.length).greaterThan(1);
      skeleton.findSlot('badge')!.setAttachment(null);
      tick();
      expect(batches.some(batch => batch.indicesNum === 0)).equals(true);
    });

    it('handles moving Spine clipping polygons, including fully clipped frames', () => {
      const { skeleton, tick } = createSkeleton();

      skeleton.setAttachment('clip', 'clip');
      const counts: number[] = [];

      for (const x of [0, 0.6, 3, -0.6, 0]) {
        skeleton.findBone('clip')!.x = x;
        tick();
        counts.push(batches.reduce((sum, batch) => sum + batch.indicesNum, 0));
      }
      expect(counts[0]).greaterThan(0);
      expect(counts[2]).equals(0);
      expect(counts[4]).equals(counts[0]);
      expect(new Set(counts).size).greaterThan(2);
    });

    it('restores full CPU buffers and can resume after an empty frame', async function () {
      this.timeout(8000);
      const batch = createBatch();

      update(batch, vertices(6), [0, 1, 2, 3, 4, 5]);
      update(batch, vertices(3, 0.5), [0, 2, 1]);
      const buffer = batch.geometry.getAttributeBuffer(VertexElementType.Position)!;
      const previousResource = buffer.underlyingResource;

      if (backend === 'webgl') {
        const extension = gl.getExtension('WEBGL_lose_context');

        expect(extension).not.equals(null);
        await new Promise<void>(resolve => {
          engine.once('contextrestored', () => resolve());
          engine.canvas.addEventListener('webglcontextlost', () => {
            setTimeout(() => extension!.restoreContext(), 0);
          }, { once: true });
          extension!.loseContext();
        });
      } else {
        buffer.releaseGPU();
        batch.geometry.getIndexBuffer()!.releaseGPU();
        engine.effectsObjectServer.restoreGraphicsResources();
      }
      expect(buffer.underlyingResource).not.equals(previousResource);
      verifyBuffers(batch);
      update(batch, [], []);
      verifyBuffers(batch);
      update(batch, vertices(6, 1), [0, 2, 1, 3, 5, 4]);
      verifyBuffers(batch);
    });
  });
}
