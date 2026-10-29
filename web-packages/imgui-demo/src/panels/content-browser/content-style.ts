import { ImGui } from '../../imgui';

export const CONTENT_COLORS = {
  panel: ImGui.COL32(26, 26, 26, 255), toolbar: ImGui.COL32(36, 36, 36, 255), recessed: ImGui.COL32(16, 16, 16, 255),
  secondary: ImGui.COL32(56, 56, 56, 255), hover: ImGui.COL32(87, 87, 87, 255), border: ImGui.COL32(15, 15, 15, 255),
  text: ImGui.COL32(192, 192, 192, 255), white: ImGui.COL32(255, 255, 255, 255), muted: ImGui.COL32(128, 128, 128, 255),
  faint: ImGui.COL32(80, 80, 80, 255), selection: ImGui.COL32(0, 112, 224, 255), selectionInactive: ImGui.COL32(64, 87, 111, 255),
  selectionHover: ImGui.COL32(14, 134, 255, 255), selectionInactiveHover: ImGui.COL32(74, 99, 126, 255), scene: ImGui.COL32(255, 156, 0, 255),
  green: ImGui.COL32(42, 112, 48, 255), greenHover: ImGui.COL32(53, 134, 60, 255), texture: ImGui.COL32(192, 64, 64, 255),
  folder: ImGui.COL32(190, 190, 190, 255), danger: ImGui.COL32(210, 72, 72, 255), drop: ImGui.COL32(25, 132, 245, 255),
};

export type ContentIcon = 'add' | 'import' | 'save' | 'back' | 'forward' | 'down' | 'right' | 'folder' | 'folderOpen' | 'scene' |
'sources' | 'search' | 'filter' | 'settings' | 'star' | 'collection' | 'texture' | 'close' | 'check' | 'sort' | 'tiles' | 'list' | 'columns';

export function contentWindowBackground (): void {
  const origin = ImGui.GetCursorScreenPos(), position = ImGui.GetWindowPos(), size = ImGui.GetWindowSize();
  const draw = ImGui.GetWindowDrawList(), top = Math.min(origin.y, position.y + ImGui.GetFontSize());
  const min = new ImGui.Vec2(position.x, top), max = new ImGui.Vec2(position.x + size.x, position.y + size.y);

  draw.PushClipRect(min, max, false);
  draw.AddRectFilled(min, max, CONTENT_COLORS.panel); draw.PopClipRect();
}

