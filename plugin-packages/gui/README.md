# @galacean/effects-plugin-gui

Concrete GUI behavior for Galacean Effects. The core package owns only the
`Control`, `Container`, GUI roots and input bridge
protocols; automatic layout algorithms and future widgets/themes belong here.

The package currently exports:

- `BoxContainer`, `HBoxContainer`, `VBoxContainer`
- `GridContainer`
- `MarginContainer`
- `CenterContainer`
- `AspectRatioContainer`

Importing the package does not register a plugin and has no logging side
effects. Create controls with the same `Engine` used by the owning GUI tree.

```ts
import type { Engine } from '@galacean/effects';
import { Control, SizeFlags } from '@galacean/effects';
import { HBoxContainer } from '@galacean/effects-plugin-gui';

function createRow (engine: Engine): HBoxContainer {
  const row = new HBoxContainer(engine);
  const child = new Control(engine);

  row.setThemeConstantOverride('separation', 12);
  child.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
  row.addChild(child);

  return row;
}
```
