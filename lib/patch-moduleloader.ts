import { readFileSync, PathLike, Stats } from 'fs';

import { isWindows, unixifyPath, isWindowsPath } from './common';
import { resolve, isAbsolute } from 'path'


const makeLong: (filepath: string) => string = (require('path'))._makeLong || resolve;

export interface IModule {
  _extensions: Map<string, () => void>;
  _originalFindPath(request: string, searchPaths: Array<string>, isMain: boolean);
  _alternateFindPath(request: string, searchPaths: Array<string>, isMain: boolean);
  _findPath(request: string, searchPaths: Array<string>, isMain: boolean);
  _pathCache: any;
  _fallback: boolean;
}

export interface IReadOnlySynchronousFileSystem {
  readFileSync(path: PathLike | number, options?: { encoding?: string | null; flag?: string; } | string | null): string | Buffer;
  realpathSync(path: PathLike, options?: { encoding?: string | null } | string | null): string;
  statSync(path: PathLike): Stats;
}

function stripBOM(content: string): string {
  return content && content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
}

function unixifyVolume(volume: IReadOnlySynchronousFileSystem): IReadOnlySynchronousFileSystem {
  return isWindows ? {
    readFileSync: (path: PathLike, options?: { encoding?: string | null; flag?: string; } | string | null) => volume.readFileSync(unixifyPath(path), options),
    realpathSync: (path: PathLike, options?: { encoding?: string | null } | string | null) => volume.realpathSync(unixifyPath(path)),
    statSync: (path) => volume.statSync(unixifyPath(path))
  } : volume;
}

