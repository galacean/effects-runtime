// @ts-nocheck
import { GPUCapability, ShaderCompileResultStatus, GLSLVersion, ShaderType, createShaderWithMarcos } from '@galacean/effects-core';
import { GLMaterial, GLRenderer } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/GLShaderLibrary', () => {
  let rendererGL1;
  let rendererGL2;
  let webglCanvas;
  let webgl2Canvas;
  let engine1, engine2;

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
    engine2 = rendererGL2.engine;
  });

  after(() => {
    rendererGL1.dispose();
    rendererGL1 = null;
    rendererGL2.dispose();
    rendererGL2 = null;
    webglCanvas.remove();
    webglCanvas = null;
    webgl2Canvas.remove();
    webgl2Canvas = null;
    engine1 = null;
    engine2 = null;
  });

  it('create material shader from shaderlib', async () => {
    const shaderLib = rendererGL2.pipelineContext.shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 1.0]],
    });

    rendererGL2.pipelineContext.shaderLibrary.compileShader(shader);
    const program = shader.program;

    expect(program).not.eql(null);

    const material = new GLMaterial(
      engine2,
      {
        states: {},
      });

    material.shader = shader;
    material.initialize(rendererGL2.engine);

    expect(material.shader).not.eql(undefined);

    const program2 = material.shader?.program;

    expect(program2).not.eql(null);
    expect(material.shader?.program).to.eql(program);

    material.dispose();
  });

  it('shader cache by string hash', async () => {
    const shaderLib = rendererGL2.pipelineContext.shaderLibrary;
    const sameShader = {
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 1.0]],
    };
    const cacheId = shaderLib.addShader(sameShader);

    expect(cacheId).not.to.eql(shaderLib.addShader(sameShader));
    sameShader.shared = true;
    expect(cacheId).not.to.eql(shaderLib.addShader(sameShader));
    expect(shaderLib.addShader(sameShader)).to.eql(shaderLib.addShader(sameShader));
  });

  it('compile shader after destroy program with ShaderLib::deleteShader(cacheId: number)', async () => {
    // TODO 目前删除方式改变，待补充。
    // const shaderLib = renderer.pipelineContext.shaderLibrary;
    // const shaderId = shaderLib.addShader({
    //   vertex: vs,
    //   fragment: fs,
    //   marcos: [['HAS_TEXTURE', 1.0]],
    // });

    // renderer.pipelineContext.shaderLibrary.compileShader(shaderId);
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
  });

  it('auto downgrade to webgl 1 shader', () => {
    const pipelineContext = rendererGL1.pipelineContext;

    expect(engine1.gpuCapability.level).to.eql(1);
    const vertexShader = `
    #version 300
    in vec2 aPos;
    out vec2 vPos;
    `;

    const fragShader = `
    #version 300
    in vec2 vPos;
    out (location=0) vec4 fragColor;
    `;
    const lib = pipelineContext.shaderLibrary;
    const shader = lib.createShader({
      fragment: createShaderWithMarcos([], fragShader, ShaderType.fragment, 1),
      vertex: createShaderWithMarcos([], vertexShader, ShaderType.vertex, 1),
      glslVersion: GLSLVersion.GLSL1,
    });
    const source = shader.source;

    expect(/\bin\b/.test(source.fragment)).to.be.false;
    expect(/\b(in|out)\b/.test(source.vertex)).to.be.false;
    expect(source.vertex.includes('attribute vec2 aPos')).to.be.true;
    expect(source.vertex.includes('varying vec2 vPos')).to.be.true;
    expect(source.fragment.includes('varying vec2 vPos')).to.be.true;
    expect(source.fragment).to.contains('#define WEBGL1');
    expect(source.vertex).to.contains('#define WEBGL1');
  });

  it('compile shader async', function (done) {
    const shaderLib = new GLRenderer(webgl2Canvas, 'webgl2').pipelineContext.shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 122.0]],
    });
    const callback = chai.spy(result => {
      expect(result).to.eql(shader.compileResult);
      expect(shader.compileResult?.status).to.eql(ShaderCompileResultStatus.success);
      // 不同机器上编译时间不一样，把阈值调小
      expect(Date.now() - time).to.be.greaterThanOrEqual(1);
      done();
    });

    const time = Date.now();

    shaderLib.compileShader(shader, callback);
    expect(shader.compileResult.status).to.eql(ShaderCompileResultStatus.compiling);
  });

  it('compile shader async work if no extension', function (done) {
    const pipelineContext = rendererGL2.pipelineContext;
    const shaderLib = pipelineContext.shaderLibrary;
    const shader = shaderLib.createShader({
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 152.0]],
    });

    //@ts-expect-error
    shaderLib.glAsyncCompileExt = null;

    const callback = chai.spy(result => {
      expect(result).to.eql(shader.compileResult);
      expect(shader.compileResult?.status).to.eql(ShaderCompileResultStatus.success);
      pipelineContext.dispose();
      done();
    });

    shaderLib.compileShader(shader, callback);
    expect(shader.compileResult.status).to.eql(ShaderCompileResultStatus.compiling);
  });

  it('compile all shader async', function (done) {
    const canvas = document.createElement('canvas');
    const renderer = new GLRenderer(canvas, 'webgl2');
    const shaderLib = renderer.pipelineContext.shaderLibrary;

    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 12.0]],
    });
    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 33.0]],
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
    const shaderLib = renderer.pipelineContext.shaderLibrary;

    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 12.0]],
    });
    shaderLib.addShader({
      vertex: vs,
      fragment: fs,
      marcos: [['HAS_TEXTURE', 33.0]],
    });
    //@ts-expect-error
    shaderLib._glAsyncCompileExt = null;
    shaderLib.compileAllShaders(function (results) {
      expect(results.length).to.eql(2);
      renderer.dispose();
      canvas.remove();
      done();
    });
  });
});
