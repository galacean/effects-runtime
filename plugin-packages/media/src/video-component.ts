import { spec, RendererComponent, effectsClass } from '@galacean/effects-core';

@effectsClass(spec.DataType.VideoComponent)
export class VideoComponent extends RendererComponent {
  override fromData (data: unknown): void {

    super.fromData(data);
  }
}
