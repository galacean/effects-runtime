/**
 * @internal
 * WorkerPool, T 为发送消息的类型，U 为返回值的类型。
 */
export class WorkerPool<T = any, U = any> {
  private taskQueue: TaskItem<T, U>[] = [];
  private workerStatus: number = 0;
  private workerItems: WorkerItem<U>[];
  private initPromises: Map<number, Promise<Worker>> = new Map();
  private destroyed = false;

  /**
   * WorkerPool 的构造函数。
   * @param limitedCount - worker数量上限
   * @param workerCreator - worker创建器
   */
  constructor (
    public readonly limitedCount = 2,
    private readonly workerCreator: () => Worker | Promise<Worker>,
  ) {
    if (limitedCount > 8 || limitedCount < 1) {
      throw new Error('limitedCount must be between 1 and 8');
    }
    this.workerItems = new Array<WorkerItem<U>>(limitedCount);
  }

  prepareWorker () {
    const count = this.limitedCount;
    const promises = new Array<Promise<Worker>>(count);

    for (let i = 0; i < count; i++) {
      promises.push(this.ensureWorker(i));
    }

    return Promise.all(promises);
  }

  private ensureWorker (workerId: number): Promise<Worker> {
    if (!this.initPromises.has(workerId)) {
      this.initPromises.set(workerId, this.initWorker(workerId));
    }

    return this.initPromises.get(workerId)!;
  }

  /**
   * 向 worker 发送消息。
   * @param message - 要发送给 worker 的消息
   * @returns 返回一个消息处理结果的 Promise
   */
  postMessage (message: T): Promise<U> {
    if (this.destroyed) {
      return Promise.reject(new Error('Worker Pool destroyed'));
    }

    return new Promise((resolve, reject) => {
      const workerId = this.getIdleWorkerId();

      if (workerId !== -1) {
        this.ensureWorker(workerId)
          .then(() => {
            if (this.destroyed) {
              throw new Error('Worker Pool destroyed');
            }
            const workerItem = this.workerItems[workerId];

            workerItem.resolve = resolve;
            workerItem.reject = reject;
            workerItem.worker.postMessage(message);
          })
          .catch(error => {
            this.workerStatus &= ~(1 << workerId);
            this.initPromises.delete(workerId);
            reject(error);
          });
      } else {
        this.taskQueue.push({ resolve, reject, message });
      }
    });
  }

  private initWorker (workerId: number): Promise<Worker> {
    return Promise.resolve(this.workerCreator()).then(worker => {
      if (this.destroyed) {
        worker.terminate();
        throw new Error('Worker Pool destroyed');
      }

      const onMessage = this.onMessage.bind(this, workerId);
      const onError = (event: ErrorEvent) => {
        const workerItem = this.workerItems[workerId];

        if (workerItem) {
          workerItem.reject(event.error || new Error(event.message || 'Worker error'));
          this.nextTask(workerId);
        }
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);

      this.workerItems[workerId] = {
        worker,
        resolve: () => { },
        reject: () => { },
        onMessage,
        onError,
      };

      return worker;
    });
  }

  /**
   * 获取空闲的 worker ID，并原子性地标记为忙碌
   * @returns worker ID，如果没有空闲 worker 返回 -1
   */
  private getIdleWorkerId () {
    for (let i = 0, count = this.limitedCount; i < count; i++) {
      if (!(this.workerStatus & (1 << i))) {
        this.workerStatus |= 1 << i;  // ✅ 原子性标记

        return i;
      }
    }

    return -1;
  }

  private onMessage (workerId: number, msg: MessageEvent<U>) {
    const workerItem = this.workerItems[workerId];

    if (!workerItem) {
      return;
    }

    const error = (msg.data as ErrorMessageData).error;

    if (error) {
      workerItem.reject(error);
    } else {
      workerItem.resolve(msg.data);
    }

    this.nextTask(workerId);
  }

  private nextTask (workerId: number) {
    if (this.taskQueue.length) {
      const taskItem = this.taskQueue.shift() as TaskItem<T, U>;
      const workerItem = this.workerItems[workerId];

      if (!workerItem) {
        taskItem.reject(new Error('Worker not initialized'));
        this.workerStatus &= ~(1 << workerId);

        return;
      }

      workerItem.resolve = taskItem.resolve;
      workerItem.reject = taskItem.reject;
      workerItem.worker.postMessage(taskItem.message);
    } else {
      this.workerStatus &= ~(1 << workerId);
    }
  }

  destroy (): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    const workerItems = this.workerItems;
    const error = new Error('Worker Pool destroyed');

    for (let i = 0, n = workerItems.length; i < n; i++) {
      const workerItem = workerItems[i];

      if (!workerItem) { continue; }

      if (workerItem.onMessage) {
        workerItem.worker.removeEventListener('message', workerItem.onMessage);
      }
      if (workerItem.onError) {
        workerItem.worker.removeEventListener('error', workerItem.onError);
      }

      workerItem.worker.terminate();
      workerItem.reject?.(error);
    }

    while (this.taskQueue.length) {
      this.taskQueue.shift()?.reject(error);
    }

    workerItems.length = 0;
    this.taskQueue.length = 0;
    this.workerStatus = 0;
    this.initPromises.clear();
  }
}

interface ErrorMessageData {
  error: unknown,
}

interface WorkerItem<U> {
  worker: Worker,
  resolve: (item: U | PromiseLike<U>) => void,
  reject: (reason?: any) => void,
  onMessage?: (msg: MessageEvent<U>) => void,
  onError?: (event: ErrorEvent) => void,
}

interface TaskItem<T, U> {
  message: T,
  resolve: (item: U | PromiseLike<U>) => void,
  reject: (reason?: any) => void,
}
