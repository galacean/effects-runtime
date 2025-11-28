// @ts-nocheck
import {
  TextureSourceType, RenderPass, RenderPassDestroyAttachmentType,
  RenderPassAttachmentStorageType, OrderType, Mesh, DrawObjectPass,
} from '@galacean/effects-core';
import { GLTexture, GLGeometry, GLMaterial, GLEngine } from '@galacean/effects-webgl';
import { getGL2 } from './gl-utils';
import { MathUtils } from './math-utils';

const { expect } = chai;

describe('webgl/gl-render-pass', () => {
  let gl = getGL2()!;
  let engine = new GLEngine(gl.canvas, { glType: 'webgl2' });
  let renderer = engine.renderer;

  after(() => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    engine.dispose();
    renderer = null;
    gl.canvas.remove();
    gl = null;
    engine = null;
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
    const rp1 = new RenderPass(renderer);

    rp1.addMesh(mesh0);
    rp1.addMesh(mesh1);
    rp1.addMesh(mesh2);
    rp1.addMesh(mesh00);
    expect(rp1.meshes).to.deep.equal([mesh00, mesh0, mesh1, mesh2]);
  });

  it('custom viewport after binding', () => {
    let rp1 = new RenderPass(renderer);

    rp1.configure(renderer);
    expect(rp1.viewport).to.deep.equal([0, 0, renderer.width, renderer.height]);

    rp1.dispose();
    rp1 = new RenderPass(renderer);

    rp1.configure(renderer);
    expect(rp1.viewport).to.deep.equal([0, 0, renderer.width, renderer.height]);
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
    const rp1 = new RenderPass(renderer);

    for (const mesh of meshes) {
      rp1.addMesh(mesh);
    }

    renderer.engine.bindSystemFramebuffer();
    rp1.configure(renderer);

    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    for (let i = 0, j = length - 1; i <= j; i++, j--) {
      const tempI = rp1.meshes[i];
      const tempJ = rp1.meshes[j];

      expect(tempJ.priority >= tempI.priority).is.eql(true);
    }
    rp1.dispose();
  });

  it('RPOrderTest07 render pass resort meshes with meshes.length===0', () => {
    const rp1 = new RenderPass(renderer);

    renderer.engine.bindSystemFramebuffer();
    rp1.configure(renderer);

    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).is.null;
    expect(rp1.meshes.length).is.eql(0);
    rp1.dispose();
  });

  it('RPOrderTest08 render pass resort meshes with meshes.length===1', () => {
    const spy = chai.spy(() => { });
    const call = renderer.engine.viewport;
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
    const rp1 = new RenderPass(renderer);

    rp1.addMesh(mesh);

    renderer.engine.bindSystemFramebuffer();
    renderer.engine.viewport = spy;
    renderer.setFramebuffer(null);
    expect(spy).has.been.called.once;
    renderer.engine.viewport = call;

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
    const rp1 = new RenderPass(renderer);

    rp1.addMesh(mesh1);
    rp1.addMesh(mesh);

    renderer.engine.bindSystemFramebuffer();
    rp1.configure(renderer);

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
    const rp1 = new RenderPass(renderer);

    for (const mesh of meshes) {
      rp1.addMesh(mesh);
    }

    renderer.engine.bindSystemFramebuffer();
    rp1.configure(renderer);

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
    const rp1 = new RenderPass(renderer);

    renderer.engine.bindSystemFramebuffer();
    rp1.configure(renderer);

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
    const rp1 = new RenderPass(renderer);

    renderer.engine.bindSystemFramebuffer();
    rp1.configure(renderer);

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

    //engine.setSize(oldWidth,oldHeight);
    renderer.engine.bindSystemFramebuffer();
    const rp1 = new DrawObjectPass(renderer, {});

    const rp2 = new RenderPass(renderer);

    rp1.configure(renderer);
    rp2.configure(renderer);
    const spy = chai.spy(() => { });
    const call = renderer.resize;

    renderer.resize = spy;
    //传入不同的宽高，renderer要做resize处理，同时renderpass的viewport和所属的color/depth-setencil都要做同步处理 但是用户传入viewport的pass不会发生改变
    engine.setSize(newWidth, newHeight);
    expect(spy).has.been.called.once;
    renderer.resize = call;
    engine.setSize(newWidth, newHeight);
    expect(rp1.viewport).to.eql([0, 0, newWidth, newHeight]);
    engine.setSize(300, 150);
    rp1.dispose();
    rp2.dispose();
  });

  //向render传入相同的width和height来进行resize,此时判断不需要resize，相应的renderpass也就不需要reset
  it('render pass resize with identical height and width', () => {
    //重置renderer的size
    const oldWidth = 300;
    const oldHeight = 150;

    engine.setSize(300, 150);
    const spy = chai.spy(() => {
    });
    const call = renderer.resize;
    const rp1 = new RenderPass(renderer);

    renderer.engine.bindSystemFramebuffer();
    expect(rp1.viewport).to.deep.equal([0, 0, oldWidth, oldHeight]);

    renderer.resize = spy;
    engine.setSize(300, 150);
    expect(spy).has.been.called.once;
    renderer.resize = call;
    engine.setSize(300, 150);
    //传入相同的宽高的时候renderpass不做resset处理
    expect(rp1.viewport).to.deep.equals([0, 0, 300, 150]);
    rp1.dispose();
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
    const call = renderer.resize;
    //创建的时候传入viewport
    const rp1 = new DrawObjectPass(renderer, {});

    renderer.engine.bindSystemFramebuffer();

    //resize后framebuffer的宽高也要跟着变
    renderer.resize = spy;
    engine.setSize(resizeWidth, resizeHeight);
    expect(spy).has.been.called.once;
    renderer.resize = call;
    engine.setSize(resizeWidth, resizeHeight);
    //置回默认值，方便其他同学测试
    engine.setSize(300, 150);
    rp1.dispose();
  });
});
