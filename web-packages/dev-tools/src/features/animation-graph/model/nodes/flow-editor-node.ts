import type { PoseNodeDebugInfo } from '@galacean/effects';
import { ImGui } from '../../../../platform/imgui/index';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { DrawContext } from '../../../../ui/graph-editor/graph-draw-context';
import type { GraphEditorContext } from '../../../../ui/graph-editor/graph-editor-context';
import { add, subtract } from '../../../../ui/graph-editor/graph-math';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import { beginEditorMenu, editorMenuItem, endEditorMenu } from '../../../../ui/widgets/editor-menu';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import type { AnimationGraphContext } from '../animation-graph-context';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

export const InvalidIndex = -1;

export enum GraphType {
  BlendTree,
  ValueTree,
  TransitionConduit
}

export enum GraphValueType {
  Unknown,
  Bool,
  ID,
  Float,
  Vector,
  Target,
  BoneMask,
  Pose,
  Special
}

export function GetIDForValueType (type: GraphValueType): string {
  const IDs = [
    'Unknown',
    'Bool',
    'ID',
    'Float',
    'Vector',
    'Target',
    'BoneMask',
    'Pose',
    'Special',
  ];

  return IDs[type];
}

export function GetValueTypeForID (ID: string): GraphValueType {
  for (let i = 0; i <= Number(GraphValueType.Special); i++) {
    const gvt = i as GraphValueType;

    if (GetIDForValueType(gvt) === ID) {
      return gvt;
    }
  }

  return GraphValueType.Unknown;
}

const colors: Color[] = [
  new Color(GraphColors.GhostWhite),      // unknown
  new Color(GraphColors.LightPink),       // bool
  new Color(GraphColors.MediumPurple),    // ID
  new Color(GraphColors.LightSteelBlue),  // float
  new Color(GraphColors.SkyBlue),         // vector
  new Color(GraphColors.CornflowerBlue),  // target
  new Color(GraphColors.Thistle),         // bone mask
  new Color(GraphColors.MediumSeaGreen),  // pose
  new Color(GraphColors.White),           // special
];

export function GetColorForValueType (type: GraphValueType): Color {
  return colors[type as number];
}

export function GetNameForValueType (type: GraphValueType): string {
  const names: string[] = [
    'Unknown',
    'Bool',
    'ID',
    'Float',
    'Vector',
    'Target',
    'Bone Mask',
    'Pose',
    'Special',
  ];

  return names[type as number];
}

// Constants
const g_playbackBarMinimumWidth: number = 120;
const g_playbackBarHeight: number = 12;
const g_playbackBarMarkerSize: number = 4;

//-------------------------------------------------------------------------

