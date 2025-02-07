import { ImGui } from '../../../imgui/index';
import { ImRect } from './im-rect';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

export enum DrawChannel {
  Background = 1,
  // Empty user channel
  ContentBackground = 3,
  // Empty user channel
  Foreground = 5,

  NumChannels,
}

export class DrawContext {
  m_pDrawList: ImGui.ImDrawList | null = null;
  m_viewOffset: ImVec2 = new ImVec2();
  m_windowRect: ImRect = new ImRect();
  m_canvasVisibleRect: ImRect = new ImRect();
  m_mouseScreenPos: ImVec2 = new ImVec2();
  m_mouseCanvasPos: ImVec2 = new ImVec2();
  m_viewScaleFactor: number = 1.0;
  m_inverseViewScaleFactor: number = 1.0;
  m_isReadOnly: boolean = false;

  currentChannel: number = 0;

  private m_areChannelsSplit: boolean = false;

  // Scaling and Conversion Functions
  CanvasToWindow (vec: ImVec2): ImVec2;
  CanvasToWindow (f: number): number;
  CanvasToWindow (arg: ImVec2 | number): ImVec2 | number {
    if (typeof arg === 'number') {
      return arg * this.m_viewScaleFactor;
    } else {
      return new ImVec2(arg.x * this.m_viewScaleFactor, arg.y * this.m_viewScaleFactor);
    }
  }

  WindowToCanvas (vec: ImVec2): ImVec2;
  WindowToCanvas (f: number): number;
  WindowToCanvas (arg: ImVec2 | number): ImVec2 | number {
    if (typeof arg === 'number') {
      return arg * this.m_inverseViewScaleFactor;
    } else {
      return new ImVec2(arg.x * this.m_inverseViewScaleFactor, arg.y * this.m_inverseViewScaleFactor);
    }
  }

  WindowToScreenPosition (windowPosition: ImVec2): ImVec2 {
    return new ImVec2(
      windowPosition.x + this.m_windowRect.Min.x,
      windowPosition.y + this.m_windowRect.Min.y,
    );
  }

  WindowToCanvasPosition (windowPosition: ImVec2): ImVec2 {
    return new ImVec2(
      (windowPosition.x * this.m_inverseViewScaleFactor) + this.m_viewOffset.x,
      (windowPosition.y * this.m_inverseViewScaleFactor) + this.m_viewOffset.y,
    );
  }

  CanvasToWindowPosition (canvasPosition: ImVec2): ImVec2 {
    return new ImVec2(
      (canvasPosition.x - this.m_viewOffset.x) * this.m_viewScaleFactor,
      (canvasPosition.y - this.m_viewOffset.y) * this.m_viewScaleFactor,
    );
  }

  CanvasToScreenPosition (canvasPosition: ImVec2): ImVec2 {
    const windowPosition = this.CanvasToWindowPosition(canvasPosition);

    return this.WindowToScreenPosition(windowPosition);
  }

  ScreenToWindowPosition (screenPosition: ImVec2): ImVec2 {
    return new ImVec2(
      screenPosition.x - this.m_windowRect.Min.x,
      screenPosition.y - this.m_windowRect.Min.y,
    );
  }

  ScreenToCanvasPosition (screenPosition: ImVec2): ImVec2 {
    const windowPosition = this.ScreenToWindowPosition(screenPosition);

    return this.WindowToCanvasPosition(windowPosition);
  }

  CanvasToWindowRect (canvasRect: ImRect): ImRect {
    return new ImRect(
      this.CanvasToWindowPosition(canvasRect.Min),
      this.CanvasToWindowPosition(canvasRect.Max),
    );
  }

  WindowToCanvasRect (windowRect: ImRect): ImRect {
    return new ImRect(
      this.WindowToCanvasPosition(windowRect.Min),
      this.WindowToCanvasPosition(windowRect.Max),
    );
  }

  IsItemVisible (itemCanvasRect: ImRect): boolean {
    return this.m_canvasVisibleRect.Overlaps(itemCanvasRect);
  }

  SetDrawChannel (channelIndex: number): void {
    this.m_pDrawList?.ChannelsSetCurrent(channelIndex);
    this.currentChannel = channelIndex;
  }

  SplitDrawChannels (): void {
    this.m_pDrawList?.ChannelsSplit(DrawChannel.NumChannels);
    this.m_areChannelsSplit = true;
  }

  MergeDrawChannels (): void {
    this.m_pDrawList?.ChannelsMerge();
    this.m_areChannelsSplit = false;
  }

  SetViewScaleFactor (viewScaleFactor: number): void {
    if (viewScaleFactor === 0) {
      throw new Error('View scale factor cannot be zero');
    }
    this.m_viewScaleFactor = viewScaleFactor;
    this.m_inverseViewScaleFactor = 1.0 / this.m_viewScaleFactor;
  }
}