export function contentIcon (icon: ContentIcon, x: number, y: number, size = 16, color = CONTENT_COLORS.text): void {
  const draw = ImGui.GetWindowDrawList(), p = (px: number, py: number) => new ImGui.Vec2(x + px * size / 16, y + py * size / 16);
  const line = (ax: number, ay: number, bx: number, by: number, thickness = 1.5) => draw.AddLine(p(ax, ay), p(bx, by), color, thickness);

  if (icon === 'folder' || icon === 'folderOpen') {
    draw.AddRectFilled(p(1, 3), p(7, 6), color, 1);
    draw.AddRectFilled(p(1, 5), p(15, 13), color, 1);
    if (icon === 'folderOpen') {
      draw.AddTriangleFilled(p(2, 7), p(16, 7), p(13, 14), color);
      draw.AddTriangleFilled(p(2, 7), p(13, 14), p(0, 14), color);
    }
  } else if (icon === 'add') { line(8, 3, 8, 13, 2); line(3, 8, 13, 8, 2); } else if (icon === 'close') {
    line(4, 4, 12, 12); line(12, 4, 4, 12);
  } else if (icon === 'back' || icon === 'forward') {
    const reverse = icon === 'forward';
    const point = (px: number, py: number) => p(reverse ? 16 - px : px, py);

    draw.AddLine(point(3, 8), point(13, 8), color, 1.7);
    draw.AddLine(point(3, 8), point(8, 3), color, 1.7);
    draw.AddLine(point(3, 8), point(8, 13), color, 1.7);
  } else if (icon === 'right' || icon === 'down') {
    if (icon === 'down') { draw.AddTriangleFilled(p(4, 6), p(12, 6), p(8, 10), color); } else { draw.AddTriangleFilled(p(6, 4), p(6, 12), p(10, 8), color); }
  } else if (icon === 'search') {
    draw.AddCircle(p(6.5, 6.5), size * 0.25, color, 14, 1.6); line(10, 10, 14, 14, 2);
  } else if (icon === 'filter') {
    line(2, 3, 14, 3, 2); line(4, 7, 12, 7, 2); line(6, 11, 10, 11, 2);
  } else if (icon === 'sources') {
    draw.AddRect(p(1, 2), p(15, 14), color, 1, 0, 1.3); line(6, 2, 6, 14, 1.3);
    line(9, 5, 13, 5, 1); line(9, 8, 13, 8, 1); line(9, 11, 13, 11, 1);
  } else if (icon === 'import') {
    line(8, 1, 8, 10, 1.7); line(4, 6, 8, 10, 1.7); line(12, 6, 8, 10, 1.7);
    line(2, 10, 2, 14); line(2, 14, 14, 14); line(14, 14, 14, 10);
  } else if (icon === 'save') {
    draw.AddRect(p(2, 2), p(14, 14), color, 1, 0, 1.4); draw.AddRect(p(5, 2), p(11, 6), color, 0, 0, 1.3); draw.AddRect(p(5, 9), p(11, 14), color, 0, 0, 1.3);
  } else if (icon === 'star') {
    for (let index = 0; index < 10; index++) {
      const a = index * Math.PI / 5 - Math.PI / 2, b = (index + 1) * Math.PI / 5 - Math.PI / 2;
      const ar = index % 2 ? 3 : 6.5, br = index % 2 ? 6.5 : 3;

      draw.AddLine(p(8 + Math.cos(a) * ar, 8 + Math.sin(a) * ar), p(8 + Math.cos(b) * br, 8 + Math.sin(b) * br), color, 1.3);
    }
  } else if (icon === 'collection') {
    draw.AddRect(p(2, 4), p(13, 14), color, 1, 0, 1.3); line(5, 1, 15, 1); line(15, 1, 15, 11); line(5, 8, 10, 8); line(5, 11, 10, 11);
  } else if (icon === 'texture') {
    draw.AddRect(p(1, 2), p(15, 14), color, 1, 0, 1.2); draw.AddCircleFilled(p(5, 6), size * 0.1, color);
    line(3, 12, 8, 7); line(8, 7, 13, 12); line(10, 10, 12, 8); line(12, 8, 14, 11);
  } else if (icon === 'scene') {
    const shade = (factor: number) => ImGui.COL32((color & 255) * factor, ((color >>> 8) & 255) * factor, ((color >>> 16) & 255) * factor, color >>> 24);

    draw.AddQuadFilled(p(1, 4), p(5.5, 2), p(5.5, 12), p(1, 14), color);
    draw.AddQuadFilled(p(5.5, 2), p(10.5, 4), p(10.5, 14), p(5.5, 12), shade(0.66));
    draw.AddQuadFilled(p(10.5, 4), p(15, 2), p(15, 12), p(10.5, 14), shade(0.88));
  } else if (icon === 'settings') {
    draw.AddCircle(p(8, 8), size * 0.3, color, 10, 1.5); draw.AddCircle(p(8, 8), size * 0.12, color, 10, 1.4);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;

      line(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, 2);
    }
  } else if (icon === 'check') { line(3, 8, 7, 12, 2); line(7, 12, 14, 4, 2); } else if (icon === 'sort') {
    line(3, 3, 13, 3); line(3, 7, 10, 7); line(3, 11, 7, 11);
  } else if (icon === 'tiles') {
    for (let i = 0; i < 4; i++) { draw.AddRectFilled(p(2 + i % 2 * 7, 2 + Math.floor(i / 2) * 7), p(7 + i % 2 * 7, 7 + Math.floor(i / 2) * 7), color, 1); }
  } else {
    for (let i = 0; i < 3; i++) { line(2, 3 + i * 5, 14, 3 + i * 5, 2); }
    if (icon === 'columns') { line(6, 1, 6, 15, 1); line(11, 1, 11, 15, 1); }
  }
}

