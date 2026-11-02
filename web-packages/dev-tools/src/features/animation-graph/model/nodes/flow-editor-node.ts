import type { math } from '@galacean/effects';
import type { PoseNodeDebugInfo } from '@galacean/effects';
import { GraphColors } from '../../../../ui/graph-editor/graph-colors';
import type { GraphViewGeometry } from '../../../../ui/graph-editor/graph-view-geometry';
import type { GraphEditorContext } from '../../../../ui/graph-editor/graph-editor-context';
import { add, subtract } from '../../../../ui/graph-editor/graph-math';
import * as NodeGraph from '../../../../ui/graph-editor/index';
import type { AnimationGraphCompilationContext } from '../../compiler/graph-compilation-context';
import type { AnimationGraphContext } from '../animation-graph-context';

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

const colors: math.Color[] = [
  GraphColors.GhostWhite.clone(),      // unknown
  GraphColors.LightPink.clone(),       // bool
  GraphColors.MediumPurple.clone(),    // ID
  GraphColors.LightSteelBlue.clone(),  // float
  GraphColors.SkyBlue.clone(),         // vector
  GraphColors.CornflowerBlue.clone(),  // target
  GraphColors.Thistle.clone(),         // bone mask
  GraphColors.MediumSeaGreen.clone(),  // pose
  GraphColors.White.clone(),           // special
];

export function GetColorForValueType (type: GraphValueType): math.Color {
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

const g_playbackBarMinimumWidth: number = 120;
const g_playbackBarHeight: number = 12;
const g_playbackBarMarkerSize: number = 4;

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

  override GetTitleBarColor (): math.Color {
    return GetColorForValueType(this.GetOutputValueType());
  }

  override GetPinColor (pin: NodeGraph.Pin): math.Color {
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
}
