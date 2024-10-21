import { registerPlugin, VFXItem } from '@galacean/effects';
import { RichTextLoader } from './video-loader';

export * from './video-component';

registerPlugin('richtext', RichTextLoader, VFXItem, true);
