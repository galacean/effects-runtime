import type { GLType } from '../gl';
import type { Immutable } from '../utils';

export interface GPUCapabilityDetail {
  floatTexture: number,
  halfFloatTexture: number,
  //set currentPass color attachment type FLOAT
  floatColorAttachment?: boolean,
  //set currentPass color attachment type HALF_FLOAT
  halfFloatColorAttachment?: boolean,
  maxVertexUniforms: number,
  maxVertexTextures: number,
  maxFragmentUniforms: number,
  maxFragmentTextures: number,
  maxShaderTexCount: number,
  maxTextureSize: number,
  maxTextureAnisotropy: number,
  shaderTextureLod: boolean,
  instanceDraw?: boolean,
  drawBuffers?: boolean,
  asyncShaderCompile: boolean,
  //draw elements use uint32 Array
  intIndexElementBuffer?: boolean,
  //render pass depth and stencil texture readable
  //in webgl, if not readable,use Renderbuffer which cannot readable
  readableDepthStencilTextures?: boolean,
  writableFragDepth?: boolean,
  standardDerivatives: boolean,
  halfFloatLinear: boolean,
  floatLinear: boolean,
  maxSample: number,
}

const isWebGL2Available = typeof WebGL2RenderingContext === 'function';

export class GPUCapability {
  type: GLType;
  level: number;
  detail: Immutable<GPUCapabilityDetail>;
  private compressTextureCapabilityList: Map<CompressTextureCapabilityType, boolean>;

  UNSIGNED_INT_24_8: number;
  internalFormatDepth16: number;
  internalFormatDepth24_stencil8: number;

  private drawBufferExtension: WEBGL_draw_buffers | null;
  private textureMaxAnisotropyExt: number;
  glAsyncCompileExt: KHR_parallel_shader_compile | null;
  vaoExt: OES_vertex_array_object | null;

