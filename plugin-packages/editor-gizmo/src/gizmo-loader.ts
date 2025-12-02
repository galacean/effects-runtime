import type { Composition, Scene, Texture, VFXItem } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';
import { axisIconMap } from './constants';
import { createImage, createTexture } from './util';
import { GizmoComponent } from './gizmo-component';

const iconImages: Map<string, HTMLImageElement> = new Map();

export const iconTextures: Map<string, Texture> = new Map();

export class EditorGizmoPlugin extends AbstractPlugin {
  override order = 1001;

  override async onCompositionConstructed (composition: Composition, scene: Scene) {
    const engine = composition.renderer.engine;

    iconTextures.clear();

    if (iconImages.size !== axisIconMap.size) {
      for (const [name, data] of axisIconMap) {
        iconImages.set(name, await createImage(data));
      }
    }

    iconImages.forEach((image, name) => {
      iconTextures.set(name, createTexture(engine, image));
    });
    iconImages.clear();

    const items = composition.items;
    const targetMap: { [key: string]: VFXItem[] } = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const gizmoComponent = item.getComponent(GizmoComponent);

      if (gizmoComponent) {
        if (!targetMap[gizmoComponent.target]) {
          targetMap[gizmoComponent.target] = [];
        }
        targetMap[gizmoComponent.target].push(item);
      }
    }
    composition.loaderData.gizmoTarget = targetMap;
    composition.loaderData.gizmoItems = [];
  }
}
