import type { TrimPath } from '@galacean/effects';
import { ShapeComponent, TrimPathMode } from '@galacean/effects';
import { editor } from '../core/decorators';
import { Editor } from './editor';
import { EditorGUILayout } from '../widgets/editor-gui-layout';
import { PropertyGrid } from '../widgets/property-grid';

@editor(ShapeComponent)
export class ShapeComponentEditor extends Editor {
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
    if (EditorGUILayout.BeginFoldoutHeaderGroup(title)) {
      if (!trimPath) {
        EditorGUILayout.Text('Status', 'Not enabled');
      } else {
        const modes = [TrimPathMode.Synchronized, TrimPathMode.Sequential];
        let changed = EditorGUILayout.ComboField('Mode', next => {
          if (next !== undefined) { trimPath.mode = modes[next]; }

          return Math.max(0, modes.indexOf(trimPath.mode));
        }, ['Synchronized', 'Sequential']);

        for (const [label, property, min, max] of [
          ['Start', 'start', 0, 1], ['End', 'end', 0, 1], ['Offset', 'offset', -10, 10],
        ] as const) {
          changed = EditorGUILayout.NumberField(label, next => {
            if (next !== undefined) { trimPath[property] = next; }

            return trimPath[property];
          }, 0.01, min, max) || changed;
        }
        if (changed) { component.onApplyAnimationProperties(); }
      }
    }
    EditorGUILayout.EndFoldoutHeaderGroup();
  }
}
