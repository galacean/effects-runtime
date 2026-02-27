import type { Renderer, Engine, TextureFactorySourceFrom } from '@galacean/effects-core';
import {
  TextureLoadAction, glContext, getDefaultTextureFactory, RenderPassAttachmentStorageType,
  RenderPassDestroyAttachmentType, TextureSourceType, Camera, DestroyOptions, RenderPass,
  RenderFrame, Mesh, GLSLVersion,
} from '@galacean/effects-core';
import type { GLShaderVariant, GLFramebuffer, GLRenderer } from '@galacean/effects-webgl';
import { GLEngine, GLMaterial, GLGeometry, GLTexture } from '@galacean/effects-webgl';

const { expect } = chai;

/**
 * 关于destroy的说明
 * 关于all参数说明：不传递all的时候默认all为true,传all为false的时候，需要有下一级有实际意义的option
 * 才可以设置为false，比如:renderpass的{all:false,meshes:{geometries:false,material:{textures:true}}}
 * 这种设置是有意义的，{all:false,mesh:{all:false}}这种就是没有意义的设置
 */
describe('webgl/dispose', function () {
  let canvas: HTMLCanvasElement;
  let renderer: GLRenderer;
  let gl: WebGLRenderingContext;
  let result: Record<string, any>;
  let engine: Engine;

  before(() => {
    canvas = document.createElement('canvas');
    const glEngine = new GLEngine(canvas, { glType: 'webgl2' });

    renderer = glEngine.renderer as GLRenderer;
    engine = glEngine;
    gl = glEngine.gl;
  });

  beforeEach(async () => {
    result = await createMesh(engine);
  });

  afterEach(() => {
    const sb = (renderer.engine as GLEngine).shaderLibrary;

    sb.dispose();
    destroyMesh(result);
  });

  after(() => {
    engine.dispose();
    // @ts-expect-error
    renderer = null;
    // @ts-expect-error
    engine = null;
    canvas.remove();
    // @ts-expect-error
    canvas = null;
    // @ts-expect-error
    gl = null;
    // @ts-expect-error
    result = null;
  });

  // 销毁mesh时不传参，默认删除所有引用资源geometry、texture
  it('mesh dispose with default params', async () => {
    const mesh = result.mesh;
    const material: GLMaterial = result.material;
    const geom = result.geom;
    const texture = result.texture;

    const spy1 = geom.dispose = chai.spy(geom.dispose);
    const spy2 = material.dispose = chai.spy(material.dispose);
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);

    renderer.renderRenderFrame(frame);

    mesh.dispose();
    expect(mesh.isDestroyed).to.be.true;
    expect(() => mesh.initialize()).to.throw(Error);
    expect(spy1).has.been.called.once;
    expect(spy2).has.been.called.once;
    expect(material.isDestroyed).to.be.true;
    expect(geom.isDestroyed).to.be.true;
    expect(geom.buffers).to.eql({});
    expect(geom.attributes).to.eql({});
    Object.keys(geom.vaos).map(name => expect(geom.vaos[name]).to.eql(undefined));
    frame.dispose();
  });

  // mesh销毁时传入参数删除对应的geometry资源, 保留material
  it('mesh dispose with geometry destroy and material keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;

    const spy1 = material.dispose = chai.spy(material.dispose);
    const spy2 = geom.dispose = chai.spy(geom.dispose);
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);

    renderer.renderRenderFrame(frame);
    material.dispose = spy1;
    geom.dispose = spy2;

    mesh.dispose({
      geometries: DestroyOptions.destroy,
      material: DestroyOptions.keep,
    });
    expect(spy1).not.has.been.called;
    expect(spy2).has.been.called.once;

    expect(mesh.material).to.eql(material);
    expect(geom.isDestroyed).to.be.true;
    expect(geom.buffers).to.eql({});
    expect(geom.attributes).to.eql({});
    Object.keys(geom.vaos).map(name => expect(geom.vaos[name]).to.eql(undefined));
    expect(texture).to.eql(texture);

    frame.dispose();
  });

  // mesh销毁时传入参数删除对应的material资源, 保留geometry
  it('mesh dispose with material destroy and geometry keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const spy1 = material.dispose = chai.spy(material.dispose);
    const spy2 = geom.dispose = chai.spy(geom.dispose);
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);

    renderer.renderRenderFrame(frame);
    mesh.dispose({ geometries: DestroyOptions.keep });
    expect(spy2).not.has.been.called;
    expect(spy1).has.been.called.once;
    expect(material.isDestroyed).to.be.true;
    expect(Object.keys(material.textures).length).to.eql(0);
    expect(geom.isDestroyed).to.be.false;

  });

  // mesh销毁时保留material的texture资源和geometry
  it('mesh dispose with geometries and textures keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);
    renderer.renderRenderFrame(frame);

    mesh.dispose({
      geometries: DestroyOptions.keep,
      material: { textures: DestroyOptions.keep },
    });

    expect(geom.isDestroyed).to.be.false;
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.false;
  });

  // mesh销毁时只保留material和对应的texture对象
  it('mesh dispose with material and texture destroy', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);
    renderer.renderRenderFrame(frame);

    mesh.dispose({ material: { textures: DestroyOptions.keep } });

    expect(geom.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.false;
  });

  // mesh销毁时geometry、material、texture都保留
  it('mesh dispose with geometry and material all keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const spy1 = material.dispose = chai.spy(material.dispose);
    const spy2 = geom.dispose = chai.spy(geom.dispose);

    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);

    renderer.renderRenderFrame(frame);

    mesh.dispose({
      geometries: DestroyOptions.keep,
      material: DestroyOptions.keep,
    });

    expect(spy1).not.has.been.called;
    expect(spy2).not.has.been.called;
    expect(material.isDestroyed).to.be.false;
    expect(geom.isDestroyed).to.be.false;
    expect(texture.isDestroyed).to.be.false;
    expect(material.getTexture('uTexColor')).to.eql(texture);
  });

  // 使用默认参数销毁renderPass(mesh和相关attachment都会被销毁)
  it('render pass dispose with no params', async () => {
    const mesh = result.mesh;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    renderPass.dispose();
    expect(renderPass.isDisposed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
  });

  // 销毁renderPass时保留mesh和相关attachment等资源
  it('render pass dispose with all keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    renderPass.dispose({
      meshes: DestroyOptions.keep,
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(renderPass.isDisposed).to.be.true;
    expect(mesh.isDestroyed).to.be.false;
    expect(material.isDestroyed).to.be.false;
    expect(geometry.isDestroyed).to.be.false;
    expect(renderPass.meshes).to.eql([]);
    expect(texture.isDestroyed).to.be.false;
  });

  // 销毁renderPass时销毁geometry，保留colorAttachment、depthStencilAttachment和mesh的material
  it('render pass dispose with destroying geometry，keeping material，colorAttachment and depthStencilAttachment', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    renderPass.dispose({
      meshes: { geometries: DestroyOptions.destroy, material: DestroyOptions.keep },
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(renderPass.isDisposed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.false;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
    expect(texture.isDestroyed).to.be.false;
  });

  // 销毁renderPass同时销毁material
  it('render pass dispose with destroying material, keeping geometry, colorAttachment and depthStencilAttachment', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    renderPass.dispose({
      meshes: { geometries: DestroyOptions.keep, material: DestroyOptions.destroy },
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(renderPass.isDisposed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.false;
    expect(renderPass.meshes).to.eql([]);
    expect(texture.isDestroyed).to.be.false;
  });

  // 销毁renderPass,不销毁colorAttachment 销毁depthStencilAttachment
  it('render pass dispose with colorAttachment keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;

    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    //删除meshes和attachments
    renderPass.dispose({
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.destroy,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;

    expect(renderPass.meshes).to.eql([]);
  });

  // 销毁renderPass,colorAttachment保留external
  it('render pass dispose with colorAttachment keepExternal', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    renderPass.dispose({
      colorAttachment: RenderPassDestroyAttachmentType.keepExternal,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
  });

  // 销毁renderPass，保留depthStencilAttachment
  it('render pass dispose with depthStencilAttachment keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    renderPass.dispose({
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
  });

  // 销毁renderPass，保留depthStencilAttachment的extenal
  it('render pass dispose with depthStencilAttachment keepExternal }', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const rp1 = new RenderPass(renderer);

    rp1.configure(renderer);

    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    renderPass.dispose({
      depthStencilAttachment: RenderPassDestroyAttachmentType.keepExternal,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
  });

  // 销毁renderFrame
  it('render frame dispose with no params', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;

    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass,);

    renderer.renderRenderFrame(frame);
    frame.dispose();

    expect(frame.isDisposed).to.be.true;
    expect(frame.renderPasses.length).to.eql(0);
    expect(renderPass.isDisposed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(geom.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.true;
  });

  //  销毁renderFrame，保留semantics
  it('render frame dispose with semantics keep', async () => {
    const mesh = result.mesh;
    const marsTexture = result.texture;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass,);

    renderer.renderRenderFrame(frame);
    frame.dispose({ semantics: DestroyOptions.keep });

    expect(frame.isDisposed).to.be.true;
    expect(frame.renderPasses.length).to.eql(0);
    expect(renderPass.isDisposed).to.be.true;
  });

  //
  it('render frame dispose with passes keep ', async () => {
    const mesh = result.mesh;
    const marsTexture = result.texture;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const renderPass = new RenderPass(renderer);

    renderPass.addMesh(mesh);
    const frame = createRenderFrame(renderer, renderPass,);

    renderer.renderRenderFrame(frame);

    frame.dispose({ passes: DestroyOptions.keep });

    expect(frame.isDisposed).to.be.true;
    expect(frame.renderPasses.length).to.eql(0);
    expect(renderPass.isDisposed).to.be.false;
    expect(marsTexture.isDestroyed).to.be.false;
  });
});

const vs = `#version 300 es
  in vec2 position;
  in vec2 uv;
  in float id;

  void main() {
    vec2 pos = position * uv * id;
    gl_Position = vec4(pos.x, pos.y, 0.0, 1.0);
  }
  `;

const fs = `#version 300 es
  precision mediump float;
  uniform sampler2D uTexColor;
  out vec4 outColor;

  void main() {
    outColor = texture(uTexColor, vec2(0.5, 0.5));
  }
  `;

async function createTexture (engine: Engine, needCompressed = false) {
  const source: TextureFactorySourceFrom = needCompressed ? {
    type: TextureSourceType.compressed,
    url: 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/RCFCUBLGCIMW/-901396496-767d5.ktx',
  } : {
    type: TextureSourceType.image,
    url: 'https://mdn.alipayobjects.com/mars/afts/img/A*xMfUTYUbALcAAAAAAAAAAAAADlB4AQ/original',
  };
  const ret = await getDefaultTextureFactory().loadSource(source);
  const texture = new GLTexture(engine, ret);

  return texture;
}

async function createMesh (engine: Engine) {
  const texture = await createTexture(engine);
  const geom = new GLGeometry(
    engine,
    {
      drawStart: 0,
      drawCount: 3,
      attributes: {
        'position': {
          data: new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
          size: 2,
          stride: 16,
          offset: 0,
        },
        'uv': {
          dataSource: 'position',
          type: glContext.FLOAT,
          size: 2,
          stride: 16,
          offset: 8,
        },
        'id': {
          data: new Float32Array([3, 4, 5]),
          size: 1,
          stride: 0,
          offset: 0,
        },
      },
    });

  const material = new GLMaterial(
    engine,
    {
      shader: { vertex: vs, fragment: fs, glslVersion: GLSLVersion.GLSL3 },
    });

  const mesh = new Mesh(engine, {
    geometry: geom,
    material,
  });

  return {
    texture, geom, material, mesh,
  };
}

function destroyMesh (result: Record<string, any>) {
  result.texture.dispose();
  result.geom.dispose();
  result.material.dispose();
  result.mesh.dispose();
}

function createRenderFrame (
  renderer: Renderer,
  renderPass: RenderPass,
) {
  const frame = new RenderFrame({
    renderer,
    camera: new Camera(renderer.engine, ''),
  });

  frame.setRenderPasses([renderPass]);

  return frame;
}
