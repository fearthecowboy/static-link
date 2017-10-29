// this file gets dropped into the target application
// should be referenced from any entrypoint with something like:
// require ("./static-loader").LoadFileSystem("xxx")
// @modules 

import * as fs from 'fs'
import { patchModuleLoader } from "./patch-moduleloader";
import { StaticFilesystem } from "./static-filesystem";
import { patchFilesystem, IFileSystem } from "./patch-filesystem";
import { select } from "./common";
import { resolve } from 'path';
import { realpathSync } from 'fs';
import * as child_process from "child_process";
const Module = require("module");

if (require.main === module) {
  // this is for "fork mode" where we are forking a child process.
  // the first parameter should be this file.
  // the following parameter should be the static module file.
  const startpath = realpathSync(module.filename);
  for (let i = 0; i < process.argv.length; i++) {
    if (realpathSync(process.argv[i]) === startpath) {
      process.argv.splice(i, 1);
      while (i < process.argv.length && process.argv[i].startsWith("--load-module=")) {
        const staticModule = process.argv[i].split("=")[1];
        process.argv.splice(i, 1);
        load(staticModule);
      }
      if (process.argv.length < 2) {
        console.log("Missing module name to start.");
        process.exit(1);
      }
      // load the main module as if it were the real deal
      Module._load(process.argv[1], null, true);
      // Handle any nextTicks added in the first tick of the program
      (<any>process)._tickCallback();
      break;
    }
  }
}

const possibilities = [
  'node',
  'node.exe',
  process.execPath,
  process.argv[0]
];

function isNode(path: string): boolean {
  return possibilities.indexOf(path) > -1 ? true : false;
}

function indexAfterStartsWith(command: string, text: string): number {
  return command.startsWith(text) ? text.length : -1;
}

function startsWithNode(command: string): number {
  if (command.charAt(0) == '"') {
    // check includes quotes
    for (const each of possibilities) {
      const val = indexAfterStartsWith(command, `"${each}" `);
      if (val > -1) {
        return val
      }
    }
  } else {
    for (const each of possibilities) {
      const val = indexAfterStartsWith(command, `${each} `);
      if (val > -1) {
        return val
      }
    }
  }
  return -1;
}

function getInsertedArgs(loadedFileSystems: Array<string>): Array<string> {
  return select(loadedFileSystems, (p, c) => `--load-module=${c}`);
}

function getInsertedArgString(loadedFileSystems: Array<string>): string {
  return `${getInsertedArgs(loadedFileSystems).map((a) => `\"${a}\"`).join(' ')}`;
}

function padStart(str: string, targetLength: number, padString: string = ' ') {
  targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
  padString = String(padString || ' ');
  if (str.length > targetLength) {
    return String(str);
  }
  else {
    targetLength = targetLength - str.length;
    if (targetLength > padString.length) {
      padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
    }
    return padString.slice(0, targetLength) + String(str);
  }
};

function padEnd(str: string, targetLength: number, padString: string = ' ') {
  targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
  padString = String(padString || ' ');
  if (str.length > targetLength) {
    return String(str);
  }
  else {
    targetLength = targetLength - str.length;
    if (targetLength > padString.length) {
      padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
    }
    return String(str) + padString.slice(0, targetLength);
  }
};

export function list(staticModule: string) {
  const svs = new StaticFilesystem();
  svs.load(staticModule);
  const dir = new Array<any>();
  const files = {};
  for (const each of svs.entries) {
    const st = svs.statSync(each);
    if (!st.isFile()) {
      dir.push(`${padStart('<dir>', 12)}   ${each}`);
    } else {
      files[each] = `${padStart(`${st.size}`, 12)}   ${each}`;;
    }
  }
  for (const each of dir.sort()) {
    console.log(each);
  }
  for (const each of Object.keys(files).sort()) {
    console.log(files[each]);
  }
  svs.shutdown();
}

function existsInFs(svs: StaticFilesystem, filePath: string): boolean {
  try {
    return svs.statSync(filePath) ? true : false;
  } catch { }
  return false;
}

