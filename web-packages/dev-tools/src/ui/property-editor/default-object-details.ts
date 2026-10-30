import { EffectsObject, MaskableGraphic, RendererComponent, SpriteComponent } from '@galacean/effects';
import { PropertyFields } from './property-fields';
import { reflectProperties } from './property-handle';
import { PropertyTree } from './property-tree';

const HIDDEN_PROPERTIES = new Set([
  'engine', 'item', 'guid', 'definition', 'name', 'id', 'isRegistered', 'isAwakeCalled', 'isStartCalled',
  'isEnableCalled', 'isDuringPlay', 'enabled', 'materials', 'material', 'frameClipMasks', 'maskManager',
  'boundingBoxInfo', 'geometry', 'defaultGeometry', 'canvas', 'context', 'isDirty', 'maxLineWidth',
  'ALPHA_FIX_VALUE', 'eventEmitter', 'eventProcessor', 'disposed', 'visible', 'renderer',
  'controlNode', 'linkedItemTransform', 'linkedControl', 'syncingLocation', 'timelineDirty', 'isEndCalled',
]);

export function propertyLabel (name: string): string {
  const label = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export class DefaultObjectDetails {
  target: object;
  private readonly tree = new PropertyTree({
    properties: object => reflectProperties(object).filter(property => typeof property.key === 'string' && !property.key.startsWith('_') && !HIDDEN_PROPERTIES.has(property.key) && property.value !== undefined && property.value !== null && !ArrayBuffer.isView(property.value)),
    inline: (value): value is object => !!value && typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype),
    reference: (value): value is object => value instanceof EffectsObject,
    label: key => propertyLabel(String(key)), maxDepth: 4,
  });

  getSearchTerms (): string[] {
    const terms = this.tree.searchTerms(this.target);

    if (this.target instanceof RendererComponent) { terms.push('Render Order'); }
    if (this.target instanceof MaskableGraphic) { terms.push('Color'); }
    if (this.target instanceof SpriteComponent) { terms.push('Sprite'); }

    return terms;
  }

  onInspectorGUI (): void {
    this.tree.draw(this.target);
    this.drawRenderingProperties();
  }

  protected drawRenderingProperties (): void {
    const component = this.target;

    if (component instanceof MaskableGraphic) {
      const color = (component.material.getColor('_Color') ?? component.color).clone();

      if (PropertyFields.ColorField('Color', color)) { component.color = color; }
    }
    if (component instanceof SpriteComponent) { PropertyFields.ObjectField('Sprite', component, 'sprite', 'Sprite'); }
    if (component instanceof RendererComponent) {
      PropertyFields.NumberField('Render Order', next => {
        if (next !== undefined) { component.priority = Math.round(next); }

        return component.priority;
      }, 1, 0, 0, '%.0f');
    }
  }

}