export function contentButton (id: string, icon: ContentIcon, label = '', options: { width?: number, active?: boolean, disabled?: boolean, green?: boolean, dropdown?: boolean, hint?: string } = {}): boolean {
  const height = 26, size = ImGui.CalcTextSize(label), width = options.width ?? (label ? size.x + 34 + (options.dropdown ? 14 : 0) : 26);
  const p = ImGui.GetCursorScreenPos();

  ImGui.BeginDisabled(!!options.disabled);
  const clicked = ImGui.InvisibleButton(id, new ImGui.Vec2(width, height));
  const hovered = ImGui.IsItemHovered(), draw = ImGui.GetWindowDrawList();
  const background = options.green ? hovered ? CONTENT_COLORS.greenHover : CONTENT_COLORS.green : hovered ? CONTENT_COLORS.hover : 0;

  if (background) { draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + height), options.disabled ? ((background & 0xffffff) | 0x60000000) >>> 0 : background, 3); }
  const color = options.disabled ? CONTENT_COLORS.faint : options.green ? CONTENT_COLORS.white : CONTENT_COLORS.text;

  contentIcon(icon, p.x + (label ? 7 : 5), p.y + 5, 16, options.active && !options.disabled ? CONTENT_COLORS.selectionHover : color);
  if (label) { draw.AddText(new ImGui.Vec2(p.x + 28, p.y + (height - size.y) / 2), color, label); }
  if (options.dropdown) { contentIcon('down', p.x + width - 16, p.y + 5, 14, color); }
  if (options.hint && ImGui.IsItemHovered(ImGui.HoveredFlags.AllowWhenDisabled | ImGui.HoveredFlags.DelayNormal)) { ImGui.SetTooltip(options.hint); }
  ImGui.EndDisabled();

  return clicked;
}

export function contentText (text: string, x: number, y: number, color = CONTENT_COLORS.text, maxWidth = Infinity, size = ImGui.GetFontSize()): void {
  const scale = size / ImGui.GetFontSize();
  let value = text;

  if (ImGui.CalcTextSize(value).x * scale > maxWidth) {
    while (value && ImGui.CalcTextSize(value + '…').x * scale > maxWidth) { value = value.slice(0, -1); }
    value += '…';
  }
  ImGui.GetWindowDrawList().AddText(ImGui.GetFont(), size, new ImGui.Vec2(Math.round(x), Math.round(y)), color, value);
}

export function contentWrappedText (text: string, x: number, y: number, width: number, lines: number, color: number, centered = false): void {
  const characters = Array.from(text), lineHeight = ImGui.GetTextLineHeight();

  for (let row = 0; row < lines && characters.length; row++) {
    let count = 0;

    while (count < characters.length && ImGui.CalcTextSize(characters.slice(0, count + 1).join('')).x <= width) { count++; }
    count = Math.max(1, count);
    if (row === lines - 1) { count = characters.length; } else if (count < characters.length) {
      const space = characters.slice(0, count).lastIndexOf(' ');

      if (space > count / 2) { count = space; }
    }
    const value = characters.splice(0, count).join('').trim();

    while (characters[0] === ' ') { characters.shift(); }
    const offset = centered ? Math.max(0, (width - ImGui.CalcTextSize(value).x) / 2) : 0;

    contentText(value, x + offset, y + row * lineHeight, color, width);
  }
}

export function checkerboard (x: number, y: number, width: number, height: number, cell = 10): void {
  const draw = ImGui.GetWindowDrawList();

  draw.PushClipRect(new ImGui.Vec2(x, y), new ImGui.Vec2(x + width, y + height), true);
  for (let row = 0; row < Math.ceil(height / cell); row++) {
    for (let col = 0; col < Math.ceil(width / cell); col++) {
      draw.AddRectFilled(new ImGui.Vec2(x + col * cell, y + row * cell), new ImGui.Vec2(x + (col + 1) * cell, y + (row + 1) * cell), (row + col) % 2 ? ImGui.COL32(50, 50, 50, 255) : ImGui.COL32(39, 39, 39, 255));
    }
  }
  draw.PopClipRect();
}
