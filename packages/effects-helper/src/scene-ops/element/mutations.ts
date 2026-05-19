import type { spec } from '@galacean/effects';
import {
  normalizeScene,
  type SceneMutationFailure,
  type SceneMutationSuccess,
} from '../utils';
import {
  type ElementMatch,
  type ElementMutationFailureCode,
  type PatchTransformInput,
  type PatchTransformResult,
  type ReorderElementInput,
  type ReorderElementResult,
  type Vec2Like,
  type Vec3Like,
} from './types';
import {
  findElement,
} from './query';

/**
 * 在同容器内调整元素顺序，支持前后移动与相对目标插入。
 * 失败码: SCENE_PARSE_FAILED | ELEMENT_NOT_FOUND | INVALID_INPUT
 */
export function reorderElement (input: ReorderElementInput): ReorderElementResult {
  try {
    const scene = normalizeScene(input.scene);
    const match = findElement(scene, input.elementId);

    if (!match) {
      return failure('ELEMENT_NOT_FOUND', `element '${input.elementId}' 不存在`);
    }

    const fromIndex = match.index;
    const toIndex = resolveTargetIndex(scene, match, input);

    if (toIndex < 0) {
      return failure('INVALID_INPUT', '目标层级位置无效');
    }

    if (toIndex === fromIndex) {
      return success(scene, {
        elementId: match.element.id,
        fromIndex,
        toIndex,
        changed: false,
        containerType: match.containerType,
      });
    }

    const container = match.container;
    const entry = container[fromIndex];

    container.splice(fromIndex, 1);

    const finalIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;

    container.splice(finalIndex, 0, entry);

    return success(scene, {
      elementId: match.element.id,
      fromIndex,
      toIndex: finalIndex,
      changed: true,
      containerType: match.containerType,
    });
  } catch {
    return failure('SCENE_PARSE_FAILED', 'scene 不是合法的 JSONScene 对象或序列化字符串');
  }
}

/**
 * 对元素 transform 做部分字段补丁更新。
 * 失败码: SCENE_PARSE_FAILED | ELEMENT_NOT_FOUND
 */
export function patchElementTransform (input: PatchTransformInput): PatchTransformResult {
  try {
    const scene = normalizeScene(input.scene);
    const match = findElement(scene, input.elementId);

    if (!match) {
      return failure('ELEMENT_NOT_FOUND', `element '${input.elementId}' 不存在`);
    }

    const { position, rotation, scale, size, anchor } = input.transform;
    const transform = match.element.transform ?? {
      position: { x: 0, y: 0, z: 0 },
      eulerHint: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      size: { x: 1, y: 1 },
      anchor: { x: 0, y: 0 },
    };

    if (position) {
      transform.position = cloneVec3(position);
    }
    if (rotation) {
      transform.eulerHint = cloneVec3(rotation);
    }
    if (scale) {
      transform.scale = cloneVec3(scale);
    }
    if (size) {
      transform.size = cloneVec2(size);
    }
    if (anchor) {
      transform.anchor = cloneVec2(anchor);
    }

    match.element.transform = transform;

    return success(scene, {
      elementId: match.element.id,
    });
  } catch {
    return failure('SCENE_PARSE_FAILED', 'scene 不是合法的 JSONScene 对象或序列化字符串');
  }
}

function resolveTargetIndex (
  scene: spec.JSONScene,
  match: ElementMatch,
  input: ReorderElementInput,
): number {
  const maxIndex = match.container.length - 1;

  if (input.action === 'to_front') {
    return maxIndex;
  }
  if (input.action === 'to_back') {
    return 0;
  }
  if (input.action === 'forward') {
    return Math.min(maxIndex, match.index + 1);
  }
  if (input.action === 'backward') {
    return Math.max(0, match.index - 1);
  }

  if (!input.targetElementId) {
    return -1;
  }

  const target = findElement(scene, input.targetElementId);

  if (!target || !isSameContainer(match, target)) {
    return -1;
  }

  return input.action === 'before' ? target.index : target.index + 1;
}

function isSameContainer (left: ElementMatch, right: ElementMatch): boolean {
  if (left.containerType !== right.containerType) {
    return false;
  }

  if (left.containerType === 'root') {
    return true;
  }

  return left.component?.id === right.component?.id;
}

function cloneVec2 (value: Vec2Like): { x: number, y: number } {
  return { x: value.x, y: value.y };
}

function cloneVec3 (value: Vec3Like): { x: number, y: number, z: number } {
  return { x: value.x, y: value.y, z: value.z };
}

function success<T> (scene: spec.JSONScene, data: T): SceneMutationSuccess<T> {
  return {
    ok: true,
    scene,
    data,
  };
}

function failure (code: ElementMutationFailureCode, message: string): SceneMutationFailure {
  return {
    ok: false,
    code,
    message,
  };
}
