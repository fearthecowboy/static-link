import { dirname, resolve } from 'path';
import { constants } from 'os';
import * as filesystem from 'fs';

// shallow copy original function implementations before we start tweaking.
const fs = { ...filesystem };

import { readdir, stat, open, close, write, read, readFile, INTSIZE, unixifyPath, select, selectMany, first } from "./common"

interface Index {
  [filepath: string]: filesystem.Stats;
}

/** @internal */
export class StaticVolumeFile {
  private readonly intBuffer = Buffer.alloc(INTSIZE);
  private buf = Buffer.alloc(1024 * 16); // 16k by default.
  /** @internal */ public index: Index = {};
  private readonly fd: number;
  private readonly statData: filesystem.Stats;

  private readBuffer(buffer: Buffer, length?: number): number {
    return fs.readSync(this.fd, buffer, 0, length || buffer.length, null);
  }

  private readInt(): number {
    fs.readSync(this.fd, this.intBuffer, 0, INTSIZE, null);
    return this.intBuffer.readIntBE(0, 6);
  }

  public shutdown() {
    fs.closeSync(this.fd);
    this.index = <Index>{};
  }

  private addParentFolders(name: string): void {
    const parent = dirname(name);
    if (parent && !this.index[parent]) {
      this.index[parent] = {
        ... this.statData,
        isDirectory: () => true,
      }
      return this.addParentFolders(parent);
    }
  }

  readFile(filepath: string, options?: { encoding?: string | null; flag?: string; } | string | null): string | undefined {
    const item = this.index[filepath];

    if (item && item.isFile()) {
      const encoding = options ?
        typeof options === 'string' ? options :
          typeof options === 'object' ? options.encoding || 'utf8' : 'utf8' : 'utf8';

      // realloc if necessary
      if (this.buf.length < item.size) {
        this.buf = Buffer.alloc(item.size);
      }

      // read the content and return a string
      fs.readSync(this.fd, this.buf, 0, item.size, item.ino);
      return this.buf.toString(encoding, 0, item.size);
    }
    return undefined;
  }

  public hash: string;

  public constructor(public sourcePath: string) {

    // clone the original static fs values and set some defaults
    this.statData = {
      ...fs.statSync(sourcePath),
      isDirectory: () => false,
      isSymbolicLink: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFile: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      size: 0,
    };

    // read the index
    this.fd = fs.openSync(sourcePath, 'r');
    // close on process exit.
    let dataOffset = this.readInt();

    // read hash
    let hashSize = this.readInt();
    if (hashSize > this.buf.length) {
      this.buf = Buffer.alloc(hashSize);
    }
    this.readBuffer(this.buf, hashSize);
    this.hash = this.buf.toString('utf8', 0, hashSize);

    do {
      const nameSz = this.readInt();
      if (nameSz == 0) {
        break;
      }
      const dataSz = this.readInt();
      if (nameSz > this.buf.length) {
        this.buf = Buffer.alloc(nameSz);
      }
      this.readBuffer(this.buf, nameSz);
      const name = this.buf.toString('utf8', 0, nameSz);

      // add entry for file into index
      this.index[name] = {
        ... this.statData, // inherit from the filesystem file itself
        ino: dataOffset, // the location in the static fs
        size: dataSz,    // the size of the file
        blocks: 1,       // one block
        blksize: dataSz, // of filesize size.
        isFile: () => true, // it's a file!
      }
      // ensure parent path has a directory entry
      this.addParentFolders(name);
      dataOffset += dataSz;
    } while (true)
  }
}

export class StaticFilesystem {
  private fileSystems: Array<StaticVolumeFile> = [];

  private NewError(code, method, filepath) {
    switch (code) {
      case constants.errno.ENOENT:
        return {
          ... new Error(`ENOENT: no such file or directory, ${method} '${filepath}'`),
          code: 'ENOENT',
          path: filepath,
          errno: constants.errno.ENOENT
        };
      case constants.errno.EISDIR:
        return {
          ... new Error(`EISDIR: illegal operation on a directory, ${method} '${filepath}'`),
          code: 'EISDIR',
          path: filepath,
          errno: constants.errno.EISDIR
        };
    }
    return {
      ... new Error(`UNKNOWN: Error, ${method} '${filepath}'`),
      code: 'UNKNOWN',
      path: filepath,
      errno: -10000
    };
  }

  public shutdown() {
    for (const fsystem of this.fileSystems) {
      fsystem.shutdown();
    }
  }

  public get hashes(): Array<string> {
    return select(this.fileSystems, (p, c, i, a) => c.hash);
  }

  public constructor() {
  }

  public load(sourcePath: string): StaticFilesystem {
    sourcePath = resolve(sourcePath);
    for (let i = 0; i < this.fileSystems.length; i++) {
      if (this.fileSystems[i].sourcePath === sourcePath) {
        // already loaded?
        return this;
      }
    }
    this.fileSystems.push(new StaticVolumeFile(sourcePath));
    return this;
  }

  public get loadedFileSystems(): Array<string> {
    return select(this.fileSystems, (p, c) => c.sourcePath);
  }

  public unload(sourcePath: string): StaticFilesystem {
    sourcePath = resolve(sourcePath);

    for (let i = 0; i < this.fileSystems.length; i++) {
      if (this.fileSystems[i].sourcePath === sourcePath) {
        this.fileSystems[i].shutdown();
        this.fileSystems.splice(i, 1);
      }
    }
    return this;
  }

  public get entries(): Array<string> {
    return selectMany(this.fileSystems, (p, c) => Object.keys(c.index));
  }

  public readFileSync(filepath: string, options?: { encoding?: string | null; flag?: string; } | string | null): string | Buffer {
    const targetPath: string = unixifyPath(filepath);
    return <string>first(this.fileSystems, (fsystem) => fsystem.readFile(targetPath, options), () => { throw this.NewError(constants.errno.ENOENT, "readFileSync", filepath) });
  }

  public realpathSync(filepath: string): string {
    const targetPath: string = unixifyPath(filepath);
    return <string>first(this.fileSystems, (fsystem) => fsystem.index[targetPath] ? targetPath : undefined, () => { throw this.NewError(constants.errno.ENOENT, "realpathSync", filepath) });
  };

  public statSync(filepath: string): filesystem.Stats {
    const targetPath: string = unixifyPath(filepath);
    return <filesystem.Stats>first(this.fileSystems, (fsystem) => fsystem.index[targetPath], () => { throw this.NewError(constants.errno.ENOENT, "statSync", filepath) });
  }
}
