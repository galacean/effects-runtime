import * as spec from '@galacean/effects-specification';

export * from './create-gl-context';
export * from './gpu-time';

export const initErrors: string[] = [];
// @ts-expect-error
export const glContext: WebGL2RenderingContext = {};

if (!initErrors.length) {
  initGLContext();
}

export function initGLContext () {
  // 重要：iOS 9/10 低版本需要拷贝 gl context 的 prototype，要不然会有属性值的缺失
  if (typeof WebGL2RenderingContext === 'function') {
    copy(WebGL2RenderingContext);
  } else if (typeof WebGLRenderingContext !== 'undefined') {
    copy(WebGLRenderingContext);
    copy(WebGLRenderingContext.prototype);
  } else {
    initErrors.push(
      // iOS 16 lockdown mode
      'iOS16 lockdown mode, WebGL Constants not in global'
    );
  }
  if (!initErrors.length && !('HALF_FLOAT' in glContext)) {
    // @ts-expect-error set default value
    glContext['HALF_FLOAT'] = 5131;
  }
}

export function isWebGL2 (gl: WebGLRenderingContext | WebGL2RenderingContext): gl is WebGL2RenderingContext {
  return typeof WebGL2RenderingContext !== 'undefined' && gl.constructor.name === 'WebGL2RenderingContext';
}

function copy (target: any) {
  for (const name in target) {
    if (/^[A-Z_]/.test(name)) {
      // @ts-expect-error safe to assign
      glContext[name] = target[name];
    }
  }
}

export function vertexFormatType2GLType (formatType: spec.VertexFormatType): spec.BufferType {
  switch (formatType) {
    case spec.VertexFormatType.Float32:
      return WebGLRenderingContext['FLOAT'];
    case spec.VertexFormatType.Int16:
      return WebGLRenderingContext['SHORT'];
    case spec.VertexFormatType.Int8:
      return WebGLRenderingContext['BYTE'];
    case spec.VertexFormatType.UInt16:
      return WebGLRenderingContext['UNSIGNED_SHORT'];
    case spec.VertexFormatType.UInt8:
      return WebGLRenderingContext['UNSIGNED_BYTE'];
    default:
      return WebGLRenderingContext['FLOAT'];
  }
}

export function glType2VertexFormatType (webglType: spec.BufferType): spec.VertexFormatType {
  switch (webglType) {
    case WebGLRenderingContext['FLOAT']:
      return spec.VertexFormatType.Float32;
    case WebGLRenderingContext['SHORT']:
      return spec.VertexFormatType.Int16;
    case WebGLRenderingContext['BYTE']:
      return spec.VertexFormatType.Int8;
    case WebGLRenderingContext['UNSIGNED_SHORT']:
      return spec.VertexFormatType.UInt16;
    case WebGLRenderingContext['UNSIGNED_BYTE']:
      return spec.VertexFormatType.UInt8;
    default:
      return spec.VertexFormatType.Float32;
  }
}
