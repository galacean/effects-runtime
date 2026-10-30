import type { ImGui } from '../../platform/imgui/index';
import type { EditorIcon } from '../../ui/icons/editor-icons';
import { drawEditorIcon } from '../../ui/icons/editor-icons';
import { drawEditorChevron } from '../../ui/widgets/editor-arrow';

export type SequenceIcon = EditorIcon | 'chevron';

export function drawSequenceIcon (name: SequenceIcon, x: number, y: number, size: number, tint: ImGui.Vec4): void {
  if (name === 'chevron') { drawEditorChevron(x, y, size, tint); } else { drawEditorIcon(name === 'folder' ? 'folderOpen' : name, x, y, size, tint); }
}
