import * as spec from '@galacean/effects-specification';
import { clamp } from '@galacean/effects-math/es/core/utils';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import { trianglesFromRect } from '../../math';
import type { BoundingBoxTriangle, HitTestTriangleParams } from './click-handler';
import { HitTestType } from './click-handler';
import type { EventSystem, TouchEventType } from './event-system';
import { InteractMesh } from './interact-mesh';
import { RendererComponent } from '../../components';
import type { DragEventType } from './interact-vfx-item';
import type { Renderer } from '../../render';
import { effectsClass } from '../../decorators';

/**
 * 交互组件
 * @since 2.0.0
 */
@effectsClass(spec.DataType.InteractComponent)
export class InteractComponent extends RendererComponent {
  clickable: boolean;
  dragEvent: DragEventType | null;
  bouncingArg: TouchEventType | null;
  previewContent: InteractMesh | null;
  interactData: spec.InteractContent;
  /**
   * 拖拽的惯性衰减系数，范围[0, 1], 越大惯性越强
   */
  downgrade = 0.95;
  /**
   * 拖拽的距离映射系数，越大越容易拖动
   */
  dragRatio: number[] = [1, 1];
  /**
   * 拖拽X范围
   */
  dragRange: {
    dxRange: [min: number, max: number],
    dyRange: [min: number, max: number],
  } = {
      dxRange: [0, 0],
      dyRange: [0, 0],
    };

  private duringPlay = false;

  /** 是否响应点击和拖拽交互事件 */
  private _interactive = true;

  set interactive (enable: boolean) {
    this._interactive = enable;
    if (!enable) {
      // 立刻停止惯性滑动
      this.bouncingArg = null;
    }
  }

  get interactive () {
    return this._interactive;
  }

  getDragRangeX (): [min: number, max: number] {
    return this.dragRange.dxRange;
  }

  setDragRangeX (min: number, max: number) {
    this.dragRange.dxRange = [min, max];
  }

  getDragRangeY (): [min: number, max: number] {
    return this.dragRange.dyRange;
  }

  setDragRangeY (min: number, max: number) {
    this.dragRange.dyRange = [min, max];
  }

