import type { SceneBinding } from '../../components';
import type { TrackAsset } from './track';

/** Resolves bindings on demand, independently of track evaluation lifetimes. */
export class ObjectBindingCache {
  private readonly tracks = new Map<string, TrackAsset>();
  private readonly boundObjects = new Map<string, object>();
  private readonly childBindings = new Map<string, Set<string>>();

  constructor (private sceneBindings: readonly SceneBinding[]) {
  }

  addTrack (track: TrackAsset): void {
    this.tracks.set(track.getInstanceId(), track);
  }

  setBindings (bindings: readonly SceneBinding[]): void {
    this.sceneBindings = bindings;
    this.invalidate();
  }

  findBoundObject (bindingId: string): object | undefined {
    const cached = this.boundObjects.get(bindingId);

    if (cached) {
      return cached;
    }
    this.invalidate(bindingId);
    let object: object | undefined;

    for (const binding of this.sceneBindings) {
      if (binding.key.getInstanceId() === bindingId) {
        object = binding.value;
      }
    }
    const track = this.tracks.get(bindingId);

    if (!object && track?.parent) {
      const parentId = track.parent.getInstanceId();
      const parentObject = this.findBoundObject(parentId);
      let children = this.childBindings.get(parentId);

      if (!children) {
        children = new Set();
        this.childBindings.set(parentId, children);
      }
      children.add(bindingId);
      if (parentObject) {
        object = track.resolveBoundObject(parentObject);
      }
    }
    // Unresolved bindings are retried, so components added later can be found.
    if (object) {
      this.boundObjects.set(bindingId, object);
    }

    return object;
  }

  invalidate (bindingId?: string): void {
    if (bindingId === undefined) {
      this.boundObjects.clear();
      this.childBindings.clear();

      return;
    }
    this.boundObjects.delete(bindingId);
    const children = this.childBindings.get(bindingId);

    this.childBindings.delete(bindingId);
    if (children) {
      for (const child of children) {
        this.invalidate(child);
      }
    }
  }

  clear (): void {
    this.tracks.clear();
    this.invalidate();
  }
}
