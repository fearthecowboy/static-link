# Static Linker for NodeJS/Electron Apps

This utility provides a means to statically-link all your dependencies into a single static-filesystem that is patched into node's module loader.

## The Big Picture

Node.js has a great packaging system with `npm`. Deep down, it's pretty darn flexible, and handles an awful lot of situations just perfectly fine.

That being said, sometimes, you want a little less features, and a bit more rigidity:
- Sometimes, you don't want package resolution handled at install time. Yes, you can use shrinkwrapping or lock dependency versions, but that's only a small fix for a bigger problem.

- The more dependencies, the slower it gets. `Yarn` does an OK job of making it faster, but when you reference 15 packages, and they reference 15, you're over 200 before you blink. 

- Anti-malware software can impact installation speed by an order of magnitude with their "wait, I'm gonna lock that file for a moment, so I can scan it" ... Bless their hearts, I know they mean well, but ... that can hurt install speed something fierce. I've found that the per-file overhead to lock each file is much 
worse than the scan time itself.

- Bundling stuff up makes for tighter control of what goes with your app.

## Features 

This static linker performs the following:
- packs up all the files from some/all of your dependencies into a single file (aka a `static filesystem`)

- patches the node.js module loader to redirect module loading to the static filesystem. By default, it will try that first, and then fallback to the original behavior (ie, loading from `node_modules`). This can be configured so that once patched, it only loads from the static filesystem.

- patches `exec`, `fork`, `spawn` and friends so that when you spin up node.js child processes, it will inject the loader into the child process first, and then load modules from the packed filesystem. Using this you can embed other node.js apps in your static filesystem and run them out-of-proc easily. 

- When you add static dependencies, it still installs the module into your local `node_modules` during development, so that IDEs can find the files, so it doesn't change your development process at all.

- Requires very little configuration at all, and will work right out of the box for most situations.

## Is this better than Webpack (and the like)?

I'd like to think so, but your mileage may very.

I found webpack overly complex to configure, while it does a whole lotta stuff, it was like using a firehose to wash your dishes: yeah, it'll get the job done, but you're probably looking at a sink full of broken bits in the end.

Since this is specifically tailored towards node/electron apps and *not* the client side, you may find this useful when you're doing non-browser work.

I also wasn't fond of the invasive nature of hunting down `require` statements and rewriting them. 

## Getting Started: Quick and simple

To use static linking, in your `package.json` add:

#### a reference to the `static-link` package in your `devDependencies` 

``` js
  "devDependencies": {
    "static-link": "*"
  },
```

#### a `static-link` section that contains `dependencies` -- just like regular dependencies.

``` js
  "static-link": {
    "dependencies": {
      "chalk": "*",
      "marked": "*",
      "marked-terminal": "*",
      "yarn": "^1.1.0"
    }
  },
```  

#### a script to run the linker.

``` js
  "scripts": {
    "static-link": "static-link",   // use 'npm run static-link'
    "build" : "tsc && static-link"  // if you use a language with a compiler 
                                    // (like typescript or babel, etc), run 
                                    // static-link after you compile to patch your entrypoints
  },
```

Then run `npm run static-link` and it will:

- install dependencies into the `node_modules` for dev-time work, and create a `./dist/static_modules.fs` file that contains the modules.

- copy the `static-loader.js` file to the `./dist/` folder

- patch all entrypoints with the static loader so that it is enabled from any entrypoint.

It will skip the package install generation if the static-modules file is created and `package.json` hasn't changed.

Use `static-link --force` to do it anyway.


# Advanced Options

The `static-link` section has several options for controlling the process:

```js
...
  "static-link" : {
    "dependencies" : {
      // specify all your static package dependencies here. 
      // Just like regular dependencies, but nested in "static-link"
    },

    "entrypoints" : [
      // specify the entrypoints to your code here. 
      // This will default to anything in "main" or "bin"
      // or without those, the root "index.js" file
    ],

    "loader":     // the filename to copy the static loader code to. defaults to:
      "./dist/static-loader.js", 

    "filesystem": // the filename to create the static modules filesystem. defaults to:
      "./dist/static_modules.fs" 
  }

```

## Things Worth Noting:

- You'll want to run `static-link` right after you do an `npm install`. `npm` has a tendency to clean up modules that it doens't see used in your `dependencies` section, and since we keep the static-dependencies elsewhere, it may clean them up.

- if you use a transpiler of some kind, run `static-link` after that so it can patch the module entrypoints with the line of code to enable the patched module loader.

- if the package.json hasn't changed since the last time it created the static filesystem, `static-link` will skip the step of installing the packages and building the filesystem. If you need to force it, you can use `static-link --force`

- `static-link` essentially installs the static modules in your `node_modules` (for development time) and in a temp folder so it can capture the files as they should be laid out. It cleans up after itself, so you shouldn't have any problems with that.

- if a statically linked module uses anything other than `require` to load ancillary files from it's own folders, that'll fail right now. I have a fix on the way to support that. 

- internally, the static filesystem is mounting the the files at the root (ie, `/node_modules` this shouldn't affect anything, just thought you'd like to know...)

- on Windows it will internally `unixify` the filenames when it's dealing with the static filesystem. This would cause files to use forward slashes, and not have any drive letter. Again, this shouldn't affect anything.

- the static filesystem is laid out about as simple as it possibly can:

``` java
   // all integers are six-byte-big-endian values

   // header intformation 
   int dataOffset;            // offset in the file where the data streams are.
   int hashSize;              // number of bytes in the hashString
   byte[hashSize] hashString; // utf-8 encoded string for configuration file hashing
   
   // the index is a list of file entries. 
   {
     int nameSize;            // the size of the filename. (0 marks the end of the index. -- see 'zero')
     int dataSize;            // the length of the dataStream. 
     byte[nameSize] filename; // utf-8 encoded string for the filename
   }

   int zero;                  // 0 -- indicating the end of the index
   
   // starting at dataOffset, the data streams are laid out one after another 
   // the loader builds the index in memory and calulates the offset while it loads the index.
   {
     byte[dataSize];          // lather, rinse, repeat for each file.
   }
```