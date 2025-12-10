/* eslint-disable no-console */
import { MonitorPanel, type PanelConfig } from './panel';
import type { MemorySnapshot, MonitorConfig, MonitorEventData, ContextEventData } from './types';
import { formatBytes } from './format-utils';

/**
 * 事件总线类 - 统一的事件管理系统
 */
class EventBus {
  private handlers = new Map<string, Set<Function>>();

  on (event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off (event: string, handler: Function): void {
    this.handlers.get(event)?.delete(handler);
  }

  trigger (event: string, data: any): void {
    const eventHandlers = this.handlers.get(event);

    if (!eventHandlers) {return;}

    eventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('[Event Bus] Handler error:', error);
      }
    });
  }

  clear (): void {
    this.handlers.clear();
  }
}

export interface TrackerConfig extends MonitorConfig {
  showPanel?: boolean,
  panelConfig?: PanelConfig,
}

/**
 * 内存追踪器 - 组合使用 EventBus
 */
export class MemoryTracker {
  private context: WebGLRenderingContext | WebGL2RenderingContext;
  private extension: any;
  private config: Required<MonitorConfig>;
  private logTimerId: number | null = null;
  private eventBus = new EventBus();
  private uiPanel: MonitorPanel | null = null;

  constructor (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    options: TrackerConfig = {}
  ) {
    this.context = gl;
    this.config = {
      logInterval: options.logInterval ?? 0,
      enableConsole: options.enableConsole ?? false,
    };

    this.extension = gl.getExtension('GALACEAN_memory_monitor' as any);

    if (!this.extension) {
      console.warn(
        '[Galacean Memory Monitor] Extension not available. Ensure monitor-core.ts is imported first.'
      );

      return;
    }

    if (this.config.logInterval > 0 && this.config.enableConsole) {
      this.enableAutoLog();
    }

    if (options.showPanel) {
      this.createUI(options.panelConfig);
    }

    this.attachContextListeners();
  }

  getSnapshot (): MemorySnapshot | null {
    return this.extension?.getSnapshot() || null;
  }

  getObjectDetails (type: any): any[] | null {
    return this.extension?.getObjectDetails(type) || null;
  }

  logToConsole (): void {
    const snapshot = this.getSnapshot();

    if (!snapshot) {
      console.warn('[Memory Tracker] Unable to retrieve snapshot');

      return;
    }

    const { memory, resources } = snapshot;

    console.group(`WebGL Memory - ${new Date().toLocaleTimeString()}`);

    console.table({
      'Texture Memory': `${formatBytes(memory.textureMemory)} MB`,
      'Buffer Memory': `${formatBytes(memory.bufferMemory)} MB`,
      'Renderbuffer Memory': `${formatBytes(memory.renderbufferMemory)} MB`,
      'Framebuffer Memory': `${formatBytes(memory.framebufferMemory)} MB`,
      'Total Memory': `${formatBytes(memory.totalMemory)} MB`,
    });

    console.table({
      'Textures': resources.textureCount,
      'Buffers': resources.bufferCount,
      'Renderbuffers': resources.renderbufferCount,
      'Shaders': resources.shaderCount,
      'Programs': resources.programCount,
      'Vertex Arrays': resources.vertexArrayCount,
    });

    console.groupEnd();

    this.trigger('memory-update', {
      memory: memory,
      resources: resources,
      timestamp: snapshot.timestamp,
    });
  }

  enableAutoLog (): void {
    if (this.logTimerId !== null) {return;}

    if (this.config.logInterval > 0) {
      this.logTimerId = window.setInterval(() => {
        this.logToConsole();
      }, this.config.logInterval);
    }
  }

  disableAutoLog (): void {
    if (this.logTimerId !== null) {
      clearInterval(this.logTimerId);
      this.logTimerId = null;
    }
  }

