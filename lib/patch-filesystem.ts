import { PathLike, Stats, FSWatcher, ReadStream, WriteStream } from 'fs';
import * as fs from 'fs';

// backup original filesystem.
const original_fs = { ...fs };

export interface IFileSystem {
  readFileSync?(path: PathLike | number, options?: { encoding?: null; flag?: string; } | null): Buffer;
  readFileSync?(path: PathLike | number, options: { encoding: string; flag?: string; } | string): string;
  readFileSync?(path: PathLike | number, options?: { encoding?: string | null; flag?: string; } | string | null): string | Buffer;
  realpathSync?(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): string;
  realpathSync?(path: PathLike, options: { encoding: "buffer" } | "buffer"): Buffer;
  realpathSync?(path: PathLike, options?: { encoding?: string | null } | string | null): string | Buffer;
  statSync?(path: PathLike): Stats;

  readdir?(path: PathLike, callback: (err: NodeJS.ErrnoException, files: string[]) => void): void;
  rename?(oldPath: PathLike, newPath: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  renameSync?(oldPath: PathLike, newPath: PathLike): void;
  renameSync?(oldPath: PathLike, newPath: PathLike): void;
  truncate?(path: PathLike, len: number | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;
  truncate?(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  truncateSync?(path: PathLike, len?: number | null): void;
  ftruncate?(fd: number, len: number | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;
  ftruncate?(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;
  ftruncateSync?(fd: number, len?: number | null): void;
  chown?(path: PathLike, uid: number, gid: number, callback: (err: NodeJS.ErrnoException) => void): void;
  chownSync?(path: PathLike, uid: number, gid: number): void;
  fchown?(fd: number, uid: number, gid: number, callback: (err: NodeJS.ErrnoException) => void): void;
  fchownSync?(fd: number, uid: number, gid: number): void;
  lchown?(path: PathLike, uid: number, gid: number, callback: (err: NodeJS.ErrnoException) => void): void;
  lchownSync?(path: PathLike, uid: number, gid: number): void;
  chmod?(path: PathLike, mode: string | number, callback: (err: NodeJS.ErrnoException) => void): void;
  chmodSync?(path: PathLike, mode: string | number): void;
  fchmod?(fd: number, mode: string | number, callback: (err: NodeJS.ErrnoException) => void): void;
  fchmodSync?(fd: number, mode: string | number): void;
  lchmod?(path: PathLike, mode: string | number, callback: (err: NodeJS.ErrnoException) => void): void;
  lchmodSync?(path: PathLike, mode: string | number): void;
  stat?(path: PathLike, callback: (err: NodeJS.ErrnoException, stats: Stats) => void): void;
  fstat?(fd: number, callback: (err: NodeJS.ErrnoException, stats: Stats) => void): void;
  fstatSync?(fd: number): Stats;
  lstat?(path: PathLike, callback: (err: NodeJS.ErrnoException, stats: Stats) => void): void;
  lstatSync?(path: PathLike): Stats;
  link?(existingPath: PathLike, newPath: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  linkSync?(existingPath: PathLike, newPath: PathLike): void;
  symlink?(target: PathLike, path: PathLike, type: string | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;
  symlink?(target: PathLike, path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  symlinkSync?(target: PathLike, path: PathLike, type?: string | null): void;
  readlink?(path: PathLike, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, linkString: string) => void): void;
  readlink?(path: PathLike, options: { encoding: "buffer" } | "buffer", callback: (err: NodeJS.ErrnoException, linkString: Buffer) => void): void;
  readlink?(path: PathLike, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, linkString: string | Buffer) => void): void;
  readlink?(path: PathLike, callback: (err: NodeJS.ErrnoException, linkString: string) => void): void;
  readlinkSync?(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): string;
  readlinkSync?(path: PathLike, options: { encoding: "buffer" } | "buffer"): Buffer;
  readlinkSync?(path: PathLike, options?: { encoding?: string | null } | string | null): string | Buffer;
  realpath?(path: PathLike, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, resolvedPath: string) => void): void;
  realpath?(path: PathLike, options: { encoding: "buffer" } | "buffer", callback: (err: NodeJS.ErrnoException, resolvedPath: Buffer) => void): void;
  realpath?(path: PathLike, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, resolvedPath: string | Buffer) => void): void;
  realpath?(path: PathLike, callback: (err: NodeJS.ErrnoException, resolvedPath: string) => void): void;
  unlink?(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  unlinkSync?(path: PathLike): void;
  rmdir?(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  rmdirSync?(path: PathLike): void;
  mkdir?(path: PathLike, mode: number | string | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;
  mkdir?(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  mkdirSync?(path: PathLike, mode?: number | string | null): void;
  mkdtemp?(prefix: string, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, folder: string) => void): void;
  mkdtemp?(prefix: string, options: "buffer" | { encoding: "buffer" }, callback: (err: NodeJS.ErrnoException, folder: Buffer) => void): void;
  mkdtemp?(prefix: string, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, folder: string | Buffer) => void): void;
  mkdtemp?(prefix: string, callback: (err: NodeJS.ErrnoException, folder: string) => void): void;
  mkdtempSync?(prefix: string, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): string;
  mkdtempSync?(prefix: string, options: { encoding: "buffer" } | "buffer"): Buffer;
  mkdtempSync?(prefix: string, options?: { encoding?: string | null } | string | null): string | Buffer;
  readdir?(path: PathLike, options: { encoding: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, files: string[]) => void): void;
  readdir?(path: PathLike, options: { encoding: "buffer" } | "buffer", callback: (err: NodeJS.ErrnoException, files: Buffer[]) => void): void;
  readdir?(path: PathLike, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, files: Array<string | Buffer>) => void): void;
  readdir?(path: PathLike, callback: (err: NodeJS.ErrnoException, files: string[]) => void): void;
  readdirSync?(path: PathLike, options?: { encoding: BufferEncoding | null } | BufferEncoding | null): string[];
  readdirSync?(path: PathLike, options: { encoding: "buffer" } | "buffer"): Buffer[];
  readdirSync?(path: PathLike, options?: { encoding?: string | null } | string | null): Array<string | Buffer>;
  close?(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;
  closeSync?(fd: number): void;
  open?(path: PathLike, flags: string | number, mode: string | number | undefined | null, callback: (err: NodeJS.ErrnoException, fd: number) => void): void;
  open?(path: PathLike, flags: string | number, callback: (err: NodeJS.ErrnoException, fd: number) => void): void;
  openSync?(path: PathLike, flags: string | number, mode?: string | number | null): number;
  utimes?(path: PathLike, atime: string | number | Date, mtime: string | number | Date, callback: (err: NodeJS.ErrnoException) => void): void;
  utimesSync?(path: PathLike, atime: string | number | Date, mtime: string | number | Date): void;
  futimes?(fd: number, atime: string | number | Date, mtime: string | number | Date, callback: (err: NodeJS.ErrnoException) => void): void;
  futimesSync?(fd: number, atime: string | number | Date, mtime: string | number | Date): void;
  fsync?(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;
  fsyncSync?(fd: number): void;
  write?<TBuffer extends Buffer | Uint8Array>(fd: number, buffer: TBuffer, offset: number | undefined | null, length: number | undefined | null, position: number | undefined | null, callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void): void;
  write?<TBuffer extends Buffer | Uint8Array>(fd: number, buffer: TBuffer, offset: number | undefined | null, length: number | undefined | null, callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void): void;
  write?<TBuffer extends Buffer | Uint8Array>(fd: number, buffer: TBuffer, offset: number | undefined | null, callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void): void;
  write?<TBuffer extends Buffer | Uint8Array>(fd: number, buffer: TBuffer, callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void): void;
  write?(fd: number, string: any, position: number | undefined | null, encoding: string | undefined | null, callback: (err: NodeJS.ErrnoException, written: number, str: string) => void): void;
  write?(fd: number, string: any, position: number | undefined | null, callback: (err: NodeJS.ErrnoException, written: number, str: string) => void): void;
  write?(fd: number, string: any, callback: (err: NodeJS.ErrnoException, written: number, str: string) => void): void;
  writeSync?(fd: number, buffer: Buffer | Uint8Array, offset?: number | null, length?: number | null, position?: number | null): number;
  writeSync?(fd: number, string: any, position?: number | null, encoding?: string | null): number;
  read?<TBuffer extends Buffer | Uint8Array>(fd: number, buffer: TBuffer, offset: number, length: number, position: number | null, callback?: (err: NodeJS.ErrnoException, bytesRead: number, buffer: TBuffer) => void): void;
  readSync?(fd: number, buffer: Buffer | Uint8Array, offset: number, length: number, position: number | null): number;
  readFile?(path: PathLike | number, options: { encoding?: null; flag?: string; } | undefined | null, callback: (err: NodeJS.ErrnoException, data: Buffer) => void): void;
  readFile?(path: PathLike | number, options: { encoding: string; flag?: string; } | string, callback: (err: NodeJS.ErrnoException, data: string) => void): void;
  readFile?(path: PathLike | number, options: { encoding?: string | null; flag?: string; } | string | undefined | null, callback: (err: NodeJS.ErrnoException, data: string | Buffer) => void): void;
  readFile?(path: PathLike | number, callback: (err: NodeJS.ErrnoException, data: Buffer) => void): void;
  writeFile?(path: PathLike | number, data: any, options: { encoding?: string | null; mode?: number | string; flag?: string; } | string | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;
  writeFile?(path: PathLike | number, data: any, callback: (err: NodeJS.ErrnoException) => void): void;
  writeFileSync?(path: PathLike | number, data: any, options?: { encoding?: string | null; mode?: number | string; flag?: string; } | string | null): void;
  appendFile?(file: PathLike | number, data: any, options: { encoding?: string | null, mode?: string | number, flag?: string } | string | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;
  appendFile?(file: PathLike | number, data: any, callback: (err: NodeJS.ErrnoException) => void): void;
  appendFileSync?(file: PathLike | number, data: any, options?: { encoding?: string | null; mode?: number | string; flag?: string; } | string | null): void;
  watchFile?(filename: PathLike, options: { persistent?: boolean; interval?: number; } | undefined, listener: (curr: Stats, prev: Stats) => void): void;
  watchFile?(filename: PathLike, listener: (curr: Stats, prev: Stats) => void): void;
  unwatchFile?(filename: PathLike, listener?: (curr: Stats, prev: Stats) => void): void;
  watch?(filename: PathLike, options: { encoding?: BufferEncoding | null, persistent?: boolean, recursive?: boolean } | BufferEncoding | undefined | null, listener?: (event: string, filename: string) => void): FSWatcher;
  watch?(filename: PathLike, options: { encoding: "buffer", persistent?: boolean, recursive?: boolean } | "buffer", listener?: (event: string, filename: Buffer) => void): FSWatcher;
  watch?(filename: PathLike, options: { encoding?: string | null, persistent?: boolean, recursive?: boolean } | string | null, listener?: (event: string, filename: string | Buffer) => void): FSWatcher;
  watch?(filename: PathLike, listener?: (event: string, filename: string) => any): FSWatcher;
  exists?(path: PathLike, callback: (exists: boolean) => void): void;
  existsSync?(path: PathLike): boolean;
  access?(path: PathLike, mode: number | undefined, callback: (err: NodeJS.ErrnoException) => void): void;
  access?(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
  accessSync?(path: PathLike, mode?: number): void;
  createReadStream?(path: PathLike, options?: string | {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
    end?: number;
  }): ReadStream;
  createWriteStream?(path: PathLike, options?: string | {
    flags?: string;
    defaultEncoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
  }): WriteStream;
  fdatasync?(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;
  fdatasyncSync?(fd: number): void;
}

enum MemberType {
  Constructor,
  Method,
  Property
}

const metadata = {
  StatWatcher: MemberType.Constructor,
  FSWatcher: MemberType.Constructor,
  ReadStream: MemberType.Constructor,
  WriteStream: MemberType.Constructor,
  ReadFileStream: MemberType.Constructor,
  WriteFileStream: MemberType.Constructor,
  Stats: MemberType.Constructor,

  constants: MemberType.Property,
  F_OK: MemberType.Property,
  R_OK: MemberType.Property,
  W_OK: MemberType.Property,
  X_OK: MemberType.Property,
};

export function patchFilesystem(volume: IFileSystem, original: IFileSystem = fs): () => void {

  // create a backup before modification
  const backup = { ...original };

  // iterate over the filesystem and patch members
  for (const member of Object.getOwnPropertyNames(original)) {
    if (typeof volume[member] !== typeof original[member]) {
      continue;
    }
    switch (metadata[member]) {
      case MemberType.Constructor:
        // bind as a constuctor
        original[member] = volume[member].bind(null, volume);
        break;

      case MemberType.Property:
        // overwrite property
        original[member] = volume[member];
        break;

      default:
        // bind as a method
        original[member] = volume[member].bind(volume);
        break
    }
  }

  // return a delegate to undo those changes.
  return () => patchFilesystem(fs, backup);
}
