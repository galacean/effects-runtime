import { registerPlugin, VFXItem } from '@galacean/effects';
import { RichTextLoader } from './video-loader';

registerPlugin('richtext', RichTextLoader, VFXItem, true);
