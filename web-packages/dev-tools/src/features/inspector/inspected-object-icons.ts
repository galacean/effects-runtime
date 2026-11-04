import { AnimationClip, Component, Geometry, Material, RendererComponent, Shader, ShaderVariant, Sprite, Texture, VFXItem, getClass } from '@galacean/effects';
import type { EditorIcon } from '../../ui/icons/control-icons';

const COMPONENT_ICONS: Readonly<Record<string, EditorIcon>> = {
  SpriteComponent: 'sprite', TextComponent: 'text', RichTextComponent: 'text',
  ShapeComponent: 'sceneComponent', ParticleSystem: 'particle', ParticleSystemRenderer: 'particle',
  CompositionComponent: 'sequence', CameraController: 'cameraActor', CameraComponent: 'cameraActor',
  LightComponent: 'light', MeshComponent: 'mesh', SkyboxComponent: 'world', SpineComponent: 'skeleton',
  VideoComponent: 'video', AudioComponent: 'audio', InteractComponent: 'hand',
  PostProcessVolume: 'view', TreeComponent: 'sources', UIControl: 'sceneComponent',
  Animator: 'sequence', AnimationComponent: 'sequence', EffectComponent: 'particle',
  Fake3DComponent: 'transform', PositionConstraint: 'transform', FrameComponent: 'texture',
};
const classIcons = new WeakMap<Function, EditorIcon>();

function componentIcon (component: Component): EditorIcon {
  const type = component.definition.dataType;

  if (typeof type === 'string' && Object.hasOwn(COMPONENT_ICONS, type)) { return COMPONENT_ICONS[type]; }
  const constructor = component.constructor, cached = classIcons.get(constructor);

  if (cached) { return cached; }
  let prototype: object | null = Object.getPrototypeOf(component) as object;

  while (prototype && prototype !== Object.prototype) {
    const icon = Object.entries(COMPONENT_ICONS).find(([type]) => getClass(type) === prototype!.constructor)?.[1];

    if (icon) {
      classIcons.set(constructor, icon);

      return icon;
    }
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }
  const icon = component instanceof RendererComponent ? 'sceneComponent' : 'component';

  classIcons.set(constructor, icon);

  return icon;
}

export function inspectedObjectIcon (object: object): EditorIcon {
  if (object instanceof Component) { return componentIcon(object); }
  if (object instanceof VFXItem) { return 'object'; }
  if (object instanceof Material) { return 'material'; }
  if (object instanceof Sprite) { return 'sprite'; }
  if (object instanceof Texture) { return 'texture'; }
  if (object instanceof AnimationClip) { return 'sequence'; }
  if (object instanceof Geometry) { return 'mesh'; }
  if (object instanceof Shader || object instanceof ShaderVariant) { return 'shader'; }

  return 'object';
}
