import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as assert from "assert";
import { tmpdir } from 'os'
import { mkdtempSync } from 'fs'
import { mkdir, cat, cd } from 'shelljs'
import { join, resolve } from 'path';
import { backup, rmdir, writeFile, execute } from '../lib/common';

import { StaticFilesystemCreator, StaticFilesystem, calculateHash } from "../main"

@suite class StaticLoader {
  @test async "CreateSampleApp"() {

    // create tempdir
    const workingdir = mkdtempSync(join(tmpdir(), "CreateStaticApp"));
    console.log(workingdir);
    try {
      // change to temp
      cd(workingdir);

      // create package.json
      await writeFile(`${workingdir}/package.json`, JSON.stringify({
        "name": "sampleapp",
        "version": "0.1.0",
        "description": "sampleApp is here.",
        "bin": {
          "main": "./main.js",
          "main2": "./main2.js"
        },
        "devDependencies": {
          "static-link": resolve(__dirname, "..", "..")
        },
        "static-link": {
          "dependencies": {
            "yarn": "^1.1.0"
          }
        },
        "scripts": {
          "static-link": "static-link --force",
        },
      }, null, " "));
      // create app script 
      await writeFile(`${workingdir}/main.js`, `
const fs = require("fs")
const main2 = require("./main2");
console.log("main-ok");
main2.doIt();
`);

      await writeFile(`${workingdir}/main2.js`, `
const fs = require("fs")
const cp = require("child_process");

// get the entrypoint for yarn.
const ypkg = require('yarn/package.json').bin;
const yarn = require.resolve(\`yarn/\${ypkg.yarn }\`);

function doIt() {
  console.log("main2-ok");
  console.log("running yarn --help");
  cp.exec( \`node \${yarn} --help\`, (err,s,e)=> {
    console.log(s);
  } );
}
 
module.exports.doIt = doIt;
`);

      // run npm install
      const output = await execute(`npm install`, { cwd: workingdir });
      assert.equal(output.error || null, null, `npm install failed ${output.stdout}`);

      // run npm run static-link
      const slink = await execute(`npm run static-link`, { cwd: workingdir });
      assert.equal(slink.error || null, null, `npm run static-link failed ${slink.stdout}`);

      // run node main.js
      const m = await execute(`node ./main.js`, { cwd: workingdir });
      if (m.code) {
        console.log(m.stdout);
        console.log(m.stderr);
      }
      assert.equal(m.stdout.indexOf("main-ok") > -1, true, "main-ok found");
      assert.equal(m.stdout.indexOf("main2-ok") > -1, true, "main2-ok found");
      assert.equal(m.stdout.indexOf("ignore platform checks") > -1, true, "yarn ran.");

      // this test proves that 
      /*
        - one file can still load another in the same project (ie, passthru works).
        - we can find a module in the static filesystem and can call exec on it.
      */
    }
    finally {
      await rmdir(workingdir);
    }
  }
}