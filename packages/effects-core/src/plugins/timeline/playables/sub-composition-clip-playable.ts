import type { CompositionComponent } from '../../../components';
import { UpdateModes } from '../../../components';
import type { FrameContext } from '../playable';
import { ClipPlayable } from '../playable';
import type { CacheDataManager } from '../cache-data-manager';

interface SubCompositionEvaluationState {
  component?: CompositionComponent,
}

export class SubCompositionClipPlayable extends ClipPlayable {
  override evaluate (boundObject: CompositionComponent | undefined, context: FrameContext, cache: CacheDataManager): void {
    this.updateBinding(boundObject, cache);
    if (boundObject) {
      boundObject.updateMode = UpdateModes.Manual;
      boundObject.sampleTime(context.time);
    }
  }

  override onEndEvaluation (cache: CacheDataManager): void {
    this.updateBinding(undefined, cache);
  }

  private updateBinding (component: CompositionComponent | undefined, cache: CacheDataManager): void {
    const state = cache.getOrAddClipData<SubCompositionEvaluationState>(() => ({}));

    if (state.component === component) {
      return;
    }
    const previous = state.component;

    state.component = component;
    previous?.finishEvaluation();
  }
}
