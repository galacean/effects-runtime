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

export enum MouseButton {
  None,
  Left,
  Right,
  Middle,
  WheelUp,
  WheelDown,
  WheelLeft,
  WheelRight,
  Xbutton1,
  Xbutton2,
}

export enum MouseButtonMask {
  None = 0,
  Left = 1 << 0,
  Right = 1 << 1,
  Middle = 1 << 2,
  Xbutton1 = 1 << 7,
  Xbutton2 = 1 << 8,
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

export enum KeyLocation {
  Unspecified,
  Left,
  Right,
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
