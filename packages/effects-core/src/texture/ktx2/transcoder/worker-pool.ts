/**
 * @internal
 * WorkerPool, T is is post message type, U is return type.
 */
export class WorkerPool<T = any, U = any> {
  private taskQueue: TaskItem<T, U>[] = [];
  private workerStatus: number = 0;
  private workerItems: WorkerItem<U>[];

  /**
   * Constructor of WorkerPool.
   * @param limitedCount - worker limit count
   * @param workerCreator - creator of worker
   */
  constructor (
    public readonly limitedCount = 4,
    private readonly workerCreator: () => Worker | Promise<Worker>
  ) {
    this.workerItems = new Array<WorkerItem<U>>(limitedCount);
  }

  prepareWorker () {
    const count = this.limitedCount;
    const promises = new Array<Promise<Worker>>(count);

    for (let i = 0; i < count; i++) {
      promises.push(this.initWorker(i));
    }

    return Promise.all(promises);
  }

  /**
   * Post message to worker.
   * @param message - Message which posted to worker
   * @returns Return a promise of message
   */
  postMessage (message: T): Promise<U> {
    return new Promise((resolve, reject) => {
      const workerId = this.getIdleWorkerId();

      if (workerId !== -1) {
        this.workerStatus |= 1 << workerId;
        const workerItems = this.workerItems;

        Promise.resolve(workerItems[workerId] ?? this.initWorker(workerId))
          .then(() => {
            const workerItem = workerItems[workerId];

            workerItem.resolve = resolve;
            workerItem.reject = reject;
            workerItem.worker.postMessage(message);
          })
          .catch(reject);
      } else {
        this.taskQueue.push({ resolve, reject, message });
      }
    });
  }

  /**
   * Destroy the worker pool.
   */
  destroy (): void {
    const workerItems = this.workerItems;

    for (let i = 0, n = workerItems.length; i < n; i++) {
      const workerItem = workerItems[i];

      workerItem.worker.terminate();
      workerItem.reject = ()=>{};
      workerItem.resolve = ()=>{};
    }
    workerItems.length = 0;
    this.taskQueue.length = 0;
    this.workerStatus = 0;
  }

  private initWorker (workerId: number): Promise<Worker> {
    return Promise.resolve(this.workerCreator()).then(worker => {
      worker.addEventListener('message', this.onMessage.bind(this, workerId));
      this.workerItems[workerId] = { worker, resolve: ()=>{}, reject: ()=>{} };

      return worker;
    });
  }

  private getIdleWorkerId () {
    for (let i = 0, count = this.limitedCount; i < count; i++) {
      if (!(this.workerStatus & (1 << i))) {return i;}
    }

    return -1;
  }

  private onMessage (workerId: number, msg: MessageEvent<U>) {
    // onerror of web worker can't catch error in promise
    const error = (msg.data as ErrorMessageData).error;

    if (error) {
      this.workerItems[workerId].reject(error);
    } else {
      this.workerItems[workerId].resolve(msg.data);
    }
    this.nextTask(workerId);
  }

  private nextTask (workerId: number) {
    if (this.taskQueue.length) {
      const taskItem = this.taskQueue.shift() as TaskItem<T, U>;
      const workerItem = this.workerItems[workerId];

      workerItem.resolve = taskItem.resolve;
      workerItem.reject = taskItem.reject;
      workerItem.worker.postMessage(taskItem.message);
    } else {
      this.workerStatus ^= 1 << workerId;
    }
  }
}

interface ErrorMessageData {
  error: unknown,
}

interface WorkerItem<U> {
  worker: Worker,
  resolve: (item: U | PromiseLike<U>) => void,
  reject: (reason?: any) => void,
}

interface TaskItem<T, U> {
  message: T,
  transfer?: Array<Transferable>,
  resolve: (item: U | PromiseLike<U>) => void,
  reject: (reason?: any) => void,
}
