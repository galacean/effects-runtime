export interface AssetStores {
  projectId: string,
  entries: IDBObjectStore,
  payloads: IDBObjectStore,
  preferences: IDBObjectStore,
  workspace: IDBObjectStore,
}
