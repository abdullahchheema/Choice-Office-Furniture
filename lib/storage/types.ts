export type StoredObject = {
  /** The storage KEY — this is what goes in the database, never a full URL. */
  path: string;
  /** Resolved at read time from the current driver and project. */
  publicUrl: string;
  bytes: number;
  mimeType: string;
  width?: number;
  height?: number;
};

export type PutArgs = {
  bytes: Buffer;
  mimeType: string;
  path: string;
  cacheControl?: string;
};

/**
 * Storage behind one small interface.
 *
 * Only `path` is persisted, so switching bucket, project or provider is a
 * config change rather than a data migration. `publicUrl` is derived on read.
 */
export interface StorageDriver {
  readonly name: string;
  put(args: PutArgs): Promise<StoredObject>;
  remove(paths: string[]): Promise<void>;
  publicUrl(path: string): string;
}
