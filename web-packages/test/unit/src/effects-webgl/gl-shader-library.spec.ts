import type { Engine, ShaderWithSource } from '@galacean/effects-core';
import { ShaderCompileResultStatus, GLSLVersion } from '@galacean/effects-core';
import type { GLEngine } from '@galacean/effects-webgl';
import { GLRenderer } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/gl-shader-library', () => {
  let rendererGL1: GLRenderer;
  let rendererGL2: GLRenderer;
  let webglCanvas: HTMLCanvasElement;
  let webgl2Canvas: HTMLCanvasElement;
  let engine1: Engine;

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
    rendererGL1 = new GLRenderer(webglCanvas, 'webgl');
    rendererGL2 = new GLRenderer(webgl2Canvas, 'webgl2');
    engine1 = rendererGL1.engine;
  });

  after(() => {
    rendererGL1.dispose();
    // @ts-expect-error
    rendererGL1 = null;
    rendererGL2.dispose();
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
  });

  it('create material shader from shaderlib', async () => {
    const shaderLib = (rendererGL2.engine as GLEngine).shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 1.0]],
      glslVersion: GLSLVersion.GLSL3,
    });

    (rendererGL2.engine as GLEngine).shaderLibrary.compileShader(shader);
    const program = shader.program;

    expect(program).not.eql(null);
    expect(shader).not.eql(undefined);
  });

  it('shader cache by string hash', async () => {
    const shaderLib = (rendererGL2.engine as GLEngine).shaderLibrary;
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
  // const shaderLib = (renderer.engine as GLEngine).shaderLibrary;
  // const shaderId = shaderLib.addShader({
  //   vertex: vs,
  //   fragment: fs,
  //   macros: [['HAS_TEXTURE', 1.0]],
  // });

  // (renderer.engine as GLEngine).shaderLibrary.compileShader(shaderId);
  // let program = (shaderLib).getProgram(shaderId);

  // expect(program).not.eql(null);
  // let programHandle = program?.glHandle;

  // expect(programHandle).not.eql(undefined);
  // let isProgram = renderer.internal.gl.isProgram(programHandle);

  // expect(isProgram).to.eql(true);

  // // 删除webgl程序
  // shaderLib.deleteShader(shaderId);
  // programHandle = program?.glHandle;
  // isProgram = renderer.glRenderer.gl.isProgram(programHandle);
  // expect(isProgram).to.eql(false);

  // // 重新编译着色器
  // program = (shaderLib).getProgram(shaderId);
  // expect(program).not.eql(null);
  // programHandle = program?.glHandle;
  // expect(programHandle).not.eql(undefined);
  // isProgram = renderer.glRenderer.gl.isProgram(programHandle);
  // expect(isProgram).to.eql(true);
  // });

  it('compile shader async', function (done) {
    const shaderLib = (new GLRenderer(webgl2Canvas, 'webgl2').engine as GLEngine).shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 122.0]],
      glslVersion: GLSLVersion.GLSL3,
    });
    const time = Date.now();

    shaderLib.compileShader(shader, result => {
      expect(result).to.eql(shader.compileResult);
      expect(shader.compileResult?.status).to.eql(ShaderCompileResultStatus.success);
      // 不同机器上编译时间不一样，把阈值调小
      expect(Date.now() - time).to.be.greaterThanOrEqual(1);
      done();
    });
    expect(shader.compileResult.status).to.eql(ShaderCompileResultStatus.compiling);
  });

  it('compile shader async work if no extension', function (done) {
    const pipelineContext = rendererGL2.engine as GLEngine;
    const shaderLib = pipelineContext.shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      macros: [['HAS_TEXTURE', 152.0]],
      glslVersion: GLSLVersion.GLSL3,
    });

    //@ts-expect-error
    shaderLib.glAsyncCompileExt = null;

    shaderLib.compileShader(shader, result => {
      expect(result).to.eql(shader.compileResult);
      expect(shader.compileResult?.status).to.eql(ShaderCompileResultStatus.success);
      pipelineContext.dispose();
      done();
    });
    expect(shader.compileResult.status).to.eql(ShaderCompileResultStatus.compiling);
  });

  it('compile all shader async', function (done) {
    const canvas = document.createElement('canvas');
    const renderer = new GLRenderer(canvas, 'webgl2');
    const shaderLib = (renderer.engine as GLEngine).shaderLibrary;

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
    const renderer = new GLRenderer(canvas, 'webgl2');
    const shaderLib = (renderer.engine as GLEngine).shaderLibrary;

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
