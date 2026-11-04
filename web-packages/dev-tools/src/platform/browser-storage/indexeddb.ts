export function requestResult<T> (request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The asset database request failed.'));
  });
}

export function runTransaction<T> (database: IDBDatabase, names: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(names, mode);
    let result: T, failure: unknown;

    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('The asset database transaction was aborted.'));
    void (async () => {
      try { result = await action(tx); } catch (error) {
        failure = error;
        try { tx.abort(); } catch { reject(error); }
      }
    })();
  });
}
