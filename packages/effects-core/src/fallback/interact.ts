import type { InteractContent, InteractOption } from '@galacean/effects-specification';
import { InteractType, InteractBehavior } from '@galacean/effects-specification';
import { ensureRGBAValue } from './utils';

export function getStandardInteractContent (ui: any): InteractContent {
  const options = ui.options;
  let option: InteractOption;

  switch (options.type) {
    case 'click': {
      option = {
        type: InteractType.CLICK,
        showPreview: options.showPreview,
        previewColor: options.previewColor && ensureRGBAValue(options.previewColor),
        behavior: options.behavior || InteractBehavior.NOTIFY,
      };

      break;
    }
    case 'drag': {
      option = {
        type: InteractType.DRAG,
        enableInEditor: !!options.enableInEditor,
        dxRange: options.dxRange,
        dyRange: options.dyRange,
        target: options.target,
      };

      break;
    }
    case 'message': {
      option = {
        type: InteractType.MESSAGE,
      };

      break;
    }
    default: {
      break;
    }
  }

  const ret: InteractContent = {
    // @ts-expect-error
    options: option,
  };

  return ret;
}
