import type { TrimPath } from '@galacean/effects';
import { ShapeComponent, TrimPathMode } from '@galacean/effects';
import { detailsCustomization } from '../../../framework/registry/editor-registry';
import { DefaultObjectDetails } from '../../../ui/property-editor/default-object-details';
import { PropertyFields } from '../../../ui/property-editor/property-fields';
import { PropertyGrid } from '../../../ui/property-editor/property-grid';

@detailsCustomization(ShapeComponent)
export class ShapeDetailsCustomization extends DefaultObjectDetails {
  override getSearchTerms (): string[] {
    return ['Fill Trim Path', 'Stroke Trim Path', 'Mode', 'Start', 'End', 'Offset', ...super.getSearchTerms()];
  }

  override onInspectorGUI (): void {
    const component = this.target as ShapeComponent;

    this.drawTrimPath('Fill Trim Path', component.fillTrimPath, component);
    this.drawTrimPath('Stroke Trim Path', component.strokeTrimPath, component);
    this.drawRenderingProperties();
  }

  private drawTrimPath (title: string, trimPath: TrimPath | null, component: ShapeComponent): void {
    if (!PropertyGrid.matches(title, 'Mode', 'Start', 'End', 'Offset')) { return; }
    if (PropertyFields.BeginFoldoutHeaderGroup(title)) {
      if (!trimPath) {
        PropertyFields.Text('Status', 'Not enabled');
      } else {
        const modes = [TrimPathMode.Synchronized, TrimPathMode.Sequential];
        let changed = PropertyFields.ComboField('Mode', next => {
          if (next !== undefined) { trimPath.mode = modes[next]; }

          return Math.max(0, modes.indexOf(trimPath.mode));
        }, ['Synchronized', 'Sequential']);

        for (const [label, property, min, max] of [
          ['Start', 'start', 0, 1], ['End', 'end', 0, 1], ['Offset', 'offset', -10, 10],
        ] as const) {
          changed = PropertyFields.NumberField(label, next => {
            if (next !== undefined) { trimPath[property] = next; }

            return trimPath[property];
          }, 0.01, min, max) || changed;
        }
        if (changed) { component.onApplyAnimationProperties(); }
      }
    }
    PropertyFields.EndFoldoutHeaderGroup();
  }
}
