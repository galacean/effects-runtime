import type { Composition } from '@galacean/effects';
import { FrameComponent, ShapeComponent, TextComponent, VFXItem, math, spec } from '@galacean/effects';
import {
  GizmoViewportUtils, ItemCreateType, createInteractionPlane, projectPoint, shapeConfig, toColor, viewPositionToWorld,
} from '@galacean/effects-plugin-editor-gizmo';
import type {
  Editor2D, GeometryGizmoHost, GizmoActionLifecycleEvent, GizmoItemCreateActionEvent, GizmoPlacementChangeEvent, PenPathData, ShapeDrawingActionEvent,
} from '@galacean/effects-plugin-editor-gizmo';
import { SceneItemOperations } from '../operations/scene-item-operations';
import { attachPreservingWorld, editSceneStructure } from '../operations/scene-structure-edit';
import { applyShapeComponentData, readShapeComponentData } from '../serialization/shape-component-data';
import { jsonData } from '../serialization/scene-values';
import { sceneWorkspace } from '../scene-workspace';

/** Adapts the shared drawing gizmos to scene coordinates, authored data and history. */
export class SceneGeometryTools implements GeometryGizmoHost {
  readonly appendSubpaths = true;
  private readonly releases: (() => void)[];
  private pending: (() => void)[] = [];
  private flushing = false;
  private placements: GizmoPlacementChangeEvent[] = [];
  private framesKey = '';

  constructor (
    private readonly composition: Composition,
    private readonly handler: Editor2D,
    private readonly created: (kind: 'shape' | 'pen' | 'text' | 'frame', continueCreate: boolean, finish?: boolean) => void,
  ) {
    this.releases = [
      handler.on('actionstart', this.onAction), handler.on('actionupdate', this.onAction), handler.on('actioncommit', this.onCommit),
      handler.on('placementchange', event => { if (this.canEdit()) { this.placements.push(event); } }),
      handler.on('framerefreshchildren', () => this.syncFrames()),
    ];
  }

  canEdit (itemId?: string): boolean {
    const document = sceneWorkspace.current;

    return document?.composition === this.composition && !document.restoring && !sceneWorkspace.busy
      && (!itemId || !!this.item(itemId)?.getComponent(ShapeComponent));
  }

  contextKey (): unknown { return sceneWorkspace.current; }

  readPath () {
    const items = this.handler.getSelection().getSelectedPlayerItems();
    const item = items.length === 1 ? items[0] : undefined;
    const component = item?.getComponent(ShapeComponent);

    if (!item || component?.shape.type !== spec.ShapePrimitiveType.Custom) { return; }
    const { points, easingIns, easingOuts, shapes } = readShapeComponentData(component);

    return { itemId: item.getInstanceId(), kind: 'custom' as const, path: jsonData({ points, easingIns, easingOuts, shapes }) as PenPathData };
  }

  viewToLocal (point: math.Vector2, itemId?: string): math.Vector2 | undefined {
    const item = this.item(itemId);

    if (!item || Math.abs(item.transform.getWorldMatrix().determinant()) < 1e-10) { return; }
    const plane = createInteractionPlane(item.transform.getWorldPosition(), item.transform.getWorldRotation());
    const world = viewPositionToWorld(point, GizmoViewportUtils.getCameraInfo(this.composition.engine), plane, this.size());

    return world?.applyMatrix(item.transform.getWorldMatrix().clone().invert()).toVector2();
  }

  localToView (point: { x: number, y: number }, itemId?: string): math.Vector2 {
    const item = this.item(itemId) ?? this.composition.sceneRoot;
    const world = new math.Vector3(point.x, point.y, 0).applyMatrix(item.transform.getWorldMatrix());

    return projectPoint(world, item, this.size());
  }

  syncFrames (): void {
    if (this.handler.isMouseButtonPressed()) { return; }
    const manager = this.handler.getFrameManager();
    const frames = this.composition.items.filter(item => item.getComponent(FrameComponent));
    const key = frames.map(item => item.getInstanceId() + ':' + item.children.map(child => child.getInstanceId()).join(',')).join(';');

    if (key === this.framesKey) { return; }
    this.framesKey = key;
    const ids = new Set(frames.map(item => item.getInstanceId()));

    for (const frame of manager.getFrames()) { if (!ids.has(frame.id)) { manager.deleteFrame(frame.id); } }
    for (const frame of frames) {
      const id = frame.getInstanceId();

      manager.ensureFrame({ id }); manager.setChildren(id, frame.children.map(child => child.getInstanceId()));
    }
    manager.updateViewBoxes();
  }

