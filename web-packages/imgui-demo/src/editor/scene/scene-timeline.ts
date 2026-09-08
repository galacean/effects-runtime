import { CompositionComponent, getEffectsClassName, SerializationHelper, TimelineAsset } from '@galacean/effects';
import type { Constructor, TrackAsset, VFXItem, spec } from '@galacean/effects';
import type { SceneGraph } from './scene-graph';

/** Applies node deletion to editor bindings without changing timeline evaluation. */
export function removeTimelineBindings (scene: SceneGraph, removed: ReadonlySet<VFXItem>): void {
  const removedIds = new Set(Array.from(removed, item => item.getInstanceId()));

  for (const { root } of scene.compositions) {
    for (const item of [root, ...root.getDescendants()]) {
      if (removed.has(item)) {continue;}
      for (const component of item.getComponents(CompositionComponent)) {
        const data = SerializationHelper.serialize(component) as spec.CompositionComponentData;
        const bindings = data.sceneBindings ?? [];
        const deletedBindings = bindings.filter(binding => removedIds.has(binding.value.id));

        if (!deletedBindings.length) {continue;}
        const engine = component.engine;
        const excluded = new Set(deletedBindings.map(binding => binding.key.id));
        const tracks = new Map<string, TrackAsset>();
        const cloneTrack = (track: TrackAsset): TrackAsset | undefined => {
          const Type = track.constructor as Constructor<TrackAsset>;

          // Playback generates extra tracks; rebuilding the instance recreates them.
          if (excluded.has(track.getInstanceId()) || !getEffectsClassName(Type)) {return;}
          const copy = engine.content.createVirtualAsset(Type);
          const record = structuredClone(SerializationHelper.serialize(track)) as spec.TrackAssetData;
          const children = track.getChildTracks().map(cloneTrack).filter((child): child is TrackAsset => !!child);

          record.id = copy.getInstanceId();
          record.children = children.map(child => ({ id: child.getInstanceId() }));
          SerializationHelper.deserialize(record, copy);
          tracks.set(track.getInstanceId(), copy);
          (scene.assets ??= []).push({ asset: copy, collection: 'miscs' });

          return copy;
        };

        if (data.timelineAsset) {
          const original = engine.findObject<TimelineAsset>(data.timelineAsset);
          // Timelines may be shared by composition instances. Edit an owned copy.
          const copy = engine.content.createVirtualAsset(TimelineAsset);
          const record = structuredClone(SerializationHelper.serialize(original)) as spec.TimelineAssetData;

          record.id = copy.getInstanceId();
          record.tracks = original.tracks.map(cloneTrack).filter((track): track is TrackAsset => !!track)
            .map(track => ({ id: track.getInstanceId() }));
          SerializationHelper.deserialize(record, copy);
          (scene.assets ??= []).push({ asset: copy, collection: 'miscs' });
          data.timelineAsset = { id: copy.getInstanceId() };
        }
        data.sceneBindings = bindings.filter(binding => !removedIds.has(binding.value.id) && tracks.has(binding.key.id))
          .map(binding => ({ key: { id: tracks.get(binding.key.id)!.getInstanceId() }, value: binding.value }));
        // fromData invalidates only this component's cached TimelineInstance.
        SerializationHelper.deserialize(data, component);
      }
    }
  }
}
