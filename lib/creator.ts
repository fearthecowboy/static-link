import { readdir, stat, open, close, write, read, readFile, INTSIZE, calculateHash } from "./common"


interface FileDefinition {
  size: number;
  filename?: Buffer;
  getBuffer: () => Promise<Buffer>;
}

export class StaticFilesystemCreator {
  private index = new Array<FileDefinition>();
  private hash?: string;
  private hashBuffer!: Buffer;

  public constructor() {

  }

  public async addFolder(sourceFolder: string, targetFolder: string) {
    await this.getFileNames(sourceFolder, targetFolder);
  }

  private get headerLength(): number {
    let size = INTSIZE; // start of data 

    // put hash size in header
    this.hashBuffer = Buffer.from(<string>this.hash, 'utf-8');

    size += INTSIZE;
    size += this.hashBuffer.byteLength;

    for (const each in this.index) {
      size += INTSIZE; // name size
      size += INTSIZE; // data size

      const filenameBuffer = Buffer.from(each, 'utf-8');
      this.index[each].filename = filenameBuffer;
      size += filenameBuffer.byteLength; // name itself.
    }
    size += INTSIZE; // trailing zero.
    return size;
  }

  private intBuffer = Buffer.alloc(INTSIZE);

  private writeInt(fd: number, value: number, position?: number): Promise<number> {
    this.intBuffer.writeIntBE(value, 0, 6);
    return write(fd, this.intBuffer, 0, INTSIZE, position);
  }

  public async write(outputPath: string, hash: string = calculateHash(this.index)): Promise<string> {
    this.hash = hash;
    let dataOffset = this.headerLength;
    const fd = await open(outputPath, "w");
    let headerPosition = await this.writeInt(fd, dataOffset);

    headerPosition += await this.writeInt(fd, this.hashBuffer.byteLength);
    headerPosition += await write(fd, this.hashBuffer, 0, this.hashBuffer.byteLength, headerPosition);

    const all: Array<Promise<any>> = [];

    // start writing out the data
    for (const each in this.index) {
      const entry = this.index[each];
      const position = dataOffset;
      dataOffset += entry.size;
      const buf = await this.index[each].getBuffer();
      await write(fd, buf, 0, buf.length, position);
    }

    // finish writing all the buffers.
    await Promise.all(all);

    // write the header 
    for (const each in this.index) {
      const entry = this.index[each];
      headerPosition += await this.writeInt(fd, (<Buffer>entry.filename).length, headerPosition);
      headerPosition += await this.writeInt(fd, entry.size, headerPosition);
      headerPosition += await write(fd, (<Buffer>entry.filename), 0, (<Buffer>entry.filename).length, headerPosition);
    }

    await close(fd);
    return hash;
  }

  private async getFileNames(sourceFolder: string, targetFolder: string) {
    const files = await readdir(sourceFolder);
    const all = new Array<Promise<void>>();

    for (const file of files) {
      // compute the path names
      const sourcePath = `${sourceFolder}/${file}`;
      const targetPath = `${targetFolder}/${file}`;

      // is this a directory 
      const ss = await stat(sourcePath);
      if (ss.isDirectory()) {
        all.push(this.getFileNames(sourcePath, targetPath));
      } else {
        // it's a file. capture the details.
        this.index[targetPath] = {
          size: ss.size,
          getBuffer: () => readFile(sourcePath)
        }
      };
    }
    // wait for children to finish
    await Promise.all(all);
  }
}