  override onStart (): void {
    const options = this.item.props.content.options as spec.DragInteractOption;
    const { env } = this.item.engine.renderer;
    const composition = this.item.composition;
    const { type, showPreview } = this.interactData.options as spec.ClickInteractOption;

    this.item.composition?.on('goto', () => {
      if (this.item.time > 0) {
        this.duringPlay = true;
      }
    });
    if (type === spec.InteractType.CLICK) {
      this.clickable = true;
      if (showPreview && env === PLAYER_OPTIONS_ENV_EDITOR) {
        const rendererOptions = composition?.getRendererOptions();

        if (rendererOptions !== undefined) {
          this.previewContent = new InteractMesh((this.item.props as spec.InteractItem).content, rendererOptions, this.transform, this.engine);
        }
      }
    }
    if (options.type === spec.InteractType.DRAG) {
      if (env !== PLAYER_OPTIONS_ENV_EDITOR || options.enableInEditor) {
        composition?.event && this.beginDragTarget(options, composition.event);
      }
    }
    if (this.previewContent) {
      this.previewContent.mesh.item = this.item;
      this.materials = this.previewContent.mesh.materials;
    }
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onDisable (): void {
    super.onDisable();
    if (this.item && this.item.composition) {
      if (this.duringPlay && !this.item.transform.getValid()) {
        this.item.composition.removeInteractiveItem(this.item, (this.item.props as spec.InteractItem).content.options.type);
        this.duringPlay = false;
      }
      this.clickable = false;
      this.endDragTarget();
    }
  }

  override onEnable (): void {
    super.onEnable();
    const { type } = this.interactData.options as spec.ClickInteractOption;

    if (type === spec.InteractType.CLICK) {
      this.clickable = true;
    }
  }

  override onUpdate (dt: number): void {
    // trigger messageBegin when item enter
    if (this.item.time > 0 && !this.duringPlay) {
      const options = this.item.props.content.options as spec.DragInteractOption;

      this.item.composition?.addInteractiveItem(this.item, options.type);
      this.duringPlay = true;
    }

    this.previewContent?.updateMesh();

    if (!this.dragEvent || !this.bouncingArg) {
      return;
    }

    this.bouncingArg.vx *= this.downgrade;
    this.bouncingArg.vy *= this.downgrade;
    this.bouncingArg.dy += this.bouncingArg.vy;
    this.bouncingArg.dx += this.bouncingArg.vx;

    if (shouldIgnoreBouncing(this.bouncingArg)) {
      this.dragEvent = null;
      this.bouncingArg = null;
    } else {
      this.handleDragMove(this.dragEvent, this.bouncingArg);
    }
  }

  override render (renderer: Renderer): void {
    if (this.previewContent) {
      this.previewContent.mesh.render(renderer);
    }
  }

  override onDestroy (): void {
    this.previewContent?.mesh.dispose();
  }

  endDragTarget () {
    // OVERRIDE
  }

  handleDragMove (evt: Partial<DragEventType>, event: TouchEventType) {
    if (!evt?.cameraParam || !this.canInteract() || !this.item.composition) {
      return;
    }

    const { position, fov } = evt.cameraParam;
    const dy = event.dy;
    const dx = event.dx * event.width / event.height;
    const depth = position[2];
    const sp = Math.tan(fov * Math.PI / 180 / 2) * Math.abs(depth);
    const height = dy * sp;
    const width = dx * sp;
    const { dxRange, dyRange } = this.dragRange;
    let nx = position[0] - this.dragRatio[0] * width;
    let ny = position[1] - this.dragRatio[1] * height;

    const [xMin, xMax] = dxRange;
    const [yMin, yMax] = dyRange;

    nx = clamp(nx, xMin, xMax);
    ny = clamp(ny, yMin, yMax);
    if (nx !== xMin && nx !== xMax && xMin !== xMax) {
      event.origin?.preventDefault();
    }
    if (ny !== yMin && ny !== yMax && yMin !== yMax) {
      event.origin?.preventDefault();
    }
    this.item.composition.camera.position = new Vector3(nx, ny, depth);
  }

  beginDragTarget (options: spec.DragInteractOption, eventSystem: EventSystem) {
    if (options.target !== 'camera') {
      return;
    }
    let dragEvent: Partial<DragEventType> | null;
    const handlerMap: Record<string, (event: TouchEventType) => void> = {
      touchstart: (event: TouchEventType) => {
        if (!this.canInteract()) {
          return;
        }
        this.dragEvent = null;
        this.bouncingArg = null;
        const camera = this.item.composition?.camera;

        dragEvent = {
          x: event.x,
          y: event.y,
          cameraParam: {
            position: camera?.position.toArray() || [0, 0, 8],
            fov: camera?.fov || 60,
          },
        };
      },
      touchmove: (event: TouchEventType) => {
        this.handleDragMove(dragEvent as Partial<DragEventType>, event);
        this.bouncingArg = event;
      },
      touchend: (event: TouchEventType) => {
        if (!this.canInteract()) {
          return;
        }
        const bouncingArg = this.bouncingArg as TouchEventType;

        if (!shouldIgnoreBouncing(bouncingArg, 3) && bouncingArg) {
          const speed = 5;

          bouncingArg.vx *= speed;
          bouncingArg.vy *= speed;
          this.dragEvent = { ...dragEvent as DragEventType };
        }
        dragEvent = null;
      },
    };

    Object.keys(handlerMap).forEach(name => {
      eventSystem.addEventListener(name, handlerMap[name]);
    });

    handlerMap.touchmove({ dx: 0, dy: 0, width: 1, height: 1 } as TouchEventType);
    this.item.getComponent(InteractComponent).endDragTarget = () => {
      Object.keys(handlerMap).forEach(name => {
        eventSystem.removeEventListener(name, handlerMap[name]);
      });
    };
  }

  getHitTestParams = (force?: boolean): HitTestTriangleParams | void => {
    if (!this.clickable) {
      return;
    }
    const { behavior } = (this.item.props as spec.InteractItem).content.options as spec.ClickInteractOption;
    const area = this.getBoundingBox();

    if (area) {
      return {
        type: area.type,
        triangles: area.area,
        behavior,
      };
    }
  };

  getBoundingBox (): BoundingBoxTriangle | void {
    const worldMatrix = this.transform.getWorldMatrix();
    const triangles = trianglesFromRect(Vector3.ZERO, 0.5 * this.transform.size.x, 0.5 * this.transform.size.y);

    triangles.forEach(triangle => {
      worldMatrix.transformPoint(triangle.p0 as Vector3);
      worldMatrix.transformPoint(triangle.p1 as Vector3);
      worldMatrix.transformPoint(triangle.p2 as Vector3);
    });

    return {
      type: HitTestType.triangle,
      area: triangles,
    };
  }

  override fromData (data: spec.InteractContent): void {
    super.fromData(data);
    this.interactData = data;
    if (data.options.type === spec.InteractType.DRAG) {
      const options = data.options as spec.DragInteractOption;

      if (options.dxRange) {
        this.dragRange.dxRange = options.dxRange;
      }
      if (options.dyRange) {
        this.dragRange.dyRange = options.dyRange;
      }
    }
  }

  canInteract (): boolean {
    return Boolean(this.item.composition?.interactive) && this._interactive;
  }

}

function shouldIgnoreBouncing (arg: TouchEventType, mul?: number) {
  const threshold = 0.00001 * (mul || 1);

  return arg && Math.abs(arg.vx || 0) < threshold && Math.abs(arg.vy || 0) < threshold;
}
