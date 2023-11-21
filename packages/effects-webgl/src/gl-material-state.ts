import { glContext } from '@galacean/effects-core';
import type { GLPipelineContext } from './gl-pipeline-context';

export class GLMaterialState {
  // Blend相关设置
  public blending: boolean;
  public blendFunctionParameters: [blendSrc: GLenum, blendDst: GLenum, blendSrcAlpha: GLenum, blendDstAlpha: GLenum];
  public blendEquationParameters: [blendEquationRGB: GLenum, blendEquationAlpha: GLenum];
  public blendColor: [r: number, g: number, b: number, a: number];

  // depth相关设置
  public depthTest: boolean;
  public depthMask: boolean;
  public depthRange: [zNear: GLenum, zFar: GLenum];
  public depthFunc: GLenum;
  public polygonOffset: [factor: GLenum, units: GLenum];
  public polygonOffsetFill: boolean;
  public sampleAlphaToCoverage: boolean;
  public colorMask: [r: boolean, g: boolean, b: boolean, a: boolean];

  // stencil相关
  public stencilTest: boolean;
  public stencilMask: [front: GLenum, back: GLenum];
  public stencilRef: [front: GLenum, back: GLenum];
  public stencilFunc: [front: GLenum, back: GLenum];
  public stencilOpFail: [front: GLenum, back: GLenum];
  public stencilOpZFail: [front: GLenum, back: GLenum];
  public stencilOpZPass: [front: GLenum, back: GLenum];

  // culling相关
  public culling: boolean;
  public frontFace: GLenum;
  public cullFace: GLenum;

  constructor () {
    this.reset();
  }

  setBlendColor (color: [r: number, g: number, b: number, a: number]): void {
    const [r, g, b, a] = color;

    if (this.blendColor[0] === r && this.blendColor[1] === g && this.blendColor[2] === b && this.blendColor[3] === a) {
      return;
    }
    this.blendColor[0] = r;
    this.blendColor[1] = g;
    this.blendColor[2] = b;
    this.blendColor[3] = a;
  }

  setBlending (value: boolean): void {
    if (this.blending !== value) {
      this.blending = value;
    }
  }

  setBlendFunctionParameters (value: [blendSrc: GLenum, blendDst: GLenum, blendSrcAlpha: GLenum, blendDstAlpha: GLenum]): void {
    const [blendSrc, blendDst, blendSrcAlpha, blendDstAlpha] = value;

    if (
      this.blendFunctionParameters[0] === blendSrc &&
      this.blendFunctionParameters[1] === blendDst &&
      this.blendFunctionParameters[2] === blendSrcAlpha &&
      this.blendFunctionParameters[3] === blendDstAlpha
    ) {
      return;
    }

    this.blendFunctionParameters[0] = blendSrc;
    this.blendFunctionParameters[1] = blendDst;
    this.blendFunctionParameters[2] = blendSrcAlpha;
    this.blendFunctionParameters[3] = blendDstAlpha;

  }

  setBlendEquationParameters (value: [rgb: GLenum, alpha: GLenum]): void {
    const [rgb, alpha] = value;

    if (this.blendEquationParameters[0] === rgb && this.blendEquationParameters[1] === alpha) {
      return;
    }

    this.blendEquationParameters[0] = rgb;
    this.blendEquationParameters[1] = alpha;
  }

  setDepthTest (value: boolean) {
    if (this.depthTest === value) {
      return;
    }

    this.depthTest = value;
  }

  setDepthMask (value: boolean) {
    if (this.depthMask === value) {
      return;
    }

    this.depthMask = value;
  }

  setDepthRange (value: [zNear: GLenum, zFar: GLenum]) {
    if (this.depthRange[0] === value[0] && this.depthRange[1] === value[1]) {
      return;
    }

    this.depthRange[0] = value[0];
    this.depthRange[1] = value[1];
  }

  setDepthFunc (value: GLenum) {
    if (this.depthFunc === value) {
      return;
    }

    this.depthFunc = value;
  }

  setPolygonOffsetFill (value: boolean) {
    if (this.polygonOffsetFill === value) {
      return;
    }

    this.polygonOffsetFill = value;
  }

  setPolygonOffset (value: [factor: GLenum, units: GLenum]) {
    if (this.polygonOffset[0] === value[0] && this.polygonOffset[1] === value[1]) {
      return;
    }

    this.polygonOffset[0] = value[0];
    this.polygonOffset[1] = value[1];
  }

  setSampleAlphaToCoverage (value: boolean) {
    if (this.sampleAlphaToCoverage === value) {
      return;
    }

    this.sampleAlphaToCoverage = value;
  }

  setColorMask (color: [r: boolean, g: boolean, b: boolean, a: boolean]): void {
    const [r, g, b, a] = color;

    if (this.colorMask[0] === r && this.colorMask[1] === g && this.colorMask[2] === b && this.colorMask[3] === a) {
      return;
    }
    this.colorMask[0] = r;
    this.colorMask[1] = g;
    this.colorMask[2] = b;
    this.colorMask[3] = a;
  }

  setStencilTest (value: boolean) {
    if (this.stencilTest === value) {
      return ;
    }

    this.stencilTest = value;
  }

  setStencilMask (value: [front: GLenum, back: GLenum]) {
    if (this.stencilMask[0] === value[0] && this.stencilMask[1] === value[1]) {
      return;
    }

    this.stencilMask[0] = value[0];
    this.stencilMask[1] = value[1];
  }

