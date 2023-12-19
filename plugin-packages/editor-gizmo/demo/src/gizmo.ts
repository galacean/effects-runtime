import type { Camera } from '@galacean/effects';
import { Player } from '@galacean/effects';
import type { GizmoVFXItem } from '@galacean/effects-plugin-editor-gizmo';
import { primaryJSON, gizmoJSON, transformGizmoScene } from './assets';
import { Vector2, Vector3, Matrix4, Quaternion } from '@galacean/effects-plugin-model/runtime/math';
let input: Input;
let orbitController: OrbitController;

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    renderFramework: 'webgl2',
    interactive: true,
    env: 'editor',
    onItemClicked: e => {
      const { player, id } = e;
      const composition = player.getCompositions()[0];
      const item = composition.items.find(item => item.id === String(id)) as unknown as GizmoVFXItem;

      console.info('itemId: ' + item.id);
      console.info('hitBoundingKey: ' + item.hitBounding?.key);
    },
  });
  const json = JSON.parse(transformGizmoScene);

  json.compositions[0].items = JSON.parse(gizmoJSON);
  const scene = await player.loadScene(json);

  input = new Input();
  input.startup();
  orbitController = new OrbitController(scene.camera);
  requestAnimationFrame(update);

  void player.play();
})();

function update () {
  orbitController.update();
  input.refreshStatus();
  requestAnimationFrame(update);
}

class Input {
  keyStatusMap: Record<number, KeyStatus>;
  mousePosition: Vector2;
  mouseMovement: Vector2;
  mouseWheelDeltaY: number;

  startup () {
    this.keyStatusMap = {};
    this.mousePosition = new Vector2();
    this.mouseMovement = new Vector2();
    this.mouseWheelDeltaY = 0;

    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('wheel', this.onMouseWheel);
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

  private onPointerMove = (event: PointerEvent) =>{
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
    this.mouseMovement.x = event.movementX;
    this.mouseMovement.y = event.movementY;
  };

  private onPointerDown = (event: PointerEvent)=>{
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

  private onPointerUp = (event: PointerEvent) =>{
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

  private onMouseWheel = (event: WheelEvent) =>{
    this.mouseWheelDeltaY = event.deltaY;
  };
}

class OrbitController {
  targetPosition: Vector3;
  camera: Camera;
  deltaTheta: number;
  deltaPhi: number;
  constructor (camera: Camera) {
    this.targetPosition = new Vector3(0, 0, 0);
    this.camera = camera;
    this.deltaTheta = 0;
    this.deltaPhi = 0;

    this.xAxis = new Vector3();
    this.yAxis = new Vector3();
    this.zAxis = new Vector3();
  }

  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;

  update () {
    if (input.getMouseButton(0)) {
      this.handleRotate();
    }
    if (input.getMouseButton(1)) {
      this.handlePan();
    }
    if (input.mouseWheelDeltaY !== 0) {
      this.handleZoom();
    }
  }

  handlePan () {
    const moveSpeed = 0.01;
    const dx = - input.mouseMovement.x * moveSpeed;
    const dy = + input.mouseMovement.y * moveSpeed;

    const cameraRight = Vector3.X.clone().applyMatrix(this.camera.getQuat().toMatrix4(new Matrix4()));
    const cameraUp = Vector3.Y.clone().applyMatrix(this.camera.getQuat().toMatrix4(new Matrix4()));
    const moveVector = cameraRight.clone().scale(dx).add(cameraUp.clone().scale(dy));

    this.camera.position = this.camera.position.add(moveVector);
    this.targetPosition.add(moveVector);
  }

  handleRotate () {
    const rotation = this.camera.getQuat().toMatrix4(new Matrix4()).toArray();

    this.xAxis.set(rotation[0], rotation[1], rotation[2]);

    const rotateSpeed = 1;
    const ndx = input.mouseMovement.x / 512;
    const ndy = input.mouseMovement.y / 1024;
    const dxAngle = ndx * Math.PI * rotateSpeed;
    const dyAngle = ndy * Math.PI * rotateSpeed;
    const newRotation = Quaternion.fromAxisAngle(Vector3.Y, -dxAngle);
    const tempRotation = Quaternion.fromAxisAngle(this.xAxis.normalize(), -dyAngle);

    newRotation.multiply(tempRotation);
    const rotateMatrix = newRotation.toMatrix4(new Matrix4());
    const targetPoint = this.targetPosition;
    const deltaPosition = this.camera.position.clone().subtract(targetPoint);

    rotateMatrix.transformPoint(deltaPosition);
    const newPosition = deltaPosition.add(targetPoint);

    newRotation.multiply(this.camera.getQuat());
    this.camera.position = new Vector3(newPosition.x, newPosition.y, newPosition.z);
    this.camera.setQuat(new Quaternion(newRotation.x, newRotation.y, newRotation.z, newRotation.w));
  }

  handleZoom () {
    const zoomSpeed = 0.0005;
    const dy = -input.mouseWheelDeltaY * zoomSpeed;

    this.camera.position = this.camera.position.scale(1 - dy);
  }
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