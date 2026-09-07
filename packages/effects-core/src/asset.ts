import { EffectsObject } from './effects-object';
import type { EventEmitterListener, EventEmitterOptions } from './events';
import { EventEmitter } from './events';
import {
  AssetLoadCanceledError, type AssetLoadPrepare, LoadAssetTask, TaskState,
} from './load-asset-task';
import { logger } from './utils';

enum LoadState {
  Unloaded = 'Unloaded',
  Loaded = 'Loaded',
  LoadFailed = 'LoadFailed',
}

export type AssetEvent = {
  loaded: [asset: Asset],
};

export class Asset extends EffectsObject {
  private _loadState = LoadState.Unloaded;
  private _loadError: Error | undefined;
  private loadingTask: LoadAssetTask | undefined;
  private readonly eventEmitter = new EventEmitter<AssetEvent>();

  get loadError (): Error | undefined {
    return this._loadError;
  }

  get isLoaded (): boolean {
    return this._loadState === LoadState.Loaded;
  }

  get isLoadFailed (): boolean {
    return this._loadState === LoadState.LoadFailed;
  }

  waitForLoaded (): Promise<void> {
    if (this._loadState === LoadState.Loaded) {
      return Promise.resolve();
    }
    if (this._loadState === LoadState.LoadFailed) {
      return Promise.reject(this._loadError);
    }
    if (this.loadingTask) {
      return this.loadingTask.completion;
    }

    return Promise.reject(new Error(`Asset '${this.getInstanceId()}' has no loading task.`));
  }

  /**
   * Listen for Asset lifecycle events.
   */
  on<E extends keyof AssetEvent> (
    eventName: E,
    listener: EventEmitterListener<AssetEvent[E]>,
    options?: EventEmitterOptions,
  ): () => void {
    return this.eventEmitter.on(eventName, listener, options);
  }

  /**
   * Stop listening for an Asset lifecycle event.
   */
  off<E extends keyof AssetEvent> (
    eventName: E,
    listener: EventEmitterListener<AssetEvent[E]>,
  ): void {
    this.eventEmitter.off(eventName, listener);
  }

  /**
   * Listen for an Asset lifecycle event once.
   */
  once<E extends keyof AssetEvent> (
    eventName: E,
    listener: EventEmitterListener<AssetEvent[E]>,
  ): void {
    this.eventEmitter.once(eventName, listener);
  }

  /**
   * Runs after deserialization and before this asset becomes Loaded. Asset
   * types override this only when their own initialization requires more work
   * or a hard dependency to be fully loaded.
   */
  protected loadAsset (): void | Promise<void> {
  }

  /**
   * Creates the task used for one asset loading attempt.
   * @internal
   */
  protected createLoadingTask (prepare: AssetLoadPrepare): LoadAssetTask {
    return new LoadAssetTask(this, prepare);
  }

  /** @internal */
  onLoad (task: LoadAssetTask): void | Promise<void> {
    if (this.loadingTask !== task || task.isCancelRequested) {
      throw new AssetLoadCanceledError(this);
    }

    const loading = this.loadAsset();
    const complete = () => {
      if (this.loadingTask !== task || task.isCancelRequested) {
        throw new AssetLoadCanceledError(this);
      }

      this._loadState = LoadState.Loaded;
      this._loadError = undefined;
      this.loadingTask = undefined;
      this.onLoaded();
    };

    if (!loading) {
      complete();

      return;
    }

    return loading.then(complete);
  }

  /** @internal */
  onLoadTaskEnded (task: LoadAssetTask): void {
    if (this.loadingTask !== task) {
      return;
    }
    this.loadingTask = undefined;

    if (task.state === TaskState.Failed) {
      this._loadState = LoadState.LoadFailed;
      this._loadError = task.error;

      return;
    }
    if (task.state === TaskState.Canceled) {
      this._loadState = LoadState.Unloaded;
      this._loadError = undefined;
    }
  }

  /** @internal */
  startLoading (prepare: AssetLoadPrepare): void {
    if (this.loadingTask && !this.loadingTask.isEnded) {
      throw new Error(`Asset '${this.getInstanceId()}' is already loading.`);
    }

    const task = this.createLoadingTask(prepare);

    this.loadingTask = task;
    this._loadState = LoadState.Unloaded;
    this._loadError = undefined;
    task.start();
  }

  /** @internal */
  initAsVirtual (): void {
    if (this.loadingTask && !this.loadingTask.isEnded) {
      throw new Error(`Cannot initialize loading asset '${this.getInstanceId()}' as virtual.`);
    }
    this.loadingTask = undefined;
    this._loadState = LoadState.Loaded;
    this._loadError = undefined;
  }

  private onLoaded (): void {
    try {
      this.eventEmitter.emit('loaded', this);
    } catch (error) {
      logger.error(`Asset '${this.getInstanceId()}' loaded event failed.`, error);
    }
  }

  override dispose (): void {
    const task = this.loadingTask;

    this.loadingTask = undefined;
    task?.cancel();
    this.engine.content?.removeAssetFromPool(this);
    super.dispose();
  }
}

export class DataAsset<T> extends Asset {
  data: T;
}
