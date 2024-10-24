import { registerPlugin, VFXItem } from '@galacean/effects';
import { RichTextLoader } from './video-loader';

export * from './rich-text-parser';
export * from './rich-text-component';
registerPlugin('richtext', RichTextLoader, VFXItem, true);
