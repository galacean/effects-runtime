import { PROPERTY_COLORS as C } from '../property-editor/property-grid';
import { toolbarButton } from '../widgets/toolbar-button';
import { drawEditorIcon } from './editor-icons';

export type InspectorIcon = 'object' | 'component' | 'lock' | 'unlock' | 'settings' | 'material' | 'transform';

export function drawObjectIcon (icon: InspectorIcon, x: number, y: number, size: number, tint = C.text): void {
  drawEditorIcon(icon, x, y, size, tint);
}

export function objectIconButton (id: string, icon: InspectorIcon, hint: string): boolean {
  return toolbarButton(id, { icon, hint, width: 28, height: 26 });
}