  createUI (config?: PanelConfig): MonitorPanel {
    if (this.uiPanel) {
      this.uiPanel.show();

      return this.uiPanel;
    }

    this.uiPanel = new MonitorPanel(() => this.getSnapshot(), config);

    return this.uiPanel;
  }

  hideUI (): void {
    this.uiPanel?.hide();
  }

  showUI (): void {
    this.uiPanel?.show();
  }

  toggleUI (): void {
    this.uiPanel?.toggle();
  }

  destroyUI (): void {
    if (this.uiPanel) {
      this.uiPanel.destroy();
      this.uiPanel = null;
    }
  }

  getUI (): MonitorPanel | null {
    return this.uiPanel;
  }

  updateConfig (newConfig: Partial<MonitorConfig>): void {
    const oldInterval = this.config.logInterval;
    const oldConsole = this.config.enableConsole;

    Object.assign(this.config, newConfig);

    if (oldInterval !== this.config.logInterval || oldConsole !== this.config.enableConsole) {
      this.disableAutoLog();
      if (this.config.logInterval > 0 && this.config.enableConsole) {
        this.enableAutoLog();
      }
    }
  }

  on (event: string, handler: Function): void {
    this.eventBus.on(event, handler);
  }

  off (event: string, handler: Function): void {
    this.eventBus.off(event, handler);
  }

  private trigger (event: string, data: any): void {
    this.eventBus.trigger(event, data);
  }

  private attachContextListeners (): void {
    if (!this.context.canvas) {return;}

    this.context.canvas.addEventListener('webglcontextlost', () => {
      this.trigger('context-lost', { timestamp: Date.now() });
    });

    this.context.canvas.addEventListener('webglcontextrestored', () => {
      this.trigger('context-restored', { timestamp: Date.now() });
    });
  }

  dispose (): void {
    this.disableAutoLog();
    this.destroyUI();
    this.eventBus.clear();
  }
}

const activeTrackers = new WeakMap<WebGLRenderingContext | WebGL2RenderingContext, MemoryTracker>();

// 全局事件总线
const globalEventBus = new EventBus();

/**
 * 启动内存监控
 */
export const startMonitoring = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  config?: TrackerConfig
): MemoryTracker => {
  let tracker = activeTrackers.get(gl);

  if (tracker) {
    return tracker;
  }

  tracker = new MemoryTracker(gl, config);
  activeTrackers.set(gl, tracker);

  tracker.on('memory-update', (data: MonitorEventData) => {
    globalEventBus.trigger('memory-update', { ...data, context: gl });
  });

  tracker.on('context-lost', (data: ContextEventData) => {
    globalEventBus.trigger('context-lost', { ...data, context: gl });
  });

  tracker.on('context-restored', (data: ContextEventData) => {
    globalEventBus.trigger('context-restored', { ...data, context: gl });
  });

  return tracker;
};

/**
 * 启动带 UI 的内存监控
 */
export const startMonitoringWithUI = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  config?: TrackerConfig & { panelConfig?: PanelConfig }
): MemoryTracker => {
  return startMonitoring(gl, {
    ...config,
    showPanel: true,
    panelConfig: config?.panelConfig,
  });
};

/**
 * 停止内存监控
 */
export const stopMonitoring = (gl: WebGLRenderingContext | WebGL2RenderingContext): void => {
  const tracker = activeTrackers.get(gl);

  if (tracker) {
    tracker.dispose();
    activeTrackers.delete(gl);
  }
};

/**
 * 获取活跃的追踪器
 */
export const getActiveTracker = (
  gl: WebGLRenderingContext | WebGL2RenderingContext
): MemoryTracker | undefined => {
  return activeTrackers.get(gl);
};

export const onMemoryEvent = (event: string, handler: Function): void => {
  globalEventBus.on(event, handler);
};

export const offMemoryEvent = (event: string, handler: Function): void => {
  globalEventBus.off(event, handler);
};

export const createTracker = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  config?: TrackerConfig
): MemoryTracker => {
  return new MemoryTracker(gl, config);
};
