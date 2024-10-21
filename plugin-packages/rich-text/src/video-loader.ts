import type { SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';

export class RichTextLoader extends AbstractPlugin {
  static override async processAssets (
    json: spec.JSONScene,
    options: SceneLoadOptions = {},
  ) {
  }
}
