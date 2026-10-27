import { openDB, type IDBPDatabase } from "idb";

const STORE = "keyval";

/** The browser's own database (IndexedDB), as a simple read/write by key. */
export class LocalStore {
  private readonly db: Promise<IDBPDatabase>;

  constructor(dbName = "taxisstant") {
    this.db = openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
  }

  async read(key: string): Promise<unknown> {
    return (await this.db).get(STORE, key);
  }

  async write(key: string, value: unknown): Promise<void> {
    await (await this.db).put(STORE, value, key);
  }
}
