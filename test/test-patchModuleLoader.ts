import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as assert from "assert";
import * as os from 'os'
import * as fs from 'fs'

import { patchModuleLoader, IReadOnlySynchronousFileSystem, StaticFilesystem } from "../main"

@suite class PatchModuleLoader {
  @test async "Ensure that you can't use require on a false file"() {
    assert.throws(() => require("/foo/bar"));
  }


  @test async "Does patchModuleLoader work"() {
    const undo = patchModuleLoader({
      readFileSync: (path: string, options?: { encoding?: string | null; flag?: string; } | string | null): string | Buffer => {
        if (path === '/foo/bar.js' || path === '/foo/nobar.js') {
          return "module.exports = 100";
        }
        throw new Error();
      },
      realpathSync: (path: string, options?: { encoding?: string | null } | string | null): string => {
        return path;
      },
      statSync: (path: string): fs.Stats => {
        if (path === '/foo/bar.js' || path === '/foo/nobar.js') {
          return <fs.Stats><any>{
            ...fs.statSync(__filename),

            isFile: () => false,
            isDirectory: () => false,

            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isSymbolicLink: () => false,
            isFIFO: () => false,
            isSocket: () => false
          }
        }
        throw new Error();

      }
    }, true);

    // have to use a different file here because caching
    const value = require("/foo/nobar");
    undo();

    assert.equal(value, 100, "Able to do simple patchModuleLoader");

    // have to use a different file here because caching
    assert.throws(() => require("/foo/bar"));
  }

  @test async "Ensure that you can't use require on a false file after last test"() {
    // have to use a different file here because caching
    assert.throws(() => require("/foo/bar"));
  }

  @test async "Use static file system"() {
    try {
      // make sure semver is gone from node_modules
      fs.renameSync(`${__dirname}/../../node_modules/semver`, `${__dirname}/../../node_modules/sv`);
      // this should throw!
      assert.throws(() => fs.statSync(`${__dirname}/../../node_modules/semver`));
      // this should throw too.
      assert.throws(() => require("semver"));

      // now mount the svs
      const svs = new StaticFilesystem();
      svs.load(`${__dirname}/output.fs`);
      const undo = patchModuleLoader(svs, true);

      // now it should work!
      const semver = require("semver");
      assert.equal(true, semver.gt("1.0.2", "1.0.0"), "use semver");

    } finally {
      fs.renameSync(`${__dirname}/../../node_modules/sv`, `${__dirname}/../../node_modules/semver`);
    }
  }


}