import type { FrameContext } from '../playable';
import { VFXItem } from '../../../vfx-item';
import type { TrackInstance } from '../track-instance';
import { TransformLayerMixer } from '../transform-layer-mixer';
import { TransformPlayable } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

type TransformMixerGroupState = {
  layerMixer: TransformLayerMixer,
  remaining: number,
};

/**
 * TransformTrack 的 mixer。
 * - 单 track（无 layerMixer）：evaluate 阶段直写 item.transform。
 * - 多 track（有 layerMixer）：提交 contribution，由 layerMixer 合成。
 */
export class TransformMixerPlayable extends TrackMixerPlayable {
  private static mixerGroupMap = new WeakMap<TrackInstance, Map<string, TransformMixerPlayable[]>>();
  private static mixerStateMap = new WeakMap<TrackInstance, Map<string, TransformMixerGroupState>>();

  override evaluate (context: FrameContext): void {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return;
    }
    const transformMixers = this.getTransformMixerGroup(item);
    const groupState = transformMixers.length > 1 ? this.getLayerMixerState(item, transformMixers.length) : undefined;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.clipWeights[i];

      if (!weight || weight <= 0) {
        continue;
      }
      const playable = this.clipPlayables[i];

      if (!(playable instanceof TransformPlayable)) {
        continue;
      }

      if (groupState) {
        // 多 track：提交 delta 贡献，由 layerMixer.flush 合成
        groupState.layerMixer.addContribution(
          item,
          playable.getContribution(groupState.layerMixer.getBasePosition()),
          weight,
        );
      } else {
        // 单 track：当场直写
        playable.applyContribution(item);
      }
    }

    if (groupState) {
      groupState.remaining--;
      if (groupState.remaining === 0) {
        groupState.layerMixer.flush(item);
      }
    }
  }

  private getLayerMixerState (item: VFXItem, groupSize: number): TransformMixerGroupState {
    const rootTrack = this.getRootTrack();
    let itemStateMap = TransformMixerPlayable.mixerStateMap.get(rootTrack);

    if (!itemStateMap) {
      itemStateMap = new Map();
      TransformMixerPlayable.mixerStateMap.set(rootTrack, itemStateMap);
    }
    const itemId = item.getInstanceId();
    let state = itemStateMap.get(itemId);

    if (!state || state.remaining <= 0) {
      state = {
        layerMixer: state?.layerMixer ?? new TransformLayerMixer(),
        remaining: groupSize,
      };
      state.layerMixer.captureBasePose(item);
      state.layerMixer.resetFrame();
      itemStateMap.set(itemId, state);
    }

    return state;
  }

  private getTransformMixerGroup (item: VFXItem): TransformMixerPlayable[] {
    const rootTrack = this.getRootTrack();
    let itemGroupMap = TransformMixerPlayable.mixerGroupMap.get(rootTrack);

    if (!itemGroupMap) {
      itemGroupMap = new Map();
      TransformMixerPlayable.mixerGroupMap.set(rootTrack, itemGroupMap);
    }
    const itemId = item.getInstanceId();
    let transformMixers = itemGroupMap.get(itemId);

    if (!transformMixers) {
      transformMixers = [];
      this.collectTransformMixers(rootTrack, item, transformMixers);
      itemGroupMap.set(itemId, transformMixers);
    }

    return transformMixers;
  }

  private collectTransformMixers (
    track: TrackInstance,
    item: VFXItem,
    transformMixers: TransformMixerPlayable[],
  ): void {
    if (track.boundObject === item && track.mixer instanceof TransformMixerPlayable) {
      transformMixers.push(track.mixer);
    }
    for (const child of track.children) {
      this.collectTransformMixers(child, item, transformMixers);
    }
  }

  private getRootTrack (): TrackInstance {
    let track: TrackInstance = this.trackInstance;

    while (track.parent) {
      track = track.parent;
    }

    return track;
  }
}
