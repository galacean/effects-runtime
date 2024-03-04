/**
 * 鼠标和键盘控制的封装，主要用于Demo测试。
 * 不可以打包导出，因为有移动端触控的第三方依赖
 */

import type { Composition } from '@galacean/effects';
import type { CameraGestureHandler } from './protocol';
import { CameraGestureHandlerImp } from './index';
import 'hammerjs';

export enum MouseButtonType {
  left = 1,
  middle = 4,
  right = 2,
}

export enum InputActionType {
  none,
  moveXYPlane,
  moveZAxis,
  rotateCamera,
  rotatePoint,
}

export interface InputControllerOptions {
  cameraID: string,
  sceneRadius: number,
  moveSpeed?: number,
  rotateSpeed?: number,
  //
  comp: Composition,
  canvas: HTMLCanvasElement,
}

/**
 * 鼠标和键盘输入控制器
 */
export class InputController {
  cameraID = 'extra-camera';
  sceneRadius = 1.0;
  moveSpeed = 0.03;
  rotateSpeed = 4;
  //
  comp?: Composition;
  canvas?: HTMLCanvasElement;
  gesture?: CameraGestureHandler;
  hammer?: HammerManager;
  // key and mouse listeners
  keyDownListener?: (e: KeyboardEvent) => any;
  mouseUpListener?: (e: MouseEvent) => any;
  mouseDownListener?: (e: MouseEvent) => any;
  mouseMoveListener?: (e: MouseEvent) => any;
  mouseLeaveListener?: (e: MouseEvent) => any;
  mouseWheelListener?: (e: WheelEvent) => any;
  //
  isMouseDown = false;
  isMoveBegin = false;
  currentAction = InputActionType.none;
  /**
   * 相机控制事件的回调，包括开始、持续和结束三种事件
   */
  private beginEventCallback?: (eventName: string) => any;
  private moveEventCallback?: (eventName: string) => any;
  private endEventCallback?: (eventName: string) => any;

  initial (options: InputControllerOptions) {
    this.cameraID = options.cameraID;
    this.sceneRadius = options.sceneRadius;
    this.moveSpeed = options.moveSpeed ?? 0.03;
    this.rotateSpeed = options.rotateSpeed ?? 4;
    //
    this.comp = options.comp;
    this.canvas = options.canvas;
    this.gesture = new CameraGestureHandlerImp(options.comp);
    //
    this.registerMouseEvent(this);
    this.registerKeyboardEvent(this);
    this.registerTouchEvent(this);
  }

  setBeginEventCallback (cb: (eventName: string) => any) {
    this.beginEventCallback = cb;
  }

  setMoveEventCallback (cb: (eventName: string) => any) {
    this.moveEventCallback = cb;
  }

  setEndEventCallback (cb: (eventName: string) => any) {
    this.endEventCallback = cb;
  }

