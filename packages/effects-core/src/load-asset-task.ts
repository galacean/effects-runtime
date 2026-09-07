import type { Asset } from './asset';
import { Deferred, logger } from './utils';

/**
 * Asset loading task state.
 * @internal
 */
export enum TaskState {
  Created = 'Created',
  Failed = 'Failed',
  Canceled = 'Canceled',
  Queued = 'Queued',
  Running = 'Running',
  Finished = 'Finished',
}

/**
 * Work that prepares an asset before its type-specific load step runs.
 * @internal
 */
export type AssetLoadPrepare = (task: LoadAssetTask) => void | Promise<void>;

/**
 * Error used when an asset loading attempt is superseded or canceled.
 * @internal
 */
export class AssetLoadCanceledError extends Error {
  constructor (asset: Asset) {
    super(`Loading asset '${asset.getInstanceId()}' was canceled.`);
    this.name = 'AssetLoadCanceledError';
  }
}

/**
 * Represents one attempt to load an Asset.
 *
 * The task owns execution and completion. Asset owns the authoritative load
 * state and accepts results only from its current task.
 * @internal
 */
export class LoadAssetTask {
  private readonly deferred = new Deferred<void>();
  private _state = TaskState.Created;
  private _error: Error | undefined;
  private _cancelFlag = false;

  readonly completion = this.deferred.promise;

  constructor (
    readonly asset: Asset,
    private readonly prepare: AssetLoadPrepare,
  ) {
    // Loading is normally started in the background by Content.loadAsync().
    // Keep the original promise rejectable for waitForLoaded(), while avoiding
    // an unhandled rejection when no caller waits for it.
    void this.completion.catch(() => undefined);
  }

  get state (): TaskState {
    return this._state;
  }

  get error (): Error | undefined {
    return this._error;
  }

  get isFinished (): boolean {
    return this._state === TaskState.Finished;
  }

  get isEnded (): boolean {
    return this.isFinished
      || this._state === TaskState.Failed
      || this._state === TaskState.Canceled;
  }

  get isCanceled (): boolean {
    return this._state === TaskState.Canceled;
  }

  get isCancelRequested (): boolean {
    return this._cancelFlag;
  }

  start (): void {
    if (this._state !== TaskState.Created) {
      return;
    }
    this._state = TaskState.Running;

    let execution: void | Promise<void>;

    try {
      execution = this.run();
    } catch (error) {
      this.finishExecution(true, error);

      return;
    }

    if (execution) {
      void execution.then(
        () => this.finishExecution(false),
        error => this.finishExecution(true, error),
      );
    } else {
      this.finishExecution(false);
    }
  }

  cancel (): void {
    if (this.isEnded) {
      return;
    }
    this._cancelFlag = true;

    if (this._state === TaskState.Created) {
      this.finishExecution(false);
    }
  }

  private run (): void | Promise<void> {
    const preparation = this.prepare(this);

    if (preparation) {
      return preparation.then(() => this.runAsset());
    }

    return this.runAsset();
  }

  private runAsset (): void | Promise<void> {
    if (this._state !== TaskState.Running || this._cancelFlag) {
      return;
    }

    return this.asset.onLoad(this);
  }

  private finishExecution (failed: boolean, error?: unknown): void {
    if (this.isEnded) {
      return;
    }

    if (this._cancelFlag || error instanceof AssetLoadCanceledError) {
      this._state = TaskState.Canceled;
      this._error = error instanceof AssetLoadCanceledError
        ? error
        : new AssetLoadCanceledError(this.asset);
    } else if (failed) {
      this._state = TaskState.Failed;
      this._error = error instanceof Error ? error : new Error(String(error));
      this.onFail();
    } else {
      this._state = TaskState.Finished;
    }

    this.onEnd();

    if (this._state === TaskState.Finished) {
      this.deferred.resolve();
    } else {
      this.deferred.reject(this._error);
    }
  }

  private onFail (): void {
    logger.error(`Failed to load asset '${this.asset.getInstanceId()}'.`, this._error);
  }

  private onEnd (): void {
    this.asset.onLoadTaskEnded(this);
  }
}
