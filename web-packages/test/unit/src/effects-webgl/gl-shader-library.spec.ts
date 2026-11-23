import type { Renderer, ShaderCompileResult, ShaderWithSource } from '@galacean/effects-core';
import { Engine } from '@galacean/effects-core';
import { ShaderCompileResultStatus, GLSLVersion } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/gl-shader-library', () => {
  let rendererGL1: Renderer;
  let rendererGL2: Renderer;
  let webglCanvas: HTMLCanvasElement;
  let webgl2Canvas: HTMLCanvasElement;
  let engine1: Engine;
  let engine2: Engine;

  const vs = `#version 300 es
  layout(location = 0) in vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
  }`;

  const fs = `#version 300 es
  precision highp float;
  out vec4 outColor;

  void main() {

    outColor = vec4(1.0, 0.0, 0.0, 1.0);
  }`;

  before(() => {
    webglCanvas = document.createElement('canvas');
    webgl2Canvas = document.createElement('canvas');
    const glEngine1 = new Engine(webglCanvas, { glType: 'webgl' });
    const glEngine2 = new Engine(webgl2Canvas, { glType: 'webgl2' });

    rendererGL1 = glEngine1.renderer;
    rendererGL2 = glEngine2.renderer;
    engine1 = glEngine1;
    engine2 = glEngine2;
  });

  after(() => {
    engine1.dispose();
    // @ts-expect-error
    rendererGL1 = null;
    engine2.dispose();
    // @ts-expect-error
    rendererGL2 = null;
    webglCanvas.remove();
    // @ts-expect-error
    webglCanvas = null;
    webgl2Canvas.remove();
    // @ts-expect-error
    webgl2Canvas = null;
    // @ts-expect-error
    engine1 = null;
    // @ts-expect-error
    engine2 = null;
  });

  it('create material shader from shaderlib', async () => {
    const shaderLib = (rendererGL2.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 1.0]],
      glslVersion: GLSLVersion.GLSL3,
    });

    (rendererGL2.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary.compileShader(shader);
    const program = shader.program;

    expect(program).not.eql(null);
    expect(shader).not.eql(undefined);
  });

  it('shader cache by string hash', async () => {
    const shaderLib = (rendererGL2.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;
    const sameShader: ShaderWithSource = {
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 1.0]],
    };
    const cacheId = shaderLib.addShader(sameShader);

    expect(cacheId).not.to.eql(shaderLib.addShader(sameShader));
    sameShader.shared = true;
    expect(cacheId).not.to.eql(shaderLib.addShader(sameShader));
    expect(shaderLib.addShader(sameShader)).to.eql(shaderLib.addShader(sameShader));
  });

  // it('compile shader after destroy program with ShaderLib::deleteShader(cacheId: number)', async () => {
  // TODO 目前删除方式改变，待补充。
  // const shaderLib = (renderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;
  // const shaderId = shaderLib.addShader({
  //   vertex: vs,
  //   fragment: fs,
  //   macros: [['HAS_TEXTURE', 1.0]],
  // });

  // (renderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary.compileShader(shaderId);
  // let program = (shaderLib).getProgram(shaderId);

  // expect(program).not.eql(null);
  // let programHandle = program?.glHandle;

  // expect(programHandle).not.eql(undefined);
  // let isProgram = renderer.internal.gl.isProgram(programHandle);

  // expect(isProgram).to.eql(true);

  // // 删除webgl程序
  // shaderLib.deleteShader(shaderId);
  // programHandle = program?.glHandle;
  // isProgram = renderer.gl.isProgram(programHandle);
  // expect(isProgram).to.eql(false);

  // // 重新编译着色器
  // program = (shaderLib).getProgram(shaderId);
  // expect(program).not.eql(null);
  // programHandle = program?.glHandle;
  // expect(programHandle).not.eql(undefined);
  // isProgram = renderer.gl.isProgram(programHandle);
  // expect(isProgram).to.eql(true);
  // });

  it('compile shader with callback', async () => {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas, { glType: 'webgl2' });
    const shaderLib = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 122.0]],
      glslVersion: GLSLVersion.GLSL3,
    });

    try {
      const result = await new Promise<ShaderCompileResult>(resolve => shaderLib.compileShader(shader, resolve));

      expect(result).to.equal(shader.compileResult);
      expect(result.status).to.equal(ShaderCompileResultStatus.success);
      expect(shader.initialized).to.be.true;
      expect(shader.program).to.exist;
    } finally {
      engine.dispose();
      canvas.remove();
    }
  });

  it('compile shader callback works without parallel extension', async () => {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas, { glType: 'webgl2' });
    const glEngine = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    const shaderLib = glEngine.shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 152.0]],
      glslVersion: GLSLVersion.GLSL3,
    });

    //@ts-expect-error
    shaderLib.glAsyncCompileExt = null;

    try {
      const result = await new Promise<ShaderCompileResult>(resolve => shaderLib.compileShader(shader, resolve));

      expect(result).to.equal(shader.compileResult);
      expect(result.status).to.equal(ShaderCompileResultStatus.success);
      expect(shader.initialized).to.be.true;
      expect(shader.program).to.exist;
    } finally {
      engine.dispose();
      canvas.remove();
    }
  });

  it('compile all shader async', function (done) {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas, { glType: 'webgl2' });
    const renderer = engine.renderer;
    const shaderLib = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;

    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 12.0]],
    });
    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 33.0]],
    });
    shaderLib.compileAllShaders(function (results) {
      expect(results.length).to.eql(2);
      renderer.dispose();
      canvas.remove();
      done();
    });
  });

  it('compile all shader async work with no extension', function (done) {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas, { glType: 'webgl2' });
    const renderer = engine.renderer;
    const shaderLib = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary;

    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 12.0]],
    });
    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 33.0]],
    });
    //@ts-expect-error
    shaderLib._glAsyncCompileExt = null;
    shaderLib.compileAllShaders(results => {
      expect(results.length).to.eql(2);
      renderer.dispose();
      canvas.remove();
      done();
    });
  });
});