  /**
   * 注册鼠标回调事件，只有在PC上才会注册，手机上不会注册
   *
   * @param owner 输入控制器对象
   */
  private registerMouseEvent (owner: InputController) {
    // 设备类型过滤，只在windows和mac上注册
    const platform = navigator.platform.toLowerCase();

    if (platform.search('win') < 0 && platform.search('mac') < 0) {
      return;
    }

    if (this.canvas === undefined || this.gesture === undefined) {
      return;
    }

    this.mouseDownListener = (e: MouseEvent) => {
      const buttons = e.buttons as MouseButtonType;

      owner.isMouseDown = true;
      owner.isMoveBegin = true;

      if (buttons === MouseButtonType.left) {
        owner.currentAction = InputActionType.rotatePoint;
      } else if (buttons === MouseButtonType.middle) {
        owner.currentAction = InputActionType.moveXYPlane;
      } else if (buttons === MouseButtonType.right) {
        owner.currentAction = InputActionType.moveZAxis;
      }
    };
    this.canvas.addEventListener('mousedown', this.mouseDownListener);

    this.mouseMoveListener = (e: MouseEvent) => {
      if (owner.canvas === undefined || owner.gesture === undefined || !owner.isMouseDown) {
        return;
      }

      const buttons = e.buttons as MouseButtonType;

      if (buttons === MouseButtonType.left) {
        if (owner.isMoveBegin) {
          owner.gesture.onRotatePointBegin(
            e.clientX,
            e.clientY,
            owner.canvas.width / 2,
            owner.canvas.height / 2,
            [0, 0, 0],
            owner.cameraID,
          );
          owner.isMoveBegin = false;
          this.launchBeginEventCallback('RotatePoint');
        }

        owner.gesture.onRotatingPoint(e.clientX, e.clientY, owner.getRotateSpeed());
        this.launchMoveEventCallback('RotatePoint');
      } else if (buttons === MouseButtonType.middle) {
        if (owner.isMoveBegin) {
          owner.gesture.onXYMoveBegin(
            e.clientX,
            e.clientY,
            owner.canvas.width / 2,
            owner.canvas.height / 2,
            owner.cameraID,
          );
          owner.isMoveBegin = false;
          this.launchBeginEventCallback('XYMove');
        }

        owner.gesture.onXYMoving(e.clientX, e.clientY, owner.getMouseMoveSpeed());
        this.launchMoveEventCallback('XYMove');
      } else if (buttons === MouseButtonType.right) {
        if (owner.isMoveBegin) {
          owner.gesture.onZMoveBegin(
            e.clientX,
            e.clientY,
            owner.canvas.width / 2,
            owner.canvas.height / 2,
            owner.cameraID,
          );
          owner.isMoveBegin = false;
          this.launchBeginEventCallback('ZMove');
        }

        owner.gesture.onZMoving(e.clientX, e.clientY, owner.getMouseMoveSpeed());
        this.launchMoveEventCallback('ZMove');
      }

    };
    this.canvas.addEventListener('mousemove', this.mouseMoveListener);

    this.mouseUpListener = (e: MouseEvent) => {
      owner.isMouseDown = false;
      owner.isMoveBegin = false;

      if (owner.gesture === undefined) {
        return;
      }

      const buttons = e.buttons as MouseButtonType;

      if (buttons === MouseButtonType.left) {
        owner.gesture.onRotatePointEnd();
        this.launchEndEventCallback('RotatePoint');
      } else if (buttons === MouseButtonType.middle) {
        owner.gesture.onXYMoveEnd();
        this.launchEndEventCallback('XYMove');
      } else if (buttons === MouseButtonType.right) {
        owner.gesture.onZMoveEnd();
        this.launchEndEventCallback('ZMove');
      }

    };
    this.canvas.addEventListener('mouseup', this.mouseUpListener);

    this.mouseLeaveListener = (e: MouseEvent) => {
      owner.isMouseDown = false;
      owner.isMoveBegin = false;

      if (owner.gesture === undefined) {
        return;
      }

      const buttons = e.buttons as MouseButtonType;

      if (buttons === MouseButtonType.left) {
        owner.gesture.onRotatePointEnd();
        this.launchEndEventCallback('RotatePoint');
      } else if (buttons === MouseButtonType.middle) {
        owner.gesture.onXYMoveEnd();
        this.launchEndEventCallback('XYMove');
      } else if (buttons === MouseButtonType.right) {
        owner.gesture.onZMoveEnd();
        this.launchEndEventCallback('ZMove');
      }

    };
    this.canvas.addEventListener('mouseleave', this.mouseLeaveListener);

    this.mouseWheelListener = (e: WheelEvent) => {
      if (owner.gesture === undefined) {
        return;
      }

      const we = e ;

      owner.gesture.onKeyEvent({
        cameraID: owner.cameraID,
        zAxis: we.deltaY > 0 ? 1 : -1,
        speed: owner.getWheelMoveSpeed(),
      });
      this.launchMoveEventCallback('ZMove');
    };
    this.canvas.addEventListener('wheel', this.mouseWheelListener);
  }

