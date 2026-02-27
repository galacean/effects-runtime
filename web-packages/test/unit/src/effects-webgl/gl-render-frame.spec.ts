import type { ShaderWithSource, Engine } from '@galacean/effects-core';
import { Camera, TextureLoadAction, RenderFrame, Mesh } from '@galacean/effects-core';
import type { GLRenderer } from '@galacean/effects-webgl';
import { GLEngine, GLGeometry, GLMaterial } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/gl-render-frame', () => {
  let canvas: HTMLCanvasElement;
  let renderer: GLRenderer;
  let engine: Engine;

  before(() => {
    canvas = document.createElement('canvas');
    engine = new GLEngine(canvas, { glType: 'webgl' });

    renderer = engine.renderer as GLRenderer;
  });

  after(() => {
    engine.dispose();
    // @ts-expect-error
    renderer = null;
    canvas.remove();
    // @ts-expect-error
    canvas = null;
  });

  it('add default render Pass with info', () => {
    const frame = new RenderFrame({ renderer, camera: new Camera(renderer.engine, '') });
    const meshes = generateMeshes(renderer, 3);

    frame.addMeshToDefaultRenderPass(meshes[0]);
    frame.addMeshToDefaultRenderPass(meshes[1]);
    frame.addMeshToDefaultRenderPass(meshes[2]);
    // expect(frame.renderPasses.length).to.eql(1);
    // expect(frame.renderPasses[0].attachments.length).to.eql(0);

    // frame.splitDefaultRenderPassByMesh(meshes[1], {
    //   attachments: [{ texture: { format: glContext.RGBA }, persistent: false }],
    // });
    // const { detail } = engine.gpuCapability;
    // const writeDepth = detail.writableFragDepth && detail.readableDepthStencilTextures;

    // expect(frame.resource.depthStencil).to.contains({ storageType: writeDepth ? RenderPassAttachmentStorageType.depth_24_stencil_8_texture : RenderPassAttachmentStorageType.depth_stencil_opaque });
    // TODO: 待修复此处错误
    // expect(frame.renderPasses.length).to.eql(3);
    // expect(frame.renderPasses).contains(frame.resource.finalCopyRP);
    // expect(frame.defRenderPasses.length).to.eql(2);
  });
});

function generateMeshes (renderer: GLRenderer, num: number, priority = 0) {
  const meshs = [];
  const engine = renderer.engine;

  for (let i = 0; i < num; i++) {
    meshs.push(new Mesh(engine, {
      name: 'm' + i,
      priority: i + 1 + priority,
      material: new GLMaterial(engine, { shader: { cacheId: 'xxx' } as ShaderWithSource }),
      geometry: new GLGeometry(engine, { attributes: {} }),
    }));
  }

  return meshs;
}
