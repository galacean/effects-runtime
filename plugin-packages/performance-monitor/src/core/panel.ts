import type { MemorySnapshot } from './types';
import { formatBytes } from './format-utils';

export interface PanelConfig {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  updateRate?: number,
  theme?: 'dark' | 'light',
  minimized?: boolean,
}

interface HistoryPoint {
  timestamp: number,
  memory: MemorySnapshot['memory'],
}

/**
 * 面板样式配置
 */
const PANEL_STYLES = {
  positions: {
    'top-left': 'top: 10px; left: 10px;',
    'top-right': 'top: 10px; right: 10px;',
    'bottom-left': 'bottom: 10px; left: 10px;',
    'bottom-right': 'bottom: 10px; right: 10px;',
  },
  themes: {
    light: {
      primary: '#28a745',
      secondary: '#007bff',
      warning: '#ffc107',
      danger: '#dc3545',
      text: '#333333',
      containerGradient: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.95))',
      containerBorder: '1px solid #dddddd',
      buttonBackground: 'rgba(0, 0, 0, 0.1)',
      buttonBorder: '1px solid #ccc',
      buttonColor: '#333',
    },
    dark: {
      primary: '#00ffff',
      secondary: '#ff00ff',
      warning: '#ffff00',
      danger: '#ff0000',
      text: '#00ffff',
      containerGradient: 'linear-gradient(135deg, rgba(15, 0, 30, 0.95), rgba(30, 0, 60, 0.95))',
      containerBorder: '2px solid #00ffff',
      buttonBackground: 'rgba(0, 255, 255, 0.2)',
      buttonBorder: '1px solid #00ffff',
      buttonColor: '#00ffff',
      containerBoxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
    },
  } as const,
} as const;

export class MonitorPanel {
  private container: HTMLElement;
  private config: Required<PanelConfig>;
  private updateTimerId: number | null = null;
  private history: HistoryPoint[] = [];
  private maxHistorySize = 60;
  private isMinimized = false;
  private dataProvider: () => MemorySnapshot | null;

  constructor (
    dataProvider: () => MemorySnapshot | null,
    config: PanelConfig = {}
  ) {
    this.dataProvider = dataProvider;
    this.config = {
      position: config.position ?? 'top-right',
      updateRate: config.updateRate ?? 1000,
      theme: config.theme ?? 'dark',
      minimized: config.minimized ?? false,
    };

    this.isMinimized = this.config.minimized;
    this.container = this.createContainer();
    this.startUpdates();
  }

  // 容器创建
  private createContainer (): HTMLElement {
    const el = document.createElement('div');

    el.id = 'galacean-memory-panel';
    el.style.cssText = this.getContainerStyles();
    document.body.appendChild(el);
    this.enableDragging(el);

    return el;
  }

  private getContainerStyles (): string {
    const position = PANEL_STYLES.positions[this.config.position];
    const theme = PANEL_STYLES.themes[this.config.theme];

    const baseStyles = `
      position: fixed;
      ${position}
      padding: 15px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      border-radius: 8px;
      min-width: 230px;
      max-width: 330px;
      z-index: 999999;
      user-select: none;
      cursor: move;
      transition: all 0.3s ease;
      background: ${theme.containerGradient};
      color: ${theme.text};
      border: ${theme.containerBorder};
    `;

    // 深色主题有阴影效果
    if (this.config.theme === 'dark') {
      const darkTheme = theme as typeof PANEL_STYLES.themes.dark;

      return baseStyles + `box-shadow: ${darkTheme.containerBoxShadow};`;
    }

    return baseStyles;
  }