  private registerKeyboardEvent (owner: InputController) {
    this.keyDownListener = (e: KeyboardEvent) => {
      if (owner.gesture === undefined) {
        return;
      }

      switch (e.key) {
        case 'w':
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, zAxis: -1, speed: owner.getKeyMoveSpeed() });

          break;
        case 's':
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, zAxis: 1, speed: owner.getKeyMoveSpeed() });

          break;
        case 'a':
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, xAxis: -1, speed: owner.getKeyMoveSpeed() });

          break;
        case 'd':
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, xAxis: 1, speed: owner.getKeyMoveSpeed() });

          break;
        case 'q':
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, yAxis: 1, speed: owner.getKeyMoveSpeed() });

          break;
        case 'e':
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, yAxis: -1, speed: owner.getKeyMoveSpeed() });

          break;
        case 'p':{
          const trans = (owner.gesture as CameraGestureHandlerImp).getCameraTransform();

          console.info(`Camera: [${trans.position}], [${trans.rotation}]`);
        }

          break;
      }
    };

    window.addEventListener('keydown', this.keyDownListener);
  }

  /**
   * 注册触控回调事件，只在手机上才会注册，PC上不会注册
   *
   * @param owner 输入控制器对象
   */
  private registerTouchEvent (owner: InputController) {
    // 设备类型过滤，只在安卓和iPhone上注册
    const platform = navigator.platform.toLowerCase();

    if (platform.search('arm') < 0 && platform.search('iphone') < 0) {
      return;
    }

    if (this.canvas === undefined) {
      return;
    }

    this.hammer = new Hammer(this.canvas);
    this.hammer.get('pinch').set({ enable: true });
    this.hammer.on('pinch', function (ev) {
      if (owner.canvas === undefined || owner.gesture === undefined) {
        return;
      }

      if (ev.type === 'pinch') {
        // @ts-expect-error
        const additionalEvent = ev.additionalEvent;
        const speed = Math.sqrt(ev.velocityX * ev.velocityX + ev.velocityY * ev.velocityY) * owner.getKeyMoveSpeed() * 5;

        if (additionalEvent === 'pinchin') {
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, zAxis: 1, speed: speed });
        } else if (additionalEvent === 'pinchout') {
          owner.gesture.onKeyEvent({ cameraID: owner.cameraID, zAxis: -1, speed: speed });
        }
      }
    });

    owner.currentAction = InputActionType.rotatePoint;
    this.hammer.on('pan panstart panend tap', function (ev) {
      if (owner.canvas === undefined || owner.gesture === undefined) {
        return;
      }

      if (ev.type === 'panstart') {
        if (owner.currentAction === InputActionType.rotatePoint) {
          owner.gesture.onRotatePointBegin(
            0, 0,
            owner.canvas.width / 2,
            owner.canvas.height / 2,
            [0, 0, 0],
            owner.cameraID,
          );
        } else if (owner.currentAction === InputActionType.moveXYPlane) {
          owner.gesture.onXYMoveBegin(
            0, 0,
            owner.canvas.width / 2,
            owner.canvas.height / 2,
            owner.cameraID,
          );
        } else if (owner.currentAction === InputActionType.moveZAxis) {
          owner.gesture.onZMoveBegin(
            0, 0,
            owner.canvas.width / 2,
            owner.canvas.height / 2,
            owner.cameraID,
          );
        }
      } else if (ev.type === 'pan') {
        if (owner.currentAction === InputActionType.rotatePoint) {
          owner.gesture.onRotatingPoint(ev.deltaX, ev.deltaY, owner.getRotateSpeed());
        } else if (owner.currentAction === InputActionType.moveXYPlane) {
          owner.gesture.onXYMoving(ev.deltaX, ev.deltaY, owner.getMouseMoveSpeed() * 0.2);
        } else if (owner.currentAction === InputActionType.moveZAxis) {
          owner.gesture.onZMoving(ev.deltaX, ev.deltaY, owner.getMouseMoveSpeed() * 0.2);
        }
      } else if (ev.type === 'panend') {
        if (owner.currentAction === InputActionType.rotatePoint) {
          owner.gesture.onRotatePointEnd();
        } else if (owner.currentAction === InputActionType.moveXYPlane) {
          owner.gesture.onXYMoveEnd();
        } else if (owner.currentAction === InputActionType.moveZAxis) {
          owner.gesture.onZMoveEnd();
        }
      } else if (ev.type === 'tap') {
        if (owner.currentAction !== InputActionType.rotatePoint) {
          owner.currentAction = InputActionType.rotatePoint;
        } else {
          owner.currentAction = InputActionType.moveXYPlane;
        }
      }
    });
  }

  /**
   * 相机开始事件的回调
   * @param eventName - 事件名称
   */
  private launchBeginEventCallback (eventName: string) {
    if (this.beginEventCallback !== undefined) {
      this.beginEventCallback(eventName);
    }
  }

  /**
   * 相机持续事件的回调
   * @param eventName - 事件名称
   */
  private launchMoveEventCallback (eventName: string) {
    if (this.moveEventCallback !== undefined) {
      this.moveEventCallback(eventName);
    }
  }

  /**
   * 相机结束事件的回调
   * @param eventName - 事件名称
   */
  private launchEndEventCallback (eventName: string) {
    if (this.endEventCallback !== undefined) {
      this.endEventCallback(eventName);
    }
  }

  dispose () {
    if (this.keyDownListener !== undefined) {
      window.removeEventListener('keydown', this.keyDownListener);
    }
    if (this.mouseUpListener !== undefined) {
      this.canvas?.removeEventListener('mouseup', this.mouseUpListener);
    }
    if (this.mouseDownListener !== undefined) {
      this.canvas?.removeEventListener('mousedown', this.mouseDownListener);
    }
    if (this.mouseMoveListener !== undefined) {
      this.canvas?.removeEventListener('mousemove', this.mouseMoveListener);
    }
    if (this.mouseLeaveListener !== undefined) {
      this.canvas?.removeEventListener('mouseleave', this.mouseLeaveListener);
    }
    if (this.mouseWheelListener !== undefined) {
      this.canvas?.removeEventListener('wheel', this.mouseWheelListener);
    }
    if (this.hammer !== undefined) {
      this.hammer.remove('pinch pan panstart panend tap');
    }

    this.beginEventCallback = undefined;
    this.moveEventCallback = undefined;
    this.endEventCallback = undefined;
  }

  getMouseMoveSpeed (): number {
    return this.sceneRadius * this.moveSpeed;
  }

  getKeyMoveSpeed (): number {
    return this.getMouseMoveSpeed() * 0.3;
  }

  getRotateSpeed (): number {
    return this.rotateSpeed;
  }

  getWheelMoveSpeed (): number {
    return this.getMouseMoveSpeed() * 10.0;
  }
}