export function DrawPoseNodeDebugInfo (ctx: NodeGraph.DrawContext, canvasWidth: number, pDebugInfo: PoseNodeDebugInfo | null): void {
  const availableCanvasWidth = Math.max(canvasWidth, g_playbackBarMinimumWidth);
  const playbackBarSize = ctx.CanvasToWindow(new ImVec2(availableCanvasWidth, g_playbackBarHeight));
  const playbackBarTopLeft = ImGui.GetCursorScreenPos();
  const playbackBarBottomRight = add(playbackBarTopLeft, playbackBarSize);

  // Draw spacer
  //-------------------------------------------------------------------------
  ImGui.Dummy(playbackBarSize);

  // Draw Info
  //-------------------------------------------------------------------------
  if (pDebugInfo !== null) {
    const percentageThroughTrack = pDebugInfo.currentTime;
    const pixelOffsetForPercentageThrough = Math.floor(playbackBarSize.x * percentageThroughTrack);

    // Draw events
    // const GetIntervalColor = (intervalIdx: number): Color => {
    //   return Math.IsEven(intervalIdx) ? Colors.White : Colors.DarkGray;
    // };

    // const events = pDebugInfo.m_pSyncTrack.GetEvents();
    // const numEvents = events.length;

    // for (let i = 0; i < numEvents; i++) {
    //   const eventTopLeft = new ImVec2(
    //     Math.round(playbackBarTopLeft.x + playbackBarSize.x * events[i].m_startTime),
    //     playbackBarTopLeft.y
    //   );
    //   const eventBottomRight = new ImVec2(
    //     Math.min(playbackBarBottomRight.x, eventTopLeft.x + Math.round(playbackBarSize.x * events[i].m_duration)),
    //     playbackBarBottomRight.y
    //   );

    //   // Draw start line (and overflow event)
    //   if (i === 0 && events[i].m_startTime !== 0.0) {
    //     const eventBottomLeft = new ImVec2(eventTopLeft.x, eventBottomRight.y);

    //     ctx.m_pDrawList!.AddRectFilled(playbackBarTopLeft, eventBottomLeft, GetIntervalColor(numEvents - 1));
    //     ctx.m_pDrawList!.AddLine(eventTopLeft, eventBottomLeft, Colors.HotPink, 2.0 * ctx.m_viewScaleFactor);
    //   }

    //   // Draw interval
    //   ctx.m_pDrawList!.AddRectFilled(eventTopLeft, eventBottomRight, GetIntervalColor(i));
    // }

    // Draw progress bar
    const progressBarTopLeft = playbackBarTopLeft;
    const progressBarBottomRight = add(playbackBarTopLeft, new ImVec2(pixelOffsetForPercentageThrough, playbackBarSize.y));

    const progressBarColor = new Color(GraphColors.LimeGreen);

    progressBarColor.Value.z *= 0.65;
    ctx.m_pDrawList!.AddRectFilled(progressBarTopLeft, progressBarBottomRight, progressBarColor.toImU32());

    // Draw Marker
    const scaledMarkerSize = ctx.CanvasToWindow(g_playbackBarMarkerSize);
    const t0 = new ImVec2(progressBarTopLeft.x + pixelOffsetForPercentageThrough, playbackBarBottomRight.y);
    const t1 = new ImVec2(t0.x - scaledMarkerSize, playbackBarBottomRight.y + scaledMarkerSize);
    const t2 = new ImVec2(t0.x + scaledMarkerSize, playbackBarBottomRight.y + scaledMarkerSize);

    ctx.m_pDrawList!.AddLine(t0, subtract(t0, new ImVec2(0, playbackBarSize.y)), GraphColors.LimeGreen);
    ctx.m_pDrawList!.AddTriangleFilled(t0, t1, t2, GraphColors.LimeGreen);

    // Draw text info
    ImGui.Text(`Time: ${(pDebugInfo.currentTime * pDebugInfo.duration).toFixed(2)}/${pDebugInfo.duration.toFixed(2)}s`);
    ImGui.Text(`Percent: ${(pDebugInfo.currentTime * 100).toFixed(1)}%`);
    // ImGui.Text(`Event: ${pDebugInfo.m_currentSyncTime.m_eventIdx}, ${(pDebugInfo.m_currentSyncTime.m_percentageThrough.ToFloat() * 100).toFixed(1)}%`);
    // const eventID = pDebugInfo.m_pSyncTrack.GetEventID(pDebugInfo.m_currentSyncTime.m_eventIdx);

    // ImGui.Text(`Event ID: ${eventID.IsValid() ? eventID : 'No ID'}`);
  } else {
    // Draw empty playback visualization bar
    ctx.m_pDrawList!.AddRectFilled(playbackBarTopLeft, add(playbackBarTopLeft, playbackBarSize), GraphColors.DarkGray);

    // Draw text placeholders
    ImGui.Text('Time: N/A');
    ImGui.Text('Percent: N/A');
    // ImGui.Text('Event: N/A');
    // ImGui.Text('Event ID: N/A');
  }
}

export abstract class AnimationGraphNode extends NodeGraph.FlowGraphNode {
  static GetPinTypeForValueType (valueType: GraphValueType): string {
    return GetIDForValueType(valueType);
  }

  static GetValueTypeForPinType (pinType: string): GraphValueType {
    return GetValueTypeForID(pinType);
  }

  constructor () {
    super();
  }

  override GetTitleBarColor (): Color {
    return GetColorForValueType(this.GetOutputValueType());
  }

  override GetPinColor (pin: NodeGraph.Pin): Color {
    return GetColorForValueType(AnimationGraphNode.GetValueTypeForPinType(pin.m_type));
  }

  abstract GetAllowedParentGraphTypes (): Map<GraphType, boolean>;

  IsPersistentNode (): boolean {
    return false;
  }

  Compile (context: AnimationGraphCompilationContext): number {
    return 0;
  }

  IsAnimationClipReferenceNode (): boolean {
    return false;
  }

  GetOutputValueType (): GraphValueType {
    return this.HasOutputPin()
      ? AnimationGraphNode.GetValueTypeForPinType(this.GetOutputPin(0)!.m_type)
      : GraphValueType.Unknown;
  }

  GetLogicAndEventIDs (outIDs: string[]): void {}

  RenameLogicAndEventIDs (oldID: string, newID: string): void {}

  protected override CreateInputPin (pPinName: string, pinType: GraphValueType | string): void {
    if (typeof pinType === 'string') {
      super.CreateInputPin(pPinName, pinType);
    } else {
      super.CreateInputPin(pPinName, AnimationGraphNode.GetPinTypeForValueType(pinType));
    }
  }

  protected override CreateOutputPin (
    pPinName: string,
    pinType: GraphValueType | string,
    allowMultipleOutputConnections: boolean = false
  ): void {
    if (typeof pinType === 'string') {
      super.CreateOutputPin(
        pPinName,
        pinType,
        allowMultipleOutputConnections
      );
    } else {
      super.CreateOutputPin(
        pPinName,
        AnimationGraphNode.GetPinTypeForValueType(pinType),
        allowMultipleOutputConnections
      );
    }
  }

  protected DrawInfoText (ctx: DrawContext): void {}

  override IsActive (pUserContext: GraphEditorContext): boolean {
    const pGraphNodeContext = pUserContext as AnimationGraphContext;

    if (pGraphNodeContext.HasDebugData()) {
      const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID());

      if (runtimeNodeIdx !== InvalidIndex) {
        return pGraphNodeContext.IsNodeActive(runtimeNodeIdx);
      }
    }

