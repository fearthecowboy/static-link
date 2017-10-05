#!/usr/bin/env node
import { stat, execute, calculateHash, isFile, isDirectory, mkdir, rmdir, rmFile, rename, writeFile, copyFile, readFile } from "./lib/common";
import { resolve, dirname, join, basename, extname, relative } from "path";
import { mkdtempSync, rmdirSync, unlinkSync } from "fs"
import { tmpdir } from 'os';
import { StaticVolumeFile } from "./lib/static-filesystem";
import { StaticFilesystemCreator } from "./main"

function help(reason: string) {
  console.log("static-link");
  console.log(reason);
}

export type Licence = string /* [a-zA-Z] */ | LicenceObject;
export interface LicenceObject {
  type?: string; // [a-zA-Z]
  url?: string; // ^https?://
}

interface Package {

  name: string; // ^[A-Za-z](?:[_\.-]?[A-Za-z0-9]+)*$
  version: string; // ^\d+\.\d+\.\d+(?:-[a-z]+(?:[_\.-]*[a-z0-9]+)*)*$
  description: string;
  keywords: string /* ^[A-Za-z](?:[_\.-]?[A-Za-z0-9]+)*$ */[];
  author: string;
  contributors?: string[];
  maintainers?: string[];
  homepage: string; // ^https?://
  repository: string;
  man?: string | string[];
  bugs: string /* ^https?:// */ | {
    url: string; // ^https?://
    email?: string; // ^([0-9a-zA-Z]([-\.\w]*[0-9a-zA-Z])*@([0-9a-zA-Z][-\w]*[0-9a-zA-Z]\.)+[a-zA-Z]{2,9})$
  };
  license?: Licence;
  licenses: Licence[];
  private?: boolean;
  preferGlobal?: boolean;
  engines: Map<string, string>;
  engineStrict?: boolean;
  main: string;
  bin?: string | Map<string, string>;
  files?: string[];
  os?: string /* ^[A-Za-z](?:[_-]?[A-Za-z0-9]+)*$ */[];
  cpu?: string /* ^[A-Za-z](?:[_-]?[A-Za-z0-9]+)*$ */[];
  config?: {
  };
  publishConfig?: {
  };
  directories?: {
    lib?: string;
    bin?: string;
    man?: string;
    doc?: string;
    example?: string;
  };
  scripts: {
    test?: string; // [a-zA-Z]
  };
  dependencies: Map<string, string>;
  devDependencies: Map<string, string>;
  bundledDependencies?: Map<string, string>;
  bundleDependencies?: Map<string, string>;
  optionalDependencies?: Map<string, string>;
  peerDependencies?: Map<string, string>;
  "static-link"?: StaticLinkConfiguration;
}

interface StaticLinkConfiguration {
  filesystem?: string;
  loader?: string;
  entrypoints?: Array<string>;
  dependencies?: Map<string, string>;
}

async function yarnInstall(directory: string, pkgs: Array<string>) {
  const output = await execute(`${__dirname}/../node_modules/yarn/bin/yarn add --json ${pkgs.map((a) => `"${a}"`).join(' ')}`, { cwd: directory });
  // console.log(output.stdout);
  if (output.error) {
    throw Error(`Failed to install package '${pkgs}' -- ${output.error}`);
  }
}
async function npmInstall(directory: string, pkg: string) {
  const output = await execute(`${__dirname}/../node_modules/yarn/bin/yarn add --json "${pkg}"`, { cwd: directory });

  if (output.error) {
    throw Error(`Failed to install package '${pkg}' -- ${output.error}`);
  }
}

function getArg(arg: string): boolean | string | undefined {
  const match = `--${arg}`
  for (const each of process.argv.slice(2)) {
    if (each.startsWith(match)) {
      if (each === match) {
        return true;
      }
      const more = each.substr(match.length);
      switch (more.charAt(0)) {
        case ':':
        case '=':
          return more.substr(1);
      }
    }
  }
  return undefined;
}

async function backup(filename: string): Promise<() => void> {
  if (!await isFile(filename)) {
    // file doesn't exists, doesn't need restoring.
    return async () => {
      await rmFile(filename);
    };
  }
  const backupFile = join(dirname(filename), `${basename(filename)}.${Math.random() * 10000}${extname(filename)}`);

  // rename then copy preserves the file attributes when we restore.
  await rename(filename, backupFile);
  await copyFile(backupFile, filename);

  return async () => {
    await rmFile(filename);
    await rename(backupFile, filename);
  }
}