  constructor (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
  ) {
    this.setupCapability(gl);
  }
  get isWebGL2 (): boolean {
    return this.level === 2;
  }
  isCompressedFormatSupported (cap: CompressTextureCapabilityType): boolean {
    return !!this.compressTextureCapabilityList.get(cap);
  }
  private setupCapability (gl: WebGLRenderingContext | WebGL2RenderingContext) {
    const level = isWebGL2Available && gl instanceof WebGL2RenderingContext ? 2 : 1;
    const level2 = level === 2;
    const textureAnisotropicExt = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') as EXT_texture_filter_anisotropic;
    const depthTextureExtension = gl.getExtension('WEBGL_depth_texture');
    let halfFloatLinear = !!gl.getExtension('OES_texture_half_float_linear');
    let floatLinear = !!gl.getExtension('OES_texture_float_linear');

    this.level = level;
    this.type = level2 ? 'webgl2' : 'webgl';
    this.vaoExt = gl.getExtension('OES_vertex_array_object');
    this.glAsyncCompileExt = gl.getExtension('KHR_parallel_shader_compile');

    this.UNSIGNED_INT_24_8 = (gl as WebGL2RenderingContext).UNSIGNED_INT_24_8;
    this.drawBufferExtension = gl.getExtension('WEBGL_draw_buffers');
    if (depthTextureExtension) {
      this.UNSIGNED_INT_24_8 = depthTextureExtension.UNSIGNED_INT_24_8_WEBGL;
    }
    if (level2 && !halfFloatLinear) {
      halfFloatLinear = checkLinearTextureFilter(gl as WebGL2RenderingContext, (gl as WebGL2RenderingContext).HALF_FLOAT);
    }
    if (level2 && !floatLinear) {
      floatLinear = checkLinearTextureFilter(gl as WebGL2RenderingContext, (gl as WebGL2RenderingContext).FLOAT);
    }
    this.internalFormatDepth16 = level2 ? (gl as WebGL2RenderingContext).DEPTH_COMPONENT16 : gl.DEPTH_COMPONENT;
    this.internalFormatDepth24_stencil8 = level2 ? (gl as WebGL2RenderingContext).DEPTH24_STENCIL8 : gl.DEPTH_STENCIL;
    const floatTexture = (level2 || gl.getExtension('OES_texture_float')) ? gl.FLOAT : 0;
    const halfFloatTexture = level2 ? WebGL2RenderingContext.HALF_FLOAT : (gl.getExtension('OES_texture_half_float')?.HALF_FLOAT_OES || 0);

    this.compressTextureCapabilityList = new Map([
      [CompressTextureCapabilityType.astc, !!gl.getExtension('WEBGL_compressed_texture_astc')],
      [CompressTextureCapabilityType.astc_webkit, !!gl.getExtension('WEBKIT_WEBGL_compressed_texture_astc')],
      [CompressTextureCapabilityType.etc, !!gl.getExtension('WEBGL_compressed_texture_etc')],
      [CompressTextureCapabilityType.etc_webkit, !!gl.getExtension('WEBKIT_WEBGL_compressed_texture_etc')],
      [CompressTextureCapabilityType.etc1, !!gl.getExtension('WEBGL_compressed_texture_etc1')],
      [CompressTextureCapabilityType.pvrtc, !!gl.getExtension('WEBGL_compressed_texture_pvrtc') || !!gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc')],
      [CompressTextureCapabilityType.pvrtc_webkit, !!gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc')],
      [CompressTextureCapabilityType.sRGB, !!gl.getExtension('EXT_sRGB')],
    ]);
    const detail: GPUCapabilityDetail = {
      floatTexture,
      halfFloatTexture,
      maxSample: level2 ? gl.getParameter((gl as WebGL2RenderingContext).MAX_SAMPLES) : 1,
      maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxFragmentTextures: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      floatColorAttachment: level2 ? !!gl.getExtension('EXT_color_buffer_float') : (floatTexture > 0 && !!gl.getExtension('WEBGL_color_buffer_float')),
      halfFloatColorAttachment: level2 ? !!gl.getExtension('EXT_color_buffer_float') : (halfFloatTexture > 0 && !!gl.getExtension('EXT_color_buffer_half_float')),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxShaderTexCount: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      halfFloatLinear,
      floatLinear,
      maxTextureAnisotropy: textureAnisotropicExt ? gl.getParameter(textureAnisotropicExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0,
      shaderTextureLod: level2 || !!gl.getExtension('EXT_shader_texture_lod'),
      instanceDraw: level2 || !!gl.getExtension('ANGLE_instanced_arrays'),
      drawBuffers: level2 || !!this.drawBufferExtension,
      asyncShaderCompile: !!this.glAsyncCompileExt,
      intIndexElementBuffer: !!gl.getExtension('OES_element_index_uint'),
      standardDerivatives: level2 || !!gl.getExtension('OES_standard_derivatives'),
      readableDepthStencilTextures: level2 || !!depthTextureExtension,
      writableFragDepth: level2 || !!gl.getExtension('EXT_frag_depth'),
    };

    this['detail'] = detail;
    if (textureAnisotropicExt) {
      this.textureMaxAnisotropyExt = textureAnisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT;
    }
  }

  framebufferTexture2D (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    target: GLenum,
    index: number,
    textarget: number,
    texture: WebGLTexture | null,
  ) {
    const ext = this.drawBufferExtension;

    if (this.level === 1 && !ext && index > 0) {
      throw new Error('Draw multiple color buffers not available.');
    }
    const attachment = ext ?
      ext[`COLOR_ATTACHMENT${index}_WEBGL` as keyof WEBGL_draw_buffers] as number :
      gl[`COLOR_ATTACHMENT${index}` as keyof WebGLRenderingContext] as number;

    if (attachment) {
      gl.framebufferTexture2D(target, attachment, textarget, texture, 0);
    } else {
      console.error(`Invalid color attachment index: ${index}.`);
    }
  }

  drawBuffers (gl: WebGLRenderingContext | WebGL2RenderingContext, bufferStates: boolean[]) {
    const ext = this.drawBufferExtension;

    if (this.level === 1 && !ext) {
      if (bufferStates.length > 1) {
        throw new Error('Draw buffers not available.');
      } else {
        return;
      }
    }
    const buffers = bufferStates.map((enabled, index) => {
      if (enabled) {
        return ext ?
          ext[`COLOR_ATTACHMENT${index}_WEBGL` as keyof WEBGL_draw_buffers] as number :
          gl[`COLOR_ATTACHMENT${index}` as keyof WebGLRenderingContext] as number;
      }

      return gl.NONE;
    });

    if (ext) {
      ext.drawBuffersWEBGL(buffers);
    } else {
      (gl as WebGL2RenderingContext).drawBuffers(buffers);
    }
  }

  setTextureAnisotropic (gl: WebGLRenderingContext | WebGL2RenderingContext, target: GLenum, level: number) {
    const { maxTextureAnisotropy } = this.detail;

    if (maxTextureAnisotropy) {
      gl.texParameterf(target, this.textureMaxAnisotropyExt, Math.min(maxTextureAnisotropy, level || 4));
    }
  }
}

function checkLinearTextureFilter (gl: WebGL2RenderingContext, type: number): boolean {
  const tex = gl.createTexture();
  let ret = false;

  gl.getError();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (!gl.getError()) {
    ret = true;
  }
  gl.deleteTexture(tex);

  return ret;
}

/**
 * GL Capabilities
 * Some capabilities can be smoothed out by extension, and some capabilities must use WebGL 2.0.
 * */
export enum CompressTextureCapabilityType {
  astc = 'WEBGL_compressed_texture_astc',
  astc_webkit = 'WEBKIT_WEBGL_compressed_texture_astc',
  etc = 'WEBGL_compressed_texture_etc',
  etc_webkit = 'WEBKIT_WEBGL_compressed_texture_etc',
  etc1 = 'WEBGL_compressed_texture_etc1',
  pvrtc = 'WEBGL_compressed_texture_pvrtc',
  pvrtc_webkit = 'WEBKIT_WEBGL_compressed_texture_pvrtc',
  sRGB = 'EXT_sRGB'
}