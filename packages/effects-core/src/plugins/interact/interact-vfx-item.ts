import type { vec3 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import { Vector3, clamp } from '@galacean/effects-math/es/core/index';
import { PLAYER_OPTIONS_ENV_EDITOR } from '../../constants';
import type { EventSystem, TouchEventType } from './event-system';
import type { VFXItemProps } from '../../vfx-item';
import { VFXItem } from '../../vfx-item';
import type { HitTestTriangleParams, BoundingBoxTriangle } from './click-handler';
import { HitTestType } from './click-handler';
import { trianglesFromRect } from '../../math';
import type { Composition } from '../../composition';
import { InteractMesh } from './interact-mesh';
import type { InteractItem } from './interact-item';
import type { Engine } from '../../engine';
import { assertExist } from '../../utils';

interface DragEventType extends TouchEventType {
  cameraParam?: {
    position: vec3,
    fov: number,
  },
}

export class InteractVFXItem extends VFXItem<InteractItem> {
  previewContent: InteractMesh | null;

  private ui: spec.InteractContent;
  private clickable: boolean;
  private dragEvent: DragEventType | null;
  private bouncingArg: TouchEventType | null;
  engine?: Engine;

  constructor (props: VFXItemProps, composition: Composition) {
    super(props, composition);
    this.engine = this.composition?.getEngine();
  }

  override get type () {
    return spec.ItemType.interact;
  }

  override onConstructed (options: spec.InteractItem) {
    this.ui = options.content;
  }

  override onLifetimeBegin (composition: Composition) {
    const options = this.ui.options as spec.DragInteractOption;
    const { env } = this.engine?.renderer ?? {};

    this.composition?.addInteractiveItem(this, options.type);
    if (options.type === spec.InteractType.DRAG) {
      if (env !== PLAYER_OPTIONS_ENV_EDITOR || options.enableInEditor) {
        composition.event && this.beginDragTarget(options, composition.event);
      }
    }
  }

  override onItemUpdate () {
    this.previewContent?.updateMesh();

    if (!this.dragEvent || !this.bouncingArg) {
      return;
    }

    const downgrade = 0.95;

    this.bouncingArg.vx *= downgrade;
    this.bouncingArg.vy *= downgrade;
    this.bouncingArg.dy += this.bouncingArg.vy;
    this.bouncingArg.dx += this.bouncingArg.vx;

    if (shouldIgnoreBouncing(this.bouncingArg)) {
      this.dragEvent = null;
      this.bouncingArg = null;
    } else {
      this.handleDragMove(this.dragEvent, this.bouncingArg);
    }
  }

  override onItemRemoved (composition: Composition) {
    composition.removeInteractiveItem(this, this.ui.options.type);
    this.clickable = false;
    this.previewContent?.mesh.dispose();
    this.endDragTarget();
  }

  override getBoundingBox (): BoundingBoxTriangle | void {
    const worldMatrix = this.transform.getWorldMatrix();
    const triangles = trianglesFromRect(Vector3.ZERO, 0.5, 0.5);

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

  override getHitTestParams (): HitTestTriangleParams | void {
    if (!this.clickable) {
      return;
    }
    const { behavior } = this.ui.options as spec.ClickInteractOption;
    const area = this.getBoundingBox();

    if (area) {
      return {
        type: area.type,
        triangles: area.area,
        behavior,
      };
    }
  }

  protected override doCreateContent (composition: Composition): InteractItem {
    const { type, showPreview } = this.ui.options as spec.ClickInteractOption;
    const engine = this.engine;
    const { env } = engine?.renderer ?? {};

    assertExist(engine);
    if (type === spec.InteractType.CLICK) {
      this.clickable = true;
      if (showPreview && env === PLAYER_OPTIONS_ENV_EDITOR) {
        const rendererOptions = composition.getRendererOptions();

        this.previewContent = new InteractMesh(this.ui, rendererOptions, this.transform, engine);
      }
    }

    return {};
  }

  private beginDragTarget (options: spec.DragInteractOption, eventSystem: EventSystem) {
    if (options.target !== 'camera') {
      return;
    }

    let dragEvent: Partial<DragEventType> | null;
    const handlerMap: Record<string, (event: TouchEventType) => void> = {
      touchstart: (event: TouchEventType) => {
        this.dragEvent = null;
        this.bouncingArg = null;
        const camera = this.composition?.camera;

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
    this.endDragTarget = () => {
      Object.keys(handlerMap).forEach(name => {
        eventSystem.removeEventListener(name, handlerMap[name]);
      });
    };
  }

  private endDragTarget () {
    // OVERRIDE
  }

  private handleDragMove (evt: Partial<DragEventType>, event: TouchEventType) {
    if (!(evt && evt.cameraParam) || !this.composition) {
      return;
    }

    const options = this.ui.options as spec.DragInteractOption;
    const { position, fov } = evt.cameraParam;
    const dy = event.dy;
    const dx = event.dx * event.width / event.height;
    const depth = position[2];
    const sp = Math.tan(fov * Math.PI / 180 / 2) * Math.abs(depth);
    const height = dy * sp;
    const width = dx * sp;
    let nx = position[0] - width;
    let ny = position[1] - height;

    if (options.dxRange) {
      const [min, max] = options.dxRange;

      nx = clamp(nx, min, max);
      if (nx !== min && nx !== max && min !== max) {
        event.origin?.preventDefault();
      }
    }
    if (options.dyRange) {
      const [min, max] = options.dyRange;

      ny = clamp(ny, min, max);
      if (ny !== min && ny !== max && min !== max) {
        event.origin?.preventDefault();
      }
    }
    this.composition.camera.position = new Vector3(nx, ny, depth);
  }
}

function shouldIgnoreBouncing (arg: TouchEventType, mul?: number) {
  const threshold = 0.00001 * (mul || 1);

  return arg && Math.abs(arg.vx || 0) < threshold && Math.abs(arg.vy || 0) < threshold;
}
