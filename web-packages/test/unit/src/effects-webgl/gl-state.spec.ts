import { Engine } from '@galacean/effects-core';
import type { Renderer } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { assert, expect } = chai;

describe('webgl/gl-state', () => {
  let canvas: HTMLCanvasElement;
  let renderer: Renderer;
  let gl: WebGLRenderingContext | WebGL2RenderingContext;
  let engine: Engine;

  before(() => {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    engine = new Engine(canvas, { glType: 'webgl2' });
    renderer = engine.renderer;
  });

  after(() => {
    engine.dispose();
    // @ts-expect-error
    renderer = null;
    canvas.remove();
    // @ts-expect-error
    canvas = null;
    // @ts-expect-error
    gl = null;
  });

  it('WebGL default value', () => {
    const state = engine;

    // gl.DITHER是为了验证glEngine是否初始化了
    assert.equal((state.renderingDevice as RenderingDeviceWebGL).get('gl.DITHER'), null);
  });

  it('WebGL framebuffer and depth function test ', () => {
    const state = engine;
    //framebuffer
    const framebuffer = gl.createFramebuffer();

    (state.renderingDevice as RenderingDeviceWebGL).bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), framebuffer, 'fbo');
    state.renderingDevice.bindSystemFramebuffer();
    assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), null, 'fbo null');
    //end framebuffer
    //clear
    gl.clearColor(1, 1, 1, 1);
    (state.renderingDevice as RenderingDeviceWebGL).gl.clear(gl.COLOR_BUFFER_BIT);
    expect(gl.getParameter(gl.COLOR_CLEAR_VALUE)).deep.equals(new Float32Array([1, 1, 1, 1]));
    //clear depth
    (state.renderingDevice as RenderingDeviceWebGL).clearDepth(1);
    assert.equal(gl.getParameter(gl.DEPTH_CLEAR_VALUE), 1, 'DEPTH_CLEAR_VALUE');
    //depth func
    (state.renderingDevice as RenderingDeviceWebGL).enable(gl.DEPTH_TEST);
    state.renderingDevice.depthFunc(gl.NEVER);
    assert.equal(gl.getParameter(gl.DEPTH_FUNC), gl.NEVER, 'DEPTH_FUNC');
    //depth mash
    state.renderingDevice.depthMask(false);
    assert.equal(gl.getParameter(gl.DEPTH_WRITEMASK), false);

    //depth range
    state.renderingDevice.depthRange(0.2, 0.6);
    expect(gl.getParameter(gl.DEPTH_RANGE)).deep.equals(new Float32Array([0.2, 0.6]));
    //depth end

  });

  it('stencil function test', () => {
    const state = engine;

    //stencil start
    (state.renderingDevice as RenderingDeviceWebGL).clearStencil(1.0);
    assert.equal(gl.getParameter(gl.STENCIL_CLEAR_VALUE), 1.0);
    //stencli mask
    (state.renderingDevice as RenderingDeviceWebGL).stencilMask(110101);
    assert.equal(gl.getParameter(gl.STENCIL_WRITEMASK), 110101);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_WRITEMASK), 110101);
    assert.equal(gl.getParameter(gl.STENCIL_BITS), 0);

    //stencilfunc
    (state.renderingDevice as RenderingDeviceWebGL).stencilFunc(gl.LESS, 0.1, 0b1110011);
    assert.equal(gl.getParameter(gl.STENCIL_FUNC), gl.LESS);
    //stencilFuncSeparate
    state.renderingDevice.stencilFuncSeparate(gl.BACK, gl.NEVER, 0.2, 1110011);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK), 1110011);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_FUNC), gl.NEVER);
    //stencilMaskSeparate
    state.renderingDevice.stencilMaskSeparate(gl.FRONT, 111001);
    assert.equal(gl.getParameter(gl.STENCIL_WRITEMASK), 111001);
    //stencilOp
    (state.renderingDevice as RenderingDeviceWebGL).stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_FAIL), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL), gl.KEEP);
    //stencilOpSeparate
    state.renderingDevice.stencilOpSeparate(gl.BACK, gl.KEEP, gl.DECR_WRAP, gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_FAIL), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_PASS), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_FAIL), gl.DECR_WRAP);

    //cull face
    state.renderingDevice.cullFace(gl.BACK);
    assert.equal(gl.getParameter(gl.CULL_FACE_MODE), gl.BACK);
    //frontFace
    state.renderingDevice.frontFace(gl.CCW);
  });

  it('color function test', () => {
    const state = engine;

    (state.renderingDevice as RenderingDeviceWebGL).clearColor(1.0, 1.0, 0.8, 1.0);
    expect(gl.getParameter(gl.COLOR_CLEAR_VALUE)).deep.equal(new Float32Array([1.0, 1.0, 0.8, 1.0]));

    //color mask
    state.renderingDevice.colorMask(true, true, false, false);
    expect(gl.getParameter(gl.COLOR_WRITEMASK)).deep.equal([true, true, false, false]);
  });

  it('blend function test', () => {
    const state = engine;

    //blend color
    state.renderingDevice.blendColor(0, 0.5, 1, 1);
    expect(gl.getParameter(gl.BLEND_COLOR)).deep.equal(new Float32Array([0, 0.5, 1, 1]));

    //blendFunc
    (state.renderingDevice as RenderingDeviceWebGL).blendFunc(gl.SRC_COLOR, gl.DST_COLOR);
    assert.equal(gl.getParameter(gl.BLEND_SRC_RGB), gl.SRC_COLOR);
    //blendFuncSeparate
    state.renderingDevice.blendFuncSeparate(gl.SRC_COLOR, gl.DST_COLOR, gl.ONE, gl.ZERO);
    assert.equal(gl.getParameter(gl.BLEND_SRC_RGB), gl.SRC_COLOR);
    //blendEquation
    (state.renderingDevice as RenderingDeviceWebGL).blendEquation(gl.FUNC_ADD);
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_RGB), gl.FUNC_ADD);
    //blendEquationSeparate
    state.renderingDevice.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.FUNC_SUBTRACT);
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_RGB), gl.FUNC_REVERSE_SUBTRACT);
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_ALPHA), gl.FUNC_SUBTRACT);
  });

  it('texture adn others function test', () => {
    const state = engine;

    gl.activeTexture(gl.TEXTURE0);
    assert.equal(gl.getParameter(gl.ACTIVE_TEXTURE), gl.TEXTURE0);
    //bind texture
    const texture = gl.createTexture();

    (state.renderingDevice as RenderingDeviceWebGL).bindTexture(gl.TEXTURE_2D, texture);
    assert.equal(gl.getParameter(gl.TEXTURE_BINDING_2D), texture);
    //gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
    (state.renderingDevice as RenderingDeviceWebGL).setPixelStorei(gl.PACK_ALIGNMENT, 4);
    assert.equal(gl.getParameter(gl.PACK_ALIGNMENT), 4);
    //viewport
    state.renderingDevice.setViewport(0, 0, 900, 800);
    expect(gl.getParameter(gl.VIEWPORT)).deep.equals(new Int32Array([0, 0, 900, 800]));
  });

  after(() => {
    //fakeRenderer.destroy();
    // runs once after the last test in this block
  });
});
