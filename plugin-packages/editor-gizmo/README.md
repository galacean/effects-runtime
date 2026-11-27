# Galacean Effects Editor Gizmo Plugin

Editor interaction and scene gizmos for Galacean Effects.

- **2D**: selection, translation, resizing, rotation, text editing, image cropping,
  viewport navigation and frame layout.
- **3D**: transform handles, camera and light gizmos, geometry and wireframes.

## Usage

```ts
import { Editor } from '@galacean/effects-plugin-editor-gizmo';

const editor = new Editor(engine);
composition.addItem(editor.rootItem);
editor.setMode('3d');
```

The editor starts in 2D. Its `editor2D` and `editor3D` controls share
`editor.selection` and stay mounted when the active mode changes. Importing the package registers the `editor-gizmo` plugin. Keep its version
aligned with `@galacean/effects`.

## Source layout

- `src/2d/`: 2D interaction, selection, viewport and layout helpers.
- `src/3d/`: 3D gizmos, geometry, wireframes and plugin loader.
- `../../web-packages/test/unit/src/plugin-editor-gizmo/`: unit tests.

## Development

```bash
pnpm --filter @galacean/effects-plugin-editor-gizmo dev
```

Open [the demo](http://localhost:8081/demo/index.html).

Build the plugin:

```bash
pnpm --filter @galacean/effects-plugin-editor-gizmo build
```

Run the shared unit tests:

```bash
pnpm test
```

Open [the unit tests](http://localhost:9090/unit/index.html).
