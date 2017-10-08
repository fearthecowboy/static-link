import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as assert from "assert";
import * as os from 'os'
import * as fs from 'fs'

import { StaticFilesystemCreator, StaticFilesystem, calculateHash } from "../main"

@suite class CreateStaticFile {

  dirR(path: string, result = new Array<string>()) {
    for (const each of fs.readdirSync(path)) {
      if (fs.statSync(`${path}/${each}`).isDirectory()) {
        this.dirR(`${path}/${each}`, result)
      } else {
        result.push(`${path}/${each}`)
      }
    }
    return result;
  }

  @test async "Does testing work"() {
    assert.equal(true, true, "Basic Test Example");
  }

  @test async "create fs"() {
    const sf = new StaticFilesystemCreator();
    const hash = calculateHash("this is a test ");
    await sf.addFolder("./node_modules", "/node_modules");
    await sf.write(`${__dirname}/output.fs`, hash);

    const fsf = new StaticFilesystem();
    fsf.load(`${__dirname}/output.fs`);
    let count = 0;

    assert.equal(fsf.hashes[0], hash, "Hashes equal");

    // count the files in node_modules
    const files = this.dirR("./node_modules");
    for (const each of fsf.entries) {
      if (fsf.statSync(each).isFile()) {
        const content = fsf.readFileSync(each);
        const original = fs.readFileSync(`.${each}`);
        assert.equal(content, original, `Matching ${each}`);
        count++;
      }
    }

    // did we get the same number of files?
    assert.equal(count, files.length);
  }
}