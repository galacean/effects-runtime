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

export enum KeyLocation {
  Unspecified,
  Left,
  Right,
}
