// @ts-nocheck
import * as NodeGraph from '../../visual-graph';
import { ImGui } from '../../../../imgui/index';
import type { GraphCompilationContext } from '../../node-graph';
import type { DrawContext } from '../../visual-graph/drawing-context';
import type { UserContext } from '../../visual-graph/user-context';
import type { ToolsGraphUserContext } from '../tools-graph-user-context';

type ImVec2 = ImGui.ImVec2;
const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

const InvalidIndex = -1;

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

export abstract class FlowToolsNode extends NodeGraph.FlowNode {
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
    return this.GetColorForValueType(this.GetOutputValueType());
  }

  override GetPinColor (pin: NodeGraph.Pin): Color {
    return this.GetColorForValueType(FlowToolsNode.GetValueTypeForPinType(pin.m_type));
  }

  abstract GetAllowedParentGraphTypes (): TBitFlags<GraphType>;

  IsPersistentNode (): boolean {
    return false;
  }

  Compile (context: GraphCompilationContext): number {
    return 0;
  }

  IsAnimationClipReferenceNode (): boolean {
    return false;
  }

  GetOutputValueType (): GraphValueType {
    return this.HasOutputPin()
      ? FlowToolsNode.GetValueTypeForPinType(this.GetOutputPin(0)!.m_type)
      : GraphValueType.Unknown;
  }

  GetLogicAndEventIDs (outIDs: string[]): void {}

  RenameLogicAndEventIDs (oldID: string, newID: string): void {}

  protected override CreateInputPin (pPinName: string, pinType: GraphValueType | string): void {
    if (typeof pinType === 'string') {
      super.CreateInputPin(pPinName, pinType);
    } else {
      super.CreateInputPin(pPinName, FlowToolsNode.GetPinTypeForValueType(pinType));
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
        FlowToolsNode.GetPinTypeForValueType(pinType),
        allowMultipleOutputConnections
      );
    }
  }

  protected DrawInfoText (ctx: DrawContext): void {}

  override IsActive (pUserContext: UserContext): boolean {
    const pGraphNodeContext = pUserContext as ToolsGraphUserContext;

    if (pGraphNodeContext.HasDebugData()) {
      const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID());

      if (runtimeNodeIdx !== InvalidIndex) {
        return pGraphNodeContext.IsNodeActive(runtimeNodeIdx);
      }
    }

    return false;
  }

  override DrawExtraControls (ctx: DrawContext, pUserContext: UserContext): void {
    const pGraphNodeContext = pUserContext as ToolsGraphUserContext;

    const isPreviewing = pGraphNodeContext.HasDebugData();
    const runtimeNodeIdx = isPreviewing
      ? pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID())
      : InvalidIndex;
    const isPreviewingAndValidRuntimeNodeIdx = isPreviewing && (runtimeNodeIdx !== InvalidIndex);

    const nodeValueType = this.GetOutputValueType();

    // Runtime Index Info
    if (pGraphNodeContext.m_showRuntimeIndices && isPreviewingAndValidRuntimeNodeIdx) {
      DrawRuntimeNodeIndex(ctx, pGraphNodeContext, this, runtimeNodeIdx);
    }

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
      this.DrawInfoText(ctx);

      if (nodeValueType !== GraphValueType.Unknown &&
                nodeValueType !== GraphValueType.BoneMask &&
                nodeValueType !== GraphValueType.Special) {
        this.DrawInternalSeparator(ctx);
        this.BeginDrawInternalRegion(ctx);

        if (isPreviewingAndValidRuntimeNodeIdx &&
                    pGraphNodeContext.IsNodeActive(runtimeNodeIdx) &&
                    this.HasOutputPin()) {
          DrawValueDisplayText(ctx, pGraphNodeContext, runtimeNodeIdx, nodeValueType);
        } else {
          ImGui.NewLine();
        }

        this.EndDrawInternalRegion(ctx);
      }
    }
  }

  override DrawContextMenuOptions (
    ctx: DrawContext,
    pUserContext: UserContext,
    mouseCanvasPos: ImVec2,
    pPin: NodeGraph.Pin | null
  ): void {
    const pGraphNodeContext = pUserContext as ToolsGraphUserContext;

    if (pGraphNodeContext.HasDebugData()) {
      if (ImGui.BeginMenu('Runtime Node ID')) {
        const runtimeNodeIdx = pGraphNodeContext.GetRuntimeGraphNodeIndex(this.GetID());

        if (runtimeNodeIdx !== InvalidIndex) {
          const label = `Runtime Index: ${runtimeNodeIdx}`;

          if (ImGui.MenuItem(label)) {
            ImGui.SetClipboardText(runtimeNodeIdx.toString());
          }
        }
        ImGui.EndMenu();
      }
    }
  }
}