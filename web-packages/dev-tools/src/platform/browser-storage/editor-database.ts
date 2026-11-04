export type DatabaseUpgrade = (database: IDBDatabase, transaction: IDBTransaction, previousVersion: number, fail: (error: unknown) => void) => void;

export class EditorDatabase {
  private connection?: IDBDatabase;
  private opening?: Promise<IDBDatabase>;

  constructor (readonly name: string, private readonly version: number, private readonly upgrade: DatabaseUpgrade, private readonly onClosed: () => void = () => {}) { }

  open (): Promise<IDBDatabase> {
    if (this.connection) { return Promise.resolve(this.connection); }
    this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      let blocked = false, upgradeError: unknown;

      request.onupgradeneeded = event => {
        const fail = (error: unknown): void => { upgradeError = error; request.transaction!.abort(); };

        try { this.upgrade(request.result, request.transaction!, event.oldVersion, fail); } catch (error) { fail(error); }
      };
      request.onerror = () => reject(upgradeError ?? request.error ?? new Error('Unable to open the asset database.'));
      request.onblocked = () => { blocked = true; reject(new Error('Close older editor tabs to finish updating the asset database.')); };
      request.onsuccess = () => {
        const database = request.result;

        if (blocked) {
          database.close();

          return;
        }
        const closed = (): void => {
          if (this.connection === database) { this.connection = undefined; this.opening = undefined; this.onClosed(); }
        };

        database.onversionchange = () => { database.close(); closed(); };
        database.onclose = closed;
        this.connection = database; resolve(database);
      };
    }).catch(error => { this.opening = undefined; throw error; });

    return this.opening;
  }

  close (): void { this.connection?.close(); this.connection = undefined; this.opening = undefined; }
}