export function patchModuleLoader(volume: IReadOnlySynchronousFileSystem, enablePathNormalization = false, Module: IModule = require('module')): () => void {
  const backup = { ...Module };
  const preserveSymlinks = false;
  const statcache = {};
  const packageMainCache = {};

  if (enablePathNormalization) {
    volume = unixifyVolume(volume);
  }

  // Used to speed up module loading.  Returns the contents of the file as
  // a string or undefined when the file cannot be opened.  The speedup
  // comes from not creating Error objects on failure.
  function internalModuleReadFile(path: string): string | undefined {
    try { return <string>volume.readFileSync(path, 'utf8'); } catch { }
    return undefined;
  }

  // Used to speed up module loading.  Returns 0 if the path refers to
  // a file, 1 when it's a directory or < 0 on error (usually -ENOENT.)
  // The speedup comes from not creating thousands of Stat and Error objects.
  function internalModuleStat(filename: string): number {
    try { return volume.statSync(filename).isDirectory() ? 1 : 0; } catch { }
    return -2; // ENOENT
  }

  function stat(filename: string): number {
    filename = makeLong(filename);
    const result = statcache[filename];
    return (result !== undefined) ? result : statcache[filename] = internalModuleStat(filename);
  }

  function readPackage(requestPath) {
    const entry = packageMainCache[requestPath];
    if (entry) {
      return entry;
    }

    const jsonPath = resolve(requestPath, 'package.json');
    const json = internalModuleReadFile(makeLong(jsonPath));

    if (json === undefined) {
      return false;
    }

    let pkg;
    try {
      pkg = packageMainCache[requestPath] = JSON.parse(json).main;
    } catch (e) {
      e.path = jsonPath;
      e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
      throw e;
    }
    return pkg;
  }

  function tryFile(requestPath: string, isMain: boolean): string | undefined {
    if (preserveSymlinks && !isMain) {
      return stat(requestPath) === 0 ? resolve(requestPath) : undefined;
    }
    return stat(requestPath) === 0 ? volume.realpathSync(requestPath) : undefined;
  }

  // given a path check a the file exists with any of the set extensions
  function tryExtensions(p, exts, isMain): string | undefined {
    for (let i = 0; i < exts.length; i++) {
      const filename = tryFile(p + exts[i], isMain);
      if (filename) {
        return filename;
      }
    }
    return undefined;
  }

  function tryPackage(requestPath, exts, isMain): string | undefined {
    let pkg = readPackage(requestPath);

    if (pkg) {
      let filename = resolve(requestPath, pkg);
      return tryFile(filename, isMain) ||
        tryExtensions(filename, exts, isMain) ||
        tryExtensions(resolve(filename, 'index'), exts, isMain);
    }
    return undefined;
  }

  // Native extension for .js
  Module._extensions['.js'] = (module, filename) => {
    if (stat(filename) == 0) {
      module._compile(stripBOM(<string>volume.readFileSync(filename, 'utf8')), filename);
    } else if (Module._fallback) {
      module._compile(stripBOM(readFileSync(filename, 'utf8')), filename);
    }
  };

  // Native extension for .json
  Module._extensions['.json'] = (module, filename) => {
    if (stat(filename) == 0) {
      try {
        module.exports = JSON.parse(stripBOM(<string>volume.readFileSync(filename, 'utf8')));
      } catch (err) {
        throw { ...err, message: filename + ': ' + err.message }
      }
    } else if (Module._fallback) {
      try {
        module.exports = JSON.parse(stripBOM(readFileSync(filename, 'utf8')));
      } catch (err) {
        throw { ...err, message: filename + ': ' + err.message }
      }

    }
  };

  Module._findPath = (request: string, paths: Array<string>, isMain: boolean): string | false => {
    const result = Module._alternateFindPath(request, paths, isMain);
    return (!result && Module._fallback) ? Module._originalFindPath(request, paths, isMain) : result;
  }

  Module._originalFindPath = Module._findPath;
  Module._alternateFindPath = (request: string, paths: Array<string>, isMain: boolean): string | false => {
    if (!request) {
      return false;
    }
    if (isAbsolute(request)) {
      paths = [''];
    } else if (!paths || paths.length === 0) {
      return false;
    }

    const cacheKey = request + '\x00' + (paths.length === 1 ? paths[0] : paths.join('\x00'));
    const entry = Module._pathCache[cacheKey];
    if (entry) {
      return entry;
    }

    const trailingSlash = request.charCodeAt(request.length - 1) === 47;

    // For each path
    //for (var i = 0; i < paths.length; i++) {
    for (const curPath of paths) {
      // Don't search further if path doesn't exist

      if (curPath && stat(curPath) < 1) {
        continue;
      }

      let basePath = resolve(curPath, request);
      let rc = stat(basePath);

      // check if this is a windows paths and if it should be corrected
      if (rc < 0 && isWindowsPath(basePath)) {
        // uncorrected path doesn't work, maybe the correctedPath?
        let correctedPath = unixifyPath(basePath);
        rc = stat(correctedPath);
        if (rc >= 0) {
          // that looks pretty good, let's go with that.
          basePath = correctedPath;
        }
      }

      let filename: string | undefined;
      const exts = Object.keys(Module._extensions);
      if (!trailingSlash) {
        switch (rc) {
          case 0:
            filename = (preserveSymlinks && !isMain) ? resolve(basePath) : volume.realpathSync(basePath);
            break;
          case 1:
            filename = tryPackage(basePath, exts, isMain);
            break;
        }

        if (!filename) {
          // try it with each of the extensions
          filename = tryExtensions(basePath, exts, isMain);
        }
      }

      if (!filename && rc === 1) {  // Directory.
        filename = tryPackage(basePath, exts, isMain) || tryExtensions(resolve(basePath, 'index'), exts, isMain);
      }

      if (filename) {
        Module._pathCache[cacheKey] = filename;
        return filename;
      }
    }
    return false;
  };

  // magic sauce to revert the patching.
  return () => {
    Module._extensions['.js'] = backup._extensions['.js'];
    Module._extensions['.json'] = backup._extensions['.json'];
    Module._findPath = backup._findPath;
  }
}