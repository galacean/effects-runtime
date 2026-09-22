import type { RendererComponent } from '../components/renderer-component';
import type { RenderingData } from './rendering-data';
import { addItem, removeItem } from '../utils';

/** Lists collected for one render. Group names identify extension pass inputs. */
export class RenderList {
  readonly objects: RendererComponent[] = [];
  readonly groups = new Map<string, RendererComponent[]>();
}

/** Scene-owned registrations. Clearing registrations never disposes components. */
export class SceneRendering {
  private readonly renderers: RendererComponent[] = [];
  private readonly groups = new Map<string, RendererComponent[]>();

  addRenderer (renderer: RendererComponent, group?: string): void {
    if (group === undefined) {
      addItem(this.renderers, renderer);
    } else {
      let renderers = this.groups.get(group);

      if (!renderers) {
        renderers = [];
        this.groups.set(group, renderers);
      }
      addItem(renderers, renderer);
    }
  }

  removeRenderer (renderer: RendererComponent, group?: string): void {
    const renderers = group === undefined ? this.renderers : this.groups.get(group);

    if (renderers) {
      removeItem(renderers, renderer);
      if (group !== undefined && renderers.length === 0) {
        this.groups.delete(group);
      }
    }
  }

  collect (data: RenderingData): void {
    data.renderList.objects.push(...this.renderers);
    data.renderList.objects.sort((a, b) => a.priority - b.priority);
    for (const [name, renderers] of this.groups) {
      data.renderList.groups.set(name, renderers.slice().sort((a, b) => a.priority - b.priority));
    }
  }

  clear (): void {
    this.renderers.length = 0;
    this.groups.clear();
  }
}
