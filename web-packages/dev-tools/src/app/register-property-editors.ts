import { EffectsObject } from '@galacean/effects';
import { drawAssetReferenceField } from '../features/assets/ui/asset-reference-field';
import '../features/inspector/customizations/index';
import { sceneWorkspace } from '../features/scene/scene-workspace';
import { registerObjectReferenceRenderer } from '../ui/property-editor/object-reference-field';
import { registerPropertyMutationHandler } from '../ui/property-editor/property-handle';

export function registerPropertyEditors (): void {
  registerObjectReferenceRenderer(drawAssetReferenceField);
  registerPropertyMutationHandler((object, key, action) => {
    if (object instanceof EffectsObject) { sceneWorkspace.observe('Edit ' + String(key), action, [object]); } else { action(); }
  });
}