  setStencilRef (value: [front: GLenum, back: GLenum]) {
    if (this.stencilRef[0] === value[0] && this.stencilRef[1] === value[1]) {
      return;
    }

    this.stencilRef[0] = value[0];
    this.stencilRef[1] = value[1];
  }

  setStencilFunc (value: [front: GLenum, back: GLenum]) {
    if (this.stencilFunc[0] === value[0] && this.stencilFunc[1] === value[1]) {
      return;
    }

    this.stencilFunc[0] = value[0];
    this.stencilFunc[1] = value[1];
  }

  setStencilOpFail (value: [front: GLenum, back: GLenum]) {
    if (this.stencilOpFail[0] === value[0] && this.stencilOpFail[1] === value[1]) {
      return;
    }

    this.stencilOpFail[0] = value[0];
    this.stencilOpFail[1] = value[1];
  }

  setStencilOpZFail (value: [front: GLenum, back: GLenum]) {
    if (this.stencilOpZFail[0] === value[0] && this.stencilOpZFail[1] === value[1]) {
      return;
    }

    this.stencilOpZFail[0] = value[0];
    this.stencilOpZFail[1] = value[1];
  }

  setStencilOpZPass (value: [front: GLenum, back: GLenum]) {
    if (this.stencilOpZPass[0] === value[0] && this.stencilOpZPass[1] === value[1]) {
      return;
    }

    this.stencilOpZPass[0] = value[0];
    this.stencilOpZPass[1] = value[1];
  }

  setCulling (value: boolean) {
    if (this.culling === value) {
      return;
    }
    this.culling = value;
  }

  setFrontFace (value: GLenum) {
    if (this.frontFace === value) {
      return;
    }
    this.frontFace = value;
  }

  setCullFace (value: GLenum) {
    if (this.cullFace === value) {
      return;
    }
    this.cullFace = value;
  }

  reset (): void {
    this.blending = false;
    this.blendColor = [0, 0, 0, 0];
    this.blendFunctionParameters = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];
    this.blendEquationParameters = [glContext.FUNC_ADD, glContext.FUNC_ADD];
    this.depthTest = false;
    this.depthMask = false;
    this.depthRange = [0, 1];
    this.depthFunc = glContext.LESS;
    this.polygonOffset = [0, 0];
    this.polygonOffsetFill = false;
    this.sampleAlphaToCoverage = false;
    this.colorMask = [true, true, true, true];
    this.stencilTest = false;
    this.stencilMask = [0xFF, 0xFF];
    this.stencilRef = [0, 0];
    this.stencilFunc = [glContext.ALWAYS, glContext.ALWAYS];
    this.stencilOpFail = [glContext.KEEP, glContext.KEEP];
    this.stencilOpZFail = [glContext.KEEP, glContext.KEEP];
    this.stencilOpZPass = [glContext.KEEP, glContext.KEEP];
    this.culling = false;
    this.frontFace = glContext.CW;
    this.cullFace = glContext.FRONT;
  }

  apply (pipelineContext: GLPipelineContext) {
    pipelineContext.toggle(glContext.SAMPLE_ALPHA_TO_COVERAGE, this.sampleAlphaToCoverage);
    pipelineContext.toggle(glContext.BLEND, this.blending);
    pipelineContext.toggle(glContext.DEPTH_TEST, this.depthTest);
    pipelineContext.toggle(glContext.STENCIL_TEST, this.stencilTest);
    pipelineContext.toggle(glContext.CULL_FACE, this.culling);
    pipelineContext.toggle(glContext.POLYGON_OFFSET_FILL, this.polygonOffsetFill);

    if (this.stencilTest) {
      //stencil
      pipelineContext.stencilMaskSeparate(glContext.BACK, this.stencilMask[1]);
      pipelineContext.stencilMaskSeparate(glContext.FRONT, this.stencilMask[0]);
      pipelineContext.stencilFuncSeparate(glContext.BACK, this.stencilFunc[0], this.stencilRef[0], this.stencilMask[0]);
      pipelineContext.stencilFuncSeparate(glContext.FRONT, this.stencilFunc[1], this.stencilRef[1], this.stencilMask[1]);
      pipelineContext.stencilOpSeparate(glContext.BACK, this.stencilOpFail[0], this.stencilOpZFail[0], this.stencilOpZPass[0]);
      pipelineContext.stencilOpSeparate(glContext.FRONT, this.stencilOpFail[1], this.stencilOpZFail[1], this.stencilOpZPass[1]);
    }

    if (this.blending) {
      const {
        blendColor,
        blendEquationParameters,
        blendFunctionParameters,
      } = this;

      pipelineContext.blendColor(blendColor[0], blendColor[1], blendColor[2], blendColor[3]);
      pipelineContext.blendEquationSeparate(blendEquationParameters[0], blendEquationParameters[1]);
      pipelineContext.blendFuncSeparate(blendFunctionParameters[0], blendFunctionParameters[1], blendFunctionParameters[2], blendFunctionParameters[3]);
    }

    //color depth
    pipelineContext.colorMask(this.colorMask[0], this.colorMask[1], this.colorMask[2], this.colorMask[3]);

    if (this.depthTest) {
      pipelineContext.depthMask(this.depthMask);
      pipelineContext.depthFunc(this.depthFunc);
      pipelineContext.depthRange(this.depthRange[0], this.depthRange[1]);
    }

    if (this.culling) {
      //face
      pipelineContext.cullFace(this.cullFace);
      pipelineContext.frontFace(this.frontFace);
    }

    if (this.polygonOffsetFill) {
      pipelineContext.polygonOffset(this.polygonOffset[0], this.polygonOffset[1]);
    }
  }
}
