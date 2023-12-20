// @ts-nocheck
import { createShaderWithMarcos, RenderFrame, RenderPass, glContext, DestroyOptions, TextureLoadAction, ShaderType, Texture, Camera, Mesh, math } from '@galacean/effects-core';
import { GLMaterial, GLGeometry, GLRenderer } from '@galacean/effects-webgl';

const { Vector4 } = math;
const { expect, assert } = chai;

describe('gl-material', () => {
  let canvas, renderer, gl, engine;
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
  const shader = {
    vertex: vs,
    fragment: fs,
  };

  before(() => {
    canvas = document.createElement('canvas');
    renderer = new GLRenderer(canvas, 'webgl2');
    gl = renderer.glRenderer.gl;
    engine = renderer.engine;
  });

  after(() => {
    renderer.dispose();
    renderer = null;
    canvas.remove();
    canvas = null;
    gl = null;
  });

  afterEach(() => {
    const sb = renderer.pipelineContext.shaderLibrary;

    sb.dispose();
    sb.gl = renderer.glRenderer.gl;
    sb.renderer = renderer.glRenderer;
  });

  // 使用自定义的material states
  it('material states', () => {
    const material = generateGLMaterial(
      engine,
      shader,
      {
        sampleAlphaToCoverage: false,
        blending: true,
        blendEquationAlpha: glContext.FUNC_SUBTRACT,
        blendSrcAlpha: glContext.ONE_MINUS_SRC_ALPHA,
        blendDstAlpha: glContext.ZERO,
        blendSrc: glContext.ZERO,
        blendDst: glContext.ONE_MINUS_SRC_ALPHA,
        blendColor: [0, 0.5, 1.0, 0],
        cullFace: glContext.FRONT,
        depthTest: false,
        depthMask: true,
        depthRange: [0, 0.7],
        stencilTest: true,
        stencilOpBack: [glContext.INCR, glContext.INCR, glContext.INCR],
        stencilMask: 0xff,
        stencilFuncFront: [glContext.NEVER, 0.5, 0x00],
      }, renderer);

    material.setInt('u_Test', 1);
    material.initialize(renderer.engine);
    material.setupStates(renderer.pipelineContext);
    const states = material.glMaterialState;

    assert.equal(states.sampleAlphaToCoverage, false);
    assert.equal(states.blending, true);

    expect(states.blendEquationParameters).to.eql([glContext.FUNC_ADD, glContext.FUNC_SUBTRACT]);
    expect(states.blending).to.be.true;
    expect(states.blendFunctionParameters).to.eql([glContext.ZERO, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ZERO]);
    assert.equal(states.culling, true);
    expect(states.blendColor).to.eql([0, 0.5, 1.0, 0]);
    expect(states.colorMask).to.eql([true, true, true, true]);
    assert.equal(states.depthTest, false);
    assert.equal(states.depthMask, true);
    assert.equal(states.depthFunc, glContext.LESS);
    expect(states.depthRange).to.eql([0, 0.7]);
    assert.equal(states.cullFace, glContext.FRONT);
    assert.equal(states.frontFace, glContext.CW);

    assert.equal(states.stencilTest, true);
    expect(states.stencilFunc).to.eql([glContext.ALWAYS, glContext.ALWAYS]);
    expect(states.stencilMask).to.eql([0xff, 0xff]);

    // expect(states.stencilOpFail).to.eql([glContext.INCR, glContext.KEEP]);
    // expect(states.stencilOpZFail).to.eql([glContext.INCR, glContext.KEEP]);
    // expect(states.stencilOpZPass).to.eql([glContext.INCR, glContext.KEEP]);
  });

  // blending关闭 m
  it('blending disabled', () => {
    const material = generateGLMaterial(engine, shader, { blending: false }, renderer);

    expect(gl.isEnabled(glContext.BLEND)).to.eql(false);
  });

  // blending开启的默认值
  it('blending enabled with default parameters', () => {
    const material = generateGLMaterial(engine, shader, { blending: true }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);

    expect(gl.isEnabled(gl.BLEND)).to.eql(true);
    assert.equal(gl.getParameter(gl.BLEND_SRC_RGB), glContext.ONE, 'src_rgb');
    assert.equal(gl.getParameter(gl.BLEND_SRC_ALPHA), glContext.ONE, 'src_alpha');
    assert.equal(gl.getParameter(gl.BLEND_DST_RGB), glContext.ONE_MINUS_SRC_ALPHA, 'dst_rgb');
    assert.equal(gl.getParameter(gl.BLEND_DST_ALPHA), glContext.ONE_MINUS_SRC_ALPHA, 'dst_alpha');
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_ALPHA), glContext.FUNC_ADD, 'eq_alpha');
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_RGB), glContext.FUNC_ADD, 'eq_rgb');
    expect(gl.getParameter(gl.COLOR_WRITEMASK)).to.deep.equals([true, true, true, true]);
  });

  // blending使用自定义参数
  it('blending enabled with custom parameters', () => {
    generateGLMaterial(
      engine,
      shader,
      {
        blending: true,

        blendSrc: glContext.SRC_ALPHA,
        blendSrcAlpha: glContext.ONE,
        blendDst: glContext.ONE_MINUS_SRC_ALPHA,
        blendEquationRGB: glContext.FUNC_ADD,
        blendEquationAlpha: glContext.FUNC_SUBTRACT,
        blendColor: [0.5, 0.0, 1.0, 0.1],
      }, renderer);
    assert.equal(gl.getParameter(gl.BLEND_SRC_RGB), glContext.SRC_ALPHA, 'src-rgb');
    assert.equal(gl.getParameter(gl.BLEND_SRC_ALPHA), glContext.ONE, 'src-alpha');
    assert.equal(gl.getParameter(gl.BLEND_DST_RGB), glContext.ONE_MINUS_SRC_ALPHA, 'dst-rgb');
    assert.equal(gl.getParameter(gl.BLEND_DST_ALPHA), glContext.ONE_MINUS_SRC_ALPHA, 'dst-alpha');
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_RGB), glContext.FUNC_ADD, 'eq-rgb');
    assert.equal(gl.getParameter(gl.BLEND_EQUATION_ALPHA), glContext.FUNC_SUBTRACT, 'eq-alpha');
    expect(gl.getParameter(gl.BLEND_COLOR)).to.deep.equals(new Float32Array([0.5, 0.0, 1.0, 0.1]));
  });

  // 关闭cullface
  it('cullFace disabled', () => {
    const material = generateGLMaterial(engine, shader, { cullFaceEnabled: false }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.CULL_FACE)).to.eql(false);
  });

  // 开启cullface 使用默认参数
  it('cullFace enable with default parameters', () => {
    const material = generateGLMaterial(engine, shader, { cullFaceEnabled: true }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.CULL_FACE)).to.eql(true);
    expect(gl.getParameter(gl.CULL_FACE_MODE)).to.eql(glContext.FRONT);
    expect(gl.getParameter(gl.FRONT_FACE)).to.eql(glContext.CW);
  });

  // 开启cullface 使用自定义参数
  it('cullFace enable disabled with custom parameters', () => {
    const material = generateGLMaterial(engine, shader, { cullFaceEnabled: true, cullFace: glContext.FRONT_AND_BACK, frontFace: glContext.CW }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.CULL_FACE)).to.eql(true);
    expect(gl.getParameter(gl.CULL_FACE_MODE)).to.eql(glContext.FRONT_AND_BACK);
    expect(gl.getParameter(gl.FRONT_FACE)).to.eql(glContext.CW);
  });

  // 关闭depthTest
  it('depthTest disable', () => {
    generateGLMaterial(engine, shader, { depthTest: false }, renderer);

    expect(gl.isEnabled(gl.DEPTH_TEST)).to.eql(false);
  });

  // 开启depthTest 使用默认参数
  it('depthTest enable with default parameters', () => {
    const material = generateGLMaterial(engine, shader, { depthTest: true }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.DEPTH_TEST)).to.eql(true);
    // expect(gl.getParameter(gl.DEPTH_WRITEMASK)).to.eql(true);
    expect(gl.getParameter(gl.DEPTH_RANGE)).to.eql(new Float32Array([0., 1.]));
    expect(gl.getParameter(gl.DEPTH_FUNC)).to.eql(glContext.LESS);
  });

  // 开启depthTest 使用自定义参数
  it('depthTest enable with custom parameters', () => {
    const material = generateGLMaterial(
      engine,
      shader,
      {
        depthTest: true,
        depthMask: false,
        depthRange: [0.4, 0.5],
        depthFunc: glContext.ALWAYS,
      }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.DEPTH_TEST)).to.eql(true);
    expect(gl.getParameter(gl.DEPTH_WRITEMASK)).to.eql(false);
    expect(gl.getParameter(gl.DEPTH_RANGE)).to.eql(new Float32Array([0.4, 0.5]));
    expect(gl.getParameter(gl.DEPTH_FUNC)).to.eql(glContext.ALWAYS);
  });

  // 关闭stencilTest
  it('stencilTest enable', () => {
    const material = generateGLMaterial(engine, shader, { stencilTest: false }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.STENCIL_TEST)).to.eql(false);
  });

  // 开启stencilTest 使用默认参数
  it('stencilTest enable with default parameters', () => {
    const material = generateGLMaterial(engine, shader, { stencilTest: true }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.STENCIL_TEST)).to.eql(true);
    //stencil func
    expect(gl.getParameter(gl.STENCIL_FUNC)).to.eql(glContext.ALWAYS);
    expect(gl.getParameter(gl.STENCIL_BACK_FUNC)).to.eql(glContext.ALWAYS);
    expect(gl.getParameter(gl.STENCIL_VALUE_MASK)).to.eql(0xff);
    expect(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK)).to.eql(0xff);
    //stencil mask
    expect(gl.getParameter(gl.STENCIL_BACK_WRITEMASK)).to.eql(0xff);
    expect(gl.getParameter(gl.STENCIL_WRITEMASK)).to.eql(0xff);
    //stencil op
    expect(gl.getParameter(gl.STENCIL_REF)).to.eql(0);
    expect(gl.getParameter(gl.STENCIL_BACK_REF)).to.eql(0);
    expect(gl.getParameter(gl.STENCIL_FAIL)).to.eql(glContext.KEEP);
    expect(gl.getParameter(gl.STENCIL_BACK_FAIL)).to.eql(glContext.KEEP);
    expect(gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL)).to.eql(glContext.KEEP);
    expect(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_FAIL)).to.eql(glContext.KEEP);
    expect(gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS)).to.eql(glContext.KEEP);
    expect(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_PASS)).to.eql(glContext.KEEP);
  });

  // 开启stencilTest 使用自定义的mack,func,op参数
  it('stencilTest enable with custom parameters(mack,func,op)', () => {
    const material = generateGLMaterial(
      engine,
      shader,
      {
        stencilTest: true,
        stencilMask: 0x00,
        stencilRef: [0, 2],
        stencilFunc: [glContext.NEVER, glContext.NEVER],
        stencilOpFail: [glContext.ZERO, glContext.KEEP],
        stencilOpZFail: [glContext.INVERT, glContext.KEEP],
        stencilOpZPass: [glContext.DECR, glContext.KEEP],
      }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.STENCIL_TEST)).to.eql(true);
    //stencil func
    expect(gl.getParameter(gl.STENCIL_FUNC)).to.eql(glContext.NEVER);
    expect(gl.getParameter(gl.STENCIL_BACK_FUNC)).to.eql(glContext.NEVER);
    expect(gl.getParameter(gl.STENCIL_VALUE_MASK)).to.eql(0x00);
    expect(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK)).to.eql(0x00);
    expect(gl.getParameter(gl.STENCIL_REF)).to.eql(2);
    expect(gl.getParameter(gl.STENCIL_BACK_REF)).to.eql(0);
    //stencil mask
    expect(gl.getParameter(gl.STENCIL_BACK_WRITEMASK)).to.eql(0x00);
    expect(gl.getParameter(gl.STENCIL_WRITEMASK)).to.eql(0x00);
    //stencil op
    expect(gl.getParameter(gl.STENCIL_BACK_FAIL)).to.eql(glContext.ZERO);
    expect(gl.getParameter(gl.STENCIL_FAIL)).to.eql(glContext.KEEP);
    expect(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_FAIL)).to.eql(glContext.INVERT);
    expect(gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL)).to.eql(glContext.KEEP);
    expect(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_PASS)).to.eql(glContext.DECR);
    expect(gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS)).to.eql(glContext.KEEP);
  });

  // 开启stencilTest 分别设置mack,func,op参数
  it('stencilTest disabled with custom parameters(mack,func,op hava back/front)', () => {
    const material = generateGLMaterial(
      engine,
      shader,
      {
        stencilTest: true,
        stencilRef: [3, 7],
        stencilFunc: [glContext.LEQUAL, glContext.EQUAL],
        stencilOpFail: [glContext.DECR, glContext.INCR],
        stencilOpZFail: [glContext.INCR_WRAP, glContext.DECR_WRAP],
        stencilOpZPass: [glContext.REPLACE, glContext.ZERO],
        // stencilFuncFront: [glContext.EQUAL, 7, 0x03],
        // stencilFuncBack: [glContext.LEQUAL, 3, 0x30],
        // stencilOpFront: [glContext.DECR, glContext.DECR_WRAP, glContext.ZERO],
        // stencilOpBack: [glContext.INCR, glContext.INCR_WRAP, glContext.REPLACE],
      }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.STENCIL_TEST)).to.eql(true);
    //stencil func
    expect(gl.getParameter(gl.STENCIL_FUNC)).to.eql(glContext.EQUAL);
    expect(gl.getParameter(gl.STENCIL_BACK_FUNC)).to.eql(glContext.LEQUAL);
    // expect(gl.getParameter(gl.STENCIL_VALUE_MASK)).to.eql(0x03);
    // expect(gl.getParameter(gl.STENCIL_BACK_VALUE_MASK)).to.eql(0x30);
    expect(gl.getParameter(gl.STENCIL_REF)).to.eql(7);
    expect(gl.getParameter(gl.STENCIL_BACK_REF)).to.eql(3);
    //stencil mask
    expect(gl.getParameter(gl.STENCIL_BACK_WRITEMASK)).to.eql(0xff);
    expect(gl.getParameter(gl.STENCIL_WRITEMASK)).to.eql(0xff);
    //stencil op
    expect(gl.getParameter(gl.STENCIL_FAIL)).to.eql(glContext.INCR);
    expect(gl.getParameter(gl.STENCIL_BACK_FAIL)).to.eql(glContext.DECR);
    expect(gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL)).to.eql(glContext.DECR_WRAP);
    expect(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_FAIL)).to.eql(glContext.INCR_WRAP);
    expect(gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS)).to.eql(glContext.ZERO);
    expect(gl.getParameter(gl.STENCIL_BACK_PASS_DEPTH_PASS)).to.eql(glContext.REPLACE);
  });

  // 关闭sampleAlphaToCoverage
  it('sampleAlphaToCoverage disable', () => {
    const material = generateGLMaterial(engine, shader, { sampleAlphaToCoverage: false }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.SAMPLE_ALPHA_TO_COVERAGE)).to.eql(false);
  });

  // 开启sampleAlphaToCoverage
  it('sampleAlphaToCoverage enable', () => {
    const material = generateGLMaterial(engine, shader, { sampleAlphaToCoverage: true }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.isEnabled(gl.SAMPLE_ALPHA_TO_COVERAGE)).to.eql(true);
  });

  // 使用默认的colorMask相关参数
  it('colorMask with default parameters', () => {
    const material = generateGLMaterial(engine, shader, {}, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.getParameter(gl.COLOR_WRITEMASK)).to.deep.equals([true, true, true, true]);
  });

  // 使用自定义的colorMask相关参数
  it('colorMask with custom parameters', () => {
    const material = generateGLMaterial(engine, shader, { colorMask: [false, true, false, true] }, renderer);

    material.setupStates(renderer.glRenderer.pipelineContext);
    expect(gl.getParameter(gl.COLOR_WRITEMASK)).to.deep.equals([false, true, false, true]);
  });

  // 销毁GLMaterial以及对应的texture
  it('test destroy GLMaterial with texture', () => {
    const texture = generateTexture(engine);
    const material = generateGLMaterial(engine, shader, {}, renderer);

    material.setTexture('u_Tex', texture);
    expect(material.getTexture('u_Tex')).to.deep.equal(texture);
    material.initialize(renderer.engine);
    expect(material).not.eql(undefined);
    material.dispose({
      blocks: DestroyOptions.destroy,
      textures: DestroyOptions.destroy,
    });
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.true;
    expect(() => material.initialize()).to.throw(Error);
  });

  // 销毁GLMaterial,使用默认的销毁参数
  it('test destroy GLMaterial with default destroy params', () => {
    const texture = generateTexture(engine);
    const material = generateGLMaterial(engine, shader, {}, renderer);

    material.setTexture('u_Tex', texture);
    material.initialize(renderer.engine);
    expect(material.getTexture('u_Tex')).to.deep.equal(texture);
    expect(material).not.eql(undefined);
    material.dispose();
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.true;
    expect(material.getTexture('u_Tex')).to.equal(undefined);
    expect(() => material.initialize()).to.throw(Error);
  });

  // 销毁GLMaterial和对应的dataBlock, 保留texture
  it('test destroy GLMaterial with texture keep and dataBlock destroy', () => {
    const texture = generateTexture(engine);
    const material = generateGLMaterial(engine, shader, {}, renderer);

    material.setTexture('u_Tex', texture);
    material.initialize(renderer.engine);
    expect(material.getTexture('u_Tex')).to.deep.equal(texture);
    expect(material).not.eql(undefined);
    material.dispose({
      textures: DestroyOptions.keep,
    });
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.false;
    expect(() => material.initialize()).to.throw(Error);
  });

  // 销毁GLMaterial,保留texture和dataBlock
  it('test destroy GLMaterial with texture and dataBlock keep', () => {
    const texture = generateTexture(engine);
    const material = generateGLMaterial(engine, shader, {}, renderer);

    material.setTexture('u_Tex', texture);
    material.initialize(renderer.engine);
    expect(material).not.eql(undefined);
    material.dispose({
      textures: DestroyOptions.keep,
    });
    expect(material.isDestroyed).to.be.true;
    expect(texture.isDestroyed).to.be.false;
    expect(material.getTexture('u_Tex')).to.equal(undefined);
  });

  // material创建后使用gl进行初始化
  it('material initialize with glRenderer', async () => {
    const material = new GLMaterial(
      engine,
      {
        shader: {
          vertex: vs,
          fragment: fs,
        },
        states: {},
      });
    const texture = generateTexture(engine);
    const texture2 = generateTexture(engine);

    expect(texture.gl).to.not.exist;
    material.setTexture('u_Tex', texture);
    material.setTexture('u_TexArr', texture2);
    expect(material.shader).to.eql(undefined);

    material.initialize(renderer.engine);
    expect(texture.textureBuffer).to.be.an.instanceof(WebGLTexture);
    const texArr = material.getTexture('u_TexArr');

    expect(texArr).to.deep.equals(texture2);
    expect(texture2.textureBuffer).to.be.an.instanceof(WebGLTexture);
    expect(material.shader.initialized).to.be.true;
    expect(material.shader.compileResult.status).to.eql(1);

    material.dispose();
  });

  // TODO material创建时使用具有cacheId的shader 等改完GLShader的创建逻辑再改
  // it('test create material with shaderCacheId', async ()=> {
  //   const material = new GLMaterial({
  //     shader: {
  //       vertex: vs,
  //       fragment: fs,
  //       shared: true,
  //       cacheId: 'test_001_shader',
  //     },
  //     states: {},
  //   });
  //   const material2 = new GLMaterial({
  //     shader: {
  //       cacheId: 'test_001_shader',
  //     },
  //     states: {},
  //   });
  //
  //   material.initialize(renderer.engine);
  //   material2initialize(renderer.engine);
  //   expect(material.shader).to.exist;
  //   expect(material.shader.initialized).to.true;
  //   renderer.pipelineContext.shaderLibrary.compileAllShaders();
  //   // material2initialize(renderer.engine);
  //
  //   console.log(renderer.pipelineContext.shaderLibrary.shaderResults);
  //
  //
  //    const program = material.shader.program
  //   // const program2 = material2.shader.program;
  //   expect(program).to.exist;
  //   // expect(program2).to.exist;
  //   expect(program.shared).to.be.true;
  //   // expect(program).to.eql(program2);
  //   //
  //   material.dispose();
  //   // material2.dispose();
  //   expect(renderer.pipelineContext.shaderLibrary.shaderResults['test_001_shader']).to.exist;
  // });
  //
  // it('shared material will keep', async ()=> {
  //   const material = new GLMaterial({
  //     shader: {
  //       vertex: vs,
  //       fragment: fs,
  //       cacheId: 'test_002_shader',
  //       shared: true,
  //     },
  //     states: {},
  //   });
  //
  //   material.initialize(renderer.engine);
  //
  //   renderer.pipelineContext.shaderLibrary.compileAllShaders();
  //   expect(material.shader).to.exist;
  //   expect(renderer.pipelineContext.shaderLibrary.shaderResults['test_002_shader']).to.contains({ shared: true });
  //
  //   const program = material.getProgram();
  //
  //   expect(program).to.exist;
  //   expect(program?.shared).to.be.true;
  //
  //   material.dispose();
  //   expect(renderer.pipelineContext.shaderLibrary.shaderResults['test_002_shader']).to.exist;
  // });

  // 使用二维数组给unfiorm赋值
  it('set uniform by 2dimension array', () => {
    const vs =
      `#version 300 es
      layout(location = 0) in vec2 aPosition;
      uniform vec4 u_pos[4];
      out vec4 v_pos;
      void main() {
        v_pos = u_pos[0];
        gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
      }`;
    const fs =
      `#version 300 es
      precision highp float;
      uniform vec4 u_pos[4];
      in vec4 v_pos;
      out vec4 outColor;
      void main() {
        outColor = u_pos[1];
        outColor = vec4(v_pos);
      }`;
    const mesh = new Mesh(
      engine,
      {
        name: 'mesh1',
        material: new GLMaterial(
          engine,
          {
            shader: { vertex: vs, fragment: fs },
            states: {},
          }),
        geometry: new GLGeometry(
          engine,
          {
            attributes: {
              aPoint: {
                size: 2,
                data: new Float32Array([
                  -1.0, 1.0, 0, 1,
                  -1.0, -1.0, 0, 0,
                  1.0, 1.0, 1, 1,
                  1.0, -1.0, 1, 0,
                ]),
                stride: Float32Array.BYTES_PER_ELEMENT * 4,
              },
              aTexCoord: {
                type: glContext.FLOAT,
                size: 2,
                stride: Float32Array.BYTES_PER_ELEMENT * 4,
                offset: Float32Array.BYTES_PER_ELEMENT * 2,
                dataSource: 'aPoint',
              },
            },
            indices: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
            drawCount: 6,
          }),
      });
    const renderFrame = new RenderFrame({
      renderer,
      camera: new Camera(),
      clearAction: {
        colorAction: TextureLoadAction.clear,
        clearColor: [0, 0, 0, 0],
      },
    });
    const testData = [
      1, 2, 3, 4,
      1, 2, 3, 4,
      1, 2, 3, 4,
      1, 2, 3, 4,
    ];

    mesh.material.setVector4Array('u_pos', [
      Vector4.fromArray([1, 2, 3, 4]),
      Vector4.fromArray([1, 2, 3, 4]),
      Vector4.fromArray([1, 2, 3, 4]),
      Vector4.fromArray([1, 2, 3, 4]),
    ]);
    const data2 = mesh.material.getVector4Array('u_pos');

    expect(new Float32Array(data2)).to.eqls(new Float32Array(testData));
    renderer.renderRenderFrame(renderFrame);
    mesh.material.initialize(renderer.engine);
    mesh.geometry.initialize(renderer.engine);
    mesh.render(renderer);

    const program = mesh.material.shader.program.program;
    const loc = gl.getUniformLocation(program, 'u_pos');
    const valData = gl.getUniform(program, loc);

    expect(new Float32Array(valData)).to.eqls(new Float32Array([1, 2, 3, 4]));

    renderFrame.dispose();
  });

  // // 使用webgl2的struct进行uniform值设置 TODO: ubo目前还没完成
  // it('set uniform struct value', () => {
  //   const vs =
  //     `#version 300 es
  //     layout(location = 0) in vec2 aPosition;
  //     uniform vec4 u_pos[4];
  //     out vec4 v_pos;
  //     void main() {
  //       v_pos = u_pos[0];
  //       gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
  //     }`;
  //   const fs =
  //     `#version 300 es
  //     precision highp float;
  //     uniform vec4 u_pos[4];
  //     struct Light {
  //       float intensity;
  //       vec4 color;
  //       vec3 position;
  //     };
  //     struct Light2 {
  //       float intensity;
  //       vec4 color;
  //       vec3 position;
  //     };
  //     uniform Light lights[2];
  //     uniform Light2 light123;
  //     in vec4 v_pos;
  //     out vec4 outColor;
  //     void main() {
  //       outColor = u_pos[1];
  //       outColor += u_pos[2];
  //       outColor += lights[0].color;
  //       outColor += lights[1].color;
  //       outColor = vec4(v_pos);
  //       outColor += light123.color;
  //     }`;
  //   const mesh = new Mesh({
  //     name: 'mesh1',
  //     material: new GLMaterial({
  //       shader: { vertex: vs, fragment: fs, shared: false },
  //       states: {},
  //     }),
  //     geometry: new GLGeometry({
  //       attributes: {
  //         aPoint: {
  //           size: 2,
  //           data: new Float32Array([
  //             -1.0, 1.0, 0, 1,
  //             -1.0, -1.0, 0, 0,
  //             1.0, 1.0, 1, 1,
  //             1.0, -1.0, 1, 0,
  //           ]),
  //           stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //         },
  //         aTexCoord: {
  //           type: glContext.FLOAT,
  //           size: 2,
  //           stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //           offset: Float32Array.BYTES_PER_ELEMENT * 2,
  //           dataSource: 'aPoint',
  //         },
  //       },
  //       indices: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
  //       drawCount: 6,
  //     }),
  //   });
  //   const renderFrame = new RenderFrame({
  //     renderer,
  //     camera: new Camera(),
  //     clearAction: {
  //       colorAction: TextureLoadAction.clear,
  //       clearColor: [0, 0, 0, 0],
  //     },
  //   });

  //   mesh.material.setVector4Array('lights', [{
  //     intensity: 1.0,
  //     color: [1.0, 0.0, 1.0, 1.0],
  //     position: [1.0, 1.0, 1.0],
  //   }, {
  //     intensity: 2.0,
  //     color: [1.0, 1.0, 0.0, 1.0],
  //     position: [2.0, 0.0, 2.0],
  //   }]);

  //   mesh.material.defaultDataBlock.setUniformValue('light123', {
  //     intensity: 3.0,
  //     color: [2.0, 0.0, 3.0, 1.0],
  //     position: [2.0, 2.0, 1.0],
  //   });
  //   mesh.material.defaultDataBlock.setUniformValue('u_pos', [
  //     [1, 2, 3, 4],
  //     [1, 2, 3, 4],
  //     [1, 2, 3, 4],
  //     [1, 2, 3, 4],
  //   ]);

  //   renderer.renderRenderFrame(renderFrame);
  //   renderer.renderMesh(mesh);
  //   const light123 = mesh.material.defaultDataBlock.getUniformValue('light123');

  //   expect(light123.intensity).to.eql(3.0);
  //   expect(light123.color).to.eql([2.0, 0.0, 3.0, 1.0]);
  //   expect(light123.position).to.eql([2.0, 2.0, 1.0]);

  //   const lights = mesh.material.defaultDataBlock.getUniformValue('lights');

  //   expect(lights[0].intensity).to.eql(1.0);
  //   expect(lights[0].color).to.eql([1.0, 0.0, 1.0, 1.0]);
  //   expect(lights[0].position).to.eql([1.0, 1.0, 1.0]);

  //   expect(lights[1].intensity).to.eql(2.0);
  //   expect(lights[1].color).to.eql([1.0, 1.0, 0.0, 1.0]);
  //   expect(lights[1].position).to.eql([2.0, 0.0, 2.0]);
  //   const program = mesh.material.shader.program.program;

  //   let loc = gl.getUniformLocation(program, 'lights[0].intensity');
  //   let valData = gl.getUniform(program, loc);

  //   expect(valData).to.eql(1.0);

  //   loc = gl.getUniformLocation(program, 'lights[0].color');
  //   valData = gl.getUniform(program, loc);
  //   expect(valData).to.eql(new Float32Array([1.0, 0.0, 1.0, 1.0]));

  //   loc = gl.getUniformLocation(program, 'lights[0].position');
  //   valData = gl.getUniform(program, loc);
  //   expect(valData).to.eql(new Float32Array([1.0, 1.0, 1.0]));

  //   loc = gl.getUniformLocation(program, 'lights[1].position');
  //   valData = gl.getUniform(program, loc);
  //   expect(valData).to.eql(new Float32Array([2.0, 0.0, 2.0]));

  //   loc = gl.getUniformLocation(program, 'light123.intensity');
  //   valData = gl.getUniform(program, loc);
  //   expect(valData).to.eql(3.0);

  //   loc = gl.getUniformLocation(program, 'light123.color');
  //   valData = gl.getUniform(program, loc);
  //   expect(valData).to.eql(new Float32Array([2.0, 0.0, 3.0, 1.0]));

  //   loc = gl.getUniformLocation(program, 'light123.position');
  //   valData = gl.getUniform(program, loc);
  //   expect(valData).to.eql(new Float32Array([2.0, 2.0, 1.0]));

  //   renderFrame.dispose();
  //   mesh.dispose();

  // });

  // 设置ubo的uniform值
  // it('set uniform block value', () => {
  //   const vs = `#version 300 es
  //   layout(location = 0) in vec2 aPosition;
  //   void main() {
  //     gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
  //   }`;

  //   const fs = `#version 300 es
  //   precision highp float;
  //   layout(std140) uniform Test {
  //     float f;
  //     float fa[2];
  //     vec2 v2;
  //     vec3 v3;
  //     vec4 v4;
  //     vec2 v2a[3];
  //     mat4 m4;
  //     mat4 m4a[2];
  //     mat3 m3;
  //     mat3 m3a[2];
  //   };
  //   out vec4 outColor;
  //   void main() {
  //     outColor += v4;
  //   }`;
  //   const mesh = new Mesh({
  //     name: 'mesh1',
  //     material: new GLMaterial({
  //       shader: { vertex: vs, fragment: fs },
  //       states: {},
  //     }),
  //     geometry: new GLGeometry({
  //       attributes: {
  //         aPoint: {
  //           size: 2,
  //           data: new Float32Array([
  //             -1.0, 1.0, 0, 1,
  //             -1.0, -1.0, 0, 0,
  //             1.0, 1.0, 1, 1,
  //             1.0, -1.0, 1, 0,
  //           ]),
  //           stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //         },
  //         aTexCoord: {
  //           type: glContext.FLOAT,
  //           size: 2,
  //           stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //           offset: Float32Array.BYTES_PER_ELEMENT * 2,
  //           dataSource: 'aPoint',
  //         },
  //       },
  //       indices: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
  //       drawCount: 6,
  //     }),
  //   });
  //   const renderFrame = new RenderFrame({
  //     renderer,
  //     camera: new Camera(),
  //     clearAction: {
  //       colorAction: TextureLoadAction.clear,
  //       clearColor: [0, 0, 0, 0],
  //     },
  //   });
  //   const block = new GLMaterialDataBlock({ name: 'Test', keepUboData: true });

  //   mesh.material.addDataBlock(block);

  //   block.setUniformValue('f', 1);
  //   block.setUniformValue('fa', [1, 2]);
  //   block.setUniformValue('v2', [3, 4]);
  //   block.setUniformValue('v3', [5, 6, 7]);
  //   block.setUniformValue('v4', [1, 2, 3, 1]);

  //   block.setUniformValue('v2a', [1, 1, 2, 2, 3, 3]);
  //   block.setUniformValue('m3', [1, 1, 1, 2, 2, 2, 3, 3, 3]);
  //   block.setUniformValue('m4', [
  //     1, 0, 0, 0, // m4
  //     0, 2, 0, 0,
  //     0, 0, 3, 0,
  //     0, 0, 0, 4]);
  //   block.setUniformValue('m4a', [
  //     1, 0, 0, 0, // m4a
  //     0, 1, 0, 0,
  //     0, 0, 1, 0,
  //     0, 0, 0, 1,
  //     2, 0, 0, 0,
  //     0, 2, 0, 0,
  //     0, 0, 2, 0,
  //     0, 0, 0, 2]);
  //   block.setUniformValue('m3a', [
  //     3, 3, 3,
  //     3, 3, 3,
  //     3, 3, 3,
  //     4, 4, 4,
  //     4, 4, 4,
  //     4, 4, 4,
  //   ]);
  //   const data = new Float32Array(
  //     4 + // f
  //     2 * 4 + // fa[2]
  //     4 + // v2
  //     4 + // v3
  //     4 + // v4
  //     3 * 4 + // v2a[3]
  //     3 * 2 * 4 + // m2a[3]
  //     3 * 2 * 4 + // m23a[3]
  //     4 * 3 +// m3
  //     2 * 4 * 3
  //   );
  //   const expected = new Float32Array([
  //     1, 0, 0, 0, // f
  //     1, 0, 0, 0, 2, 0, 0, 0, // fa[2]
  //     3, 4, 0, 0, // v2
  //     5, 6, 7, 0, // v3
  //     1, 2, 3, 1, // v4
  //     1, 1, 0, 0, // v2a[3]
  //     2, 2, 0, 0,
  //     3, 3, 0, 0,
  //     1, 0, 0, 0, // m4
  //     0, 2, 0, 0,
  //     0, 0, 3, 0,
  //     0, 0, 0, 4,
  //     1, 0, 0, 0, // m4a
  //     0, 1, 0, 0,
  //     0, 0, 1, 0,
  //     0, 0, 0, 1,
  //     2, 0, 0, 0,
  //     0, 2, 0, 0,
  //     0, 0, 2, 0,
  //     0, 0, 0, 2,
  //     1, 1, 1, 0, //m3
  //     2, 2, 2, 0,
  //     3, 3, 3, 0,
  //     3, 3, 3, 0, //m3a
  //     3, 3, 3, 0,
  //     3, 3, 3, 0,
  //     4, 4, 4, 0,
  //     4, 4, 4, 0,
  //     4, 4, 4, 0,
  //   ]);

  //   let valueData = block.getUniformValue('f');

  //   expect(valueData).to.eql(1);

  //   valueData = block.getUniformValue('fa');
  //   expect(valueData).to.eql([1, 2]);

  //   valueData = block.getUniformValue('v2');
  //   expect(valueData).to.eql([3, 4]);

  //   valueData = block.getUniformValue('v3');
  //   expect(valueData).to.eql([5, 6, 7]);

  //   valueData = block.getUniformValue('v4');
  //   expect(valueData).to.eql([1, 2, 3, 1]);
  //   expect(block.getUniformValue('v2a')).to.eql([1, 1, 2, 2, 3, 3]);

  //   renderer.renderRenderFrame(renderFrame);
  //   renderer.renderMesh(mesh);
  //   gl.getBufferSubData(gl.UNIFORM_BUFFER, 0, data);
  //   expect(data).to.eql(expected);

  //   renderFrame.dispose();
  //   mesh.dispose();
  // });

  // // 利用setSubData更新uniform的值
  // it('set uniform sub block value', () => {
  //   const vs = `#version 300 es
  //     layout(location = 0) in vec2 aPosition;
  //     void main() {
  //       gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
  //     }`;
  //   const fs = `#version 300 es
  //     precision highp float;
  //     layout(std140) uniform Test {
  //       mat4 m4a[4];
  //     };
  //     out vec4 outColor;
  //     void main() {
  //       outColor = vec4(m4a[1]);
  //     }`;
  //   const mesh = new Mesh({
  //     name: 'mesh1',
  //     material: new GLMaterial({
  //       shader: { vertex: vs, fragment: fs },
  //       states: {},
  //     }),
  //     geometry: new GLGeometry({
  //       attributes: {
  //         aPoint: {
  //           size: 2,
  //           data: new Float32Array([
  //             -1.0, 1.0, 0, 1,
  //             -1.0, -1.0, 0, 0,
  //             1.0, 1.0, 1, 1,
  //             1.0, -1.0, 1, 0,
  //           ]),
  //           stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //         },
  //         aTexCoord: {
  //           type: glContext.FLOAT,
  //           size: 2,
  //           stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //           offset: Float32Array.BYTES_PER_ELEMENT * 2,
  //           dataSource: 'aPoint',
  //         },
  //       },
  //       indices: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
  //       drawCount: 6,
  //     }),
  //   });
  //   const renderPass = new RenderPass({
  //     name: 'basic', priority: 8, meshes: [mesh], camera: { name: 'main' },
  //   });
  //   const renderFrame = new RenderFrame({
  //     renderer,
  //     camera: new Camera(),
  //     clearAction: {
  //       colorAction: TextureLoadAction.clear,
  //       clearColor: [0, 0, 0, 0],
  //     },
  //   });

  //   renderFrame.setRenderPasses([renderPass]);
  //   renderer.renderRenderFrame(renderFrame);
  //   renderer.renderMesh(mesh);

  //   const array = [[
  //     1, 0, 0, 0, // m4a
  //     0, 1, 0, 0,
  //     0, 0, 1, 0,
  //     0, 0, 0, 1,
  //   ], [
  //     2, 0, 0, 0,
  //     0, 2, 0, 0,
  //     0, 0, 2, 0,
  //     0, 0, 0, 2,
  //   ], [
  //     3, 0, 0, 0,
  //     0, 3, 0, 0,
  //     0, 0, 3, 0,
  //     0, 0, 0, 3,
  //   ]];

  //   mesh.material.setMatrixArray('m4a', array);
  //   const data = new Float32Array(16 * 3);

  //   renderer.renderMesh(mesh);
  //   gl.getBufferSubData(gl.UNIFORM_BUFFER, 0, data);
  //   expect(data).to.eql(array);

  //   // const m4a = mesh.material.getMatrixArray('m4a');

  //   const m4b = [
  //     1, 1, 1, 1,
  //     2, 2, 2, 2,
  //     3, 3, 3, 3,
  //     4, 4, 4, 4,
  //     5, 5, 5, 5, //not upload
  //     6, 6, 6, 6, //not upload
  //   ];

  //   mesh.material.setMatrixArray('m4a', m4b);
  //   mesh.initialize(renderer.glRenderer);
  //   renderer.renderMesh(mesh);
  //   gl.getBufferSubData(gl.UNIFORM_BUFFER, 0, data);
  //   expect(data).to.eql(new Float32Array([
  //     1, 1, 1, 1,
  //     2, 2, 2, 2,
  //     3, 3, 3, 3,
  //     4, 4, 4, 4,
  //     2, 0, 0, 0,
  //     0, 2, 0, 0,
  //     0, 0, 2, 0,
  //     0, 0, 0, 2,
  //     3, 0, 0, 0,
  //     0, 3, 0, 0,
  //     0, 0, 3, 0,
  //     0, 0, 0, 3,
  //   ]));

  //   block.updateUniformSubData('m4a', 0, 1);
  //   block.updateUniformSubData('m4a', 1, 1);
  //   expect(block.uniformValueRanges['m4a']).to.eql([0, 2]);
  //   renderer.renderMesh(mesh);
  //   gl.getBufferSubData(gl.UNIFORM_BUFFER, 0, data);
  //   expect(data).to.eql(new Float32Array([
  //     1, 1, 1, 1,
  //     2, 2, 2, 2,
  //     3, 3, 3, 3,
  //     4, 4, 4, 4,
  //     5, 5, 5, 5,
  //     6, 6, 6, 6,
  //     0, 0, 2, 0,
  //     0, 0, 0, 2,
  //     3, 0, 0, 0,
  //     0, 3, 0, 0,
  //     0, 0, 3, 0,
  //     0, 0, 0, 3,
  //   ]));

  //   renderFrame.dispose();
  // });

  //   // 为共享的program绑定ubo
  //   it('bind ubo for shared program', () => {
  //     const vs = `
  // #version 300 es
  // layout(location = 0) in vec2 aPosition;
  // void main() {
  //   gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
  // }
  // `;
  //     const fs = `
  // #version 300 es
  // precision highp float;
  // uniform Test {
  //   vec4 uColor;
  //   vec2 uC2;
  //   vec3 uC3[2];
  // };
  // out vec4 outColor;
  // void main() {
  //   vec3 a = uC3[1] + vec3(uC2,1.);
  //   outColor = uColor;
  // }
  // `;
  //     const spy = chai.spy();
  //     const mesh = generateMesh('m0', vs, fs);
  //     const mesh1 = generateMesh('m1', vs, fs);
  //     const meshes = [mesh, mesh1];

  //     mesh.material.addDataBlock(new GLMaterialDataBlock({
  //       name: 'Test',
  //       uniformValues: { uColor: [1, 2, 3, 4], uC3: [1, 2, 3, 4, 5, 6] },
  //       keepUboData: true,
  //     }));
  //     mesh1.material.addDataBlock(new GLMaterialDataBlock({
  //       name: 'Test',
  //       uniformValues: { uColor: [4, 5, 6, 7] },
  //       keepUboData: true,
  //     }));

  //     const renderPass = new RenderPass({
  //       name: 'basic',
  //       priority: 8,
  //       meshes,
  //       camera: { name: 'main' },
  //       delegate: {
  //         didRenderMesh (mesh) {
  //           const db = mesh.material.dataBlocks[1];

  //           expect(db.name).to.eql('Test');
  //           const ubo = Object.values(db.uboBufferMap)[0];

  //           expect(ubo.buffer.glBuffer).to.be.instanceof(WebGLBuffer);

  //           if (mesh.name === 'm0') {
  //             expect(ubo.dirtyFlags['uColor'].buffer).to.deep.equals(new Float32Array([1, 2, 3, 4]));
  //             expect(ubo.dirtyFlags['uC3'].buffer).to.deep.equals(new Float32Array([1, 2, 3, 0, 4, 5, 6, 0]));
  //           }
  //           if (mesh.name === 'm1') {
  //             expect(ubo.dirtyFlags['uColor'].buffer).to.deep.equals(new Float32Array([4, 5, 6, 7]));
  //           }
  //           expect(gl.getParameter(glContext.UNIFORM_BUFFER_BINDING)).to.eql(ubo.buffer.glBuffer, 'ubo buffer');
  //           spy();
  //         },
  //       },
  //     });
  //     const renderFrame = new RenderFrame({
  //       renderer,
  //       camera: new Camera(),
  //       clearAction: {
  //         colorAction: TextureLoadAction.clear,
  //         clearColor: [0, 0, 0, 0],
  //       },
  //     });

  //     renderFrame.setRenderPasses([renderPass]);
  //     renderer.renderRenderFrame(renderFrame);
  //     expect(spy).to.has.been.called.twice;
  //     renderFrame.dispose();
  //   });
  // TODO material创建时使用具有cacheId的shader 等改完GLShader的创建逻辑再改
  /*// 不同material使用相同的materialDataBlock
  it('bind ubo for instance program', ()=> {

    const vs = `#version 300 es
      layout(location = 0) in vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
      }`;

    const fs = `#version 300 es
      precision highp float;
      #ifdef NDC
        uniform T2{
          vec3 uT2V3;
        };
      #endif
      uniform Test {
        vec4 uColor;
        vec2 uC2;
        vec3 uC3[2];
      };
      out vec4 outColor;
      void main() {
        vec3 a = uC3[1] + vec3(uC2,1.);
        #ifdef NDC
        a += uT2V3;
        #endif
        outColor = uColor;
      }`;

    const spy = chai.spy();
    const db = new GLMaterialDataBlock({ name: 'Test', uniformValues: { uColor: [4, 5, 6, 7] }, keepUboData: true });
    const db2 = new GLMaterialDataBlock({ name: 'T2', uniformValues: { uT2V3: [4, 5, 6] }, keepUboData: true });
    const mesh =  createMesh('m0', vs, fs, [], false);
    const mesh1 = createMesh('m1', vs, fs,[['NDC', true]], false);

    const meshes = [ mesh1];
    mesh.material.addDataBlock(db);
    mesh1.material.addDataBlock(db);
    mesh1.material.addDataBlock(db2);

    const renderPass = new RenderPass({
      name: 'basic', priority: 8, meshes, camera: { name: 'main' },
      delegate: {
        didRenderMesh () {
          spy();
        },
      },
    });

    const renderFrame = new RenderFrame({
      renderer,
      camera: new Camera(),
      clearAction: {
        colorAction: TextureLoadAction.clear,
        clearColor: [0, 0, 0, 0],
      },
    });

    renderFrame.setRenderPasses([renderPass])
    renderer.renderRenderFrame(renderFrame);

    expect(Object.values((db).uboBufferMap).length).to.eql(1);
    expect(Object.values((db2).uboBufferMap).length).to.eql(2);
    const program = mesh.material.shader.program;
    const program1 = mesh1.material.shader.program;
    expect(program).to.exist;
    expect(program1).to.exist;
    expect(program).to.eql(program1);
    expect(program.uniformBlockMap.Test.index).to.eql(program1.uniformBlockMap.Test.index);
    expect(spy).to.has.been.called.twice;
  });

  // 同一gLMaterialDataBlock绑定到不同program
  it('bind GLMaterialDataBlock for 2 different program', ()=> {

    const vs = `#version 300 es
      layout(location = 0) in vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
      }`;

    const fs = `#version 300 es
    precision highp float;
    uniform Test {
      vec4 uColor;
      vec2 uC2;
      vec3 uC3[2];
      #ifdef NDC
      vec3 uT2V3;
      #endif
    };
    out vec4 outColor;
    void main() {
      vec3 a = uC3[1] + vec3(uC2,1.);
      #ifdef NDC
      a += uT2V3;
      #endif
      outColor = uColor;
    }`;

    const spy = chai.spy();
    const db = new GLMaterialDataBlock({
      name: 'Test',
      uniformValues: {
        uColor: [4, 5, 6, 7],
        uT2V3: [1, 1, 1],
      },
      keepUboData: true,
    });
    const mesh = createMesh('m0',vs, fs);
    const mesh1 =  createMesh( 'm1', vs, fs,[['NDC', true]]);
    const meshes = [mesh, mesh1];
    mesh.material.addDataBlock(db);
    mesh1.material.addDataBlock(db);
    mesh.material.shader.id = 'mesh_shader';
    mesh1.material.shader.id = 'mesh1_shader';
    const renderPass = new RenderPass({
      name: 'basic',
      priority: 8,
      meshes: meshes,
      camera: { name: 'main' },
      delegate: {
        didRenderMesh () {
          spy();
        },
      },
    });

    const renderFrame = new RenderFrame({
      renderer,
      camera: new Camera(),
      clearAction: {
        colorAction: TextureLoadAction.clear,
        clearColor: [0, 0, 0, 0],
      },
    });
    renderFrame.setRenderPasses([renderPass])
    renderer.renderRenderFrame(renderFrame);
    const p0 = mesh.material.shader.program;
    const p1 = mesh1.material.shader.program;
    expect(Object.values((db).uboBufferMap).length).to.eql(2);
    expect(p0).to.exist;
    expect(p1).to.exist;
    expect(p0).to.not.eql(p1);
    expect(p0.uniformBlockMap.Test.index).to.eql(p1.uniformBlockMap.Test.index);
    expect(p0.uniformBlockMap.Test.id).not.to.eql(p1.uniformBlockMap.Test.id);
    const ub0 = db.uboBufferMap[p0.uniformBlockMap.Test.id].buffer.byteLength;
    const ub1 = db.uboBufferMap[p1.uniformBlockMap.Test.id].buffer.byteLength;

    expect(ub1 - ub0).to.eql(Float32Array.BYTES_PER_ELEMENT * 4, 'vec3');

    expect(spy).to.has.been.called.twice;
  });
*/

  //   it('Mesh被删除时删除UniformBlockBuffer', async () => {
  //     const keeUBOData = true;
  //     const result = generateMeshAndUBO(renderer, keeUBOData);
  //     const block = result.block;
  //     const mesh = result.mesh;
  //     const renderFrame = result.renderFrame;

  //     renderer.renderRenderFrame(renderFrame);

  //     // mesh删除参数，删除ubo
  //     mesh.dispose({
  //       material: {
  //         blocks: DestroyOptions.destroy,
  //       },
  //     });

  //     // mesh的材质引用已经设置为undefined
  //     expect(mesh.material.isDestroyed).to.be.true;

  //     // ubo已经被删除
  //     for (const value of Object.values(block.uboBufferMap)) {
  //       expect(value.buffer).to.eql(undefined);
  //     }
  //   });

  //   // Mesh被删除时保留UniformBlockBuffer
  //   it('Mesh被删除时保留UniformBlockBuffer', async () => {
  //     const keeUBOData = true;
  //     const result = generateMeshAndUBO(renderer, keeUBOData);
  //     const block = result.block;
  //     const mesh = result.mesh;
  //     const renderFrame = result.renderFrame;

  //     renderer.renderRenderFrame(renderFrame);
  //     // mesh删除参数保留材质的block数据
  //     mesh.dispose({
  //       material: {
  //         blocks: DestroyOptions.keep,
  //       },
  //     });

  //     // mesh的材质引用已经设置为undefined
  //     expect(mesh.material.isDestroyed).to.be.true;

  //     // ubo被render托管因此不会被删除
  //     for (const value of Object.values(block.uboBufferMap)) {
  //       expect(value.buffer).not.eql(undefined);
  //     }
  //     block.dispose();
  //     renderFrame.dispose();
  //   });

  //   it('材质被删除时保留UniformBlockBuffer', async () => {
  //     const keeUBOData = true;
  //     const result = generateMeshAndUBO(renderer, keeUBOData);
  //     const block = result.block;
  //     const material = result.material;
  //     const renderFrame = result.renderFrame;

  //     renderer.renderRenderFrame(renderFrame);

  //     material.dispose({
  //       blocks: DestroyOptions.keep,
  //     });

  //     for (const value of Object.values(block.uboBufferMap)) {
  //       expect(value.buffer).not.eql(undefined);
  //     }
  //     block.dispose();
  //     renderFrame.dispose();
  //   });

  //   it('材质被删除时同时删除UniformBlockBuffer', async () => {
  //     const keeUBOData = true;
  //     const result = generateMeshAndUBO(renderer, keeUBOData);
  //     const block = result.block;
  //     const material = result.material;
  //     const renderFrame = result.renderFrame;

  //     renderer.renderRenderFrame(renderFrame);

  //     material.dispose({
  //       blocks: DestroyOptions.destroy,
  //     });

  //     for (const value of Object.values(block.uboBufferMap)) {
  //       expect(value.buffer).to.eql(undefined);
  //     }
  //     renderFrame.dispose();
  //   });

  //   it('ubo名字相同内部uniform不同时，测试UniformBlockBuffer内存布局', () => {
  //     const vs = `
  // #version 300 es
  // layout(location = 0) in vec2 aPosition;
  // layout(location = 1) in vec2 aTexCoord;

  // void main() {
  //   gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
  // }
  // `;
  //     const fs = `
  // #version 300 es
  // precision highp float;

  // layout(std140) uniform GlobalLights {
  //   float intensity;
  //   vec3 Direction;
  //   vec4 InnerColor;
  //   vec4 OuterColor;
  //   float RadiusInner;
  //   float RadiusOuter;
  // };

  // out vec4 outColor;
  // void main() {
  //   outColor += vec4(InnerColor.x, InnerColor.y, InnerColor.z, intensity);
  // }
  // `;
  //     const material = new GLMaterial({
  //       shader: { vertex: vs, fragment: fs },
  //       states: {},
  //     });
  //     const mesh = new Mesh({
  //       name: 'mesh1',
  //       material: material,
  //       geometry: new GLGeometry({
  //         attributes: {
  //           aPosition: {
  //             size: 2,
  //             data: new Float32Array([
  //               -1.0, 1.0, 0, 1,
  //               -1.0, -1.0, 0, 0,
  //               1.0, 1.0, 1, 1,
  //               1.0, -1.0, 1, 0,
  //               1.0, 1.0, 1, 1,
  //               1.0, -1.0, 1, 0,
  //             ]),
  //             stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //           },
  //           aTexCoord: {
  //             type: glContext.FLOAT,
  //             size: 2,
  //             stride: Float32Array.BYTES_PER_ELEMENT * 4,
  //             offset: Float32Array.BYTES_PER_ELEMENT * 2,
  //             dataSource: 'aPoint',
  //           },
  //         },
  //         indices: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
  //         drawCount: 6,
  //       }),
  //     });
  //     // 使用shared布局
  //     const vs2 = `
  // #version 300 es
  // layout(location = 0) in vec2 aPosition;

  // void main() {
  //   gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
  // }
  // `;
  //     const fs2 = `
  // #version 300 es
  // precision highp float;

  // uniform GlobalLights {
  //   float intensity;
  //   vec3 Direction;
  //   vec4 InnerColor;
  //   vec4 OuterColor;
  // };

  // out vec4 outColor;
  // void main() {
  //   outColor += vec4(InnerColor.x, InnerColor.y, InnerColor.z, intensity);
  // }
  // `;
  //     const mesh2 = generateMesh('mesh2', vs2, fs2);
  //     const renderPass = new RenderPass({
  //       name: 'basic',
  //       priority: 8,
  //       meshes: [mesh, mesh2],
  //       delegate: {},
  //     });
  //     const renderFrame = new RenderFrame({
  //       renderer,
  //       camera: new Camera(),
  //       clearAction: {
  //         colorAction: TextureLoadAction.clear,
  //         clearColor: [0, 0, 0, 0],
  //       },
  //     });

  //     renderFrame.setRenderPasses([renderPass]);

  //     const block = new GLMaterialDataBlock({ name: 'GlobalLights', keepUboData: true });

  //     mesh.material.addDataBlock(block);
  //     mesh2.material.addDataBlock(block);

  //     block.setUniformValue('intensity', 2.0);
  //     block.setUniformValue('Direction', [0, 1, 0]);
  //     block.setUniformValue('InnerColor', [1, 1, 1]);
  //     block.setUniformValue('OuterColor', [0.5, 0.5, 0.1]);
  //     block.setUniformValue('RadiusInner', 0.5);
  //     block.setUniformValue('RadiusOuter', 1.0);

  //     renderer.renderRenderFrame(renderFrame);

  //     for (const ubo of Object.values(block.uboBufferMap)) {
  //       let uboBytelength = 0;

  //       for (const uniform of Object.values(ubo.info.uniforms)) {
  //         uboBytelength += uniform[8];
  //       }

  //       const temp = new ArrayBuffer(uboBytelength);
  //       const data = new Float32Array(temp);

  //       if (ubo.buffer !== undefined) {
  //         ubo.buffer.bind();
  //         ubo.buffer.readSubData(0, data);
  //       }
  //     }

  //     renderFrame.dispose();
  //   });
});

