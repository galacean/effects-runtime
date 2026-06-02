import { glContext } from '../gl';
import type { Engine } from '../engine';

export class MaterialState {
  // Blend相关设置
  blending: boolean;
  blendFunctionParameters: [blendSrc: number, blendDst: number, blendSrcAlpha: number, blendDstAlpha: number];
  blendEquationParameters: [blendEquationRGB: number, blendEquationAlpha: number];
  blendColor: [r: number, g: number, b: number, a: number];

  // depth相关设置
  depthTest: boolean;
  depthMask: boolean;
  depthRange: [zNear: number, zFar: number];
  depthFunc: number;
  polygonOffset: [factor: number, units: number];
  polygonOffsetFill: boolean;
  sampleAlphaToCoverage: boolean;
  colorMask: [r: boolean, g: boolean, b: boolean, a: boolean];

  // stencil相关
  stencilTest: boolean;
  stencilMask: [front: number, back: number];
  stencilRef: [front: number, back: number];
  stencilFunc: [front: number, back: number];
  stencilOpFail: [front: number, back: number];
  stencilOpZFail: [front: number, back: number];
  stencilOpZPass: [front: number, back: number];

  // culling相关
  culling: boolean;
  frontFace: number;
  cullFace: number;

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

  setBlendFunctionParameters (value: [blendSrc: number, blendDst: number, blendSrcAlpha: number, blendDstAlpha: number]): void {
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

  setBlendEquationParameters (value: [rgb: number, alpha: number]): void {
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

  setDepthRange (value: [zNear: number, zFar: number]) {
    if (this.depthRange[0] === value[0] && this.depthRange[1] === value[1]) {
      return;
    }

    this.depthRange[0] = value[0];
    this.depthRange[1] = value[1];
  }

  setDepthFunc (value: number) {
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

  setPolygonOffset (value: [factor: number, units: number]) {
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

  setColorMask (colorMask: boolean): void {
    this.colorMask[0] = colorMask;
    this.colorMask[1] = colorMask;
    this.colorMask[2] = colorMask;
    this.colorMask[3] = colorMask;
  }

  setStencilTest (value: boolean) {
    if (this.stencilTest === value) {
      return;
    }

    this.stencilTest = value;
  }

  setStencilMask (value: [front: number, back: number]) {
    if (this.stencilMask[0] === value[0] && this.stencilMask[1] === value[1]) {
      return;
    }

    this.stencilMask[0] = value[0];
    this.stencilMask[1] = value[1];
  }

  setStencilRef (value: [front: number, back: number]) {
    if (this.stencilRef[0] === value[0] && this.stencilRef[1] === value[1]) {
      return;
    }

    this.stencilRef[0] = value[0];
    this.stencilRef[1] = value[1];
  }

  setStencilFunc (value: [front: number, back: number]) {
    if (this.stencilFunc[0] === value[0] && this.stencilFunc[1] === value[1]) {
      return;
    }

    this.stencilFunc[0] = value[0];
    this.stencilFunc[1] = value[1];
  }

  setStencilOpFail (value: [front: number, back: number]) {
    if (this.stencilOpFail[0] === value[0] && this.stencilOpFail[1] === value[1]) {
      return;
    }

    this.stencilOpFail[0] = value[0];
    this.stencilOpFail[1] = value[1];
  }

  setStencilOpZFail (value: [front: number, back: number]) {
    if (this.stencilOpZFail[0] === value[0] && this.stencilOpZFail[1] === value[1]) {
      return;
    }

    this.stencilOpZFail[0] = value[0];
    this.stencilOpZFail[1] = value[1];
  }

  setStencilOpZPass (value: [front: number, back: number]) {
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

  setFrontFace (value: number) {
    if (this.frontFace === value) {
      return;
    }
    this.frontFace = value;
  }

  setCullFace (value: number) {
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
    this.depthTest = true;
    this.depthMask = true;
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
    this.frontFace = glContext.CCW;
    this.cullFace = glContext.FRONT;
  }

  apply (engine: Engine) {
    engine.setSampleAlphaToCoverage(this.sampleAlphaToCoverage);
    engine.setBlending(this.blending);
    engine.setDepthTest(this.depthTest);
    engine.setStencilTest(this.stencilTest);
    engine.setCulling(this.culling);
    engine.setPolygonOffsetFill(this.polygonOffsetFill);

    if (this.stencilTest) {
      engine.stencilMaskSeparate(glContext.BACK, this.stencilMask[1]);
      engine.stencilMaskSeparate(glContext.FRONT, this.stencilMask[0]);
      engine.stencilFuncSeparate(glContext.BACK, this.stencilFunc[0], this.stencilRef[0], this.stencilMask[0]);
      engine.stencilFuncSeparate(glContext.FRONT, this.stencilFunc[1], this.stencilRef[1], this.stencilMask[1]);
      engine.stencilOpSeparate(glContext.BACK, this.stencilOpFail[0], this.stencilOpZFail[0], this.stencilOpZPass[0]);
      engine.stencilOpSeparate(glContext.FRONT, this.stencilOpFail[1], this.stencilOpZFail[1], this.stencilOpZPass[1]);
    }

    if (this.blending) {
      const {
        blendColor,
        blendEquationParameters,
        blendFunctionParameters,
      } = this;

      engine.blendColor(blendColor[0], blendColor[1], blendColor[2], blendColor[3]);
      engine.blendEquationSeparate(blendEquationParameters[0], blendEquationParameters[1]);
      engine.blendFuncSeparate(blendFunctionParameters[0], blendFunctionParameters[1], blendFunctionParameters[2], blendFunctionParameters[3]);
    }

    engine.colorMask(this.colorMask[0], this.colorMask[1], this.colorMask[2], this.colorMask[3]);

    if (this.depthTest) {
      engine.depthMask(this.depthMask);
      engine.depthFunc(this.depthFunc);
      engine.depthRange(this.depthRange[0], this.depthRange[1]);
    }

    if (this.culling) {
      engine.cullFace(this.cullFace);
      engine.frontFace(this.frontFace);
    }

    if (this.polygonOffsetFill) {
      engine.polygonOffset(this.polygonOffset[0], this.polygonOffset[1]);
    }
  }
}
