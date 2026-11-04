import type { TrimPath } from '@galacean/effects';
import { ShapeComponent, TrimPathMode } from '@galacean/effects';
import { detailsCustomization } from '../../../framework/registry/editor-registry';
import { DefaultObjectDetails } from '../../../ui/property-editor/default-object-details';
import type { PropertyGroup } from '../../../ui/property-editor/property-sheet';

@detailsCustomization(ShapeComponent)
export class ShapeDetailsCustomization extends DefaultObjectDetails {
  override getSearchTerms (): string[] {
    return ['Fill Trim Path', 'Stroke Trim Path', 'Mode', 'Start', 'End', 'Offset', ...super.getSearchTerms()];
  }

  override build (group: PropertyGroup): void {
    const component = this.target as ShapeComponent;

    this.buildTrimPath(group, 'Fill Trim Path', component.fillTrimPath, component);
    this.buildTrimPath(group, 'Stroke Trim Path', component.strokeTrimPath, component);
    this.buildRenderingProperties(group);
  }

  private buildTrimPath (parent: PropertyGroup, title: string, trimPath: TrimPath | null, component: ShapeComponent): void {
    const group = parent.group(title, title);

    if (!trimPath) {
      group.readOnly('Status', () => 'Not enabled');

      return;
    }
    const modes = [TrimPathMode.Synchronized, TrimPathMode.Sequential];

    group.choice('Mode', { read: () => Math.max(0, modes.indexOf(trimPath.mode)),
      write: index => { trimPath.mode = modes[index]; component.onApplyAnimationProperties(); } }, ['Synchronized', 'Sequential']);
    for (const [label, property, min, max] of [['Start', 'start', 0, 1], ['End', 'end', 0, 1], ['Offset', 'offset', -10, 10]] as const) {
      group.number(label, { read: () => trimPath[property], write: value => { trimPath[property] = value; component.onApplyAnimationProperties(); } }, { step: .01, min, max });
    }
  }
}
