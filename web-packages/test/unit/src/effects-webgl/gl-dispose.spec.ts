// @ts-nocheck
import {
  TextureLoadAction, glContext, getDefaultTextureFactory,
  RenderPassAttachmentStorageType,
  RenderPassDestroyAttachmentType,
  TextureSourceType,
  Camera,
  DestroyOptions, RenderPass, RenderFrame, Mesh,
} from '@galacean/effects-core';
import { GLMaterial, GLGeometry, GLTexture, GLRenderer } from '@galacean/effects-webgl';

const { expect } = chai;

/**
 * 关于destroy的说明
 * 关于all参数说明：不传递all的时候默认all为true,传all为false的时候，需要有下一级有实际意义的option
 * 才可以设置为false，比如:renderpass的{all:false,meshes:{geometries:false,material:{textures:true}}}
 * 这种设置是有意义的，{all:false,mesh:{all:false}}这种就是没有意义的设置
 */
describe('dispose gl-mesh / gl-render-frame / gl-render-pass', function () {
  let canvas, renderer, gl, result, engine;

  before(() => {
    canvas = document.createElement('canvas');
    renderer = new GLRenderer(canvas, 'webgl2');
    engine = renderer.engine;
    gl = renderer.pipelineContext.gl;
  });

  beforeEach(async () => {
    result = await createMesh(engine);
  });

  afterEach(() => {
    const sb = renderer.pipelineContext.shaderLibrary;

    sb.dispose();
    sb.gl = renderer.glRenderer.gl;
    sb.renderer = renderer.glRenderer;
    DestroyMesh(result);
  });

  after(() => {
    renderer.dispose();
    renderer = null;
    engine = null;
    canvas.remove();
    canvas = null;
    gl = null;
    result = null;
  });

  // 销毁mesh时不传参，默认删除所有引用资源geometry、texture
  it('mesh dispose with default params', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;

    const spy1 = geom.dispose = chai.spy(geom.dispose);
    const spy2 = material.dispose = chai.spy(material.dispose);
    const renderPass = new RenderPass(renderer, {
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
    });
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);

    renderer.renderRenderFrame(frame);

    mesh.dispose();
    expect(mesh.isDestroyed).to.be.true;
    expect(() => mesh.initialize()).to.throw(Error);
    expect(spy1).has.been.called.once;
    expect(spy2).has.been.called.once;
    expect(material.isDestroyed).to.be.true;
    expect(material.shader.program.pipelineContext).to.eql(null);
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
    const renderPass = new RenderPass(renderer, {
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
    });
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
    const renderPass = new RenderPass(renderer, {
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
    });
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);

    renderer.renderRenderFrame(frame);
    mesh.dispose({ geometries: DestroyOptions.keep });
    expect(spy2).not.has.been.called;
    expect(spy1).has.been.called.once;
    expect(material.isDestroyed).to.be.true;
    expect(material.shader.program.pipelineContext).to.eql(null);
    expect(texture.isDestroyed).to.be.true;
    expect(geom.isDestroyed).to.be.false;

  });

  // mesh销毁时保留material的texture资源和geometry
  it('mesh dispose with geometries and textures keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const renderPass = new RenderPass(renderer, {
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
    });
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);
    renderer.renderRenderFrame(frame);

    mesh.dispose({
      geometries: DestroyOptions.keep,
      material: { textures: DestroyOptions.keep },
    });

    expect(geom.isDestroyed).to.be.false;
    expect(material.isDestroyed).to.be.true;
    expect(material.shader.program.pipelineContext).to.eql(null);
    expect(texture.isDestroyed).to.be.false;
  });

  // mesh销毁时只保留material和对应的texture对象
  it('mesh dispose with material and texture destroy', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const renderPass = new RenderPass(renderer, {
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
    });
    const frame = createRenderFrame(renderer, renderPass);

    material.setTexture('uTexColor', texture);

    renderer.renderRenderFrame(frame);

    mesh.dispose({ material: { textures: DestroyOptions.keep } });

    expect(geom.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.true;
    expect(material.shader.program.pipelineContext).to.eql(null);
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

    const renderPass = new RenderPass(renderer, {
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
    });
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

    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);
    const colorAttachment = renderPass.attachments[0];
    const stencilTexture = renderPass.stencilAttachment.texture;
    const depthTexture = renderPass.depthAttachment.texture;
    const frameBuffer = renderPass.frameBuffer;

    renderPass.dispose();
    expect(renderPass.isDestroyed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments).to.eql([]);
    expect(colorAttachment.texture.isDestroyed).to.be.true;
    expect(stencilTexture.isDestroyed).to.be.true;
    expect(depthTexture.isDestroyed).to.be.true;
    expect(frameBuffer.renderer).to.eql(null);
    expect(renderPass.semantics.semantics).to.eql({});
    expect(texture.isDestroyed).to.be.true;
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
    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);
    const colorAttachment = renderPass.attachments[0];
    const stencilTexture = renderPass.stencilAttachment.texture;
    const depthTexture = renderPass.depthAttachment.texture;
    const frameBuffer = renderPass.frameBuffer;

    renderPass.dispose({
      meshes: DestroyOptions.keep,
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(renderPass.isDestroyed).to.be.true;
    expect(mesh.isDestroyed).to.be.false;
    expect(material.isDestroyed).to.be.false;
    expect(geometry.isDestroyed).to.be.false;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments).to.eql([]);
    expect(texture.isDestroyed).to.be.false;
    expect(colorAttachment.texture.isDestroyed).to.be.false;
    expect(stencilTexture.isDestroyed).to.be.false;
    expect(depthTexture.isDestroyed).to.be.false;
    expect(frameBuffer.renderer).to.eql(null);
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
    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);
    const colorAttachment = renderPass.attachments[0];
    const stencilTexture = renderPass.stencilAttachment.texture;
    const depthTexture = renderPass.depthAttachment.texture;
    const frameBuffer = renderPass.frameBuffer;

    renderPass.dispose({
      meshes: { geometries: DestroyOptions.destroy, material: DestroyOptions.keep },
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(renderPass.isDestroyed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.false;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments).to.eql([]);
    expect(texture.isDestroyed).to.be.false;
    expect(colorAttachment.texture.isDestroyed).to.be.false;
    expect(stencilTexture.isDestroyed).to.be.false;
    expect(depthTexture.isDestroyed).to.be.false;
    expect(frameBuffer.renderer).to.eql(null);
  });

  // 销毁renderPass同时销毁material
  it('render pass dispose with destroying material，keeping geometry，colorAttachment and depthStencilAttachment', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geometry = result.geom;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);
    const colorAttachment = renderPass.attachments[0];
    const stencilTexture = renderPass.stencilAttachment.texture;
    const depthTexture = renderPass.depthAttachment.texture;
    const frameBuffer = renderPass.frameBuffer;

    renderPass.dispose({
      meshes: { geometries: DestroyOptions.keep, material: DestroyOptions.destroy },
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(renderPass.isDestroyed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.false;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments).to.eql([]);
    expect(texture.isDestroyed).to.be.false;
    expect(colorAttachment.texture.isDestroyed).to.be.false;
    expect(stencilTexture.isDestroyed).to.be.false;
    expect(depthTexture.isDestroyed).to.be.false;
    expect(frameBuffer.renderer).to.eql(null);
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
    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }, { texture: { format: gl.RGBA } }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    const stencilTexture = renderPass.stencilAttachment.texture;
    const depthTexture = renderPass.depthAttachment.texture;
    const frameBuffer = renderPass.frameBuffer;
    const att0 = renderPass.attachments[0];
    const att1 = renderPass.attachments[1];

    //删除meshes和attachments
    renderPass.dispose({
      colorAttachment: RenderPassDestroyAttachmentType.keep,
      depthStencilAttachment: RenderPassDestroyAttachmentType.destroy,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments.length).to.eql(0);
    expect(att0.texture.isDestroyed).to.be.false;
    expect(att1.texture.isDestroyed).to.be.false;
    expect(stencilTexture.isDestroyed).to.be.true;
    expect(depthTexture.isDestroyed).to.be.true;
    expect(frameBuffer.renderer).to.eql(null);
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
    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }, { texture: { format: gl.RGBA } }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    const stencilTexture = renderPass.stencilAttachment.texture;
    const depthTexture = renderPass.depthAttachment.texture;
    const frameBuffer = renderPass.frameBuffer;
    const externalTexture = renderPass.attachments[0];
    const att1 = renderPass.attachments[1];

    renderPass.dispose({
      colorAttachment: RenderPassDestroyAttachmentType.keepExternal,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments.length).to.eql(0);
    expect(externalTexture.texture.isDestroyed).to.be.false;
    expect(att1.texture.isDestroyed).to.be.true;
    expect(stencilTexture.isDestroyed).to.be.true;
    expect(depthTexture.isDestroyed).to.be.true;
    expect(frameBuffer.renderer).to.eql(null);
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

    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }, { texture: { format: gl.RGBA } }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    const stencilTexture = renderPass.stencilAttachment.texture;
    const depthTexture = renderPass.depthAttachment.texture;
    const frameBuffer = renderPass.frameBuffer;
    const externalTexture = renderPass.attachments[0];
    const att1 = renderPass.attachments[1];

    renderPass.dispose({
      depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments.length).to.eql(0);
    expect(externalTexture.texture.isDestroyed).to.be.true;
    expect(att1.texture.isDestroyed).to.be.true;
    expect(stencilTexture.isDestroyed).to.be.false;
    expect(depthTexture.isDestroyed).to.be.false;
    expect(frameBuffer.renderer).to.eql(null);
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

    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_stencil_opaque,
      },
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    rp1.configure(renderer);

    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }, { texture: { format: gl.RGBA } }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_stencil_opaque,
        storage: rp1.depthAttachment.storage,
      },
    });
    const frame = createRenderFrame(renderer, renderPass);

    renderer.renderRenderFrame(frame);

    const frameBuffer = renderPass.frameBuffer;
    const externalTexture = renderPass.attachments[0];
    const att1 = renderPass.attachments[1];
    const depthStencilRenderBuffer = frameBuffer.depthStencilRenderBuffer;

    expect(frameBuffer.externalStorage).to.be.true;

    renderPass.dispose({
      depthStencilAttachment: RenderPassDestroyAttachmentType.keepExternal,
    });

    expect(material.isDestroyed).to.be.true;
    expect(geometry.isDestroyed).to.be.true;
    expect(renderPass.meshes).to.eql([]);
    expect(renderPass.options).to.eql(null);
    expect(renderPass.renderer).to.eql(null);
    expect(renderPass.attachments.length).to.eql(0);
    expect(externalTexture.texture.isDestroyed).to.be.true;
    expect(att1.texture.isDestroyed).to.be.true;
    expect(frameBuffer.renderer).to.eql(null);
    expect(depthStencilRenderBuffer.renderer).to.exist;
  });

  // 销毁renderFrame
  it('render frame dispose with no params', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const marsTexture = result.texture;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }, { texture: { format: gl.RGBA } }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
    });
    const frame = createRenderFrame(renderer, renderPass, { t: marsTexture });

    renderer.renderRenderFrame(frame);
    frame.dispose();

    expect(frame.isDestroyed).to.be.true;
    expect(frame.renderPasses.length).to.eql(0);
    expect(renderPass.isDestroyed).to.be.true;
    expect(mesh.isDestroyed).to.be.true;
    expect(geom.isDestroyed).to.be.true;
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.true;
    expect(frame.semantics.semantics.t).to.eql(undefined);
  });

  //  销毁renderFrame，保留semantics
  it('render frame dispose with semantics keep', async () => {
    const mesh = result.mesh;
    const marsTexture = result.texture;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const renderPass = new RenderPass(renderer, {
      attachments: [{ texture }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });
    const frame = createRenderFrame(renderer, renderPass, { t: marsTexture });

    renderer.renderRenderFrame(frame);
    frame.dispose({ semantics: DestroyOptions.keep });

    expect(frame.isDestroyed).to.be.true;
    expect(frame.renderPasses.length).to.eql(0);
    expect(renderPass.isDestroyed).to.be.true;
    expect(frame.semantics.semantics.t).to.eql(marsTexture);
  });

  //
  it('render frame dispose with passes keep ', async () => {
    const mesh = result.mesh;
    const marsTexture = result.texture;
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });

    const renderPass = new RenderPass(renderer, {
      renderer,
      attachments: [{ texture }, { texture: { format: gl.RGBA } }],
      name: 'basic',
      meshes: [mesh],
      camera: new Camera('main'),
    });
    const frame = createRenderFrame(renderer, renderPass, { t: marsTexture });

    renderer.renderRenderFrame(frame);

    frame.dispose({ passes: DestroyOptions.keep });

    expect(frame.isDestroyed).to.be.true;
    expect(frame.renderPasses.length).to.eql(0);
    expect(renderPass.isDestroyed).to.be.false;
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

async function createTexture (engine, needCompressed = false) {
  const source = needCompressed ? {
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

async function createMesh (engine) {
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
      shader: { vertex: vs, fragment: fs },
      states: {},
    });

  const mesh = new Mesh(engine, {
    geometry: geom,
    material,
  });

  return {
    texture, geom, material, mesh,
  };
}

function DestroyMesh (result) {
  result.texture.dispose();
  result.geom.dispose();
  result.material.dispose();
  result.mesh.dispose();
}

function createRenderFrame (renderer, renderPass, semantics = {}) {
  const frame = new RenderFrame({
    renderer,
    semantics,
    camera: new Camera(),
    clearAction: {
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    },
  });

  frame.setRenderPasses([renderPass]);

  return frame;
}
