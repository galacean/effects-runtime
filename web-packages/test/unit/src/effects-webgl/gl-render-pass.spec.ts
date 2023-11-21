//@ts-nocheck
import { TextureSourceType, RenderPass, RenderPassDestroyAttachmentType, RenderPassAttachmentStorageType, OrderType, Mesh } from '@galacean/effects-core';
import { GLRenderer, GLTexture, GLGeometry, GLMaterial } from '@galacean/effects-webgl';
import { getGL2 } from './gl-utils';
import { MathUtils } from './math-utils';

const { expect } = chai;

describe('effects-webgl/render-pass', () => {
  let gl = getGL2()!;
  let renderer = new GLRenderer(gl.canvas, 'webgl2');
  let engine = renderer.engine;

  after(() => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.dispose();
    renderer = null;
    gl.canvas.remove();
    gl = null;
    engine = null;
  });

  it('reset gl viewport', () => {
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    rp1.configure(renderer);
    const vp0 = gl.getParameter(gl.VIEWPORT);

    expect(Array.from(vp0)).is.deep.equal([0, 0, 128, 256]);
    expect(rp1.attachments[0].texture.width).is.eql(128);
    expect(rp1.attachments[0].texture.height).is.eql(256);
    const rp2 = new RenderPass(renderer, {
      name: 'draw',
      meshes: [],
    });

    rp2.initialize(renderer);

    rp2.configure(renderer);
    const vp1 = Array.from(gl.getParameter(gl.VIEWPORT));

    expect(vp1).is.deep.equal([
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
    ]);
    rp1.dispose();
    rp2.dispose();
  });

  it('fbo accept texture as color attachment', () => {
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture }],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    rp1.configure(renderer);
    expect(texture.width).is.eql(128);
    expect(texture.height).is.eql(256);
    const rp2 = new RenderPass(renderer, {
      attachments: [{ texture }],
      viewport: [0, 0, 128, 256],
    });

    rp2.initialize(renderer);

    rp2.configure(renderer);
    expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);

    texture.destroyed = chai.spy(texture.destroyed);
    rp2.dispose({ colorAttachment: RenderPassDestroyAttachmentType.keepExternal });
    expect(texture.destroyed).not.has.been.called.once;
    expect(texture.width).is.eql(128);
    expect(texture.height).is.eql(256);
    rp1.dispose();
    expect(texture.destroyed).is.true;

    expect(texture.width).is.eql(0);
    expect(texture.height).is.eql(0);
  });

  it('render pass reset attachments', () => {
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    rp1.resetAttachments({
      attachments: [{ texture: { format: gl.RGBA } }],
    });
    expect(rp1.attachments.length).is.eql(1);
    const colorAttachment = rp1.attachments[0];

    expect(colorAttachment.size).to.deep.equal([gl.drawingBufferWidth, gl.drawingBufferHeight]);
    rp1.dispose();
    expect(rp1.attachments.length).is.eql(0);
  });

  it('render pass reset attachments with viewport', () => {
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    expect(rp1.viewport?.[2]).to.eql(128);
    expect(rp1.viewport?.[3]).to.eql(256);
    rp1.resetAttachments({
      attachments: [{ texture: { format: gl.RGBA } }],
      viewport: [0, 0, 1024, 1024],
    });
    expect(rp1.viewport?.[2]).to.eql(1024);
    expect(rp1.viewport?.[3]).to.eql(1024);
    expect(rp1.attachments.length).is.eql(1);
    const colorAttachment = rp1.attachments[0];

    expect(colorAttachment.size).to.deep.equal([1024, 1024]);
    rp1.dispose();
    expect(rp1.attachments.length).is.eql(0);
  });

  it('render pass reset attachments with viewportScale(default 1)', () => {
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    expect(rp1.viewport?.[2]).to.eql(128);
    expect(rp1.viewport?.[3]).to.eql(256);
    rp1.resetAttachments({
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewportScale: 0.5,
    });
    expect(rp1.viewport).to.deep.equals([0, 0, renderer.width * 0.5, renderer.height * 0.5]);
    expect(rp1.renderer.width).to.eql(300);
    expect(rp1.renderer.height).to.eql(150);
    expect(rp1.attachments.length).is.eql(1);
    const colorAttachment = rp1.attachments[0];

    expect(colorAttachment.size).to.deep.equal([150, 75]);
    const frameBuffer = rp1.frameBuffer;

    expect(frameBuffer?.depthStencilStorageType).to.eql(RenderPassAttachmentStorageType.depth_24_stencil_8_texture);
    expect(frameBuffer?.depthTexture?.width).to.eql(150);
    expect(frameBuffer?.depthTexture?.height).to.eql(75);

    expect(frameBuffer?.viewport[2]).to.eql(150);
    expect(frameBuffer?.viewport[3]).to.eql(75);
    expect(frameBuffer?.stencilTexture?.source.sourceType).to.eql(
      RenderPassAttachmentStorageType.depth_24_stencil_8_texture
    );

    rp1.dispose();
    expect(rp1.attachments.length).is.eql(0);
  });

  it('render pass will keep external texture after reset attachments', () => {
    const texture = new GLTexture(engine, {
      sourceType: TextureSourceType.framebuffer,
      format: gl.RGBA,
    });
    const rp0 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_stencil_opaque,
      },
      viewport: [0, 0, 128, 256],
    });

    rp0.initialize(renderer);

    rp0.configure(renderer);
    expect(rp0.frameBuffer.externalStorage).is.false;
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture }, { texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_stencil_opaque,
        storage: rp0.depthAttachment?.storage,
      },
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(2);
    const att0 = rp1.attachments[0];
    const att1 = rp1.attachments[1];

    expect(att0.size).to.deep.equal([128, 256], 's0');
    expect(att0.externalTexture).is.true;
    expect(att1.size).to.deep.equal([128, 256], 's1');
    expect(att1.externalTexture).is.false;
    expect(rp1.depthAttachment).is.exist;
    expect(rp1.frameBuffer.externalStorage).is.true;
    rp1.resetAttachments({ attachments: [] });
    expect(att0.size).to.deep.equal([128, 256], 's2');
    expect(att1.size).to.deep.equal([0, 0], 's3');
    expect(att1.texture.isDestroyed).to.be.true;
    expect(att0.texture.isDestroyed).to.be.false;
    expect(rp1.depthAttachment).is.not.exist;
    expect(rp0.depthAttachment?.storage).is.exist;
    expect(rp0.depthAttachment?.storage.size).is.deep.equal([128, 256], 's4');
    rp0.dispose();
    expect(rp0.depthAttachment?.storage).is.not.exist;
  });

  it('fbo accept texture as depth stencil texture', () => {
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    rp1.configure(renderer);
    expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).is.eql(gl.FRAMEBUFFER_COMPLETE);
    const texture = rp1.depthAttachment?.texture;

    expect(texture.width).is.eql(128);
    expect(texture.height).is.eql(256);
    const rp2 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
        storage: rp1.depthAttachment?.storage,
      },
      viewport: [0, 0, 128, 256],
    });

    rp2.initialize(renderer);
    rp2.configure(renderer);
    expect(rp1.depthAttachment?.storage).is.eql(rp2.depthAttachment?.storage);
    expect(rp2.depthAttachment?.storage).is.not.null;

    rp2.dispose({ depthStencilAttachment: RenderPassDestroyAttachmentType.keepExternal });
    expect(texture.destroyed).is.eql(false);
    expect(texture.width).is.eql(128);
    expect(texture.height).is.eql(256);
    rp1.dispose();
    expect(texture.destroyed).is.eql(true);
    expect(texture.width).is.eql(0);
    expect(texture.height).is.eql(0);
  });

  it('if priority is the same,last added item will in behind', () => {
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });
    const mesh00 = new Mesh(engine, { geometry: geom, material, priority: 0 });
    const mesh0 = new Mesh(engine, { geometry: geom, material, priority: 1 });
    const mesh1 = new Mesh(engine, { geometry: geom, material, priority: 1 });
    const mesh2 = new Mesh(engine, { geometry: geom, material, priority: 2 });
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes: [],
      meshOrder: OrderType.ascending,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    rp1.addMesh(mesh0);
    rp1.addMesh(mesh1);
    rp1.addMesh(mesh2);
    rp1.addMesh(mesh00);
    expect(rp1.meshes).to.deep.equal([mesh00, mesh0, mesh1, mesh2]);
  });

  it('custom viewport after binding', () => {
    let rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      meshes: [],
      meshOrder: OrderType.ascending,
    });

    rp1.initialize(renderer);

    rp1.configure(renderer);
    expect(rp1.viewport).to.deep.equal([0, 0, renderer.width, renderer.height]);
    expect(rp1.viewportScale).to.eql(1);

    rp1.dispose();
    rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      meshes: [],
      viewportScale: 0.5,
      meshOrder: OrderType.ascending,
    });
    rp1.initialize(renderer);

    rp1.configure(renderer);
    expect(rp1.viewport).to.deep.equal([0, 0, renderer.width / 2, renderer.height / 2]);
    expect(rp1.viewportScale).to.eql(0.5);
  });

  it('render pass resort meshes mesh order is ascending && lenght <= 30', () => {
    const meshes = [];
    const length = 20;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(
        engine,
        {
          geometry: geom,
          material,
          priority: MathUtils.randInt(0, length),
        });

      meshes.push(mesh);
    }
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    for (let i = 0, j = length - 1; i <= j; i++, j--) {
      const tempI = rp1.meshes[i];
      const tempJ = rp1.meshes[j];

      expect(tempJ.priority >= tempI.priority).is.eql(true);
    }
    rp1.dispose();
  });

  it('render pass resort meshes mesh order is descending && lenght <= 30', () => {
    const meshes = [];
    const length = 20;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: MathUtils.randInt(0, length) });

      meshes.push(mesh);
    }
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      meshOrder: OrderType.descending,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    for (let i = 0, j = length - 1; i <= j; i++, j--) {
      const tempI = rp1.meshes[i];
      const tempJ = rp1.meshes[j];

      expect(tempJ.priority <= tempI.priority).is.eql(true);
    }
    rp1.dispose();
  });

  it('render pass resort meshes mesh order is none && lenght <= 30', () => {
    const meshes = [];
    const order = [8, 8, 4, 12, 20, 16, 16, 17, 17, 15, 1, 14, 15, 0, 6, 16, 1, 10, 10, 17];
    const length = 20;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: order[index] });

      meshes.push(mesh);
    }
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      meshOrder: OrderType.none,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    for (let i = 0; i < length; i++) {
      expect(rp1.meshes[i].priority).is.eql(order[i]);
    }

    rp1.dispose();
  });

  it('render pass resort meshes mesh order is ascending && lenght > 30', () => {
    const meshes = [];
    const length = 70;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: MathUtils.randInt(0, length) });

      meshes.push(mesh);
    }
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    for (let i = 0, j = length - 1; i <= j; i++, j--) {
      const tempI = rp1.meshes[i];
      const tempJ = rp1.meshes[j];

      expect(tempJ.priority >= tempI.priority).is.eql(true);
    }
    rp1.dispose();
  });

  it('render pass resort meshes mesh order is descending && lenght > 30', () => {
    const meshes = [];
    const length = 70;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: MathUtils.randInt(0, 200) });

      meshes.push(mesh);
    }

    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      meshOrder: OrderType.descending,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);
    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    for (let i = 0, j = length - 1; i <= j; i++, j--) {
      const tempI = rp1.meshes[i];
      const tempJ = rp1.meshes[j];

      expect(tempJ.priority <= tempI.priority).is.eql(true);
    }
    rp1.dispose();
  });

  it('render pass resort meshes mesh order is none && lenght > 30', () => {
    const meshes = [];
    const order = [
      185, 69, 191, 12, 141, 30, 2, 61, 75, 151, 22, 134, 126, 169, 176, 112, 160, 24, 131, 58, 133, 151, 104, 113, 73,
      196, 184, 104, 130, 17, 160, 102, 195, 106, 176, 167, 51, 101, 126, 167, 179, 5, 109, 122, 82, 123, 44, 16, 98,
      71, 140, 156, 200, 177, 193, 110, 160, 84, 20, 23, 12, 74, 21, 66, 199, 49, 88, 152, 172, 151,
    ];
    const length = 70;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: order[index] });

      meshes.push(mesh);
    }
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      meshOrder: OrderType.none,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    for (let i = 0; i < length; i++) {
      expect(rp1.meshes[i].priority).is.eql(order[i]);
    }

    rp1.dispose();
  });

  it('RPOrderTest07 render pass resort meshes with meshes.length===0', () => {
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes: [],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    expect(rp1.meshes.length).is.eql(0);
    rp1.dispose();
  });

  it('RPOrderTest08 render pass resort meshes with meshes.length===1', () => {
    const spy = chai.spy(() => { });
    const call = renderer.glRenderer.pipelineContext.viewport;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });
    const mesh = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 2,
        name: 'mesh1',
      });
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes: [mesh],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    renderer.glRenderer.pipelineContext.viewport = spy;
    rp1.configure(renderer);
    expect(spy).has.been.called.once;
    renderer.glRenderer.pipelineContext.viewport = call;
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    expect(rp1.meshes.length).is.eql(1);
    expect(rp1.meshes[0]).is.eql(mesh);
    rp1.dispose();
  });

  it('RPOrderTest09 render pass resort meshes with meshes.length===2', () => {
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });
    const mesh = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 2,
        name: 'mesh1',
      });
    const mesh1 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 4,
        name: 'mesh1',
      });
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes: [mesh1, mesh],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    expect(rp1.meshes.length).is.eql(2);
    //排完序mesh应该在mesh1前面
    expect(rp1.meshes[0]).is.eql(mesh);
    rp1.dispose();
  });

  it('render pass add/remove meshes with meshorder is ascending', () => {
    const meshes = [];
    const length = 20;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: MathUtils.randInt(0, 20) });

      meshes.push(mesh);
    }
    const testMesh0 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 40,
        name: 'test mesh0',
      });
    const testMesh1 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: -2,
        name: 'test mesh1',
      });
    const testMesh2 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 10,
        name: 'test mesh2',
      });
    const testMesh3 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 8,
        name: 'test mesh3',
      });
    const rp1 = new RenderPass(renderer,
      {
        attachments: [],
        meshes,
        viewport: [0, 0, 128, 256],
      });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    rp1.addMesh(testMesh0);
    rp1.addMesh(testMesh1);
    rp1.addMesh(testMesh2);
    rp1.addMesh(testMesh3);
    expect(rp1.meshes.length).is.eql(length + 4);
    for (let i = 0, j = length + 3; i <= j; i++, j--) {
      const tempI = rp1.meshes[i];
      const tempJ = rp1.meshes[j];

      expect(tempJ.priority >= tempI.priority).is.eql(true);
    }

    rp1.removeMesh(testMesh1);
    rp1.removeMesh(testMesh2);
    rp1.removeMesh(testMesh3);
    rp1.removeMesh(testMesh0);

    rp1.meshes.forEach(mesh => {
      expect(mesh).not.eql(testMesh0);
      expect(mesh).not.eql(testMesh1);
      expect(mesh).not.eql(testMesh2);
      expect(mesh).not.eql(testMesh3);
    });
    rp1.dispose();
  });

  it('render pass add/remove meshes with meshorder is descending', () => {
    const meshes = [];
    const length = 20;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: MathUtils.randInt(0, length) });

      meshes.push(mesh);
    }
    const testMesh0 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 40,
        name: 'test mesh0',
      });
    const testMesh1 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 10,
        name: 'test mesh1',
      });
    const testMesh2 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 16,
        name: 'test mesh2',
      });
    const testMesh3 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 6,
        name: 'test mesh3',
      });
    const testMesh4 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: -39,
        name: 'test mesh4',
      });
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      meshOrder: OrderType.descending,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    rp1.addMesh(testMesh0);
    rp1.addMesh(testMesh1);
    rp1.addMesh(testMesh2);
    rp1.addMesh(testMesh3);
    rp1.addMesh(testMesh4);
    expect(rp1.meshes.length).is.eql(length + 5);
    for (let i = 0, j = length + 4; i <= j; i++, j--) {
      const tempI = rp1.meshes[i];
      const tempJ = rp1.meshes[j];

      expect(tempJ.priority <= tempI.priority).is.eql(true);
    }
    rp1.removeMesh(testMesh0);
    rp1.removeMesh(testMesh1);
    rp1.removeMesh(testMesh2);
    rp1.removeMesh(testMesh3);
    rp1.removeMesh(testMesh4);
    rp1.meshes.forEach(mesh => {
      expect(mesh).not.eql(testMesh0);
      expect(mesh).not.eql(testMesh1);
      expect(mesh).not.eql(testMesh2);
      expect(mesh).not.eql(testMesh3);
      expect(mesh).not.eql(testMesh4);
    });
    rp1.dispose();
  });

  it('render pass add/remove meshes with meshorder is none', () => {
    const meshes = [];
    const order = [9, 12, 1, 11, 16, 16, 20, 9, 9, 5, 18, 2, 20, 6, 13, 4, 1, 1, 19, 13];
    const length = 20;
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });

    for (let index = 0; index < length; index++) {
      const mesh = new Mesh(engine, { geometry: geom, material, priority: order[index] });

      meshes.push(mesh);
    }
    const testMesh0 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: -10,
        name: 'test mesh',
      });
    const testMesh1 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 10,
        name: 'test mesh1',
      });
    const testMesh2 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 1,
        name: 'test mes2',
      });
    const testMesh3 = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 40,
        name: 'test mes3',
      });
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes,
      meshOrder: OrderType.none,
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    rp1.addMesh(testMesh0);
    rp1.addMesh(testMesh1);
    rp1.addMesh(testMesh2);
    rp1.addMesh(testMesh3);
    expect(rp1.meshes.length).is.eql(length + 4);
    for (let i = 0; i < length; i++) {
      expect(rp1.meshes[i].priority).is.eql(order[i]);
    }
    expect(rp1.meshes[length].priority).is.eql(testMesh0.priority);
    expect(rp1.meshes[length + 1].priority).is.eql(testMesh1.priority);
    expect(rp1.meshes[length + 2].priority).is.eql(testMesh2.priority);
    expect(rp1.meshes[length + 3].priority).is.eql(testMesh3.priority);

    rp1.removeMesh(testMesh1);
    rp1.removeMesh(testMesh2);
    rp1.removeMesh(testMesh3);
    rp1.removeMesh(testMesh0);

    rp1.meshes.forEach(mesh => {
      expect(mesh).not.eql(testMesh0);
      expect(mesh).not.eql(testMesh1);
      expect(mesh).not.eql(testMesh2);
      expect(mesh).not.eql(testMesh3);
    });
    rp1.dispose();
  });

  it('render pass add/remove meshes at meshes.length===0', () => {
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });
    const testMesh = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 2,
        name: 'test mesh',
      });
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes: [],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    rp1.addMesh(testMesh);
    expect(rp1.meshes.length).is.eql(1);
    rp1.meshes.forEach(mesh => {
      if (mesh.name === 'test mesh') {
        expect(mesh).is.eql(testMesh);
      }
    });
    rp1.removeMesh(testMesh);
    //加入测试mesh并移除后length应该为0
    expect(rp1.meshes.length).to.eql(0);
    rp1.dispose();
  });

  it('render pass add/remove meshes at meshes.length===1', () => {
    const geom = new GLGeometry(
      engine,
      {
        attributes: {},
      });

    const material = new GLMaterial(
      engine,
      {
        shader: { vertex: '', fragment: '' },
        states: {},
      });
    const mesh = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 2,
        name: 'mesh1',
      });
    const testMesh = new Mesh(
      engine,
      {
        geometry: geom,
        material,
        priority: 2,
        name: 'test mesh',
      });
    const rp1 = new RenderPass(renderer, {
      attachments: [],
      meshes: [],
      viewport: [0, 0, 128, 256],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    rp1.configure(renderer);
    expect(rp1.attachments.length).is.eql(0);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    rp1.addMesh(mesh);
    rp1.addMesh(testMesh);
    expect(rp1.meshes.length).is.eql(2);
    rp1.meshes.forEach(mesh => {
      if (mesh.name === 'test mesh') {
        expect(mesh).is.eql(testMesh);
      }
    });
    rp1.removeMesh(testMesh);
    //加入测试mesh并移除后length应该为1
    expect(rp1.meshes.length).to.eql(1);
    rp1.dispose();
  });

  //render test with multiple pass
  //向render传入不同的width和height来进行resize,此时没有设置viewport的renderpass需要reset
  it('render pass resize with different height and width', () => {
    //重置renderer的size
    const oldWidth = 300;
    const oldHeight = 150;
    const newWidth = 100;
    const newHeight = 50;
    const rp2Width = 110;
    const rp2Heigth = 440;

    //renderer.resize(oldWidth,oldHeight);
    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      meshes: [],
    });

    rp1.initialize(renderer);
    const rp2 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      meshes: [],
      viewport: [0, 0, rp2Width, rp2Heigth],
    });

    rp2.initialize(renderer);

    rp1.configure(renderer);
    rp2.configure(renderer);
    const spy = chai.spy(() => { });
    const call = renderer.glRenderer.resize;

    expect(rp2.viewport?.[2]).to.eql(rp2Width);
    expect(rp1.viewport).to.deep.equals([0, 0, 300, 150]);
    expect(rp2.viewport?.[3]).to.eql(rp2Heigth);
    const colorAttachment = rp1.attachments[0];

    expect(colorAttachment.textureOptions?.format).to.eql(gl.RGBA);
    expect(colorAttachment.height).to.eql(oldHeight);
    expect(colorAttachment.width).to.eql(oldWidth);
    expect(rp1.frameBuffer?.colorTextures[0].height).to.eql(oldHeight);
    expect(rp1.frameBuffer?.colorTextures[0].width).to.eql(oldWidth);
    expect(rp1.frameBuffer?.depthTexture?.height).to.eql(oldHeight);
    expect(rp1.frameBuffer?.depthTexture?.width).to.eql(oldWidth);
    expect(rp1.frameBuffer?.stencilTexture?.height).to.eql(oldHeight);
    expect(rp1.frameBuffer?.stencilTexture?.width).to.eql(oldWidth);
    expect(rp1.frameBuffer?.viewport?.[2]).to.eql(oldWidth);
    expect(rp1.frameBuffer?.viewport?.[3]).to.eql(oldHeight);
    renderer.glRenderer.resize = spy;
    //传入不同的宽高，renderer要做resize处理，同时renderpass的viewport和所属的color/depth-setencil都要做同步处理 但是用户传入viewport的pass不会发生改变
    renderer.resize(newWidth, newHeight);
    expect(spy).has.been.called.once;
    renderer.glRenderer.resize = call;
    renderer.resize(newWidth, newHeight);
    expect(rp1.frameBuffer?.colorTextures[0].height).to.eql(newHeight);
    expect(rp1.frameBuffer?.colorTextures[0].width).to.eql(newWidth);
    expect(rp1.frameBuffer?.depthTexture?.height).to.eql(newHeight);
    expect(rp1.frameBuffer?.depthTexture?.width).to.eql(newWidth);
    expect(rp1.frameBuffer?.stencilTexture?.height).to.eql(newHeight);
    expect(rp1.frameBuffer?.stencilTexture?.width).to.eql(newWidth);
    expect(rp1.frameBuffer?.viewport?.[2]).to.eql(newWidth);
    expect(rp1.frameBuffer?.viewport?.[3]).to.eql(newHeight);
    expect(rp1.attachments[0].height).to.eql(newHeight);
    expect(rp1.attachments[0].width).to.eql(newWidth);
    expect(rp1.viewport).to.eql([0, 0, newWidth, newHeight]);
    //rp2不会发生改变,rp2为用户传入的viewport
    expect(rp2.frameBuffer?.colorTextures[0].height).to.eql(rp2Heigth);
    expect(rp2.frameBuffer?.colorTextures[0].width).to.eql(rp2Width);
    expect(rp2.frameBuffer?.depthTexture?.height).to.eql(rp2Heigth);
    expect(rp2.frameBuffer?.depthTexture?.width).to.eql(rp2Width);
    expect(rp2.frameBuffer?.stencilTexture?.height).to.eql(rp2Heigth);
    expect(rp2.frameBuffer?.stencilTexture?.width).to.eql(rp2Width);
    expect(rp2.frameBuffer?.viewport?.[2]).to.eql(rp2Width);
    expect(rp2.frameBuffer?.viewport?.[3]).to.eql(rp2Heigth);
    expect(rp2.attachments[0].height).to.eql(rp2Heigth);
    expect(rp2.attachments[0].width).to.eql(rp2Width);
    expect(rp2.viewport?.[3]).to.eql(rp2Heigth);
    expect(rp2.viewport?.[2]).to.eql(rp2Width);
    renderer.resize(300, 150);
    rp1.dispose();
    rp2.dispose();
  });

  //向render传入相同的width和height来进行resize,此时判断不需要resize，相应的renderpass也就不需要reset
  it('render pass resize with identical height and width', () => {
    //重置renderer的size
    const oldWidth = 300;
    const oldHeight = 150;

    renderer.resize(300, 150);
    const spy = chai.spy(() => {
    });
    const call = renderer.glRenderer.resize;
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      meshes: [],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    expect(rp1.viewport).to.deep.equal([0, 0, oldWidth, oldHeight]);
    const colorAttachment = rp1.attachments[0];

    expect(colorAttachment.textureOptions?.format).to.eql(gl.RGBA);
    expect(colorAttachment.height).to.eql(oldHeight);
    expect(colorAttachment.width).to.eql(oldWidth);
    const frameBuffer = rp1.frameBuffer;

    expect(frameBuffer?.colorTextures[0].height).to.eql(oldHeight);
    expect(frameBuffer?.colorTextures[0].width).to.eql(oldWidth);
    expect(frameBuffer?.depthTexture?.height).to.eql(oldHeight);
    expect(frameBuffer?.depthTexture?.width).to.eql(oldWidth);
    expect(frameBuffer?.stencilTexture?.height).to.eql(oldHeight);
    expect(frameBuffer?.stencilTexture?.width).to.eql(oldWidth);
    expect(frameBuffer?.viewport?.[2]).to.eql(oldWidth);
    expect(frameBuffer?.viewport?.[3]).to.eql(oldHeight);
    renderer.glRenderer.resize = spy;
    renderer.resize(300, 150);
    expect(spy).not.has.been.called.once;
    renderer.glRenderer.resize = call;
    renderer.resize(300, 150);
    //传入相同的宽高的时候renderpass不做resset处理
    expect(rp1.viewport).to.deep.equals([0, 0, 300, 150]);
    expect(colorAttachment.textureOptions?.format).to.eql(gl.RGBA);
    expect(colorAttachment.height).to.eql(oldHeight);
    expect(colorAttachment.width).to.eql(oldWidth);
    expect(frameBuffer?.colorTextures[0].height).to.eql(oldHeight);
    expect(frameBuffer?.colorTextures[0].width).to.eql(oldWidth);
    expect(frameBuffer?.depthTexture?.height).to.eql(oldHeight);
    expect(frameBuffer?.depthTexture?.width).to.eql(oldWidth);
    expect(frameBuffer?.stencilTexture?.height).to.eql(oldHeight);
    expect(frameBuffer?.stencilTexture?.width).to.eql(oldWidth);
    expect(frameBuffer?.viewport?.[2]).to.eql(oldWidth);
    expect(frameBuffer?.viewport?.[3]).to.eql(oldHeight);
    rp1.dispose();
  });

  it('use attachment texture', () => {
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      meshes: [],
    });

    rp1.initialize(renderer);

    const rp2 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: rp1.depthAttachment,
      meshes: [],
    });

    rp2.initialize(renderer);

    expect(rp1.depthAttachment.texture).to.exist;
    expect(rp1.depthAttachment.texture).to.eql(rp2.depthAttachment.texture);
    rp1.dispose();
    expect(rp2.depthAttachment.texture.isDestroyed).to.be.true;
  });

  //同时进行build reset resize操作
  it('render pass with build->reset->resize', () => {
    //重置renderer的size
    const buildWidth = 128, buildHeight = 64;
    const resetWidth = 300;
    const resetHeight = 150;
    const resizeWidth = 1024, resizeHeight = 2048;
    const spy = chai.spy(() => {
    });
    const call = renderer.glRenderer.resize;
    //创建的时候传入viewport
    const rp1 = new RenderPass(renderer, {
      attachments: [{ texture: { format: gl.RGBA } }],
      depthStencilAttachment: {
        storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
      },
      viewport: [0, 0, buildWidth, buildHeight],
      meshes: [],
    });

    rp1.initialize(renderer);

    renderer.glRenderer.pipelineContext.bindSystemFramebuffer();
    expect(rp1.viewport?.[2]).to.eql(buildWidth);
    expect(rp1.viewport?.[3]).to.eql(buildHeight);
    const colorAttachment = rp1.attachments[0];

    expect(colorAttachment.textureOptions?.format).to.eql(gl.RGBA);
    expect(colorAttachment.height).to.eql(buildHeight);
    expect(colorAttachment.width).to.eql(buildWidth);
    const frameBuffer = rp1.frameBuffer;

    expect(frameBuffer?.colorTextures[0].height).to.eql(buildHeight);
    expect(frameBuffer?.colorTextures[0].width).to.eql(buildWidth);
    expect(frameBuffer?.depthTexture?.height).to.eql(buildHeight);
    expect(frameBuffer?.depthTexture?.width).to.eql(buildWidth);
    expect(frameBuffer?.stencilTexture?.height).to.eql(buildHeight);
    expect(frameBuffer?.stencilTexture?.width).to.eql(buildWidth);
    expect(frameBuffer?.viewport?.[2]).to.eql(buildWidth);
    expect(frameBuffer?.viewport?.[3]).to.eql(buildHeight);
    //reset的时候viewportScale传入0.5
    rp1.resetAttachments(
      {
        attachments: [{ texture: { format: gl.RGBA } }],
        depthStencilAttachment: {
          storageType: RenderPassAttachmentStorageType.depth_24_stencil_8_texture,
        },
        viewportScale: 0.5,
      }
    );
    //renderpass此时没有viewport值
    expect(rp1.viewport).to.eql([0, 0, 150, 75]);
    expect(colorAttachment.textureOptions?.format).to.eql(gl.RGBA);
    //reset后colorAttachment对象销毁掉了
    expect(colorAttachment.height).to.eql(0);
    expect(colorAttachment.width).to.eql(0);
    expect(rp1.frameBuffer?.colorTextures[0].height).to.eql(resetHeight * 0.5);
    expect(rp1.frameBuffer?.colorTextures[0].width).to.eql(resetWidth * 0.5);
    expect(rp1.frameBuffer?.depthTexture?.height).to.eql(resetHeight * 0.5);
    expect(rp1.frameBuffer?.depthTexture?.width).to.eql(resetWidth * 0.5);
    expect(rp1.frameBuffer?.stencilTexture?.height).to.eql(resetHeight * 0.5);
    expect(rp1.frameBuffer?.stencilTexture?.width).to.eql(resetWidth * 0.5);
    expect(rp1.frameBuffer?.viewport?.[2]).to.eql(resetWidth * 0.5);
    expect(rp1.frameBuffer?.viewport?.[3]).to.eql(resetHeight * 0.5);
    //resize后framebuffer的宽高也要跟着变
    renderer.glRenderer.resize = spy;
    renderer.resize(resizeWidth, resizeHeight);
    expect(spy).has.been.called.once;
    renderer.glRenderer.resize = call;
    renderer.resize(resizeWidth, resizeHeight);
    expect(rp1.viewport).to.eql([0, 0, resizeWidth * 0.5, resizeHeight * 0.5]);
    expect(rp1.frameBuffer?.colorTextures[0].height).to.eql(resizeHeight * 0.5);
    expect(rp1.frameBuffer?.colorTextures[0].width).to.eql(resizeWidth * 0.5);
    expect(rp1.frameBuffer?.depthTexture?.height).to.eql(resizeHeight * 0.5);
    expect(rp1.frameBuffer?.depthTexture?.width).to.eql(resizeWidth * 0.5);
    expect(rp1.frameBuffer?.stencilTexture?.height).to.eql(resizeHeight * 0.5);
    expect(rp1.frameBuffer?.stencilTexture?.width).to.eql(resizeWidth * 0.5);
    expect(rp1.frameBuffer?.viewport?.[2]).to.eql(resizeWidth * 0.5);
    expect(rp1.frameBuffer?.viewport?.[3]).to.eql(resizeHeight * 0.5);
    //置回默认值，方便其他同学测试
    renderer.resize(300, 150);
    rp1.dispose();
  });
});