export function load(staticModule: string) {
  if (!((<any>global).staticloader)) {
    (<any>global).staticloader = {};
    const svs = new StaticFilesystem();
    // first patch the require 
    const undo_loader = patchModuleLoader(svs);
    const fsRFS = fs.readFileSync;
    const undo_fs = patchFilesystem(<IFileSystem><any>{
      readFileSync: (path, options): string | Buffer => {
        try {
          if (svs.statSync(path)) {
            return svs.readFileSync(path, options);
          }
        } catch {
        }
        return fsRFS(path, options);
      }
    });
    ((<any>global).staticloader).undo = () => { undo_fs(); undo_loader(); };
    ((<any>global).staticloader).staticfilesystem = svs;

    // hot-patch process.exit so that when it's called we shutdown the patcher early
    // can't just use the event because it's not early enough
    const process_exit = process.exit;
    process.exit = (n): never => {
      // unlocks the files.
      svs.shutdown();

      // remove the patching
      ((<any>global).staticloader).undo();

      // keep going
      return process_exit(n);
    }

    const fork = child_process.fork;
    const spawn = child_process.spawn;
    const exec = child_process.exec;

    const spawnSync = child_process.spawnSync;
    const execSync = child_process.execSync;

    // hot-patch fork so we can make child processes work too.
    (<any>child_process).fork = (modulePath: string, args?: string[], options?: child_process.ForkOptions): child_process.ChildProcess => {

      if (args && existsInFs(svs, modulePath)) {
        return fork(__filename, [...getInsertedArgs(svs.loadedFileSystems), modulePath, ...Array.isArray(args) ? args : [args]], options)
      } else {
        return fork(__filename, args, options);
      }
    }

    // hot-patch spawn so we can patch if you're actually calling node.
    (<any>child_process).spawn = (command: string, args?: string[], options?: child_process.SpawnOptions): child_process.ChildProcess => {
      if (args && (Array.isArray(args) || typeof args !== 'object') && isNode(command) && existsInFs(svs, args[0])) {
        return (<any>spawn)(command, [__filename, ...getInsertedArgs(svs.loadedFileSystems), ...Array.isArray(args) ? args : [args]], options);
      }
      return (<any>spawn)(command, args, options);
    }

    (<any>child_process).spawnSync = (command: string, args?: string[], options?: child_process.SpawnOptions): child_process.ChildProcess => {
      if (args && (Array.isArray(args) || typeof args !== 'object') && isNode(command) && existsInFs(svs, args[0])) {
        return (<any>spawnSync)(command, [__filename, ...getInsertedArgs(svs.loadedFileSystems), ...Array.isArray(args) ? args : [args]], options);
      }
      return (<any>spawnSync)(command, args, options);
    }

    (<any>child_process).exec = (command: string, options, callback): child_process.ChildProcess => {
      const pos = startsWithNode(command);
      if (pos > -1) {
        return (<any>exec)(`${command.substring(0, pos)} "${__filename}" ${getInsertedArgString(svs.loadedFileSystems)} ${command.substring(pos)}`, options, callback);
      }
      // console.log(`exec ${command} ${JSON.stringify({ options }, null, "  ")}`);
      return (<any>exec)(command, options, callback);
    }

    (<any>child_process).execSync = (command: string, options): child_process.ChildProcess => {
      const pos = startsWithNode(command);
      if (pos > -1) {
        return (<any>execSync)(`${command.substring(0, pos)} "${__filename}" ${getInsertedArgString(svs.loadedFileSystems)} ${command.substring(pos)}`, options);
      }
      // console.log(`execSync ${command} ${JSON.stringify({ options }, null, "  ")}`);
      return (<any>execSync)(command, options);
    }
  }
  ((<any>global).staticloader).staticfilesystem.load(staticModule);
}

export function unload(staticModule: string) {
  if (((<any>global).staticloader).undo) {
    const svs = (<StaticFilesystem>(((<any>global).staticloader).staticfilesystem));
    svs.unload(staticModule);
  }
}
// @impls 
