import {
  CompositionComponent,
  TransformPlayableAsset,
  TransformTrack,
  spec,
  type TrackAsset,
  type VFXItem,
} from '@galacean/effects';
import { Matrix4, Vector3 } from '../math';
import { cloneConfigValue } from '../configs/config-definition';

export type MotionPathTarget = {
  item: VFXItem,
  composition: CompositionComponent,
  clip: TransformPlayableAsset,
  path: spec.BezierCurvePathValue,
};

/** 按现有轨道绑定查找路径，不使用当前播放姿态推算动画基准。 */
export function findMotionPaths (item: VFXItem): MotionPathTarget[] {
  const results: MotionPathTarget[] = [];

  for (let ancestor: VFXItem | undefined = item; ancestor; ancestor = ancestor.parent) {
    const composition = ancestor.getComponent(CompositionComponent);

    if (!composition?.timelineAsset) {
      continue;
    }
    for (const track of composition.timelineAsset.flattenedTracks) {
      if (!(track instanceof TransformTrack)) {
        continue;
      }
      let target: object | undefined;

      for (let cursor: TrackAsset | undefined = track; cursor && !target; cursor = cursor.parent) {
        target = composition.getBinding(cursor);
      }
      if (target !== item) {
        continue;
      }
      for (const clip of track.getClips()) {
        if (!(clip instanceof TransformPlayableAsset)) {
          continue;
        }
        const path = clip.transformAnimationData.positionOverLifetime?.path;

        if (path?.[0] !== spec.ValueType.BEZIER_CURVE_PATH) {
          continue;
        }
        const data = path[1];

        if (data[1].length > 1 && data[2].length === (data[1].length - 1) * 2 && data[0].length === data[1].length) {
          results.push({ item, composition, clip, path: data });
        }
      }
    }
  }

  return results;
}

export type MotionPathSnapshot = {
  item: VFXItem,
  parentMatrix: Matrix4,
  position: Vector3,
  paths: { clip: TransformPlayableAsset, path: spec.BezierCurvePathValue }[],
};

/** 平移会话保存路径及其父坐标系；动画自身播放不触发路径改写。 */
export function captureMotionPaths (item: VFXItem): MotionPathSnapshot {
  return {
    item,
    parentMatrix: item.transform.getParentMatrix()?.clone() ?? new Matrix4(),
    position: item.transform.position.clone(),
    paths: findMotionPaths(item).map(({ clip, path }) => ({ clip, path: cloneConfigValue(path) })),
  };
}

/** 将元素的整体位移同步到全部路径和控制柄，兼容移动中的父级切换。 */
export function updateMotionPathTranslation (snapshot: MotionPathSnapshot): void {
  if (!snapshot.paths.length) {
    return;
  }
  const { item, parentMatrix, position } = snapshot;
  const parent = item.transform.getParentMatrix() ?? new Matrix4();

  if (Math.abs(parent.determinant()) < 1e-10) {
    return;
  }
  const translation = item.transform.position.clone().applyMatrix(parent)
    .subtract(position.clone().applyMatrix(parentMatrix));
  const matrix = parent.clone().invert().multiply(new Matrix4().setPosition(translation)).multiply(parentMatrix);
  const point = new Vector3();

  for (const { clip, path: original } of snapshot.paths) {
    // 时间关键帧保留独立副本；坐标直接生成，避免先深拷贝再逐点替换。
    const path: spec.BezierCurvePathValue = [cloneConfigValue(original[0]), [], []];

    for (const channel of [1, 2] as const) {
      for (const value of original[channel]) {
        point.set(value[0], value[1], value[2]).applyMatrix(matrix);
        path[channel].push([point.x, point.y, point.z]);
      }
    }
    clip.setPositionPath([spec.ValueType.BEZIER_CURVE_PATH, path]);
  }
}

/** 和元素变换一起回滚，下一次时间线采样也读取原始路径。 */
export function restoreMotionPaths (snapshot: MotionPathSnapshot): void {
  for (const { clip, path } of snapshot.paths) {
    clip.setPositionPath([spec.ValueType.BEZIER_CURVE_PATH, cloneConfigValue(path)]);
  }
}
