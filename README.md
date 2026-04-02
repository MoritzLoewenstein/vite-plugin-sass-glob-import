## Note

Fork of [vite-plugin-sass-glob-import](https://github.com/cmalven/vite-plugin-sass-glob-import) which implements some stuff:

- Use namespaces (`@use "foo/a/bar.scss" as bar_1;`) to glob import multiple files with the same name (`@use "./foo/*/bar.scss";`)
- Removed `@import` support
- Vite watcher support

# vite-plugin-sass-glob-import

> Use glob syntax for @use in your main Sass or SCSS file.

## Install

```shell
npm i -D @moritzloewenstein/vite-plugin-sass-glob-import
```

```js
// In vite.config.js

import { defineConfig } from "vite";
import sassGlobImports from "@moritzloewenstein/vite-plugin-sass-glob-import";

export default defineConfig({
  plugins: [sassGlobImports()],
});
```

## Usage

**Note:** Globbing only work in a top-level file, not within referenced files.

```scss
// In src/styles/main.scss

@use "vars/**/*.scss";
@use "utils/**/*.scss";
@use "objects/**/*.scss";
```

The above will be transformed into something like the following before Vite processes it with Sass:

```scss
@use "vars/var-a.scss";
@use "vars/var-b.scss";
@use "utils/utils-a.scss";
@use "utils/utils-b.scss";
@use "objects/objects-a.scss";
@use "objects/objects-b.scss";
@use "objects/objects-c.scss";
```

## Caveats

This plugin is intentionally simple and doesn't attempt to support every feature offered by Vite. If your use-case isn't similar to the examples in the README above, it probably isn't supported by this plugin.