  discardPlacements (): void { this.placements = []; }

  /** Structural creation runs after input dispatch, when selection may safely rebuild the gizmo graph. */
  flush (): void {
    if (this.flushing || this.handler.isMouseButtonPressed()) { return; }
    const pending = this.pending;

    this.pending = []; this.flushing = true;
    try { this.applyPlacements(); pending.forEach(action => action()); this.syncFrames(); } catch (error) { sceneWorkspace.report(error); } finally { this.flushing = false; }
  }

  dispose (): void { this.releases.forEach(release => release()); this.pending = []; this.placements = []; }

  private applyPlacements (): void {
    const events = this.placements;
    const document = sceneWorkspace.current;

    this.placements = [];
    if (!events.length || document?.composition !== this.composition) { return; }
    editSceneStructure(document, 'Move selection', () => {
      for (const event of events) {
        const target = event.type === 'moveIn' ? this.item(event.targetFrameId)
          : event.type === 'moveOut' ? this.item(event.originalFrameId)?.parent
            : this.item(event.originalFrameId) ?? this.item(event.groupId)?.parent;

        if (!target) { continue; }
        for (const id of event.itemIds) {
          const item = this.item(id);

          if (item && item !== target && !VFXItem.isAncestor(item, target)) { attachPreservingWorld(item, target); }
        }
      }
    }, true);
  }

  private item (id?: string): VFXItem | undefined {
    return id ? this.composition.items.find(item => item.getInstanceId() === id) : this.composition.sceneRoot;
  }

  private size (): math.Vector2 { return GizmoViewportUtils.getContainerSize(this.composition.engine.canvas.parentElement!); }

  private readonly onAction = (event: GizmoActionLifecycleEvent): void => {
    if (this.flushing || !this.canEdit()) { return; }
    if ('sessionId' in event) { this.geometryAction(event); }
  };

  private readonly onCommit = (event: GizmoActionLifecycleEvent): void => {
    this.onAction(event);
    if (this.flushing || !this.canEdit()) { return; }
    if ('createInfo' in event && event.source.type === 'item-create') {
      // Item-create previews have no scene objects; only a completed gesture creates content.
      const action = event;

      if (!action.canceled) {
        const document = sceneWorkspace.current;

        this.pending.push(() => { if (document === sceneWorkspace.current) { this.createItem(action); } });
      }
    }
  };

  private geometryAction (event: ShapeDrawingActionEvent): void {
    const document = sceneWorkspace.current!;

    if (event.edit) {
      const component = this.item(event.edit.itemId)?.getComponent(ShapeComponent);

      if (!component) { return; }
      if (event.phase === 'start') { document.begin('Edit path'); document.setScopeActive(this, true); }
      if (event.phase !== 'start') {
        document.observe('Edit path', () => {
          applyShapeComponentData(component, { ...readShapeComponentData(component), ...(event.canceled ? event.edit!.before : event.edit!.path) });
          component.onUpdate(0);
        }, [component]);
      }
      if (event.phase === 'cancel') { document.cancel(); }
      if (event.phase === 'commit' || event.phase === 'cancel') { document.setScopeActive(this, false); }
    } else if (event.phase === 'commit' && !event.canceled && event.create) {
      this.pending.push(() => { if (document === sceneWorkspace.current) { this.createGeometry(event); } });
    }
  }

