import type { Renderer, TextureFactorySourceFrom } from '@galacean/effects-core';
import { Engine } from '@galacean/effects-core';
import { Material } from '@galacean/effects-core';
import {
  TextureLoadAction, glContext, getDefaultTextureFactory, RenderPassAttachmentStorageType,
  RenderPassDestroyAttachmentType, TextureSourceType, Camera, DestroyOptions, RenderPass,
  SceneRendering, Mesh, GLSLVersion,
} from '@galacean/effects-core';
import { Geometry } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { GLTexture } from '@galacean/effects-webgl';

const { expect } = chai;

/**
 * 关于destroy的说明
 * 关于all参数说明：不传递all的时候默认all为true,传all为false的时候，需要有下一级有实际意义的option
 * 才可以设置为false，比如:renderpass的{all:false,meshes:{geometries:false,material:{textures:true}}}
 * 这种设置是有意义的，{all:false,mesh:{all:false}}这种就是没有意义的设置
 */
describe('webgl/dispose', function () {
  let canvas: HTMLCanvasElement;
  let renderer: Renderer;
  let gl: WebGLRenderingContext;
  let result: Record<string, any>;
  let engine: Engine;

  before(() => {
    canvas = document.createElement('canvas');
    const glEngine = new Engine(canvas, { glType: 'webgl2' });

    renderer = glEngine.renderer;
    engine = glEngine;
    gl = (glEngine.graphicsServer.renderingDevice as RenderingDeviceWebGL).gl;
  });

  beforeEach(async () => {
    result = await createMesh(engine);
  });

  afterEach(() => {
    const sb = (renderer.engine.graphicsServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;

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
    const material: Material = result.material;
    const geom = result.geom;
    const texture = result.texture;

    const spy1 = geom.dispose = chai.spy(geom.dispose);
    const spy2 = material.dispose = chai.spy(material.dispose);
    const scene = new SceneRendering();

    scene.addRenderer(mesh);

    material.setTexture('uTexColor', texture);

    renderer.renderScene(scene, { camera: new Camera('') });

    mesh.dispose();
    expect(mesh.isDestroyed).to.be.true;
    expect(spy1).has.been.called.once;
    expect(spy2).has.been.called.once;
    expect(material.isDestroyed).to.be.true;
    expect(geom.isDisposed()).to.be.true;
    expect(geom.vertexBuffers).to.eql({});
    expect(geom.getAttributeNames()).to.eql([]);
    scene.clear();
  });

  // mesh销毁时传入参数删除对应的geometry资源, 保留material
  it('mesh dispose with geometry destroy and material keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;

    const spy1 = material.dispose = chai.spy(material.dispose);
    const spy2 = geom.dispose = chai.spy(geom.dispose);
    const scene = new SceneRendering();

    scene.addRenderer(mesh);

    material.setTexture('uTexColor', texture);

    renderer.renderScene(scene, { camera: new Camera('') });
    material.dispose = spy1;
    geom.dispose = spy2;

    mesh.dispose({
      geometries: DestroyOptions.destroy,
      material: DestroyOptions.keep,
    });
    expect(spy1).not.has.been.called;
    expect(spy2).has.been.called.once;

    expect(mesh.material).to.eql(material);
    expect(geom.isDisposed()).to.be.true;
    expect(geom.vertexBuffers).to.eql({});
    expect(geom.getAttributeNames()).to.eql([]);
    expect(texture).to.eql(texture);

    scene.clear();
  });

  // mesh销毁时传入参数删除对应的material资源, 保留geometry
  it('mesh dispose with material destroy and geometry keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const spy1 = material.dispose = chai.spy(material.dispose);
    const spy2 = geom.dispose = chai.spy(geom.dispose);
    const scene = new SceneRendering();

    scene.addRenderer(mesh);

    material.setTexture('uTexColor', texture);

    renderer.renderScene(scene, { camera: new Camera('') });
    mesh.dispose({ geometries: DestroyOptions.keep });
    expect(spy2).not.has.been.called;
    expect(spy1).has.been.called.once;
    expect(material.isDestroyed).to.be.true;
    expect(Object.keys(material.textures).length).to.eql(0);
    expect(geom.isDisposed()).to.be.false;

  });

  // mesh销毁时保留material的texture资源和geometry
  it('mesh dispose with geometries and textures keep', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const scene = new SceneRendering();

    scene.addRenderer(mesh);

    material.setTexture('uTexColor', texture);
    renderer.renderScene(scene, { camera: new Camera('') });

    mesh.dispose({
      geometries: DestroyOptions.keep,
      material: { textures: DestroyOptions.keep },
    });

    expect(geom.isDisposed()).to.be.false;
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.false;
  });

  // mesh销毁时只保留material和对应的texture对象
  it('mesh dispose with material and texture destroy', async () => {
    const mesh = result.mesh;
    const material = result.material;
    const geom = result.geom;
    const texture = result.texture;
    const scene = new SceneRendering();

    scene.addRenderer(mesh);

    material.setTexture('uTexColor', texture);
    renderer.renderScene(scene, { camera: new Camera('') });

    mesh.dispose({ material: { textures: DestroyOptions.keep } });

    expect(geom.isDisposed()).to.be.true;
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

    const scene = new SceneRendering();

    scene.addRenderer(mesh);

    material.setTexture('uTexColor', texture);

    renderer.renderScene(scene, { camera: new Camera('') });

    mesh.dispose({
      geometries: DestroyOptions.keep,
      material: DestroyOptions.keep,
    });

    expect(spy1).not.has.been.called;
    expect(spy2).not.has.been.called;
    expect(material.isDestroyed).to.be.false;
    expect(geom.isDisposed()).to.be.false;
    expect(texture.isDestroyed).to.be.false;
    expect(material.getTexture('uTexColor')).to.eql(texture);
  });

  // 使用默认参数销毁renderPass(mesh和相关attachment都会被销毁)
  it('shared pass disposal does not own scene meshes', () => {
    const scene = new SceneRendering();
    const pass = new RenderPass(renderer);

    scene.addRenderer(result.mesh);
    renderer.renderScene(scene, { camera: new Camera('') });
    pass.dispose();
    expect(pass.isDisposed).to.equal(true);
    expect(result.mesh.isDestroyed).to.equal(false);
    expect(result.material.isDestroyed).to.equal(false);
    expect(result.geom.isDisposed()).to.equal(false);
    scene.clear();
    expect(result.mesh.isDestroyed).to.equal(false);
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
  const geom = new Geometry(
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

  const material = new Material(
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
