// 内存指标
export interface MemoryMetrics {
  textureMemory: number,
  bufferMemory: number,
  renderbufferMemory: number,
  framebufferMemory: number,
  totalMemory: number,
}

// 资源指标
export interface ResourceMetrics {
  textureCount: number,
  bufferCount: number,
  renderbufferCount: number,
  shaderCount: number,
  programCount: number,
  vertexArrayCount: number,
}

// 内存快照
export interface MemorySnapshot {
  memory: MemoryMetrics,
  resources: ResourceMetrics,
  timestamp: number,
}

// 监控配置
export interface MonitorConfig {
  logInterval?: number,
  enableConsole?: boolean,
}

// 面板配置
export interface PanelConfig {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  theme?: 'dark' | 'light' | 'neon',
  updateRate?: number,
  minimized?: boolean,
  showChart?: boolean,
}

// 事件数据
export interface MonitorEventData {
  memory: MemoryMetrics,
  resources: ResourceMetrics,
  timestamp: number,
}

export interface ContextEventData {
  timestamp: number,
}

// 内部类型
export interface InternalState {
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  memoryUsage: {
    textures: number,
    buffers: number,
    renderbuffers: number,
  },
  resourceCount: {
    textures: number,
    buffers: number,
    renderbuffers: number,
    shaders: number,
    programs: number,
    vertexArrays: number,
  },
  bindingMap: Map<number, any>,
  activeVAO: any,
  defaultVAO: any,
  objectRegistry: Map<any, ObjectMetadata>,
  contextLost: boolean,
  framebufferInfo: FramebufferInfo,
}

export interface ObjectMetadata {
  memorySize: number,
  createdAt?: string,
  updatedAt?: string,
  mipLevels?: MipLevelInfo[][],
}

export interface MipLevelInfo {
  memorySize: number,
  format: number,
  dataType: number,
  width: number,
  height: number,
  depth: number,
}

export interface FramebufferInfo {
  sampleCount: number,
  depthBits: number,
  stencilBits: number,
  attributes: WebGLContextAttributes | null,
}

// 扩展接口
export interface MemoryMonitorExtension {
  getSnapshot(): MemorySnapshot,
  getObjectDetails(type: any): ObjectMetadata[],
}

// 全局声明 - 扩展 getExtension 方法，允许查询监控扩展
declare global {
  interface WebGLRenderingContext {
    getExtension(extensionName: 'GALACEAN_memory_monitor'): MemoryMonitorExtension | null,
    getExtension(extensionName: string): any,
  }

  interface WebGL2RenderingContext {
    getExtension(extensionName: 'GALACEAN_memory_monitor'): MemoryMonitorExtension | null,
    getExtension(extensionName: string): any,
  }
}
