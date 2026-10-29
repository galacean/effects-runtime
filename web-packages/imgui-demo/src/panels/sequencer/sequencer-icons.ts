import type { ImGui } from '../../imgui';
import { drawEditorChevron } from '../../widgets/editor-arrow';
import { drawEditorIcon } from '../../widgets/editor-icons';
import type { EditorIcon } from '../../widgets/editor-icons';

export type SequenceIcon = EditorIcon | 'chevron';

export function drawSequenceIcon (name: SequenceIcon, x: number, y: number, size: number, tint: ImGui.Vec4): void {
  if (name === 'chevron') { drawEditorChevron(x, y, size, tint); } else { drawEditorIcon(name === 'folder' ? 'folderOpen' : name, x, y, size, tint); }
}
