import type { vec3 } from '@galacean/effects-specification';
import type { TouchEventType } from './event-system';

export interface DragEventType extends TouchEventType {
  cameraParam?: {
    position: vec3,
    fov: number,
  },
}

