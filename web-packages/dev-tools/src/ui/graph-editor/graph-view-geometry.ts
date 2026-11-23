import { math } from '@galacean/effects';
import { GraphRect } from './graph-rect';
export class GraphViewGeometry {
  m_viewOffset: math.Vector2 = new math.Vector2();
  m_windowRect: GraphRect = new GraphRect();
  m_canvasVisibleRect: GraphRect = new GraphRect();
  m_mouseScreenPos: math.Vector2 = new math.Vector2();
  m_mouseCanvasPos: math.Vector2 = new math.Vector2();
  m_viewScaleFactor: number = 1.0;
  m_inverseViewScaleFactor: number = 1.0;
  m_isReadOnly: boolean = false;

  // Scaling and Conversion Functions
  CanvasToWindow (vec: math.Vector2): math.Vector2;
  CanvasToWindow (f: number): number;
  CanvasToWindow (arg: math.Vector2 | number): math.Vector2 | number {
    if (typeof arg === 'number') {
      return arg * this.m_viewScaleFactor;
    } else {
      return new math.Vector2(arg.x * this.m_viewScaleFactor, arg.y * this.m_viewScaleFactor);
    }
  }

  WindowToCanvas (vec: math.Vector2): math.Vector2;
  WindowToCanvas (f: number): number;
  WindowToCanvas (arg: math.Vector2 | number): math.Vector2 | number {
    if (typeof arg === 'number') {
      return arg * this.m_inverseViewScaleFactor;
    } else {
      return new math.Vector2(arg.x * this.m_inverseViewScaleFactor, arg.y * this.m_inverseViewScaleFactor);
    }
  }

  WindowToScreenPosition (windowPosition: math.Vector2): math.Vector2 {
    return new math.Vector2(
      windowPosition.x + this.m_windowRect.Min.x,
      windowPosition.y + this.m_windowRect.Min.y,
    );
  }

  WindowToCanvasPosition (windowPosition: math.Vector2): math.Vector2 {
    return new math.Vector2(
      (windowPosition.x * this.m_inverseViewScaleFactor) + this.m_viewOffset.x,
      (windowPosition.y * this.m_inverseViewScaleFactor) + this.m_viewOffset.y,
    );
  }

  CanvasToWindowPosition (canvasPosition: math.Vector2): math.Vector2 {
    return new math.Vector2(
      (canvasPosition.x - this.m_viewOffset.x) * this.m_viewScaleFactor,
      (canvasPosition.y - this.m_viewOffset.y) * this.m_viewScaleFactor,
    );
  }

  CanvasToScreenPosition (canvasPosition: math.Vector2): math.Vector2 {
    const windowPosition = this.CanvasToWindowPosition(canvasPosition);

    return this.WindowToScreenPosition(windowPosition);
  }

  ScreenToWindowPosition (screenPosition: math.Vector2): math.Vector2 {
    return new math.Vector2(
      screenPosition.x - this.m_windowRect.Min.x,
      screenPosition.y - this.m_windowRect.Min.y,
    );
  }

  ScreenToCanvasPosition (screenPosition: math.Vector2): math.Vector2 {
    const windowPosition = this.ScreenToWindowPosition(screenPosition);

    return this.WindowToCanvasPosition(windowPosition);
  }

  CanvasToWindowRect (canvasRect: GraphRect): GraphRect {
    return new GraphRect(
      this.CanvasToWindowPosition(canvasRect.Min),
      this.CanvasToWindowPosition(canvasRect.Max),
    );
  }

  WindowToCanvasRect (windowRect: GraphRect): GraphRect {
    return new GraphRect(
      this.WindowToCanvasPosition(windowRect.Min),
      this.WindowToCanvasPosition(windowRect.Max),
    );
  }

  IsItemVisible (itemCanvasRect: GraphRect): boolean {
    return this.m_canvasVisibleRect.Overlaps(itemCanvasRect);
  }

  SetViewScaleFactor (viewScaleFactor: number): void {
    if (viewScaleFactor === 0) {
      throw new Error('View scale factor cannot be zero');
    }
    this.m_viewScaleFactor = viewScaleFactor;
    this.m_inverseViewScaleFactor = 1.0 / this.m_viewScaleFactor;
  }
}