  private createGeometry (event: ShapeDrawingActionEvent): void {
    const create = event.create!;
    const config = this.handler.getConfigManager().get(shapeConfig);
    const rgba = (value: number) => {
      const { r, g, b, a } = toColor(value);

      return { r, g, b, a };
    };

    const labels = { rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star' };

    new SceneItemOperations(sceneWorkspace.current!).create({ type: spec.ItemType.shape, label: create.kind === 'pen' ? 'Path' : labels[create.geometry.shapeType] }, undefined, item => {
      const component = item.getComponent(ShapeComponent);
      const base = readShapeComponentData(component);
      let geometry: Record<string, unknown>;

      if (create.kind === 'pen') {
        geometry = { type: spec.ShapePrimitiveType.Custom, ...create.path };
      } else {
        const { center, width, height, shapeType } = create.geometry;
        const types = { rect: spec.ShapePrimitiveType.Rectangle, ellipse: spec.ShapePrimitiveType.Ellipse,
          polygon: spec.ShapePrimitiveType.Polygon, star: spec.ShapePrimitiveType.Star };

        item.transform.setPosition(center.x, center.y, 0);
        geometry = { type: types[shapeType], width, height, xRadius: width / 2, yRadius: height / 2, roundness: config.rectangleRoundness,
          pointCount: shapeType === 'star' ? config.starPointCount : config.polygonPointCount,
          radius: width / 2, outerRadius: width / 2, innerRadius: width / 2 * config.starInnerRadius / config.starOuterRadius,
          outerRoundness: config.starOuterRoundness, innerRoundness: config.starInnerRoundness };
      }
      applyShapeComponentData(component, { ...base, ...geometry,
        fills: create.kind === 'pen' && create.path.shapes.every(shape => !shape.close) ? [] : [{ type: spec.FillType.Solid, color: rgba(config.initialFillColor) }],
        strokes: [{ type: spec.FillType.Solid, color: rgba(config.initialStrokeColor) }],
        strokeWidth: create.kind === 'pen' ? Math.max(config.initialStrokeWidth, .02) : config.initialStrokeWidth,
        strokeCap: config.initialStrokeCap, strokeJoin: config.initialStrokeJoin,
      });
      component.onUpdate(0);
    });
    this.created(create.kind, !!event.continueCreate, event.finish !== false);
  }

  private pixelToLocal (point: [number, number]): math.Vector2 | undefined {
    const engine = this.composition.engine, size = this.size(), scale = GizmoViewportUtils.getViewScale(engine);
    const translation = GizmoViewportUtils.getViewportTranslation(engine);

    return this.viewToLocal(new math.Vector2((point[0] - size.x / 2) * scale + size.x * (1 + translation.x) / 2,
      (point[1] - size.y / 2) * scale + size.y * (1 - translation.y) / 2));
  }

  private createItem (event: GizmoItemCreateActionEvent): void {
    const info = event.createInfo;

    if (info.type !== ItemCreateType.TEXT && info.type !== ItemCreateType.FRAME) { return; }
    const position = this.pixelToLocal(info.position);

    if (!position) { return; }
    const frame = info.type === ItemCreateType.FRAME;
    const pixels = frame ? info.info.size : [info.info?.width ?? 200, 50];
    const edge = this.pixelToLocal([info.position[0] + pixels[0], info.position[1] + pixels[1]]);

    if (!edge) { return; }
    const size = edge.subtract(position).abs();

    new SceneItemOperations(sceneWorkspace.current!).create({ type: frame ? spec.ItemType.null : spec.ItemType.text, label: frame ? 'Frame' : 'Text' }, undefined, item => {
      item.transform.setPosition(position.x, position.y, 0);
      item.transform.size.set(size.x, size.y);
      if (frame) {
        const component = item.addComponent(FrameComponent);

        component.definition.dataType = 'FrameComponent' as spec.DataType;
        if (info.type === ItemCreateType.FRAME) {
          info.info.children.map(id => this.item(id)).filter((child): child is VFXItem => !!child && child !== item)
            .filter(child => !child.parent || !info.info.children.includes(child.parent.getInstanceId()))
            .forEach(child => attachPreservingWorld(child, item));
        }
      } else {
        const component = item.getComponent(TextComponent);

        component.setText('Text');
        component.onUpdate(0);
        const pixelsPerUnit = component.textLayout.width / item.transform.size.x;
        const fontScale = size.y / pixels[1] * pixelsPerUnit;

        component.setFontSize(component.textStyle.fontSize * fontScale);
        component.setLineHeight(component.textLayout.lineHeight * fontScale);
        component.setTextWidth(size.x * pixelsPerUnit);
        component.setTextHeight(size.y * pixelsPerUnit);
        component.onUpdate(0);
      }
    });
    this.created(frame ? 'frame' : 'text', false);
  }
}
