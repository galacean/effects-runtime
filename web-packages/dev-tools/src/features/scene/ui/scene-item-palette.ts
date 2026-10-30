import { spec } from '@galacean/effects';
import type { EditorIcon } from '../../../ui/icons/editor-icons';

export interface SceneItemDescriptor {
  type: spec.ItemType,
  label: string,
  icon: EditorIcon,
  group: string,
  empty?: boolean,
  creatable?: boolean,
}

export const SCENE_ITEM_DESCRIPTORS: SceneItemDescriptor[] = [
  { type: spec.ItemType.null, label: 'Empty Item', icon: 'cube', group: 'Basic' },
  { type: spec.ItemType.composition, label: 'Composition', icon: 'sequence', group: 'Basic' },
  { type: spec.ItemType.sprite, label: 'Sprite', icon: 'sprite', group: '2D' },
  { type: spec.ItemType.text, label: 'Text', icon: 'text', group: '2D' },
  { type: spec.ItemType.richtext, label: 'Rich Text', icon: 'text', group: '2D' },
  { type: spec.ItemType.shape, label: 'Shape', icon: 'sceneComponent', group: '2D' },
  { type: spec.ItemType.particle, label: 'Particle System', icon: 'particle', group: 'Effects' },
  { type: spec.ItemType.effect, label: 'Effect', icon: 'particle', group: 'Effects', empty: true, creatable: false },
  { type: spec.ItemType.postProcessVolume, label: 'Post Process Volume', icon: 'view', group: 'Effects' },
  { type: spec.ItemType.camera, label: 'Camera', icon: 'cameraActor', group: '3D' },
  { type: spec.ItemType.light, label: 'Light', icon: 'light', group: '3D' },
  { type: spec.ItemType.mesh, label: 'Mesh', icon: 'mesh', group: '3D', empty: true },
  { type: spec.ItemType.skybox, label: 'Skybox', icon: 'world', group: '3D', empty: true },
  { type: spec.ItemType.tree, label: 'Tree', icon: 'sources', group: '3D', creatable: false },
  { type: spec.ItemType.spine, label: 'Spine', icon: 'skeleton', group: 'Media', empty: true, creatable: false },
  { type: spec.ItemType.video, label: 'Video', icon: 'video', group: 'Media', empty: true },
  { type: spec.ItemType.audio, label: 'Audio', icon: 'audio', group: 'Media', empty: true },
  { type: spec.ItemType.interact, label: 'Interaction', icon: 'hand', group: 'Advanced' },
  { type: spec.ItemType.node, label: 'Node', icon: 'cube', group: 'Advanced', creatable: false },
  { type: spec.ItemType.plugin, label: 'Plugin', icon: 'component', group: 'Advanced', empty: true, creatable: false },
];
