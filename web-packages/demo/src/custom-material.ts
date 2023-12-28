import type { Camera, Deserializer, SpriteComponent, VFXItem, VFXItemContent } from '@galacean/effects';
import { EffectComponent, Player, math } from '@galacean/effects';
import json, { sceneData } from './assets/custom-material';
import { InspectorGui } from './gui/inspector-gui';
import { TreeGui } from './gui/tree-gui';
const { Vector2, Vector3, Matrix4, Quaternion } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;

const container = document.getElementById('J-container');
const treeGui = new TreeGui();
const inspectorGui = new InspectorGui();

let deserializer: Deserializer;
let testVfxItem: VFXItem<VFXItemContent>;

//@ts-expect-error
let gui;

// const properties = `
// _2D("2D", 2D) = "" {}
// _Color("Color",Color) = (1,1,1,1)
// _Value("Value",Range(0,10)) = 2.5
// _Float("Float",Float) = 0
// _Vector("Vector",Vector) = (0,0,0,0)
// _Rect("Rect",Rect) = "" {}
// _Cube("Cube",Cube) = "" {}
// `;

function parseMaterialProperties (shaderProperties: string, gui: any) {
  json.materials[0].floats = {};
  const lines = shaderProperties.split('\n');

  for (const property of lines) {
    // 提取材质属性信息
    // 如 “_Float1("Float2", Float) = 0”
    // 提取出 “_Float1” “Float2” “Float” “0”
    const regex = /\s*(.+?)\s*\(\s*"(.+?)"\s*,\s*(.+?)\s*\)\s*=\s*(.+)\s*/;
    const matchResults = property.match(regex);

    if (!matchResults) {
      return;
    }
    const uniformName = matchResults[1];
    const inspectorName = matchResults[2];
    const type = matchResults[3];
    const value = matchResults[4];

    // 提取 Range(a, b) 的 a 和 b
    const match = type.match(/\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);

    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);

      //@ts-expect-error
      json.materials[0].floats[uniformName] = Number(value);
      gui.add(json.materials[0].floats, uniformName, start, end).onChange(() => {
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    } else if (type === 'Float') {
      //@ts-expect-error
      json.materials[0].floats[uniformName] = Number(value);
      gui.add(json.materials[0].floats, uniformName).onChange(() => {
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    } else if (type === 'Color') {
      const Color: Record<string, number[]> = {};

      Color[uniformName] = [0, 0, 0, 0];
      gui.addColor(Color, uniformName).name(inspectorName).onChange((value: number[]) => {
        //@ts-expect-error
        json.materials[0].vector4s[uniformName] = [value[0] / 255, value[1] / 255, value[2] / 255, value[3] / 255];
        testVfxItem.getComponent(EffectComponent)!.material.fromData(json.materials[0]);
      });
    }
  }
}

// dat gui 参数及修改
function setDatGUI (materialProperties: string) {
  //@ts-expect-error
  if (gui) {
    gui.destroy();
  }
  //@ts-expect-error
  gui = new dat.GUI();
  const materialGUI = gui.addFolder('Material');

  parseMaterialProperties(materialProperties, gui);
  materialGUI.open();

  // @ts-expect-error
  gui.add(json.components[0].materials[0], 'id', { material1:'21', material2:'22', material3:'23' }).name('Material').onChange(()=>{
    testVfxItem.getComponent(EffectComponent)!.fromData(json.components[0], deserializer, sceneData);
  });
}

function setGUI () {
//   const vsInput = document.getElementById('vs-input') as HTMLTextAreaElement;
//   const fsInput = document.getElementById('fs-input') as HTMLTextAreaElement;
//   const propertiesInput = document.getElementById('properties-input') as HTMLTextAreaElement;
//   const compileButton = document.getElementById('J-compileBtn') as HTMLButtonElement;

  //   vsInput.value = json.shaders[0].vertex;
  //   fsInput.value = json.shaders[0].fragment;
  //   propertiesInput.value = `_StartColor("StartColor",Color) = (1,1,1,1)
  // _EndColor("EndColor",Color) = (1,1,1,1)`;

  //   compileButton.addEventListener('click', () => {
  //     json.shaders[0].vertex = vsInput.value;
  //     json.shaders[0].fragment = fsInput.value;
  //     setDatGUI(propertiesInput.value);
  //     testVfxItem.getComponent(EffectComponent)!.fromData(json.components[0], deserializer, sceneData);
  //   });
  setDatGUI(`_StartColor("StartColor",Color) = (1,1,1,1)
  _EndColor("EndColor",Color) = (1,1,1,1)`);
}

class Input {
  keyStatusMap: Record<number, KeyStatus>;
  mousePosition: Vector2;
  mouseMovement: Vector2;
  mouseWheelDeltaY: number;
  canvas: HTMLElement;

  startup (canvas: HTMLElement) {
    this.canvas = canvas;
    this.keyStatusMap = {};
    this.mousePosition = new Vector2();
    this.mouseMovement = new Vector2();
    this.mouseWheelDeltaY = 0;

    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onMouseWheel);
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

export class OrbitController {
  targetPosition: Vector3;
  camera: Camera;
  deltaTheta: number;
  deltaPhi: number;
  input: Input;

  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;

  setup (camera: Camera, input: Input) {
    this.targetPosition = new Vector3(0, 0, 0);
    this.camera = camera;
    this.deltaTheta = 0;
    this.deltaPhi = 0;

    this.xAxis = new Vector3();
    this.yAxis = new Vector3();
    this.zAxis = new Vector3();

    this.input = input;
  }

  update () {
    if (this.input.getMouseButton(0)) {
      this.handleRotate();
    }
    if (this.input.getMouseButton(1)) {
      this.handlePan();
    }
    if (this.input.mouseWheelDeltaY !== 0) {
      this.handleZoom();
    }
  }

  handlePan () {
    const offset = this.camera.position.clone().subtract(this.targetPosition);

    const cameraHeight = this.camera.near * (Math.tan(this.camera.fov / 2 * Math.PI / 180)) * 2;
    const perPixelDistance = cameraHeight / this.input.canvas.clientHeight;
    const moveSpeed = perPixelDistance * (offset.length() + this.camera.near) / this.camera.near;

    const dx = - this.input.mouseMovement.x * moveSpeed;
    const dy = + this.input.mouseMovement.y * moveSpeed;

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
    const ndx = this.input.mouseMovement.x / 512;
    const ndy = this.input.mouseMovement.y / 1024;
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
    const dy = -this.input.mouseWheelDeltaY * zoomSpeed;

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

function guiMainLoop () {
  if (treeGui.activeItem) {
    inspectorGui.setItem(treeGui.activeItem);
  }
  treeGui.update();
  inspectorGui.update();
}

function inputControllerUpdate () {
  orbitController.update();
  input.refreshStatus();
  requestAnimationFrame(inputControllerUpdate);
}

const input = new Input();
const orbitController = new OrbitController();

(async () => {
  try {
    const player = new Player({ container });
    //@ts-expect-error
    const composition = await player.loadScene(json);

    treeGui.setComposition(composition);
    orbitController.setup(composition.camera, input);
    input.startup(container!);

    inputControllerUpdate();

    deserializer = composition.deserializer;
    testVfxItem = composition.getItemByName('Trail1')!;
    // testVfxItem.fromData(deserializer, json.vfxItems['1'], ecsSceneJsonDemo);
    // composition.content.items.push(testVfxItem);
    // composition.content.rootItems.push(testVfxItem);
    setGUI();
    // testVfxItem.fromData(deserializer, ecsSceneJsonDemo.vfxItems['1'], ecsSceneJsonDemo);
    // testVfxItem.start();
    // testVfxItem.composition = composition;
  } catch (e) {
    console.error('biz', e);
  }
})();

setInterval(()=>{
  guiMainLoop();
}, 100);
