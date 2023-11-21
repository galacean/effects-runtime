// @ts-nocheck
import { GLPipelineContext, GLRenderer } from '@galacean/effects-webgl';

const { assert, expect } = chai;

describe('webgl/gl-state', () => {
  let canvas, renderer, fakeRenderer, gl, pipelineContext;

  before(() => {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2');
    renderer = new GLRenderer(canvas, 'webgl2');
    pipelineContext = renderer.pipelineContext;

    fakeRenderer = renderer.glRenderer;
  });

  after(() => {
    renderer.dispose();
    renderer = null;
    fakeRenderer = null;
    pipelineContext = null;
    canvas.remove();
    canvas = null;
    gl = null;
  });

  it('GLPipelineContext default value', () => {
    const state = new GLPipelineContext(renderer.engine, gl);

    // gl.DITHER是为了验证pipelineContext是否初始化了
    assert.equal(state.get('gl.DITHER'), null);
  });

  it('GLPipelineContext framebuffer and depth function test ', () => {
    const state = new GLPipelineContext(renderer.engine, gl);
    //framebuffer
    const framebuffer = gl.createFramebuffer();

    state.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), framebuffer, 'fbo');
    state.bindSystemFramebuffer();
    assert.equal(gl.getParameter(gl.FRAMEBUFFER_BINDING), null, 'fbo null');
    //end framebuffer
    //clear
    gl.clearColor(1, 1, 1, 1);
    state.clear(gl.COLOR_BUFFER_BIT);
    expect(gl.getParameter(gl.COLOR_CLEAR_VALUE)).deep.equals(new Float32Array([1, 1, 1, 1]));
    //clear depth
    state.clearDepth(1);
    assert.equal(gl.getParameter(gl.DEPTH_CLEAR_VALUE), 1, 'DEPTH_CLEAR_VALUE');
    //depth func
    state.enable(gl.DEPTH_TEST);
    state.depthFunc(gl.NEVER);
    assert.equal(gl.getParameter(gl.DEPTH_FUNC), gl.NEVER, 'DEPTH_FUNC');
    //depth mash
    state.depthMask(false);
    assert.equal(gl.getParameter(gl.DEPTH_WRITEMASK), false);

    //depth range
    state.depthRange(0.2, 0.6);
    expect(gl.getParameter(gl.DEPTH_RANGE)).deep.equals(new Float32Array([0.2, 0.6]));
    //depth end

  });

  it('stencil function test', () => {
    const state = new GLPipelineContext(renderer.engine, gl);

    //stencil start
    state.clearStencil(1.0);
    assert.equal(gl.getParameter(gl.STENCIL_CLEAR_VALUE), 1.0);
    //stencli mask
    state.stencilMask(110101);
    assert.equal(gl.getParameter(gl.STENCIL_WRITEMASK), 110101);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_WRITEMASK), 110101);
    assert.equal(gl.getParameter(gl.STENCIL_BITS), 0);

    //stencilfunc
    state.stencilFunc(gl.LESS, 0.1, 0b1110011);
    assert.equal(gl.getParameter(gl.STENCIL_FUNC), gl.LESS);
    //stencilFuncSeparate
    state.stencilFuncSeparate(gl.BACK, gl.NEVER, 0.2, 1110011);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK), 1110011);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_FUNC), gl.NEVER);
    //stencilMaskSeparate
    state.stencilMaskSeparate(gl.FRONT, 111001);
    assert.equal(gl.getParameter(gl.STENCIL_WRITEMASK), 111001);
    //stencilOp
    state.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_FAIL), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL), gl.KEEP);
    //stencilOpSeparate
    state.stencilOpSeparate(gl.BACK, gl.KEEP, gl.DECR_WRAP, gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_FAIL), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_PASS), gl.KEEP);
    assert.equal(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_FAIL), gl.DECR_WRAP);

    //cull face
    state.cullFace(gl.BACK);
    assert.equal(gl.getParameter(gl.CULL_FACE_MODE), gl.BACK);
    //frontFace
    state.frontFace(gl.CCW);
  });

  it('color function test', () => {
    const state = new GLPipelineContext(renderer.engine, gl);

    state.clearColor(1.0, 1.0, 0.8, 1.0);
    expect(gl.getParameter(gl.COLOR_CLEAR_VALUE)).deep.equal(new Float32Array([1.0, 1.0, 0.8, 1.0]));

    //color mask
    state.colorMask(true, true, false, false);
    expect(gl.getParameter(gl.COLOR_WRITEMASK)).deep.equal([true, true, false, false]);
  });

  it('blend function test', () => {
    const state = new GLPipelineContext(renderer.engine, gl);

    //blend color
    state.blendColor(0, 0.5, 1, 1);
    expect(gl.getParameter(gl.BLEND_COLOR)).deep.equal(new Float32Array([0, 0.5, 1, 1]));

    //blendFunc
    state.blendFunc(gl.SRC_COLOR, gl.DST_COLOR);
    assert.equal(gl.getParameter(gl.BLEND_SRC_RGB), gl.SRC_COLOR);
    //blendFuncSeparate
    state.blendFuncSeparate(gl.SRC_COLOR, gl.DST_COLOR, gl.ONE, gl.ZERO);
    assert.equal(gl.getParameter(gl.BLEND_SRC_RGB), gl.SRC_COLOR);
    //blendEquation
    state.blendEquation(gl.FUNC_ADD);
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_RGB), gl.FUNC_ADD);
    //blendEquationSeparate
    state.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.FUNC_SUBTRACT);
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_RGB), gl.FUNC_REVERSE_SUBTRACT);
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_ALPHA), gl.FUNC_SUBTRACT);
  });

  it('texture adn others function test', () => {
    const state = new GLPipelineContext(renderer.engine, gl);

    gl.activeTexture(gl.TEXTURE0);
    assert.equal(gl.getParameter(gl.ACTIVE_TEXTURE), gl.TEXTURE0);
    //bind texture
    const texture = gl.createTexture();

    state.bindTexture(gl.TEXTURE_2D, texture);
    assert.equal(gl.getParameter(gl.TEXTURE_BINDING_2D), texture);
    //gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
    state.setPixelStorei(gl.PACK_ALIGNMENT, 4);
    assert.equal(gl.getParameter(gl.PACK_ALIGNMENT), 4);
    //viewport
    state.viewport(0, 0, 900, 800);
    expect(gl.getParameter(gl.VIEWPORT)).deep.equals(new Int32Array([0, 0, 900, 800]));
  });

  after(() => {
    //fakeRenderer.destroy();
    // runs once after the last test in this block
  });
});
