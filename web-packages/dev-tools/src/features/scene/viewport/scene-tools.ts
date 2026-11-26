import type { ShapePrimitive } from '@galacean/effects-plugin-editor-gizmo';
import type { EditorIcon } from '../../../ui/icons/control-icons';

export type SceneTool = 'transform' | 'hand' | 'brush' | 'pen' | ShapePrimitive | 'text' | 'frame';

export const SCENE_TOOLS: Record<SceneTool, { label: string, icon: EditorIcon, shortcut?: string }> = {
  transform: { label: 'Select', icon: 'toolSelect', shortcut: 'V / W' },
  hand: { label: 'Pan', icon: 'toolHand', shortcut: 'H' },
  pen: { label: 'Pen', icon: 'toolPen', shortcut: 'P' },
  brush: { label: 'Brush', icon: 'toolBrush', shortcut: 'B' },
  rect: { label: 'Rectangle', icon: 'toolRectangle', shortcut: 'R' },
  ellipse: { label: 'Ellipse', icon: 'toolEllipse', shortcut: 'O' },
  polygon: { label: 'Polygon', icon: 'toolPolygon' },
  star: { label: 'Star', icon: 'toolStar' },
  text: { label: 'Text', icon: 'toolText', shortcut: 'T' },
  frame: { label: 'Frame', icon: 'toolFrame', shortcut: 'A' },
};

export const SCENE_SHAPE_TOOLS: ShapePrimitive[] = ['rect', 'ellipse', 'polygon', 'star'];

export const SCENE_DRAWING_TOOLS = (['pen', ...SCENE_SHAPE_TOOLS, 'text', 'frame'] as SceneTool[])
  .map(tool => ({ tool, ...SCENE_TOOLS[tool] }));
