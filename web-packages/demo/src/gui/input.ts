import { math } from '@galacean/effects';
const { Vector2, Vector3, Matrix4, Quaternion } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;

export class Input {
  keyStatusMap: Record<number, KeyStatus>;
  mousePosition: Vector2;
  mouseMovement: Vector2;
  mouseWheelDeltaY: number;
  canvas: HTMLElement;

  constructor (canvas: HTMLElement) {
    this.canvas = canvas;
    this.keyStatusMap = {};
    this.mousePosition = new Vector2();
    this.mouseMovement = new Vector2();
    this.mouseWheelDeltaY = 0;
  }

  startup () {
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onMouseWheel);
  }

  getMouseButton (button: number) {
    switch (button) {
      case 0:
        return this.keyStatusMap[KeyCode.Mouse0] === KeyStatus.KeyDown || this.keyStatusMap[KeyCode.Mouse0] === KeyStatus.Press;
      case 1:
        return this.keyStatusMap[KeyCode.Mouse1] === KeyStatus.KeyDown || this.keyStatusMap[KeyCode.Mouse1] === KeyStatus.Press;
      case 2:
        return this.keyStatusMap[KeyCode.Mouse2] === KeyStatus.KeyDown || this.keyStatusMap[KeyCode.Mouse2] === KeyStatus.Press;
    }
  }

  getMouseButtonDown (button: number) {
    switch (button) {
      case 0:
        return this.keyStatusMap[KeyCode.Mouse0] === KeyStatus.KeyDown;
      case 1:
        return this.keyStatusMap[KeyCode.Mouse1] === KeyStatus.KeyDown;
      case 2:
        return this.keyStatusMap[KeyCode.Mouse2] === KeyStatus.KeyDown;
    }
  }

  getMouseButtonUp (button: number) {
    switch (button) {
      case 0:
        return this.keyStatusMap[KeyCode.Mouse0] === KeyStatus.KeyUp;
      case 1:
        return this.keyStatusMap[KeyCode.Mouse1] === KeyStatus.KeyUp;
      case 2:
        return this.keyStatusMap[KeyCode.Mouse2] === KeyStatus.KeyUp;
    }
  }

  refreshStatus () {
    for (const key of Object.keys(this.keyStatusMap)) {
      const keySatus = this.keyStatusMap[Number(key)];

      if (keySatus === KeyStatus.KeyDown) {
        this.keyStatusMap[Number(key)] = KeyStatus.Press;
      }

      if (keySatus === KeyStatus.KeyUp) {
        this.keyStatusMap[Number(key)] = KeyStatus.None;
      }
    }
    this.mouseWheelDeltaY = 0;
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }

  dispose () {
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerdown', this.onPointerDown);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('wheel', this.onMouseWheel);
  }

  private onPointerMove = (event: PointerEvent) => {
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
    this.mouseMovement.x = event.movementX;
    this.mouseMovement.y = event.movementY;
  };

  private onPointerDown = (event: PointerEvent) => {
    switch (event.button) {
      case 0:
        this.keyStatusMap[KeyCode.Mouse0] = KeyStatus.KeyDown;

        break;
      case 1:
        this.keyStatusMap[KeyCode.Mouse1] = KeyStatus.KeyDown;

        break;
      case 2:
        this.keyStatusMap[KeyCode.Mouse2] = KeyStatus.KeyDown;

        break;
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    switch (event.button) {
      case 0:
        this.keyStatusMap[KeyCode.Mouse0] = KeyStatus.KeyUp;

        break;
      case 1:
        this.keyStatusMap[KeyCode.Mouse1] = KeyStatus.KeyUp;

        break;
      case 2:
        this.keyStatusMap[KeyCode.Mouse2] = KeyStatus.KeyUp;

        break;
    }
  };

  private onMouseWheel = (event: WheelEvent) => {
    this.mouseWheelDeltaY = event.deltaY;
  };
}

export enum KeyStatus {
  None,
  KeyDown,
  Press,
  KeyUp,
}
export enum KeyCode {
  None = -1,

  Mouse0 = 0,
  Mouse1 = 1,
  Mouse2 = 2,

  Space = 32,
  Enter = 13,
  Ctrl = 17,
  Alt = 18,
  Escape = 27,

  LeftArrow = 37,
  UpArrow = 38,
  RightArrow = 39,
  DownArrow = 40,

  A = 65,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  I,
  J,
  K,
  L,
  M,
  N,
  O,
  P,
  Q,
  R,
  S,
  T,
  U,
  V,
  W,
  X,
  Y,
  Z,

  F1 = 112,
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  F9,
  F10,
  F11,
  F12,

  Num0 = 96,
  Num1,
  Num2,
  Num3,
  Num4,
  Num5,
  Num6,
  Num7,
  Num8,
  Num9,
}