    return false;
  }

  override DrawExtraControls (ctx: DrawContext, pUserContext: GraphEditorContext): void {
    const pGraphNodeContext = pUserContext as AnimationGraphContext;

    const isPreviewing = pGraphNodeContext.HasDebugData();
    const runtimeNodeIdx = isPreviewing
      ? pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID())
      : InvalidIndex;
    const isPreviewingAndValidRuntimeNodeIdx = isPreviewing && (runtimeNodeIdx !== InvalidIndex);

    const nodeValueType = this.GetOutputValueType();

    // Runtime Index Info
    // if (pGraphNodeContext.m_showRuntimeIndices && isPreviewingAndValidRuntimeNodeIdx) {
    //   DrawRuntimeNodeIndex(ctx, pGraphNodeContext, this, runtimeNodeIdx);
    // }

    // Draw Pose Node
    if (nodeValueType === GraphValueType.Pose) {
      if (isPreviewingAndValidRuntimeNodeIdx && pGraphNodeContext.IsNodeActive(runtimeNodeIdx)) {
        const debugInfo = pGraphNodeContext.GetPoseNodeDebugInfo(runtimeNodeIdx);

        DrawPoseNodeDebugInfo(ctx, this.GetWidth(), debugInfo);
      } else {
        DrawPoseNodeDebugInfo(ctx, this.GetWidth(), null);
      }

      ImGui.SetCursorPosY(ImGui.GetCursorPosY() + ImGui.GetStyle().ItemSpacing.y);
      this.DrawInfoText(ctx);
    // eslint-disable-next-line brace-style
    }
    // Draw Value Node
    else {
      // this.DrawInfoText(ctx);j

      // if (nodeValueType !== GraphValueType.Unknown &&
      //           nodeValueType !== GraphValueType.BoneMask &&
      //           nodeValueType !== GraphValueType.Special) {
      //   this.DrawInternalSeparator(ctx);
      //   this.BeginDrawInternalRegion(ctx);

      //   if (isPreviewingAndValidRuntimeNodeIdx &&
      //               pGraphNodeContext.IsNodeActive(runtimeNodeIdx) &&
      //               this.HasOutputPin()) {
      //     DrawValueDisplayText(ctx, pGraphNodeContext, runtimeNodeIdx, nodeValueType);
      //   } else {
      //     ImGui.NewLine();
      //   }

      //   this.EndDrawInternalRegion(ctx);
      // }
    }
  }

  override DrawContextMenuOptions (
    ctx: DrawContext,
    pUserContext: GraphEditorContext,
    mouseCanvasPos: ImVec2,
    pPin: NodeGraph.Pin | null
  ): void {
    const pGraphNodeContext = pUserContext as AnimationGraphContext;

    if (pGraphNodeContext.HasDebugData()) {
      if (beginEditorMenu('Runtime Node ID')) {
        const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID());

        if (runtimeNodeIdx !== InvalidIndex) {
          const label = `Runtime Index: ${runtimeNodeIdx}`;

          if (editorMenuItem(label)) {
            ImGui.SetClipboardText(runtimeNodeIdx.toString());
          }
        }
        endEditorMenu();
      }
    }
  }
}

export function DrawValueDisplayText (
  ctx: NodeGraph.DrawContext,
  pGraphNodeContext: AnimationGraphContext,
  runtimeNodeIdx: number,
  valueType: GraphValueType
): void {
  //-------------------------------------------------------------------------

  switch (valueType) {
    case GraphValueType.Bool: {
      const value = pGraphNodeContext.GetNodeValue<boolean>(runtimeNodeIdx);

      ImGui.Text('Value: ');
      ImGui.SameLine();
      ImGui.TextColored(
        value ? new ImGui.ImColor(GraphColors.LimeGreen) : new ImGui.ImColor(GraphColors.IndianRed),
        value ? 'True' : 'False'
      );
    }

      break;
    case GraphValueType.ID: {
      // const value = pGraphNodeContext.GetNodeValue<StringID>(runtimeNodeIdx);

      // if (value.IsValid()) {
      //   ImGui.Text(`Value: ${value.toString()}`);
      // } else {
      //   ImGui.Text('Value: Invalid');
      // }
    }

      break;
    case GraphValueType.Float: {
      const value = pGraphNodeContext.GetNodeValue<number>(runtimeNodeIdx);

      ImGui.Text(`Value: ${value.toFixed(3)}`);
    }

      break;
    case GraphValueType.Vector: {
      // const value = pGraphNodeContext.GetNodeValue<Float3>(runtimeNodeIdx);

      // DrawVectorInfoText(ctx, value);
    }

      break;
    case GraphValueType.Target: {
      // const value = pGraphNodeContext.GetNodeValue<Target>(runtimeNodeIdx);

      // DrawTargetInfoText(ctx, value);
    }

      break;
    default:
      break;
  }
}