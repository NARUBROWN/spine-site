English | [Korean](README.ko.md)

# Spine Documentation

Multilingual documentation for the [Spine framework](https://github.com/NARUBROWN/spine) and [Spine CLI](https://github.com/NARUBROWN/spine-cli), built with VitePress. Covers getting started, execution contracts, platform integration, and migration guides.

[Read the documentation](https://spine.na2ru2.me/en/)

## Local development

Install Node.js and npm, then run from the repository root:

```sh
npm ci
npm run docs:dev
```

## Build and preview

```sh
npm run docs:build
npm run docs:preview
```

The documentation source is under `docs/`. VitePress generates the static site in `docs/.vitepress/dist`.
