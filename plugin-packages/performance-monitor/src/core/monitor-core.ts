import { calculateTextureSize, calculateRenderbufferSize } from './format-utils';
import type { InternalState, ObjectMetadata, MemorySnapshot, MemoryMonitorExtension, FramebufferInfo } from './types';
import { TEXTURE_TARGETS, DATA_TYPES, BUFFER_TARGETS } from './constants';
export { wrapCanvasContext };

// 已注入的上下文集合
const injectedContexts = new WeakSet<any>();

// 工具函数
const isArrayBufferView = (v: any): v is ArrayBufferView => {
  return v?.buffer instanceof ArrayBuffer;
};

const isBufferLike = (v: any): v is ArrayBuffer | ArrayBufferView => {
  return isArrayBufferView(v) || v instanceof ArrayBuffer;
};

const isNumeric = (v: any): v is number => typeof v === 'number';

const captureStack = (): string => {
  const stack = new Error().stack || '';
  const lines = stack.split('\n');

  return lines.slice(3).filter(l => !l.includes('monitor-core')).join('\n');
};

const isCubeFace = (target: number): boolean => {
  return TEXTURE_TARGETS.CUBEMAP_FACES.includes(target as any);
};

// 帧缓冲计算
const getFramebufferInfo = (
  gl: WebGLRenderingContext | WebGL2RenderingContext
): FramebufferInfo => ({
  sampleCount: gl.getParameter(gl.SAMPLES) || 1,
  depthBits: gl.getParameter(gl.DEPTH_BITS) || 0,
  stencilBits: gl.getParameter(gl.STENCIL_BITS) || 0,
  attributes: gl.getContextAttributes(),
});

const calculateFramebufferSize = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  info: FramebufferInfo
): number => {
  if (gl.isContextLost()) {return 0;}

  const { sampleCount, depthBits, stencilBits } = info;
  const colorBytes = 4;
  const pixelCount = gl.drawingBufferWidth * gl.drawingBufferHeight;

  const depthStencilBytes = Math.ceil((depthBits + stencilBits) / 8);
  const alignedDepthStencil = depthStencilBytes === 3 ? 4 : depthStencilBytes;

  return pixelCount * colorBytes +
         pixelCount * sampleCount * colorBytes +
         pixelCount * alignedDepthStencil;
};

// 状态管理
const createState = (gl: WebGLRenderingContext | WebGL2RenderingContext): InternalState => {
  const defaultVAO = {};

  return {
    gl,
    memoryUsage: {
      textures: 0,
      buffers: 0,
      renderbuffers: 0,
    },
    resourceCount: {
      textures: 0,
      buffers: 0,
      renderbuffers: 0,
      shaders: 0,
      programs: 0,
      vertexArrays: 0,
    },
    bindingMap: new Map(),
    activeVAO: defaultVAO,
    defaultVAO,
    objectRegistry: new Map([[defaultVAO, { memorySize: 0 }]]),
    contextLost: false,
    framebufferInfo: getFramebufferInfo(gl),
  };
};

const resetState = (state: InternalState): void => {
  state.bindingMap.clear();
  state.objectRegistry.clear();
  state.objectRegistry.set(state.defaultVAO, { memorySize: 0 });

  state.memoryUsage.textures = 0;
  state.memoryUsage.buffers = 0;
  state.memoryUsage.renderbuffers = 0;

  state.resourceCount.textures = 0;
  state.resourceCount.buffers = 0;
  state.resourceCount.renderbuffers = 0;
  state.resourceCount.shaders = 0;
  state.resourceCount.programs = 0;
  state.resourceCount.vertexArrays = 0;
};

const collectObjectsByType = <T>(
  state: InternalState,
  constructor: new (...args: any[]) => T
): ObjectMetadata[] => {
  return [...state.objectRegistry.keys()]
    .filter(obj => obj instanceof constructor)
    .map(obj => state.objectRegistry.get(obj)!)
    .filter(Boolean);
};