function generateMesh (engine, meshName, vs, fs, marcos = [], shared = true) {
  return new Mesh(
    engine,
    {
      name: meshName,
      material: new GLMaterial(
        engine,
        {
          shader: {
            vertex: createShaderWithMarcos(marcos, vs, ShaderType.vertex),
            fragment: createShaderWithMarcos(marcos, fs, ShaderType.fragment),
            marcos: marcos,
            shared,
          },
          states: {},
        }),
      geometry: new GLGeometry(
        engine,
        {
          attributes: {
            aPoint: {
              size: 2,
              data: new Float32Array([
                -1.0, 1.0, 0, 1,
                -1.0, -1.0, 0, 0,
                1.0, 1.0, 1, 1,
                1.0, -1.0, 1, 0,
              ]),
              stride: Float32Array.BYTES_PER_ELEMENT * 4,
            },
          },
          indices: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
          drawCount: 6,
        }),
    });
}

function generateMeshAndUBO (renderer, keeUBOData = true) {
  const vs = `
#version 300 es
layout(location = 0) in vec2 aPosition;
out vec4 v_pos;

void main() {
  gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
}
`;

  const fs = `
#version 300 es
precision highp float;

layout(std140) uniform Test {
  float f;
  float fa[2];
  vec2 v2;
  vec3 v3;
  vec4 v4;
  vec2 v2a[3];
  mat2 m2a[3];
  mat2x3 m23a[3];
};
out vec4 outColor;
void main() {
  outColor += v4;
}
`;
  const engine = renderer.engine;
  const material = new GLMaterial(
    engine,
    {
      shader: { vertex: vs, fragment: fs },
      states: {},
    });
  const mesh = new Mesh(
    engine,
    {
      material: material,
      geometry: new GLGeometry(
        engine,
        {
          attributes: {
            aPoint: {
              size: 2,
              data: new Float32Array([
                -1.0, 1.0, 0, 1,
                -1.0, -1.0, 0, 0,
                1.0, 1.0, 1, 1,
                1.0, -1.0, 1, 0,
              ]),
              stride: Float32Array.BYTES_PER_ELEMENT * 4,
            },
            aTexCoord: {
              type: glContext.FLOAT,
              size: 2,
              stride: Float32Array.BYTES_PER_ELEMENT * 4,
              offset: Float32Array.BYTES_PER_ELEMENT * 2,
              dataSource: 'aPoint',
            },
          },
          indices: { data: new Uint8Array([0, 1, 2, 2, 1, 3]) },
          drawCount: 6,
        }),
    });
  const renderPass = new RenderPass({
    name: 'basic', priority: 8, meshes: [mesh], camera: { name: 'main' },
  });
  const renderFrame = new RenderFrame({
    renderer,
    renderPasses: [renderPass],
    camera: new Camera(),
    clearAction: {
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    },
  });

  const block = new GLMaterialDataBlock({ name: 'Test', keepUboData: keeUBOData });

  material.addDataBlock(block);

  block.setUniformValue('f', 1);
  block.setUniformValue('fa', [1, 2]);
  block.setUniformValue('v2', [3, 4]);
  block.setUniformValue('v3', [5, 6, 7]);
  block.setUniformValue('v4', [1, 2, 3, 1]);
  block.setUniformValue('v2a', [1, 1, 2, 2, 3, 3]);

  return {
    block,
    material,
    mesh,
    renderFrame,
  };
}