async function main() {
  // load package.json

  const pkgfile = resolve(getArg("input") || "./package.json");
  const force = getArg("force") == true;

  if (!(await isFile(pkgfile))) {
    return help("Unknown or missing project.json file.");
  }

  const basefolder = dirname(pkgfile);
  const restorePkgFile = await backup(pkgfile);
  const restorePkgLock = await backup(join(dirname(pkgfile), "package-lock.json"));
  const restoreYarnLock = await backup(join(dirname(pkgfile), "yarn.lock"));
  const restoreYarnIntegrity = await backup(join(dirname(pkgfile), "node_modules", ".yarn-integrity"));
  const minorTasks = new Array<any>();

  const workingdir = mkdtempSync(join(tmpdir(), "static_modules"));
  console.log(workingdir);

  try {
    const pkgJson = <Package>require(pkgfile);

    const config = pkgJson["static-link"];
    if (!config) {
      return help("no 'static-link' section in package.json.")
    }

    config.filesystem = resolve(config.filesystem || `${basefolder}/dist/static_modules.fs`);
    config.loader = config.loader || `${basefolder}/dist/static-loader.js`;
    if (!config.entrypoints) {
      config.entrypoints = new Array<string>();
      if (pkgJson.main) {
        if (typeof pkgJson.main === 'string') {
          config.entrypoints.push(pkgJson.main);
        } else {
          try {
            if ((await stat(`${basefolder}/index.js`)).isFile()) {
              config.entrypoints.push(`${basefolder}/index.js`);
            }
          } catch { }
        }
        if (typeof pkgJson.bin === 'string') {
          config.entrypoints.push(pkgJson.bin);
        }
        if (Array.isArray(pkgJson.bin)) {
          config.entrypoints.push(...pkgJson.bin);
        }
      }
    }
    if (!config.dependencies) {
      return help("packages to static link should be in 'static-link/dependencies' section");
    }

    // we got this far. looks like we should be able to do this.

    // copy the static loader into place. always a good idea.
    config.loader = resolve(basefolder, config.loader);
    const sourcefile = `${__dirname}/lib/static-loader.js`;
    let doCopy = force;

    try {
      doCopy = (await stat(sourcefile)).size !== (await stat(config.loader)).size;
    } catch {
      doCopy = true;
    }

    if (doCopy) {
      console.log(`> Writing static loader: ${config.loader}`);
      minorTasks.push(copyFile(sourcefile, config.loader));
    }

    // patch the entrypoints
    for (const each of config.entrypoints) {
      const entrypoint = resolve(basefolder, each);
      let loaderPath = relative(dirname(entrypoint), config.loader).replace(/\\/g, "/");
      if (loaderPath.charAt(0) != '.') {
        loaderPath = `./${loaderPath}`;
      }
      let fsPath = relative(dirname(entrypoint), config.filesystem).replace(/\\/g, "/");
      if (fsPath.charAt(0) != '.') {
        fsPath = `./${fsPath}`;
      }
      let content = <string>await readFile(entrypoint, { encoding: "utf8" });
      const patchLine = `require('${loaderPath}').load('${fsPath}')\n`;
      let prefix = "";
      if (content.indexOf(patchLine) == -1 || force) {
        const rx = /^#!.*$/gm.exec(content);
        if (rx && rx.index == 0) {
          prefix = `${rx[0]}\n`;
          // remove prefix
          content = content.replace(prefix, "");
        }
        // strip existing loader
        content = content.replace(/^require.*static-loader.js.*$/gm, "");
        content = content.replace(/\/\/ load static module: .*$/gm, "");
        content = content.trim();
        content = `${prefix}// load static module: ${fsPath}\n${patchLine}\n${content}`

        console.log(`> Patching Entrypoint: ${entrypoint}`);
        await writeFile(entrypoint, content);
      }
    }

    // if the fs exists, check the hash to see if we need to do this.
    const hash = calculateHash(config);

    try {
      if (isFile(config.filesystem)) {
        if (!force) {
          const svf = new StaticVolumeFile(config.filesystem);
          svf.shutdown();
          if (svf.hash === hash) {
            // hash matches the file
            console.log("File hash matches configuration hash: Skipping generating file system.");
            return;
          }
        }
        unlinkSync(config.filesystem);
      }
    } catch {
      // doens't appear so.
    }

    // install packages
    try {
      const all = new Array<any>();
      const set = new Array<string>();

      for (const pkg in config.dependencies) {
        const version = config.dependencies[pkg];
        console.log(`> Installing static dependency ${pkg}@${version} `)
        set.push(`${pkg}@${version}`)
      }
      all.push(yarnInstall(workingdir, set));
      all.push(yarnInstall(basefolder, set));
      await Promise.all(all);

      // we've installed everything
      // let's pack up the file
      const sf = new StaticFilesystemCreator();

      await sf.addFolder(`${workingdir}/node_modules`, "/node_modules");
      console.log(`> Writing filesystem: ${config.filesystem}`)
      await mkdir(dirname(config.filesystem));
      await sf.write(config.filesystem, hash);
    } finally {
    }

  }
  catch (err) {
    return help(err);
  }
  finally {
    await Promise.all(minorTasks);
    await restorePkgFile();
    await restorePkgLock();
    await restoreYarnLock();
    await restoreYarnIntegrity();
    if (workingdir) {
      await rmdir(workingdir);
    }
  }
}
main();