  // 拖拽功能
  private enableDragging (element: HTMLElement): void {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let startX = 0;
    let startY = 0;

    element.addEventListener('mousedown', e => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') {return;}

      isDragging = true;
      const rect = element.getBoundingClientRect();

      offsetX = rect.left;
      offsetY = rect.top;
      startX = e.clientX - offsetX;
      startY = e.clientY - offsetY;
      element.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) {return;}

      e.preventDefault();
      offsetX = e.clientX - startX;
      offsetY = e.clientY - startY;

      // 清除所有定位属性，重新设置 left 和 top
      element.style.left = `${offsetX}px`;
      element.style.top = `${offsetY}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
      }
    });
  }

  // 主题颜色
  private getThemeColors () {
    return PANEL_STYLES.themes[this.config.theme];
  }

  private getButtonStyles (): string {
    const theme = this.getThemeColors();

    return `
      background: ${theme.buttonBackground};
      color: ${theme.buttonColor};
      border: ${theme.buttonBorder};
      padding: 2px 8px;
      margin-left: 4px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-weight: bold;
      transition: all 0.2s;
      outline: none;
    `;
  }

  // 渲染
  private render (): void {
    const snapshot = this.dataProvider();

    if (!snapshot) {return;}

    this.history.push({
      timestamp: Date.now(),
      memory: snapshot.memory,
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const { memory, resources } = snapshot;
    const totalMB = parseFloat(formatBytes(memory.totalMemory));
    const colors = this.getThemeColors();

    if (this.isMinimized) {
      this.container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <strong style="color: ${colors.text};">WebGL Memory</strong>
          <span style="color: ${totalMB > 100 ? colors.danger : colors.primary}; font-weight: bold; margin: 0 10px;">
            ${formatBytes(memory.totalMemory)} MB
          </span>
          <button id="panel-expand-btn" style="${this.getButtonStyles()}">▼</button>
        </div>
      `;
    } else {
      this.container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <strong style="color: ${colors.text}; font-size: 14px;">WebGL Memory</strong>
          <div>
            <button id="panel-minimize-btn" style="${this.getButtonStyles()}" title="Minimize">▲</button>
            <button id="panel-close-btn" style="${this.getButtonStyles()}" title="Close">✕</button>
          </div>
        </div>
        
        <div style="color: ${colors.primary};">
          <div style="margin-bottom: 8px;">
            <strong>Memory Usage:</strong>
          </div>
          
          <div style="margin-left: 10px;">
            <div style="display: flex; justify-content: space-between; margin: 6px 0;">
              <span>Texture:</span>
              <span style="font-weight: bold;">${formatBytes(memory.textureMemory)} MB</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin: 6px 0;">
              <span>Buffer:</span>
              <span style="font-weight: bold;">${formatBytes(memory.bufferMemory)} MB</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin: 6px 0;">
              <span>Renderbuffer:</span>
              <span style="font-weight: bold;">${formatBytes(memory.renderbufferMemory)} MB</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin: 6px 0;">
              <span>Framebuffer:</span>
              <span style="font-weight: bold;">${formatBytes(memory.framebufferMemory)} MB</span>
            </div>
            
            <div style="
              display: flex;
              justify-content: space-between;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid currentColor;
            ">
              <strong>Total:</strong>
              <strong style="color: ${totalMB > 100 ? colors.danger : colors.primary};">
                ${formatBytes(memory.totalMemory)} MB
              </strong>
            </div>
          </div>
        </div>
        
        <div style="color: ${colors.secondary}; margin-top: 12px;">
          <div style="margin-bottom: 8px;">
            <strong>Resources:</strong>
          </div>
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-left: 10px;
            font-size: 11px;
          ">
            <div>Textures: <strong>${resources.textureCount}</strong></div>
            <div>Buffers: <strong>${resources.bufferCount}</strong></div>
            <div>Shaders: <strong>${resources.shaderCount}</strong></div>
            <div>Renderbuffers: <strong>${resources.renderbufferCount}</strong></div>
            <div>Programs: <strong>${resources.programCount}</strong></div>
            <div>Vertex Arrays: <strong>${resources.vertexArrayCount}</strong></div>
          </div>
        </div>
      `;
    }

    this.attachEventListeners();
  }

  // 事件绑定
  private attachEventListeners (): void {
    const minimizeBtn = document.getElementById('panel-minimize-btn');
    const expandBtn = document.getElementById('panel-expand-btn');
    const closeBtn = document.getElementById('panel-close-btn');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.minimize();
      });
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.expand();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.hide();
      });
    }
  }

  // 更新控制
  private startUpdates (): void {
    this.render();
    this.updateTimerId = window.setInterval(() => {
      this.render();
    }, this.config.updateRate);
  }

  private stopUpdates (): void {
    if (this.updateTimerId !== null) {
      clearInterval(this.updateTimerId);
      this.updateTimerId = null;
    }
  }

  minimize (): void {
    this.isMinimized = true;
    this.render();
  }

  expand (): void {
    this.isMinimized = false;
    this.render();
  }

  toggle (): void {
    this.isMinimized = !this.isMinimized;
    this.render();
  }

  show (): void {
    this.container.style.display = 'block';
  }

  hide (): void {
    this.container.style.display = 'none';
  }

  setTheme (theme: 'dark' | 'light'): void {
    this.config.theme = theme;
    this.container.style.cssText = this.getContainerStyles();
    this.render();
  }

  setPosition (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): void {
    this.config.position = position;
    this.container.style.cssText = this.getContainerStyles();
  }

  destroy (): void {
    this.stopUpdates();
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.history = [];
  }

  // 数据管理
  getHistory (): HistoryPoint[] {
    return [...this.history];
  }

  clearHistory (): void {
    this.history = [];
  }

  exportData (): string {
    const snapshot = this.dataProvider();
    const exportObj = {
      timestamp: new Date().toISOString(),
      currentSnapshot: snapshot,
      history: this.history,
      environment: {
        userAgent: navigator.userAgent,
        screenInfo: {
          width: window.screen.width,
          height: window.screen.height,
          pixelRatio: window.devicePixelRatio,
        },
      },
    };

    return JSON.stringify(exportObj, null, 2);
  }

  downloadData (filename?: string): void {
    const data = this.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename || `webgl-memory-report-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }
}

/**
 * 创建面板的便捷函数
 */
export const createPanel = (
  dataProvider: () => MemorySnapshot | null,
  config?: PanelConfig
): MonitorPanel => {
  return new MonitorPanel(dataProvider, config);
};
