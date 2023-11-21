// @ts-nocheck
import { Camera, TextureLoadAction, RenderFrame, Mesh } from '@galacean/effects-core';
import { GLGeometry, GLMaterial, GLRenderer } from '@galacean/effects-webgl';

const { expect } = chai;

describe('gl-render-frame', () => {
  let canvas, renderer;
  const vs = `#version 300 es
  in vec2 aPoint;

  uniform mat4 uViewMatrix;

  void main() {
    gl_Position = uViewMatrix * vec4(aPoint.x, aPoint.y, 0.0, 1.0);
  }
  `;

  const fs = `#version 300 es
  precision mediump float;

  uniform vec4 uColor;

  uniform float uScale;

  uniform float[3] uKernels;

  out vec4 oColor;

  void main() {
    oColor = uColor * uScale * uKernels[0] * uKernels[1] * uKernels[2];
  }
  `;

  const fs2 = `#version 300 es
  precision mediump float;

  uniform vec4 uColor2;

  uniform float uScale2;

  uniform float[3] uKernels2;

  out vec4 oColor;

  void main() {
    oColor = uColor2 * uScale2 * uKernels2[0] * uKernels2[1] * uKernels2[2];
  }
  `;

  before(() => {
    canvas = document.createElement('canvas');
    renderer = new GLRenderer(canvas);
  });

  after(() => {
    renderer.dispose();
    renderer = null;
    canvas.remove();
    canvas = null;
  });

  it('create copy mesh', () => {
    // const frame = new RenderFrame({ renderer, camera: new Camera() });
    // const mesh = frame.createCopyMesh();

    // mesh.initialize(renderer.glRenderer);
    // expect(mesh.material.uniformSemantics['uFilterSource']).to.eql(SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_0);
    // expect(mesh.material.uniformSemantics['uFilterSourceSize']).to.eql(SEMANTIC_MAIN_PRE_COLOR_ATTACHMENT_SIZE_0);

    // TODO: 补充
    // frame.renderer.pipelineContext.shaderLibrary.compileShader(m.material.shaderCacheId);
    // expect(frame.renderer.pipelineContext.shaderLibrary.shaderResults[m.material.shaderCacheId].status).to.eql(1);//success
  });

  it('add default render Pass with info', () => {
    const frame = new RenderFrame({ renderer, camera: new Camera() });
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

  it('clear success', () => {
    const frame = new RenderFrame({
      renderer, camera: new Camera(),
      clearAction: {
        clearColor: [0, 0, 0, 0],
        clearDepth: 1,
        clearStencil: 0xff,
        colorAction: TextureLoadAction.clear,
        depthAction: TextureLoadAction.clear,
        stencilAction: TextureLoadAction.clear,
      },
    });
    const gl = renderer.glRenderer.gl;

    gl.depthMask(false);
    gl.stencilMask(0);
    gl.colorMask(false, false, false, false);
    gl.clearDepth(0.5);
    gl.clearColor(1, 1, 1, 1);
    gl.clearStencil(0);
    renderer.renderRenderFrame(frame);
    expect(gl.getParameter(gl.DEPTH_CLEAR_VALUE)).to.eql(1);
    expect(gl.getParameter(gl.STENCIL_CLEAR_VALUE)).to.eql(0xff);
    expect(new Uint8Array(gl.getParameter(gl.COLOR_CLEAR_VALUE))).to.deep.equal(new Uint8Array([0, 0, 0, 0]));
    expect(gl.getParameter(gl.DEPTH_WRITEMASK)).to.be.true;
    expect(gl.getParameter(gl.COLOR_WRITEMASK)).to.deep.equal([true, true, true, true]);
    expect(gl.getParameter(gl.STENCIL_WRITEMASK)).to.eql(0xff);
  });
});

function generateMeshes (renderer, num, opts) {
  const meshs = [];
  const priorityBase = opts?.priority || 0;
  const engine = renderer.engine;

  for (let i = 0; i < num; i++) {
    meshs.push(new Mesh(engine, {
      name: 'm' + i,
      priority: i + 1 + priorityBase,
      material: new GLMaterial(engine, { states: {}, shader: { cacheId: 'xxx' } }),
      geometry: new GLGeometry(engine, { attributes: {} }),
    }));
  }

  return meshs;
}