// 核心注入函数
export const injectMonitor = (
  gl: WebGLRenderingContext | WebGL2RenderingContext
): void => {
  if (injectedContexts.has(gl)) {return;}
  injectedContexts.add(gl);

  const state = createState(gl);
  const { memoryUsage, resourceCount, bindingMap, objectRegistry } = state;

  // 创建扩展对象
  const extension: MemoryMonitorExtension = {
    getSnapshot (): MemorySnapshot {
      const framebufferMem = calculateFramebufferSize(gl, state.framebufferInfo);

      return {
        memory: {
          textureMemory: memoryUsage.textures || 0,
          bufferMemory: memoryUsage.buffers || 0,
          renderbufferMemory: memoryUsage.renderbuffers || 0,
          framebufferMemory: framebufferMem || 0,
          totalMemory: (memoryUsage.textures || 0) +
                      (memoryUsage.buffers || 0) +
                      (memoryUsage.renderbuffers || 0) +
                      (framebufferMem || 0),
        },
        resources: {
          textureCount: resourceCount.textures || 0,
          bufferCount: resourceCount.buffers || 0,
          renderbufferCount: resourceCount.renderbuffers || 0,
          shaderCount: resourceCount.shaders || 0,
          programCount: resourceCount.programs || 0,
          vertexArrayCount: resourceCount.vertexArrays || 0,
        },
        timestamp: Date.now(),
      };
    },

    getObjectDetails (type: any): ObjectMetadata[] {
      return collectObjectsByType(state, type);
    },
  };

  // 纹理相关
  const getTextureMetadata = (target: number): ObjectMetadata | null => {
    // 验证 target 是否有效
    const isValidTarget = target === TEXTURE_TARGETS.TEXTURE_2D ||
                         target === TEXTURE_TARGETS.TEXTURE_CUBE_MAP ||
                         target === TEXTURE_TARGETS.TEXTURE_3D ||
                         target === TEXTURE_TARGETS.TEXTURE_2D_ARRAY;

    if (!isValidTarget && !isCubeFace(target)) {
      return null;
    }

    const actualTarget = isCubeFace(target) ? TEXTURE_TARGETS.TEXTURE_CUBE_MAP : target;
    const obj = bindingMap.get(actualTarget);

    return obj ? objectRegistry.get(obj) || null : null;
  };

  const updateMipLevel = (
    meta: ObjectMetadata,
    target: number,
    level: number,
    format: number,
    width: number,
    height: number,
    depth: number,
    type: number = DATA_TYPES.UNSIGNED_BYTE
  ): void => {
    const newSize = calculateTextureSize(format, width, height, depth, type);

    const faceIndex = isCubeFace(target)
      ? target - TEXTURE_TARGETS.TEXTURE_CUBE_MAP_POSITIVE_X
      : 0;

    meta.mipLevels = meta.mipLevels || [];
    meta.mipLevels[level] = meta.mipLevels[level] || [];

    const oldMip = meta.mipLevels[level][faceIndex];
    const oldSize = oldMip?.memorySize || 0;

    meta.mipLevels[level][faceIndex] = {
      memorySize: newSize,
      format,
      dataType: type,
      width,
      height,
      depth,
    };

    // 修复：只更新该 mipmap 级别的大小，而不是整个纹理的大小
    meta.memorySize = (meta.memorySize || 0) - oldSize + newSize;
    memoryUsage.textures = (memoryUsage.textures || 0) - oldSize + newSize;
    meta.updatedAt = captureStack();
  };

  // 保存原始方法（直接保存，之后用 call 调用以确保 this 上下文）
  const original = {
    createTexture: gl.createTexture,
    deleteTexture: gl.deleteTexture,
    bindTexture: gl.bindTexture,
    texImage2D: gl.texImage2D,
    compressedTexImage2D: gl.compressedTexImage2D,
    generateMipmap: gl.generateMipmap,

    createBuffer: gl.createBuffer,
    deleteBuffer: gl.deleteBuffer,
    bindBuffer: gl.bindBuffer,
    bufferData: gl.bufferData,

    createRenderbuffer: gl.createRenderbuffer,
    deleteRenderbuffer: gl.deleteRenderbuffer,
    bindRenderbuffer: gl.bindRenderbuffer,
    renderbufferStorage: gl.renderbufferStorage,

    bindVertexArray: (gl as WebGL2RenderingContext).bindVertexArray,

    createShader: gl.createShader,
    deleteShader: gl.deleteShader,
    createProgram: gl.createProgram,
    deleteProgram: gl.deleteProgram,

    createVertexArray: (gl as WebGL2RenderingContext).createVertexArray,
    deleteVertexArray: (gl as WebGL2RenderingContext).deleteVertexArray,

    getExtension: gl.getExtension,
  };

  // 纹理方法拦截
  gl.createTexture = function (this: WebGLRenderingContext | WebGL2RenderingContext): WebGLTexture | null {
    const texture = original.createTexture.call(gl);

    if (texture && !state.contextLost) {
      resourceCount.textures++;
      objectRegistry.set(texture, {
        memorySize: 0,
        createdAt: captureStack(),
      });
    }

    return texture;
  } as any;

  gl.deleteTexture = (texture: WebGLTexture | null): void => {
    if (texture && !state.contextLost) {
      const meta = objectRegistry.get(texture);

      if (meta) {
        resourceCount.textures = Math.max(0, resourceCount.textures - 1);
        const oldMemory = memoryUsage.textures || 0;
        const newMemory = Math.max(0, oldMemory - (meta.memorySize || 0));

        // 检测内存计算异常
        if (newMemory < 0 || oldMemory - (meta.memorySize || 0) < 0) {
          console.warn(
            '[Memory Monitor] Texture memory calculation anomaly detected: ' +
            `old=${oldMemory}, delete=${meta.memorySize}, new=${newMemory}`
          );
        }

        memoryUsage.textures = newMemory;
        objectRegistry.delete(texture);
      }
    }
    original.deleteTexture.call(gl, texture);
  };

  gl.bindTexture = (target: number, texture: WebGLTexture | null): void => {
    if (!state.contextLost && typeof target === 'number') {
      const isValidBindTarget = target === TEXTURE_TARGETS.TEXTURE_2D ||
                                target === TEXTURE_TARGETS.TEXTURE_CUBE_MAP ||
                                target === TEXTURE_TARGETS.TEXTURE_3D ||
                                target === TEXTURE_TARGETS.TEXTURE_2D_ARRAY;

      if (isValidBindTarget) {
        bindingMap.set(target, texture);
      }
    }

    // 使用 call 方式调用原始方法，确保正确的 this 上下文
    original.bindTexture.call(gl, target, texture);
  };

  gl.compressedTexImage2D = (...args: any[]): void => {
    const [target, level, format, width, height] = args;

    // 调用原始方法，使用 apply 以保证参数正确传递
    (original.compressedTexImage2D as any).apply(gl, args);

    if (state.contextLost) {return;}
    const meta = getTextureMetadata(target);

    if (meta) {
      updateMipLevel(meta, target, level, format, width, height, 1, DATA_TYPES.UNSIGNED_BYTE);
    }
  };

  gl.texImage2D = (...args: any[]): void => {
    // 调用原始方法，使用 apply 以保证参数正确传递
    (original.texImage2D as any).apply(gl, args);
    if (state.contextLost) {return;}

    const [target, level, format] = args;
    let width: number, height: number, type: number;

    if (args.length === 6) {
      const source = args[5];

      width = source.width || 0;
      height = source.height || 0;
      type = args[4];
    } else {
      width = args[3];
      height = args[4];
      type = args[7];
    }

    const meta = getTextureMetadata(target);

    if (meta) {
      updateMipLevel(meta, target, level, format, width, height, 1, type);
    }
  };

  gl.generateMipmap = (target: number): void => {
    original.generateMipmap.call(gl, target);
    if (state.contextLost) {return;}

    const meta = getTextureMetadata(target);

    if (!meta?.mipLevels?.[0]?.[0]) {return;}

    const baseMip = meta.mipLevels[0][0];
    let { width, height } = baseMip;
    const { depth, format, dataType } = baseMip;

    let level = 1;
    const faceCount = target === TEXTURE_TARGETS.TEXTURE_CUBE_MAP ? 6 : 1;
    const baseTarget = target === TEXTURE_TARGETS.TEXTURE_CUBE_MAP ? TEXTURE_TARGETS.TEXTURE_CUBE_MAP_POSITIVE_X : target;

    while (width > 1 || height > 1) {
      width = Math.max(width >> 1, 1);
      height = Math.max(height >> 1, 1);

      for (let face = 0; face < faceCount; face++) {
        updateMipLevel(meta, baseTarget + face, level, format, width, height, depth, dataType);
      }
      level++;
    }
  };

  // 缓冲区方法拦截
  gl.createBuffer = function (this: WebGLRenderingContext | WebGL2RenderingContext): WebGLBuffer | null {
    const buffer = original.createBuffer.call(gl);

    if (buffer && !state.contextLost) {
      resourceCount.buffers++;
      objectRegistry.set(buffer, {
        memorySize: 0,
        createdAt: captureStack(),
      });
    }

    return buffer;
  } as any;

  gl.deleteBuffer = (buffer: WebGLBuffer | null): void => {
    if (buffer && !state.contextLost) {
      const meta = objectRegistry.get(buffer);

      if (meta) {
        resourceCount.buffers = Math.max(0, resourceCount.buffers - 1);
        const oldMemory = memoryUsage.buffers || 0;
        const newMemory = Math.max(0, oldMemory - (meta.memorySize || 0));

        // 检测内存计算异常
        if (newMemory < 0 || oldMemory - (meta.memorySize || 0) < 0) {
          console.warn(
            '[Memory Monitor] Buffer memory calculation anomaly detected: ' +
            `old=${oldMemory}, delete=${meta.memorySize}, new=${newMemory}`
          );
        }

        memoryUsage.buffers = newMemory;
        objectRegistry.delete(buffer);
      }
    }
    original.deleteBuffer.call(gl, buffer);
  };

  gl.bindBuffer = (target: number, buffer: WebGLBuffer | null): void => {
    if (!state.contextLost) {
      if (target === BUFFER_TARGETS.ELEMENT_ARRAY_BUFFER) {
        const vaoMeta = objectRegistry.get(state.activeVAO);

        if (vaoMeta) {
          (vaoMeta as any).elementBuffer = buffer;
        }
      } else {
        bindingMap.set(target, buffer);
      }
    }
    original.bindBuffer.call(gl, target, buffer);
  };

  gl.bufferData = (...args: any[]): void => {
    (original.bufferData as any).apply(gl, args);
    if (state.contextLost) {return;}

    const [target, data] = args;

    let buffer: WebGLBuffer | null = null;

    if (target === BUFFER_TARGETS.ELEMENT_ARRAY_BUFFER) {
      const vaoMeta = objectRegistry.get(state.activeVAO);

      buffer = (vaoMeta as any)?.elementBuffer || null;
    } else {
      buffer = gl.getParameter(
        target === BUFFER_TARGETS.ELEMENT_ARRAY_BUFFER
          ? BUFFER_TARGETS.ELEMENT_ARRAY_BUFFER_BINDING
          : BUFFER_TARGETS.ARRAY_BUFFER_BINDING
      );
    }

    if (!buffer) {return;}

    let size = 0;

    if (isNumeric(data)) {
      size = data;
    } else if (isBufferLike(data)) {
      size = data.byteLength;
    }

    const meta = objectRegistry.get(buffer);

    if (meta) {
      memoryUsage.buffers = Math.max(0, (memoryUsage.buffers || 0) - (meta.memorySize || 0));
      meta.memorySize = size;
      meta.updatedAt = captureStack();
      memoryUsage.buffers = (memoryUsage.buffers || 0) + size;
    }
  };

  if (original.bindVertexArray) {
    (gl as WebGL2RenderingContext).bindVertexArray = (vao: WebGLVertexArrayObject | null): void => {
      if (!state.contextLost) {
        state.activeVAO = vao || state.defaultVAO;
      }
      original.bindVertexArray.call(gl, vao);
    };
  }

  // Renderbuffer 方法拦截
  const updateRenderbufferSize = (
    target: number,
    samples: number,
    format: number,
    width: number,
    height: number
  ): void => {
    if (state.contextLost) {return;}

    const obj = bindingMap.get(target);

    if (!obj) {return;}

    const meta = objectRegistry.get(obj);

    if (!meta) {return;}

    const newSize = calculateRenderbufferSize(format, width, height, samples);

    memoryUsage.renderbuffers = (memoryUsage.renderbuffers || 0) - (meta.memorySize || 0);
    meta.memorySize = newSize;
    meta.updatedAt = captureStack();
    memoryUsage.renderbuffers = (memoryUsage.renderbuffers || 0) + newSize;
  };

  gl.createRenderbuffer = function (this: WebGLRenderingContext | WebGL2RenderingContext): WebGLRenderbuffer | null {
    const renderbuffer = original.createRenderbuffer.call(gl);

    if (renderbuffer && !state.contextLost) {
      resourceCount.renderbuffers++;
      objectRegistry.set(renderbuffer, {
        memorySize: 0,
        createdAt: captureStack(),
      });
    }

    return renderbuffer;
  } as any;

  gl.deleteRenderbuffer = (renderbuffer: WebGLRenderbuffer | null): void => {
    if (renderbuffer && !state.contextLost) {
      const meta = objectRegistry.get(renderbuffer);

      if (meta) {
        resourceCount.renderbuffers = Math.max(0, resourceCount.renderbuffers - 1);
        const oldMemory = memoryUsage.renderbuffers || 0;
        const newMemory = Math.max(0, oldMemory - (meta.memorySize || 0));

        // 检测内存计算异常
        if (newMemory < 0 || oldMemory - (meta.memorySize || 0) < 0) {
          console.warn(
            '[Memory Monitor] Renderbuffer memory calculation anomaly detected: ' +
            `old=${oldMemory}, delete=${meta.memorySize}, new=${newMemory}`
          );
        }

        memoryUsage.renderbuffers = newMemory;
        objectRegistry.delete(renderbuffer);
      }
    }
    original.deleteRenderbuffer.call(gl, renderbuffer);
  };

  gl.bindRenderbuffer = (target: number, renderbuffer: WebGLRenderbuffer | null): void => {
    if (!state.contextLost) {
      bindingMap.set(target, renderbuffer);
    }
    original.bindRenderbuffer.call(gl, target, renderbuffer);
  };

  gl.renderbufferStorage = (
    target: number,
    format: number,
    width: number,
    height: number
  ): void => {
    original.renderbufferStorage.call(gl, target, format, width, height);
    updateRenderbufferSize(target, 1, format, width, height);
  };

  // Shader & Program 方法拦截
  gl.createShader = (type: number): WebGLShader | null => {
    const shader = original.createShader.call(gl, type);

    if (shader && !state.contextLost) {
      resourceCount.shaders = (resourceCount.shaders || 0) + 1;
      objectRegistry.set(shader, {
        memorySize: 0,
        createdAt: captureStack(),
      });
    }

    return shader;
  };

  gl.deleteShader = (shader: WebGLShader | null): void => {
    if (shader && !state.contextLost) {
      const meta = objectRegistry.get(shader);

      if (meta) {
        resourceCount.shaders = Math.max(0, (resourceCount.shaders || 0) - 1);
        objectRegistry.delete(shader);
      }
    }
    original.deleteShader.call(gl, shader);
  };

  gl.createProgram = function (this: WebGLRenderingContext | WebGL2RenderingContext): WebGLProgram | null {
    const program = original.createProgram.call(gl);

    if (program && !state.contextLost) {
      resourceCount.programs = (resourceCount.programs || 0) + 1;
      objectRegistry.set(program, {
        memorySize: 0,
        createdAt: captureStack(),
      });
    }

    return program;
  } as any;

  gl.deleteProgram = (program: WebGLProgram | null): void => {
    if (program && !state.contextLost) {
      const meta = objectRegistry.get(program);

      if (meta) {
        resourceCount.programs = Math.max(0, (resourceCount.programs || 0) - 1);
        objectRegistry.delete(program);
      }
    }
    original.deleteProgram.call(gl, program);
  };

  if (original.createVertexArray) {
    (gl as WebGL2RenderingContext).createVertexArray = function (this: WebGL2RenderingContext): WebGLVertexArrayObject | null {
      const vao = original.createVertexArray.call(gl);

      if (vao && !state.contextLost) {
        resourceCount.vertexArrays = (resourceCount.vertexArrays || 0) + 1;
        objectRegistry.set(vao, {
          memorySize: 0,
          createdAt: captureStack(),
        });
      }

      return vao;
    } as any;
  }

  if (original.deleteVertexArray) {
    (gl as WebGL2RenderingContext).deleteVertexArray = (vao: WebGLVertexArrayObject | null): void => {
      if (vao && !state.contextLost) {
        const meta = objectRegistry.get(vao);

        if (meta) {
          resourceCount.vertexArrays = Math.max(0, (resourceCount.vertexArrays || 0) - 1);
          objectRegistry.delete(vao);
        }
      }
      original.deleteVertexArray.call(gl, vao);
    };
  }

  // 扩展方法拦截
  gl.getExtension = (name: string): any => {
    // 遵循 WebGL 规范：扩展名不区分大小写，但保留原始字符串进行匹配
    if (name === 'galacean_memory_monitor' || name === 'GALACEAN_memory_monitor') {
      return extension;
    }

    return original.getExtension.call(gl, name as any);
  };

  // 上下文事件监听
  if (gl.canvas) {
    gl.canvas.addEventListener('webglcontextlost', () => {
      resetState(state);
      state.contextLost = true;
    });

    gl.canvas.addEventListener('webglcontextrestored', () => {
      state.contextLost = false;
    });
  }
};

// 自动包装 Canvas.getContext
const wrapCanvasContext = (Constructor: any): void => {
  if (!Constructor?.prototype?.getContext) {return;}

  const originalGetContext = Constructor.prototype.getContext;
  let wrapCounter = 0;

  Constructor.prototype.getContext = function (
    type: string,
    ...args: any[]
  ): RenderingContext | null {
    const gl = originalGetContext.call(this, type, ...args);

    if (gl && (type === 'webgl' || type === 'webgl2')) {
      wrapCounter++;
      try {
        injectMonitor(gl as WebGLRenderingContext | WebGL2RenderingContext);
      } catch (error) {
        console.error(`[Galacean Memory Monitor] Failed to inject context #${wrapCounter}:`, error);
      }
    }

    return gl;
  };
};