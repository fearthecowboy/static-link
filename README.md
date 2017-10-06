# Static Linker for NodeJS/Electron Apps

This utility provides a means to statically-link all your dependencies into a single static-filesystem that is patched into node's module loader.

(details coming soon...)

In your `package.json` add:

- a reference to `static-link` in your `devDependencies` 
- a `static-link` section that contains `dependencies` -- just like regular deps.
- a script to run the linker 


``` json
{
  "devDependencies": {
    "static-link": "*"
  },
  "static-link": {
    "dependencies": {
      "chalk": "*",
      "marked": "*",
      "marked-terminal": "*",
      "yarn": "^1.1.0"
    }
  },
  "scripts": {
    "static-link": "static-link",
  }
}
```

Then run `npm run static-link` and it will:

- install dependencies into the `node_modules` for dev-time work, and create a `./dist/static_modules.fs` file that contains the modules.
- copy the `static-loader.js` file to the `./dist/` folder
- patch all entrypoints with the static loader so that it is enabled from any entrypoint.


# Advanced Options

The `static-link` section has several options for controlling the process:


```js
...
  static-link : {
    dependencies : {
      // specify all your static package dependencies here
    },
    entrypoints : [
      // specify the entrypoints to your code here. 
      // This will default to anything in "main" or "bin" or the root "index.js" file
    ],
    loader: "./dist/static-loader.js", // the filename to copy the static loader code to.
    filesystem: "./dist/static_modules.fs" // the filename to create the static modules filesystem
  }

```

