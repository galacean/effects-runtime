export enum MouseFilter {
  Stop,
  Pass,
  Ignore,
}

export enum MouseBehaviorRecursive {
  Inherited,
  Disabled,
  Enabled,
}

export enum FocusMode {
  None,
  Click,
  All,
  Accessibility,
}

export enum FocusBehaviorRecursive {
  Inherited,
  Disabled,
  Enabled,
}

export enum CursorShape {
  Arrow,
  Ibeam,
  PointingHand,
  Cross,
  Wait,
  Busy,
  Drag,
  CanDrop,
  Forbidden,
  Vsize,
  Hsize,
  Bdiagsize,
  Fdiagsize,
  Move,
  Vsplit,
  Hsplit,
  Help,
}

/** A preset cursor shape or a complete CSS cursor value. */
export type CursorStyle = CursorShape | string;
