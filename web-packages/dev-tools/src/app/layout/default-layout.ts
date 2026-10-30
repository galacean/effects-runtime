export const EDITOR_DOCKSPACE_ID = 0x8B93E3BD;

export const DEFAULT_WINDOWS: Record<string, boolean> = {
  Composition: false, Hierarchy: true, Scene: true, Inspector: true, 'Content Browser': true, Sequencer: true,
  'Runtime Assets': false, 'Animation Clip': false, AnimationGraph: false, 'Asset Editor': false,
};

export function defaultEditorLayout (width = window.innerWidth, height = window.innerHeight, menuHeight = 24): string {
  const w = Math.max(640, Math.round(width)), h = Math.max(400, Math.round(height - menuHeight));
  const details = Math.round(Math.min(440, Math.max(280, w * 0.28))), main = w - details - 2;
  const bottom = Math.round(Math.min(360, Math.max(280, h * 0.36), h * 0.5)), top = h - bottom - 2;
  const hierarchy = Math.round(Math.max(200, Math.min(360, h * 0.4))), inspector = h - hierarchy - 2;
  const dockedWindow = (name: string, id: string, x: number, y: number, width: number, height: number, order = 0) =>
    `[Window][${name}]\nPos=${x},${y}\nSize=${width},${height}\nCollapsed=0\nDockId=${id},${order}\n`;

  return [
    dockedWindow('Composition', '0x0000B004', 0, menuHeight + top + 2, main, bottom, 2),
    dockedWindow('Scene', '0x0000B003', 0, menuHeight, main, top),
    dockedWindow('Hierarchy', '0x0000B005', main + 2, menuHeight, details, hierarchy),
    dockedWindow('Inspector', '0x0000B006', main + 2, menuHeight + hierarchy + 2, details, inspector),
    dockedWindow('Content Browser', '0x0000B004', 0, menuHeight + top + 2, main, bottom),
    dockedWindow('Sequencer', '0x0000B004', 0, menuHeight + top + 2, main, bottom, 1),
    `[Docking][Data]
DockSpace       ID=0x8B93E3BD Pos=0,${menuHeight} Size=${w},${h} Split=X
  DockNode      ID=0x0000B001 Parent=0x8B93E3BD SizeRef=${main},${h} Split=Y
    DockNode    ID=0x0000B003 Parent=0x0000B001 SizeRef=${main},${top} CentralNode=1
    DockNode    ID=0x0000B004 Parent=0x0000B001 SizeRef=${main},${bottom}
  DockNode      ID=0x0000B002 Parent=0x8B93E3BD SizeRef=${details},${h} Split=Y
    DockNode    ID=0x0000B005 Parent=0x0000B002 SizeRef=${details},${hierarchy}
    DockNode    ID=0x0000B006 Parent=0x0000B002 SizeRef=${details},${inspector}
`,
  ].join('\n');
}
