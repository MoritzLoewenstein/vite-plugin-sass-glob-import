## Note

Fork of [vite-plugin-sass-glob-import](https://github.com/cmalven/vite-plugin-sass-glob-import) which implements some stuff:

- Use namespaces (`@use "foo/a/bar.scss" as bar_1;`) to glob import multiple files with the same name (`@use "./foo/*/bar.scss";`)
- TODO: vite-rolldown hook filters: https://rolldown.rs/plugins/hook-filters

# vite-plugin-sass-glob-import

> Use glob syntax for @import or @use in your main Sass or SCSS file.

## Install

```shell
npm i -D vite-plugin-sass-glob-import
```

```js
// In vite.config.js

import { defineConfig } from "vite";
import sassGlobImports from "vite-plugin-sass-glob-import";

export default defineConfig({
  plugins: [sassGlobImports()],
});
```

## Usage

**Note:** Globbing only work in a top-level file, not within referenced files.

```scss
// In src/styles/main.scss

@use "vars/**/*.scss";
@import "utils/**/*.scss";
@import "objects/**/*.scss";
```

The above will be transformed into something like the following before Vite processes it with Sass:

```scss
@use "vars/var-a.scss";
@use "vars/var-b.scss";
@import "utils/utils-a.scss";
@import "utils/utils-b.scss";
@import "objects/objects-a.scss";
@import "objects/objects-b.scss";
@import "objects/objects-c.scss";
```

## Caveats

This plugin is intentionally simple and doesn't attempt to support every feature offered by Vite. If your use-case isn't similar to the examples in the README above, it probably isn't supported by this plugin.
