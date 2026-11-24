import { CompositionComponent, type spec, type Composition, type VFXItem } from '@galacean/effects';
import '@galacean/effects-plugin-ffd';
import { DefaultVFXItems, cloneConfigValue } from '@galacean/effects-plugin-editor-gizmo';
import ffd from './fixtures/ffd.json';
import path from './fixtures/path.json';
import gradient from './fixtures/gradient.json';

export type GizmoExampleKind = 'ffd' | 'path' | 'gradient';

export const gizmoExampleNames: Record<GizmoExampleKind, string> = {
  ffd: 'FFD 与晶格 · 5 × 5',
  path: '运动路径 · Bezier',
  gradient: '渐变色 · 四种颜色模式',
};

/** 使用原始场景、轨道绑定和几何数据；每次实例化独立副本。 */
export async function createGizmoReference (composition: Composition, kind: GizmoExampleKind): Promise<{
  root: VFXItem,
  item: VFXItem,
}> {
  const json = cloneConfigValue({ ffd, path, gradient }[kind]) as unknown as spec.JSONScene;

  if (kind === 'ffd') {
    json.bins![0].url = new URL('./fixtures/ffd.bin', import.meta.url).href;
  }
  const root = await DefaultVFXItems.createEffects(composition, json, null, gizmoExampleNames[kind]);
  const timeline = root.getComponent(CompositionComponent);

  timeline.pause();
  timeline.setTime(0);

  return { root, item: root.children[0] };
}
