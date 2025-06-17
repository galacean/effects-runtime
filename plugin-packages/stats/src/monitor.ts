import type { Disposable } from '@galacean/effects';
import type { PerformanceData } from './core';
import { Core } from './core';
import type { StatsOptions } from './stats';

const tpl = `
  <dl>
    <dt>FPS</dt>
    <dd>0</dd>
    <dt>Memory <span class="unit">(MB)</span></dt>
    <dd>0</dd>
    <dt>DrawCall</dt>
    <dd>0</dd>
    <dt>Triangles</dt>
    <dd>0</dd>
    <dt>Textures</dt>
    <dd>0</dd>
    <dt>Shaders</dt>
    <dd>0</dd>
    <dt>Program</dt>
    <dd>0</dd>
    <dt>WebGL</dt>
    <dd></dd>
  </dl>
`;
const css = `
  .gl-perf {
    pointer-events: none;
    user-select: none;
    position: absolute;
    top: 0;
    left: 0;
    padding: ${10 / 7.5}vh ${10 / 7.5}vh 0 ${10 / 7.5}vh;
    background: rgba(0, 0, 0, 0.3);
    color: #fff;
    font: ${10 / 7.5}vh arial;
  }

  .gl-perf dl,
  .gl-perf dt,
  .gl-perf dd {
    padding: 0;
    margin: 0;
  }

  .gl-perf dt {
    color: #fff;
    text-shadow: #000 0 0 1px;
  }

  .gl-perf dt .unit{
    font-size: ${10 / 7.5}vh;
  }

  .gl-perf dd {
    font-size: ${20 / 7.5}vh;
    padding: ${10 / 7.5}vh 0 ${10 / 7.5}vh;
  }
`;

/**
 * Performance monitor.
 */
export class Monitor implements Disposable {
  /**
   * The core of the monitor, which handles the performance data collection.
   */
  core: Core;

  private doms: HTMLElement[];
  private container: HTMLElement;
  private readonly items = ['fps', 'memory', 'drawCall', 'triangles', 'textures', 'shaders', 'programs', 'webglContext'];

  private data: PerformanceData = {
    fps: 60,
    memory: 0,
    drawCall: 0,
    triangles: 0,
    lines: 0,
    points: 0,
    textures: 0,
    shaders: 0,
    programs: 0,
    webglContext: '2.0',
  };

  /**
   * Create a new Monitor instance.
   * @param gl
   * @param options
   */
  constructor (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    private readonly options: Required<StatsOptions>,
  ) {
    this.core = new Core(gl, options.debug);

    this.createContainer();
    this.update = this.update.bind(this);
  }

  private createContainer (): void {
    const container = document.createElement('div');

    this.container = container;
    if (!this.options.visible) {
      this.hide();
    }
    container.classList.add('gl-perf');
    container.innerHTML = tpl;
    container.appendChild(this.createStyle());
    this.options.container.appendChild(container);

    this.doms = Array.prototype.slice.apply(container.querySelectorAll('dd'));
  }

  private createStyle (): HTMLStyleElement {
    const style: HTMLStyleElement = document.createElement('style');

    style.appendChild(document.createTextNode(css));

    return style;
  }

  /**
   * Update per frame
   */
  update (dt: number): void {
    const data = this.core.update(dt);

    if (!data || data.triangles === 0) {
      return;
    }

    for (let i = 0, l = this.items.length; i < l; i++) {
      const dom = this.doms[i];
      const item = this.items[i];
      const value = data[item as keyof PerformanceData] || 0;

      // see: http://wilsonpage.co.uk/preventing-layout-thrashing/
      requestAnimationFrame(() => {
        dom.innerText = String(value);
      });
    }
  }

  /**
   * Hide the monitor
   */
  hide (): void {
    this.container.style.display = 'none';
  }

  /**
   * Show the monitor
   */
  show (): void {
    this.container.style.display = 'block';
  }

  /**
   * reset all hooks
   */
  reset (): void {
    this.core.reset();

    for (let i = 0, l = this.items.length; i < l; i++) {
      const dom = this.doms[i];
      const item = this.items[i];
      const value = this.data[item as keyof PerformanceData] || 0;

      // see: http://wilsonpage.co.uk/preventing-layout-thrashing/
      requestAnimationFrame(() => {
        dom.innerText = String(value);
      });
    }
  }

  /**
   * release all hooks
   */
  release (): void {
    this.core.release();
  }

  /**
   * dispose the instance
   */
  dispose (): void {
    this.release();
    this.container.remove();
  }
}