function generateTexture (engine) {
  const writePixelData = [255, 100, 50, 0];
  const buffer = new Uint8Array([1, 2, ...writePixelData, 3, 4]);

  return Texture.createWithData(
    engine,
    { width: 1, height: 1, data: new Uint8Array(buffer.buffer, 2 * Uint8Array.BYTES_PER_ELEMENT, 4) },
    {
      format: glContext.RGBA,
      type: glContext.UNSIGNED_BYTE,
    }
  );
}
function generateGLMaterial (engine, shader, states, renderer) {
  const material = new GLMaterial(engine, { shader });

  material.sampleAlphaToCoverage = !!(states.sampleAlphaToCoverage);
  material.depthTest = states.depthTest;
  material.depthMask = states.depthMask;
  material.depthRange = states.depthRange;
  material.depthFunc = states.depthFunc;
  material.colorMask = states.colorMask;
  material.polygonOffset = states.polygonOffset;
  material.polygonOffsetFill = states.polygonOffsetFill;
  material.blending = states.blending;
  material.blendFunction = [states.blendSrc ?? glContext.ONE, states.blendDst ?? glContext.ONE_MINUS_SRC_ALPHA, states.blendSrcAlpha ?? glContext.ONE, states.blendDstAlpha ?? glContext.ONE_MINUS_SRC_ALPHA];
  material.blendColor = states.blendColor;
  material.blendEquation = [states.blendEquationRGB ?? glContext.FUNC_ADD, states.blendEquationAlpha ?? glContext.FUNC_ADD];

  material.stencilTest = states.stencilTest;
  material.stencilMask = [states.stencilMask ?? 0xff, states.stencilMask ?? 0xff];
  material.stencilFunc = states.stencilFunc;
  material.stencilOpFail = states.stencilOpFail;
  material.stencilOpZFail = states.stencilOpZFail;
  material.stencilOpZPass = states.stencilOpZPass;
  material.stencilRef = states.stencilRef;

  material.culling = states.cullFaceEnabled ?? true;
  material.cullFace = states.cullFace;

  material.initialize(renderer.engine);
  material.setupStates(renderer.pipelineContext);

  return material;
}
